/**
 * daily-sheet-builder.ts
 *
 * Geração da Ficha Diária de Operador — consolidação das 24h de cada equipamento.
 *
 * Dia operacional: 00:00:00 a 23:59:59 no timezone America/Sao_Paulo (UTC-3).
 * Fontes em ordem de prioridade:
 *   1. mobile-events.json  — eventos aceitos pelo batch (por equipmentId OU fleetCode)
 *   2. live-state.json     — fallback quando não há eventos mas máquina está ativa
 *   3. trails/*.json       — pontos GPS para cálculo de distância/tempo
 */

import { ServerStorage } from '@/lib/server-storage';
import { CadastroStorage } from '@/lib/cadastro-storage';
import type { MobileEvent } from '@/lib/server-storage';
import type { TrailPoint } from '@/lib/types';
import { calculateJourneyHourmeter } from '@/lib/operational/journey-hourmeter-calculator';

// ── Constants ────────────────────────────────────────────────────────────────
const GPS_GAP_LIMIT_MIN       = 30;   // gap > 30 min → tempo indeterminado
const INDETERMINATE_LIMIT_PCT = 50;   // > 50% indeterm. → alerta
const BRT_OFFSET_HOURS        = 3;    // UTC-3 (America/Sao_Paulo, sem DST)

// ── Inconsistency codes ──────────────────────────────────────────────────────
export const DAILY_INCONSISTENCY = {
  SEM_HORIMETRO_INICIAL:               'SEM_HORIMETRO_INICIAL',
  JOURNEY_END_SEM_HORIMETRO_FINAL:     'JOURNEY_END_SEM_HORIMETRO_FINAL',
  SEM_HORIMETRO_FINAL_APOS_FECHAMENTO: 'SEM_HORIMETRO_FINAL_APOS_FECHAMENTO (alerta)',
  HORIMETRO_FINAL_MENOR_QUE_INICIAL:   'HORIMETRO_FINAL_MENOR_QUE_INICIAL',
  TOTAL_HORAS_INCONSISTENTE:           'TOTAL_HORAS_INCONSISTENTE',
  OPERADOR_NAO_IDENTIFICADO:           'OPERADOR_NAO_IDENTIFICADO',
  MATRICULA_INVALIDA:                  'MATRICULA_INVALIDA (alerta)',
  OPERACAO_NAO_INFORMADA:              'OPERACAO_NAO_INFORMADA (alerta)',
  OS_NAO_INFORMADA:                    'OS_NAO_INFORMADA (alerta)',
  IMPLEMENTO_NAO_INFORMADO:            'IMPLEMENTO_NAO_INFORMADO (alerta)',
  SEM_EVENTOS_GPS:                     'SEM_EVENTOS_GPS (alerta)',
  SEM_HEARTBEAT:                       'SEM_HEARTBEAT (alerta)',
  TEMPO_INDETERMINADO_ACIMA_LIMITE:    'TEMPO_INDETERMINADO_ACIMA_LIMITE (alerta)',
  MULTIPLAS_JORNADAS_ATIVAS:           'MULTIPLAS_JORNADAS_ATIVAS',
  FROTA_NAO_IDENTIFICADA:              'FROTA_NAO_IDENTIFICADA',
} as const;

// ── Types ────────────────────────────────────────────────────────────────────
export interface JourneySummary {
  journeyId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  hourmeterStart: number | null;
  hourmeterEnd: number | null;
  totalHourmeter: number | null;
  operatorRegistration: string | null;
  operatorName: string | null;
  operationCode: string | null;
  operationName: string | null;
  implementCode: string | null;
  implementName: string | null;
  workOrderNumber: string | null;
  costCenterName: string | null;
  stops: StopDiaria[];
  hasJourneyEnd: boolean;
}

export interface StopDiaria {
  code: string;
  description: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
}

export type FichaDiariaStatus =
  | 'EM_ANDAMENTO'
  | 'PENDENTE'
  | 'FINALIZADO'
  | 'INCONSISTENTE'
  | 'VALIDADO';

export interface FichaDiaria {
  /** Chave: tenantId|fleetCode|date */
  id: string;
  date: string;               // YYYY-MM-DD
  periodStart: string;        // ISO — 00:00:00 BRT como UTC
  periodEnd: string;          // ISO — 23:59:59 BRT como UTC
  tenantId: string;
  fleetCode: string;
  equipmentId: string;
  operatorRegistration: string | null;
  operatorName: string | null;
  operationCode: string | null;
  operationName: string | null;
  implementCode: string | null;
  implementName: string | null;
  workOrderNumber: string | null;
  costCenterName: string | null;
  hourmeterStart: number | null;
  hourmeterCurrent: number | null;
  hourmeterEnd: number | null;
  totalHourmeter: number | null;
  durationMinutes: number | null;
  minutesOperating: number | null;
  minutesStopped: number | null;
  minutesUndetermined: number | null;
  pctUndetermined: number | null;
  startedAt: string | null;
  endedAt: string | null;
  journeys: JourneySummary[];
  stops: StopDiaria[];
  trailSummary: {
    points: number;
    firstGpsAt: string | null;
    lastGpsAt: string | null;
    distanceKm: number;
  };
  status: FichaDiariaStatus;
  inconsistencies: string[];
  validated: boolean;
  validatedBy?: string | null;
  validatedAt?: string | null;
  eventCount: number;
  isDayOpen: boolean;
  /** true quando gerada a partir do live-state por ausência de eventos */
  fromLiveState?: boolean;
}

export type BuildDailyResult =
  | { ok: true;  ficha: FichaDiaria }
  | { ok: false; status: number; error: string };

// ── Primitive helpers ─────────────────────────────────────────────────────────
function asStr(v: unknown): string {
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

export function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw) return null;
  const normalized = raw.includes(',') && raw.includes('.')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function calculateTotalHours(start: unknown, end: unknown): number | null {
  const hStart = toNumber(start);
  const hEnd = toNumber(end);
  if (hStart === null || hEnd === null) return null;
  const total = hEnd - hStart;
  if (total < 0) return null;
  return Math.round(total * 100) / 100;
}

function minutesBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const diff = (new Date(b).getTime() - new Date(a).getTime()) / 60000;
  return Number.isFinite(diff) ? Math.round(diff) : null;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcDistanceKm(pts: TrailPoint[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    total += haversineKm(pts[i - 1].latitude, pts[i - 1].longitude, pts[i].latitude, pts[i].longitude);
  }
  return Math.round(total * 10) / 10;
}


// ── Operator normalization ────────────────────────────────────────────────────
/**
 * Garante que operatorName e operatorRegistration vêm do MESMO registro de cadastro.
 * Evita mistura de nome de um operador com matrícula de outro.
 * Prioridade: registration > name > id
 */
function normalizeOperatorFromCadastro(
  tenantId: string,
  registration: string | null,
  name: string | null,
): { registration: string | null; name: string | null } {
  if (!registration && !name) return { registration, name };

  try {
    const ops = CadastroStorage.getAll(tenantId, 'operadores') as Array<Record<string, unknown>>;

    // 1. Exact match by registration (most reliable)
    let found: Record<string, unknown> | undefined;
    if (registration) {
      found = ops.find(o => asStr(o.registration) === registration);
    }

    // 2. Match by name (if registration not found)
    if (!found && name) {
      found = ops.find(o => asStr(o.name).toUpperCase() === name.toUpperCase());
    }

    // 3. Match by id (APK may send internal id as operatorRegistration)
    if (!found && registration) {
      found = ops.find(o => asStr(o.id) === registration);
    }

    if (found) {
      const resolvedReg  = asStr(found.registration) || registration;
      const resolvedName = asStr(found.name)         || name;
      if (resolvedReg !== registration || resolvedName !== name) {
        console.info(
          '[daily-sheet-builder] operator normalized' +
          ' reg: ' + String(registration) + ' -> ' + String(resolvedReg) +
          ' name: ' + String(name) + ' -> ' + String(resolvedName)
        );
      }
      return { registration: resolvedReg, name: resolvedName };
    }
  } catch {
    // Cadastro unavailable — return as-is
  }

  return { registration, name };
}

function pick(...values: unknown[]): string | null {
  for (const v of values) {
    const s = asStr(v);
    if (s) return s;
  }
  return null;
}

function normalizeComparable(value: string | null | undefined): string {
  return asStr(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function resolveCostCenter(
  tenantId: string,
  rawCostCenter: unknown,
  operationValues: Array<unknown>,
  workOrderNumber: unknown = null,
): string | null {
  const costCenter = asStr(rawCostCenter);
  const comparable = normalizeComparable(costCenter);
  try {
    const findMatch = (items: Array<Record<string, unknown>>, value: unknown): Record<string, unknown> | null => {
      const needle = normalizeComparable(asStr(value));
      if (!needle) return null;
      return items.find(item =>
        [item.id, item.code, item.name, item.description].some(candidate => normalizeComparable(asStr(candidate)) === needle)
      ) ?? null;
    };
    const costCenters = CadastroStorage.getAll(tenantId, 'centros-custo') as Array<Record<string, unknown>>;
    const workOrders = CadastroStorage.getAll(tenantId, 'ordens-servico') as Array<Record<string, unknown>>;
    const workOrderId = asStr(workOrderNumber);
    if (workOrderId) {
      const workOrder = findMatch(workOrders, workOrderId);
      const costCenterId = asStr(workOrder?.costCenterId);
      if (costCenterId) {
        const resolved = findMatch(costCenters, costCenterId);
        const canonical = asStr(resolved?.code) || asStr(resolved?.name);
        if (canonical) return canonical;
      }
    }
    const operationCatalog = CadastroStorage.getAll(tenantId, 'operacoes') as Array<Record<string, unknown>>;
    const operationValuesFromCatalog = new Set<string>();
    for (const op of operationCatalog) {
      for (const candidate of [op.code, op.type, op.name, op.description]) {
        const normalized = normalizeComparable(asStr(candidate));
        if (normalized) operationValuesFromCatalog.add(normalized);
      }
    }
    if (operationValuesFromCatalog.has(comparable)) return null;
    if (operationValues.some(op => normalizeComparable(asStr(op)) === comparable)) return null;
    const direct = findMatch(costCenters, costCenter);
    if (direct) {
      const canonical = asStr(direct.code) || asStr(direct.name);
      if (canonical) return canonical;
    }
  } catch {
    // Se o cadastro não estiver disponível, mantém a regra local de exclusão.
  }
  return null;
}

// ── Period helpers (BRT-aware) ───────────────────────────────────────────────
/**
 * Returns the UTC range that covers the full BRT day (UTC-3).
 * BRT 00:00 = UTC 03:00  |  BRT 23:59 = UTC 02:59 (+1 day)
 * We add a generous ±4h buffer on top to handle devices that send
 * timestamps without explicit timezone or with small clock drift.
 */
function dayPeriod(date: string): {
  periodStart: string;
  periodEnd: string;
  periodStartBrt: string;
  periodEndBrt: string;
  isDayOpen: boolean;
} {
  // BRT = UTC - 3h.  Day starts at BRT 00:00 = UTC 03:00 same day.
  const brtOffsetMs = BRT_OFFSET_HOURS * 60 * 60 * 1000;

  const dayStartBrt = new Date(date + 'T00:00:00.000Z');    // treat input as midnight BRT
  const dayEndBrt   = new Date(date + 'T23:59:59.999Z');

  // Convert to UTC: BRT → UTC means +3h
  const startUtc = new Date(dayStartBrt.getTime() + brtOffsetMs);
  const endUtc   = new Date(dayEndBrt.getTime()   + brtOffsetMs);

  const periodStart    = startUtc.toISOString();
  const periodEnd      = endUtc.toISOString();
  const periodStartBrt = dayStartBrt.toISOString();
  const periodEndBrt   = dayEndBrt.toISOString();

  // isDayOpen: use BRT local date
  const nowBrt     = new Date(Date.now() - brtOffsetMs);
  const todayBrt   = nowBrt.toISOString().slice(0, 10);
  const isDayOpen  = date >= todayBrt;

  return { periodStart, periodEnd, periodStartBrt, periodEndBrt, isDayOpen };
}

/**
 * Returns true if the event timestamp falls within the BRT-day window
 * (or within a 4h tolerance on each side for edge cases).
 *
 * Accepts numeric epoch-ms from real APK data stored before timestamp
 * normalization was in place — typeof guard prevents "endsWith is not a function".
 */
function inPeriod(ts: string | null | undefined, periodStart: string, periodEnd: string): boolean {
  if (!ts) return false;
  // Runtime guard: numeric epoch-ms timestamps stored in JSON by older APK batches
  if (typeof (ts as unknown) === 'number') {
    const s = new Date(ts as unknown as number).toISOString();
    return s >= periodStart && s <= periodEnd;
  }
  // Normalize string: if no timezone suffix treat as UTC
  const t = ts.endsWith('Z') || ts.includes('+') ? ts : ts + 'Z';
  return t >= periodStart && t <= periodEnd;
}

/**
 * Match an event to a fleetCode by inspecting its payload.
 * Used as fallback when equipmentId doesn't match live-state.
 */
function eventMatchesFleet(ev: MobileEvent, fleetCode: string): boolean {
  const p = ev.payload as Record<string, unknown> | null | undefined;
  if (!p) return false;
  const fc = fleetCode.toLowerCase();
  return (
    asStr(p.fleetCode).toLowerCase()      === fc ||
    asStr(p.equipmentCode).toLowerCase()  === fc ||
    asStr(p.machineId).toLowerCase()      === fc ||
    ev.equipmentId.toLowerCase()          === fc
  );
}

// ── Journey grouping ─────────────────────────────────────────────────────────
interface JourneyGroup {
  journeyId: string | null;
  events: MobileEvent[];
}

function groupByJourney(events: MobileEvent[]): JourneyGroup[] {
  const map = new Map<string, MobileEvent[]>();
  for (const ev of events) {
    const p = ev.payload as Record<string, unknown> | null | undefined;
    const jid = asStr(p?.journeyId) || '__no_journey__';
    if (!map.has(jid)) map.set(jid, []);
    map.get(jid)!.push(ev);
  }
  return Array.from(map.entries()).map(([jid, evs]) => ({
    journeyId: jid === '__no_journey__' ? null : jid,
    events: evs.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1)),
  }));
}

// ── Journey summary from event list ─────────────────────────────────────────
function buildJourneySummary(tenantId: string, group: JourneyGroup): JourneySummary {
  const { journeyId, events } = group;

  const startEv = events.find(e => e.type === 'JOURNEY_START');
  const endEv   = [...events].reverse().find(e => e.type === 'JOURNEY_END' || e.type === 'MANUAL_JOURNEY_END');

  const sp = startEv?.payload as Record<string, unknown> | undefined;
  const ep = endEv?.payload   as Record<string, unknown> | undefined;

  let opReg: string | null = null, opName: string | null = null;
  let opCode: string | null = null, opNameStr: string | null = null;
  let implCode: string | null = null, implName: string | null = null;
  let wo: string | null = null, cc: string | null = null;
  let hStart: number | null = null, hEnd: number | null = null;

  for (const ev of events) {
    const p = ev.payload as Record<string, unknown> | null | undefined;
    if (!p) continue;
    opReg     = pick(p.operatorRegistration, p.registration, opReg);
    opName    = pick(p.operatorName, p.currentOperator, opName);
    opCode    = pick(p.operationCode, opCode);
    opNameStr = pick(p.operationName, p.currentOperation, opNameStr);
    implCode  = pick(p.implementCode, implCode);
    implName  = pick(p.implementName, implName);
    wo        = pick(p.workOrderNumber, p.workOrder, wo);
    cc        = pick(p.costCenterName, p.costCenterCode, p.costCenter, cc);

    const h = toNumber(p.hourmeterStart ?? p.hourmeter);
    if (h !== null && hStart === null) hStart = h;
    if (ev.type === 'JOURNEY_END' || ev.type === 'MANUAL_JOURNEY_END') {
      const he = toNumber(p.hourmeterEnd ?? p.hourmeter);
      if (he !== null) hEnd = he;
    }
  }

  if (hStart === null && sp) hStart = toNumber(sp.hourmeterStart ?? sp.hourmeter);
  if (hEnd   === null && ep) hEnd   = toNumber(ep.hourmeterEnd   ?? ep.hourmeter);

  const total = calculateTotalHours(hStart, hEnd);

  const stopSeen = new Set<string>();
  const stops: StopDiaria[] = [];
  for (const ev of events) {
    if (ev.type !== 'STOP_REASON' && ev.type !== 'PARADA') continue;
    const p = ev.payload as Record<string, unknown> | null | undefined;
    const code = asStr(p?.stopCode ?? p?.code);
    if (!code) continue;
    const start = asStr(p?.stopStartedAt) || ev.timestamp;
    const key   = code + '|' + start.slice(0, 16);
    if (stopSeen.has(key)) continue;
    stopSeen.add(key);
    const endTs = asStr(p?.stopEndedAt) || undefined;
    const dur   = minutesBetween(start, endTs ?? null);
    stops.push({
      code,
      description: asStr(p?.stopDescription ?? p?.description ?? p?.reason),
      startedAt: start,
      endedAt: endTs,
      durationMinutes: dur !== null && dur >= 0 ? dur : undefined,
    });
  }

  return {
    journeyId,
    startedAt: startEv?.timestamp ?? events[0]?.timestamp ?? null,
    endedAt:   endEv?.timestamp   ?? null,
    hourmeterStart: hStart,
    hourmeterEnd:   hEnd,
    totalHourmeter: total,
    operatorRegistration: opReg,
    operatorName:   opName,
    operationCode:  opCode,
    operationName:  opNameStr,
    implementCode:  implCode,
    implementName:  implName,
    workOrderNumber: wo,
    costCenterName:  resolveCostCenter(tenantId, cc, [opNameStr, opCode], wo),
    stops,
    hasJourneyEnd: !!endEv,
  };
}

// ── Time analysis from trail ─────────────────────────────────────────────────
function analyseTime(
  trailPts: TrailPoint[],
  stops: StopDiaria[],
  startedAt: string | null,
  endedAt: string | null,
  isDayOpen: boolean,
): {
  durationMinutes: number | null;
  minutesOperating: number | null;
  minutesStopped: number | null;
  minutesUndetermined: number | null;
  pctUndetermined: number | null;
} {
  const endTs = endedAt ?? (isDayOpen ? new Date().toISOString() : null);
  const durationMinutes = minutesBetween(startedAt, endTs);
  if (durationMinutes === null || durationMinutes <= 0) {
    return { durationMinutes, minutesOperating: null, minutesStopped: null, minutesUndetermined: null, pctUndetermined: null };
  }

  let stopped = 0;
  for (const s of stops) {
    const dur = minutesBetween(s.startedAt, s.endedAt ?? null);
    if (dur !== null && dur > 0) stopped += dur;
  }
  stopped = Math.min(stopped, durationMinutes);

  let undetermined = 0;
  const sorted = [...trailPts].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  if (sorted.length === 0) {
    undetermined = durationMinutes;
  } else if (sorted.length === 1) {
    const before = minutesBetween(startedAt, sorted[0].timestamp) ?? 0;
    const after  = minutesBetween(sorted[0].timestamp, endTs) ?? 0;
    undetermined = Math.max(0, before - GPS_GAP_LIMIT_MIN) + Math.max(0, after - GPS_GAP_LIMIT_MIN);
  } else {
    for (let i = 1; i < sorted.length; i++) {
      const gap = minutesBetween(sorted[i - 1].timestamp, sorted[i].timestamp);
      if (gap !== null && gap > GPS_GAP_LIMIT_MIN) undetermined += gap - GPS_GAP_LIMIT_MIN;
    }
  }
  undetermined = Math.min(undetermined, durationMinutes);

  const known     = durationMinutes - undetermined;
  const operating = Math.max(0, known - stopped);
  const pct       = Math.round((undetermined / durationMinutes) * 100);

  return {
    durationMinutes,
    minutesOperating: operating,
    minutesStopped:   stopped > 0 ? stopped : null,
    minutesUndetermined: undetermined > 0 ? undetermined : null,
    pctUndetermined: pct > 0 ? pct : null,
  };
}

// ── Live-state → minimal ficha (fallback) ────────────────────────────────────
/**
 * Gera uma ficha mínima a partir do live-state quando não há eventos no período.
 * Regra: se o mapa mostra a frota, a ficha não pode ficar vazia.
 */
function buildFichaFromLiveState(
  machine: ReturnType<typeof ServerStorage.getLiveFleet>[number],
  date: string,
  periodStart: string,
  periodEnd: string,
  isDayOpen: boolean,
): FichaDiaria {
  const id = (machine.tenantId ?? '') + '|' + machine.fleetCode + '|' + date;

  // Journey de live-state (se tiver journeyId)
  const liveJourney: JourneySummary | null = machine.journeyId ? {
    journeyId: machine.journeyId,
    startedAt: machine.statusStartedAt ?? machine.updatedAt ?? null,
    endedAt: machine.endedAt ?? null,
    hourmeterStart: machine.hourmeterStart ?? null,
    hourmeterEnd: machine.hourmeterEnd ?? machine.hourmeterFinal ?? null,
    totalHourmeter: calculateTotalHours(
      machine.hourmeterStart ?? machine.hourmeterInitial ?? null,
      machine.hourmeterEnd ?? machine.hourmeterFinal ?? null,
    ),
    operatorRegistration: machine.operatorRegistration ?? machine.registration ?? null,
    operatorName: machine.operatorName ?? machine.currentOperator ?? null,
    operationCode: machine.operationCode ?? null,
    operationName: machine.operationName ?? machine.currentOperation ?? null,
    implementCode: machine.implementCode ?? null,
    implementName: machine.implementName ?? null,
    workOrderNumber: machine.workOrder ?? null,
    costCenterName: resolveCostCenter(
      machine.tenantId ?? '',
      machine.costCenterName ?? machine.costCenterCode ?? machine.costCenter,
      [machine.operationName, machine.currentOperation],
      machine.workOrder ?? null,
    ),
    stops: [],
    hasJourneyEnd: false,
  } : null;

  const journeys = liveJourney ? [liveJourney] : [];

  // Trail from live-state journeyId
  const allTrailPts: TrailPoint[] = [];
  if (machine.journeyId) {
    const pts = ServerStorage.getTrail(machine.tenantId ?? '', machine.journeyId);
    allTrailPts.push(...pts);
  }
  const sortedTrail = allTrailPts.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

  const trailSummary = {
    points:     sortedTrail.length,
    firstGpsAt: sortedTrail[0]?.timestamp ?? machine.lastGpsAt ?? null,
    lastGpsAt:  sortedTrail[sortedTrail.length - 1]?.timestamp ?? machine.lastGpsAt ?? null,
    distanceKm: calcDistanceKm(sortedTrail),
  };

  const hourmeterStart   = machine.hourmeterStart   ?? machine.hourmeterInitial   ?? null;
  const hourmeterCurrent = machine.hourmeterCurrent ?? machine.hourmeter          ?? null;
  const hourmeterEnd     = machine.hourmeterEnd     ?? machine.hourmeterFinal     ?? null;
  const endedAt          = machine.endedAt          ?? null;

  // Normalizar operador no live-state fallback também
  const lsRawReg  = machine.operatorRegistration ?? machine.registration ?? null;
  const lsRawName = machine.operatorName ?? machine.currentOperator ?? null;
  const lsOp = normalizeOperatorFromCadastro(machine.tenantId ?? '', lsRawReg, lsRawName);

  const inconsistencies: string[] = [];
  if (!lsOp.registration && !lsOp.name)
    inconsistencies.push(DAILY_INCONSISTENCY.OPERADOR_NAO_IDENTIFICADO);
  if (!machine.operationCode)
    inconsistencies.push(DAILY_INCONSISTENCY.OPERACAO_NAO_INFORMADA);
  if (hourmeterStart !== null && hourmeterEnd !== null && hourmeterEnd < hourmeterStart)
    inconsistencies.push(DAILY_INCONSISTENCY.HORIMETRO_FINAL_MENOR_QUE_INICIAL);
  if (sortedTrail.length === 0)
    inconsistencies.push(DAILY_INCONSISTENCY.SEM_EVENTOS_GPS);

  const liveStatus = machine.status ?? 'ONLINE';
  const fichaStatus: FichaDiariaStatus =
    !hourmeterEnd && !endedAt && isDayOpen && liveStatus !== 'OFFLINE' && liveStatus !== 'FINALIZADO'
      ? 'EM_ANDAMENTO'
      : endedAt && !hourmeterEnd
        ? 'INCONSISTENTE'
        : 'PENDENTE';

  return {
    id,
    date, periodStart, periodEnd,
    tenantId:   machine.tenantId ?? '',
    fleetCode:  machine.fleetCode,
    equipmentId: machine.equipmentId,
    operatorRegistration: lsOp.registration,
    operatorName:   lsOp.name,
    operationCode:  machine.operationCode ?? null,
    operationName:  machine.operationName ?? machine.currentOperation ?? null,
    implementCode:  machine.implementCode ?? null,
    implementName:  machine.implementName ?? null,
    workOrderNumber: machine.workOrder ?? null,
    costCenterName:  resolveCostCenter(
      machine.tenantId ?? '',
      machine.costCenterName ?? machine.costCenterCode ?? machine.costCenter,
      [machine.operationName, machine.currentOperation],
      machine.workOrder ?? null,
    ),
    hourmeterStart,
    hourmeterCurrent,
    hourmeterEnd,
    totalHourmeter: calculateTotalHours(hourmeterStart, hourmeterEnd),
    durationMinutes: null,
    minutesOperating: null,
    minutesStopped: null,
    minutesUndetermined: null,
    pctUndetermined: null,
    startedAt: liveJourney?.startedAt ?? null,
    endedAt,
    journeys,
    stops: [],
    trailSummary,
    status: fichaStatus,
    inconsistencies,
    validated: false,
    eventCount: 0,
    isDayOpen,
    fromLiveState: true,
  };
}

// ── Main builder ──────────────────────────────────────────────────────────────
export function buildDailySheet(params: {
  tenantId:  string;
  fleetCode: string;
  date:      string; // YYYY-MM-DD (data operacional BRT)
}): BuildDailyResult {
  const { tenantId, fleetCode, date } = params;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, status: 400, error: 'date must be YYYY-MM-DD' };
  }

  const { periodStart, periodEnd, isDayOpen } = dayPeriod(date);

  // ── Find machine from live-state ─────────────────────────────────────────
  const liveFleet = ServerStorage.getLiveFleet(tenantId);
  const machine   = liveFleet.find(m => m.fleetCode === fleetCode);
  if (!machine) {
    return { ok: false, status: 404, error: 'fleetCode not found' };
  }

  const { equipmentId } = machine;

  // ── Get events — primary by equipmentId, fallback by fleetCode in payload ─
  let allEvents = ServerStorage.getEvents(tenantId, equipmentId);

  // Fallback: if zero events by equipmentId, search all events for this fleetCode.
  // Handles equipmentId mismatch between cadastro versions.
  if (allEvents.length === 0) {
    const fallback = ServerStorage.getEvents(tenantId).filter(e =>
      eventMatchesFleet(e, fleetCode)
    );
    if (fallback.length > 0) {
      console.info(
        '[daily-sheet-builder] equipmentId mismatch — using fleetCode fallback' +
        ' fleetCode=' + fleetCode + ' found=' + fallback.length
      );
      allEvents = fallback;
    }
  }

  // Filter to BRT day window
  const dayEvents = allEvents.filter(e =>
    inPeriod(e.timestamp ?? e.receivedAt, periodStart, periodEnd) ||
    // Secondary check: receivedAt as fallback (device may send wrong timestamp)
    inPeriod(e.receivedAt, periodStart, periodEnd)
  );

  console.info(
    '[FICHA_24H] buildDailySheet' +
    ' fleetCode=' + fleetCode +
    ' date=' + date +
    ' periodStart=' + periodStart +
    ' periodEnd=' + periodEnd +
    ' allEvents=' + allEvents.length +
    ' dayEvents=' + dayEvents.length +
    ' isDayOpen=' + isDayOpen
  );

  // ── Live-state fallback ───────────────────────────────────────────────────
  // Se não há eventos mas a máquina está no live-state com atividade recente,
  // gerar ficha mínima a partir do live-state.
  if (dayEvents.length === 0) {
    // Build from live-state: covers both today (isDayOpen) and historical
    // days where machine has live-state but events file is empty/missing.
    const liveState = liveFleet.find(m => m.fleetCode === fleetCode);
    if (liveState) {
      console.info(
        '[FICHA_24H] no events — building from live-state' +
        ' fleetCode=' + fleetCode + ' status=' + liveState.status
      );
      const ficha = buildFichaFromLiveState(liveState, date, periodStart, periodEnd, isDayOpen);
      return { ok: true, ficha };
    }
    return {
      ok: false, status: 404,
      error: 'Nenhum evento ou live-state para fleetCode=' + fleetCode + ' date=' + date,
    };
  }

  // ── Group events by journey ───────────────────────────────────────────────
  const groups   = groupByJourney(dayEvents);
  const journeys = groups.map(group => buildJourneySummary(tenantId, group));

  // ── Trail ─────────────────────────────────────────────────────────────────
  const allTrailPts: TrailPoint[] = [];
  for (const j of journeys) {
    if (j.journeyId) {
      const pts      = ServerStorage.getTrail(tenantId, j.journeyId);
      const filtered = pts.filter(p => inPeriod(p.timestamp, periodStart, periodEnd) || inPeriod(p.timestamp, periodStart, periodEnd));
      allTrailPts.push(...filtered);
    }
  }
  const sortedTrail = allTrailPts.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

  const trailSummary = {
    points:     sortedTrail.length,
    firstGpsAt: sortedTrail[0]?.timestamp ?? null,
    lastGpsAt:  sortedTrail[sortedTrail.length - 1]?.timestamp ?? null,
    distanceKm: calcDistanceKm(sortedTrail),
  };

  const allStops = journeys.flatMap(j => j.stops);

  // ── Consolidated operational fields ──────────────────────────────────────
  const operatorRegistration = journeys.reduce<string|null>((a, j) => a ?? j.operatorRegistration, null);
  const operatorName   = journeys.reduce<string|null>((a, j) => a ?? j.operatorName, null);
  const operationCode  = journeys.reduce<string|null>((a, j) => a ?? j.operationCode, null);
  const operationName  = journeys.reduce<string|null>((a, j) => a ?? j.operationName, null);
  const implementCode  = journeys.reduce<string|null>((a, j) => a ?? j.implementCode, null);
  const implementName  = journeys.reduce<string|null>((a, j) => a ?? j.implementName, null);
  const workOrderNumber= journeys.reduce<string|null>((a, j) => a ?? j.workOrderNumber, null);
  const costCenterRaw   = journeys.reduce<string|null>((a, j) => a ?? j.costCenterName, null);

  // Enrich missing fields from live-state (e.g., operatorName enriched by Central)
  const liveM = machine;
  const rawOpReg  = operatorRegistration  ?? pick(liveM.operatorRegistration, liveM.registration);
  const rawOpName = operatorName          ?? pick(liveM.operatorName, liveM.currentOperator);

  // Normalizar operador pelo cadastro — garante que nome e matrícula vêm do MESMO registro.
  // Evita mistura de nome de um operador com matrícula de outro quando eventos têm campos
  // de operadores diferentes (e.g., heartbeat com nome antigo + JOURNEY_START com nova matrícula).
  const normalizedOp   = normalizeOperatorFromCadastro(tenantId, rawOpReg, rawOpName);
  const effectiveOpReg  = normalizedOp.registration;
  const effectiveOpName = normalizedOp.name;
  const effectiveOpCode = operationCode         ?? pick(liveM.operationCode);
  const effectiveOpNm   = operationName         ?? pick(liveM.operationName, liveM.currentOperation);
  const effectiveImpC   = implementCode         ?? pick(liveM.implementCode);
  const effectiveImpN   = implementName         ?? pick(liveM.implementName);
  const costCenterName  = resolveCostCenter(
    tenantId,
    costCenterRaw ?? pick(liveM.costCenterName, liveM.costCenterCode, liveM.costCenter),
    [effectiveOpNm, liveM.operationName, liveM.currentOperation],
    workOrderNumber ?? pick(liveM.workOrder),
  );

  // ── Horímetros ────────────────────────────────────────────────────────────
  const hourmeterStart   = journeys.reduce<number|null>((a, j) => a ?? j.hourmeterStart, null)
    ?? liveM.hourmeterStart ?? liveM.hourmeterInitial ?? null;

  let hourmeterCurrent: number | null = null;
  for (const ev of [...dayEvents].reverse()) {
    const p = ev.payload as Record<string, unknown> | null | undefined;
    const h = toNumber(p?.hourmeterCurrent ?? p?.hourmeter ?? p?.hourmeterEnd);
    if (h !== null) { hourmeterCurrent = h; break; }
  }
  hourmeterCurrent = hourmeterCurrent ?? liveM.hourmeterCurrent ?? liveM.hourmeter ?? null;

  const activeJourneyCount = journeys.filter(journey => !journey.hasJourneyEnd || !journey.endedAt).length;
  const hasActiveJourney = activeJourneyCount > 0;
  const rawHourmeterEnd = journeys.reduce<number|null>((a, j) => j.hourmeterEnd ?? a, null);
  const hourmeterCalculation = calculateJourneyHourmeter({ status: hasActiveJourney ? 'EM_ANDAMENTO' : 'FINALIZADO', hourmeterStart, hourmeterCurrent, hourmeterEnd: rawHourmeterEnd });
  const hourmeterEnd = hourmeterCalculation.end;
  const totalHourmeter = hourmeterCalculation.total;

  const firstJourney = journeys[0];
  const startedAt = firstJourney?.startedAt ?? null;
  const endedAt   = journeys[journeys.length - 1]?.endedAt ?? null;

  const timeData = analyseTime(sortedTrail, allStops, startedAt, endedAt, isDayOpen);

  // ── Inconsistency engine ──────────────────────────────────────────────────
  const inconsistencies: string[] = [...hourmeterCalculation.warnings];
  if (activeJourneyCount > 1) inconsistencies.push(DAILY_INCONSISTENCY.MULTIPLAS_JORNADAS_ATIVAS);

  if (!effectiveOpReg && !effectiveOpName)
    inconsistencies.push(DAILY_INCONSISTENCY.OPERADOR_NAO_IDENTIFICADO);
  if (effectiveOpReg && effectiveOpReg.length < 2)
    inconsistencies.push(DAILY_INCONSISTENCY.MATRICULA_INVALIDA);
  if (!effectiveOpCode)
    inconsistencies.push(DAILY_INCONSISTENCY.OPERACAO_NAO_INFORMADA);
  if (!workOrderNumber)
    inconsistencies.push(DAILY_INCONSISTENCY.OS_NAO_INFORMADA);
  if (!effectiveImpC)
    inconsistencies.push(DAILY_INCONSISTENCY.IMPLEMENTO_NAO_INFORMADO);
  if (hourmeterStart === null && dayEvents.length > 0)
    inconsistencies.push(DAILY_INCONSISTENCY.SEM_HORIMETRO_INICIAL);

  for (const j of journeys) {
    // JOURNEY_END_SEM_HORIMETRO_FINAL: só quando existe JOURNEY_END real E a ficha não está EM_ANDAMENTO
    // Nunca gerar essa inconsistência durante jornada ativa (hasActiveJourney = true)
    if (!hasActiveJourney && j.hasJourneyEnd && !j.hourmeterEnd) {
      if (!inconsistencies.includes(DAILY_INCONSISTENCY.JOURNEY_END_SEM_HORIMETRO_FINAL))
        inconsistencies.push(DAILY_INCONSISTENCY.JOURNEY_END_SEM_HORIMETRO_FINAL);
    }
    if (j.hourmeterEnd !== null && j.hourmeterStart !== null && j.hourmeterEnd < j.hourmeterStart) {
      if (!inconsistencies.includes(DAILY_INCONSISTENCY.HORIMETRO_FINAL_MENOR_QUE_INICIAL))
        inconsistencies.push(DAILY_INCONSISTENCY.HORIMETRO_FINAL_MENOR_QUE_INICIAL);
    }
  }

  if (!isDayOpen && !hasActiveJourney && hourmeterEnd === null && hourmeterStart !== null)
    inconsistencies.push(DAILY_INCONSISTENCY.SEM_HORIMETRO_FINAL_APOS_FECHAMENTO);

  if (trailSummary.points === 0)
    inconsistencies.push(DAILY_INCONSISTENCY.SEM_EVENTOS_GPS);

  if (timeData.pctUndetermined !== null && timeData.pctUndetermined > INDETERMINATE_LIMIT_PCT)
    inconsistencies.push(DAILY_INCONSISTENCY.TEMPO_INDETERMINADO_ACIMA_LIMITE);

  // ── Status ────────────────────────────────────────────────────────────────
  const hasBlockingInconsistency = inconsistencies.some(i => !i.includes('(alerta)'));

  const status: FichaDiariaStatus = (() => {
    if (hasActiveJourney) return 'EM_ANDAMENTO';
    if (hasBlockingInconsistency) return 'INCONSISTENTE';
    const allFinalized = journeys.every(j => !j.hasJourneyEnd || j.hourmeterEnd !== null);
    if (journeys.some(j => j.hasJourneyEnd) && allFinalized) return 'FINALIZADO';
    return 'PENDENTE';
  })();

  const validated = status === 'FINALIZADO' && !hasBlockingInconsistency;

  console.info(
    '[FICHA_24H] built' +
    ' fleetCode=' + fleetCode +
    ' date=' + date +
    ' events=' + dayEvents.length +
    ' journeys=' + journeys.length +
    ' status=' + status +
    ' inc=' + inconsistencies.length
  );

  const ficha: FichaDiaria = {
    id: tenantId + '|' + fleetCode + '|' + date,
    date, periodStart, periodEnd, tenantId, fleetCode, equipmentId,
    operatorRegistration: effectiveOpReg,
    operatorName:   effectiveOpName,
    operationCode:  effectiveOpCode,
    operationName:  effectiveOpNm,
    implementCode:  effectiveImpC,
    implementName:  effectiveImpN,
    workOrderNumber,
    costCenterName,
    hourmeterStart,
    hourmeterCurrent,
    hourmeterEnd,
    totalHourmeter,
    ...timeData,
    startedAt,
    endedAt,
    journeys,
    stops: allStops,
    trailSummary,
    status,
    inconsistencies,
    validated,
    eventCount: dayEvents.length,
    isDayOpen,
  };

  return { ok: true, ficha };
}

// ── List builder ──────────────────────────────────────────────────────────────
/**
 * Gera fichas diárias para TODAS as frotas ativas no tenant para uma data.
 * Inclui fichas com dados de live-state mesmo quando não há eventos no período.
 */
export function buildDailySheetList(params: {
  tenantId: string;
  date: string;
  fleetCodeFilter?: string | null;
}): FichaDiaria[] {
  const { tenantId, date, fleetCodeFilter } = params;
  const liveFleet = ServerStorage.getLiveFleet(tenantId);

  const { periodStart, periodEnd, isDayOpen } = dayPeriod(date);

  // Get all events for the day — search by both equipmentId and payload fleetCode
  const allRawEvents = ServerStorage.getEvents(tenantId);
  const dayEvents    = allRawEvents.filter(e =>
    inPeriod(e.timestamp ?? e.receivedAt, periodStart, periodEnd) ||
    inPeriod(e.receivedAt, periodStart, periodEnd)
  );

  // Build indexes: by equipmentId AND by payload fleetCode
  const activeEquipmentIds = new Set(dayEvents.map(e => e.equipmentId));
  const activeFleetCodes   = new Set<string>();
  for (const ev of dayEvents) {
    const p = ev.payload as Record<string, unknown> | null | undefined;
    const fc = asStr(p?.fleetCode ?? p?.equipmentCode ?? p?.machineId);
    if (fc) activeFleetCodes.add(fc.toLowerCase());
    if (ev.equipmentId) activeFleetCodes.add(ev.equipmentId.toLowerCase());
  }

  console.info(
    '[FICHA_24H] buildDailySheetList' +
    ' tenantId=' + tenantId +
    ' date=' + date +
    ' range=' + periodStart + ' to ' + periodEnd +
    ' allEvents=' + allRawEvents.length +
    ' dayEvents=' + dayEvents.length +
    ' liveFleet=' + liveFleet.length +
    ' activeEquipmentIds=' + activeEquipmentIds.size +
    ' activeFleetCodes=' + activeFleetCodes.size
  );

  const fichas: FichaDiaria[] = [];

  for (const machine of liveFleet) {
    if (fleetCodeFilter && machine.fleetCode !== fleetCodeFilter) continue;

    const hasEvents =
      activeEquipmentIds.has(machine.equipmentId) ||
      activeFleetCodes.has(machine.fleetCode.toLowerCase()) ||
      activeFleetCodes.has((machine.equipmentId ?? '').toLowerCase());

    // For today: include ALL machines in live-state (live-state fallback)
    // For past days: include only machines with events
    if (!hasEvents && !isDayOpen) {
      continue;
    }

    const result = buildDailySheet({ tenantId, fleetCode: machine.fleetCode, date });
    if (result.ok) fichas.push(result.ficha);
  }

  console.info(
    '[FICHA_24H] generatedSheets=' + fichas.length +
    ' isDayOpen=' + isDayOpen
  );

  return fichas.sort((a, b) => a.fleetCode.localeCompare(b.fleetCode));
}
