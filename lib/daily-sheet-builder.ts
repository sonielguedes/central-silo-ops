/**
 * daily-sheet-builder.ts
 *
 * Geração da Ficha Diária de Operador — consolidação das 24h de cada equipamento.
 *
 * Conceito:
 *   A ficha representa o que aconteceu com um equipamento dentro de um
 *   dia operacional (00:00:00 até 23:59:59, horário UTC do servidor).
 *   Eventos fora desse período são ignorados.
 *
 * Não depende de live-state para datas históricas.
 * Para a data de hoje, complementa com live-state quando disponível.
 */

import { ServerStorage } from '@/lib/server-storage';
import type { MobileEvent } from '@/lib/server-storage';
import type { TrailPoint } from '@/lib/types';

// ── Constants ────────────────────────────────────────────────────────────────
const GPS_GAP_LIMIT_MIN       = 30;  // gap > 30 min entre pontos = indeterminado
const INDETERMINATE_LIMIT_PCT = 50;  // acima de 50% indeterminado vira alerta

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
  periodStart: string;        // ISO — 00:00:00 do dia
  periodEnd: string;          // ISO — 23:59:59 do dia
  tenantId: string;
  fleetCode: string;
  equipmentId: string;

  // Operador consolidado (primeiro válido do dia)
  operatorRegistration: string | null;
  operatorName: string | null;
  operationCode: string | null;
  operationName: string | null;
  implementCode: string | null;
  implementName: string | null;
  workOrderNumber: string | null;
  costCenterName: string | null;

  // Horímetros diários
  hourmeterStart: number | null;    // primeiro hourmeter válido do dia
  hourmeterCurrent: number | null;  // último hourmeter válido recebido
  hourmeterEnd: number | null;      // do JOURNEY_END, se houver
  totalHourmeter: number | null;    // hourmeterEnd - hourmeterStart

  // Tempo (em minutos)
  durationMinutes: number | null;
  minutesOperating: number | null;
  minutesStopped: number | null;
  minutesUndetermined: number | null;
  pctUndetermined: number | null;

  startedAt: string | null;         // início da primeira jornada do dia
  endedAt: string | null;           // fim da última jornada do dia (se finalizada)

  journeys: JourneySummary[];       // detalhes por jornada
  stops: StopDiaria[];              // todas as paradas do dia

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

  /** Total de eventos recebidos no período */
  eventCount: number;
  /** true se o dia ainda está aberto (hoje) */
  isDayOpen: boolean;
}

export type BuildDailyResult =
  | { ok: true;  ficha: FichaDiaria }
  | { ok: false; status: number; error: string };

// ── Helpers ──────────────────────────────────────────────────────────────────
function asStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

function asNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function minutesBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.round((tb - ta) / 60000);
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R    = 6371;
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
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    d += haversineKm(pts[i-1].latitude, pts[i-1].longitude, pts[i].latitude, pts[i].longitude);
  }
  return Math.round(d * 10) / 10;
}

/** Extrai o primeiro valor não-vazio dos campos, priorizando na ordem. */
function pick(...values: unknown[]): string | null {
  for (const v of values) {
    const s = asStr(v);
    if (s) return s;
  }
  return null;
}

// ── Period helpers ────────────────────────────────────────────────────────────
function dayPeriod(date: string): { periodStart: string; periodEnd: string; isDayOpen: boolean } {
  // date = YYYY-MM-DD (UTC)
  const periodStart = date + 'T00:00:00.000Z';
  const periodEnd   = date + 'T23:59:59.999Z';
  const todayUTC = new Date().toISOString().slice(0, 10);
  return { periodStart, periodEnd, isDayOpen: date >= todayUTC };
}

function inPeriod(ts: string | null | undefined, periodStart: string, periodEnd: string): boolean {
  if (!ts) return false;
  return ts >= periodStart && ts <= periodEnd;
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
function buildJourneySummary(group: JourneyGroup): JourneySummary {
  const { journeyId, events } = group;

  const startEv = events.find(e => e.type === 'JOURNEY_START');
  const endEv   = [...events].reverse().find(e => e.type === 'JOURNEY_END');

  const sp = startEv?.payload as Record<string, unknown> | undefined;
  const ep = endEv?.payload   as Record<string, unknown> | undefined;

  // Derive operational fields — scan ALL events, prefer most recent non-null value
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
    cc        = pick(p.costCenterName, p.costCenter, cc);

    const h = asNum(p.hourmeterStart ?? p.hourmeter);
    if (h !== null && hStart === null) hStart = h;
    if (ev.type === 'JOURNEY_END') {
      const he = asNum(p.hourmeterEnd ?? p.hourmeter);
      if (he !== null) hEnd = he;
    }
  }

  // Fallback from start/end payloads
  if (hStart === null && sp) hStart = asNum(sp.hourmeterStart ?? sp.hourmeter);
  if (hEnd   === null && ep) hEnd   = asNum(ep.hourmeterEnd   ?? ep.hourmeter);

  const total =
    hEnd !== null && hStart !== null
      ? Math.round((hEnd - hStart) * 100) / 100
      : null;

  // Stops
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
    costCenterName:  cc,
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

  // Stopped: sum closed stop durations
  let stopped = 0;
  for (const s of stops) {
    const dur = minutesBetween(s.startedAt, s.endedAt ?? null);
    if (dur !== null && dur > 0) stopped += dur;
  }
  stopped = Math.min(stopped, durationMinutes);

  // Undetermined: gaps between GPS points > GPS_GAP_LIMIT_MIN
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

  const known = durationMinutes - undetermined;
  const operating = Math.max(0, known - stopped);
  const pct = Math.round((undetermined / durationMinutes) * 100);

  return {
    durationMinutes,
    minutesOperating: operating,
    minutesStopped: stopped > 0 ? stopped : null,
    minutesUndetermined: undetermined > 0 ? undetermined : null,
    pctUndetermined: pct > 0 ? pct : null,
  };
}

// ── Main builder ──────────────────────────────────────────────────────────────
export function buildDailySheet(params: {
  tenantId:  string;
  fleetCode: string;
  date:      string; // YYYY-MM-DD UTC
}): BuildDailyResult {
  const { tenantId, fleetCode, date } = params;

  // Validate date
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, status: 400, error: 'date must be YYYY-MM-DD' };
  }

  const { periodStart, periodEnd, isDayOpen } = dayPeriod(date);

  // Find equipment from live state (equipmentId lookup)
  const liveFleet = ServerStorage.getLiveFleet(tenantId);
  const machine   = liveFleet.find(m => m.fleetCode === fleetCode);
  if (!machine) {
    return { ok: false, status: 404, error: 'fleetCode not found' };
  }

  const { equipmentId } = machine;

  // Get ALL events for this equipment, then filter to the 24h window
  const allEvents  = ServerStorage.getEvents(tenantId, equipmentId);
  const dayEvents  = allEvents.filter(e => inPeriod(e.timestamp ?? e.receivedAt, periodStart, periodEnd));

  if (dayEvents.length === 0 && !isDayOpen) {
    // Historical day with zero events — return empty ficha
    const emptyFicha: FichaDiaria = {
      id: tenantId + '|' + fleetCode + '|' + date,
      date, periodStart, periodEnd, tenantId, fleetCode, equipmentId,
      operatorRegistration: null, operatorName: null,
      operationCode: null, operationName: null,
      implementCode: null, implementName: null,
      workOrderNumber: null, costCenterName: null,
      hourmeterStart: null, hourmeterCurrent: null, hourmeterEnd: null, totalHourmeter: null,
      durationMinutes: null, minutesOperating: null, minutesStopped: null,
      minutesUndetermined: null, pctUndetermined: null,
      startedAt: null, endedAt: null,
      journeys: [], stops: [],
      trailSummary: { points: 0, firstGpsAt: null, lastGpsAt: null, distanceKm: 0 },
      status: 'PENDENTE',
      inconsistencies: [DAILY_INCONSISTENCY.SEM_EVENTOS_GPS],
      validated: false,
      eventCount: 0,
      isDayOpen,
    };
    return { ok: true, ficha: emptyFicha };
  }

  // Group events by journey
  const groups = groupByJourney(dayEvents);
  const journeys = groups.map(buildJourneySummary);

  // Collect all trail points for journeys that have a journeyId
  const allTrailPts: TrailPoint[] = [];
  for (const j of journeys) {
    if (j.journeyId) {
      const pts = ServerStorage.getTrail(tenantId, j.journeyId);
      // Filter trail points to today's period
      const filtered = pts.filter(p => inPeriod(p.timestamp, periodStart, periodEnd));
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

  // Collect all stops
  const allStops: StopDiaria[] = journeys.flatMap(j => j.stops);

  // Consolidated operational fields — first non-null across journeys
  const firstJourney = journeys[0];
  const operatorRegistration = journeys.reduce<string|null>((a, j) => a ?? j.operatorRegistration, null);
  const operatorName   = journeys.reduce<string|null>((a, j) => a ?? j.operatorName, null);
  const operationCode  = journeys.reduce<string|null>((a, j) => a ?? j.operationCode, null);
  const operationName  = journeys.reduce<string|null>((a, j) => a ?? j.operationName, null);
  const implementCode  = journeys.reduce<string|null>((a, j) => a ?? j.implementCode, null);
  const implementName  = journeys.reduce<string|null>((a, j) => a ?? j.implementName, null);
  const workOrderNumber= journeys.reduce<string|null>((a, j) => a ?? j.workOrderNumber, null);
  const costCenterName = journeys.reduce<string|null>((a, j) => a ?? j.costCenterName, null);

  // Horímetros diários
  const hourmeterStart = journeys.reduce<number|null>((a, j) => a ?? j.hourmeterStart, null);
  // Last hourmeter seen in any event
  let hourmeterCurrent: number | null = null;
  for (const ev of [...dayEvents].reverse()) {
    const p = ev.payload as Record<string, unknown> | null | undefined;
    const h = asNum(p?.hourmeterCurrent ?? p?.hourmeter ?? p?.hourmeterEnd);
    if (h !== null) { hourmeterCurrent = h; break; }
  }
  // hourmeterEnd — from the last JOURNEY_END that has it
  const hourmeterEnd = journeys.reduce<number|null>((a, j) => j.hourmeterEnd ?? a, null);

  const totalHourmeter = (() => {
    if (hourmeterEnd !== null && hourmeterStart !== null) {
      const d = Math.round((hourmeterEnd - hourmeterStart) * 100) / 100;
      return d >= 0 ? d : null;
    }
    return null;
  })();

  // Journey time bounds
  const startedAt = firstJourney?.startedAt ?? null;
  const endedAt   = journeys[journeys.length - 1]?.endedAt ?? null;

  // Time analysis
  const timeData = analyseTime(sortedTrail, allStops, startedAt, endedAt, isDayOpen);

  // Active journey check
  const hasActiveJourney = isDayOpen && journeys.some(j => !j.hasJourneyEnd);

  // ── Inconsistency engine ──────────────────────────────────────────────────
  const inconsistencies: string[] = [];

  if (!operatorRegistration && !operatorName)
    inconsistencies.push(DAILY_INCONSISTENCY.OPERADOR_NAO_IDENTIFICADO);
  if (operatorRegistration && operatorRegistration.length < 2)
    inconsistencies.push(DAILY_INCONSISTENCY.MATRICULA_INVALIDA);
  if (!operationCode)
    inconsistencies.push(DAILY_INCONSISTENCY.OPERACAO_NAO_INFORMADA);
  if (!workOrderNumber)
    inconsistencies.push(DAILY_INCONSISTENCY.OS_NAO_INFORMADA);
  if (!implementCode)
    inconsistencies.push(DAILY_INCONSISTENCY.IMPLEMENTO_NAO_INFORMADO);
  if (hourmeterStart === null && dayEvents.length > 0)
    inconsistencies.push(DAILY_INCONSISTENCY.SEM_HORIMETRO_INICIAL);

  // Inconsistências de fechamento — só quando jornada finalizada
  for (const j of journeys) {
    if (j.hasJourneyEnd && !j.hourmeterEnd) {
      if (!inconsistencies.includes(DAILY_INCONSISTENCY.JOURNEY_END_SEM_HORIMETRO_FINAL))
        inconsistencies.push(DAILY_INCONSISTENCY.JOURNEY_END_SEM_HORIMETRO_FINAL);
    }
    if (j.hourmeterEnd !== null && j.hourmeterStart !== null && j.hourmeterEnd < j.hourmeterStart) {
      if (!inconsistencies.includes(DAILY_INCONSISTENCY.HORIMETRO_FINAL_MENOR_QUE_INICIAL))
        inconsistencies.push(DAILY_INCONSISTENCY.HORIMETRO_FINAL_MENOR_QUE_INICIAL);
    }
  }

  // Dia fechado sem horímetro final — alerta (não-bloqueante)
  if (!isDayOpen && !hasActiveJourney && hourmeterEnd === null && hourmeterStart !== null) {
    inconsistencies.push(DAILY_INCONSISTENCY.SEM_HORIMETRO_FINAL_APOS_FECHAMENTO);
  }

  if (totalHourmeter !== null && totalHourmeter < 0)
    inconsistencies.push(DAILY_INCONSISTENCY.TOTAL_HORAS_INCONSISTENTE);

  if (trailSummary.points === 0)
    inconsistencies.push(DAILY_INCONSISTENCY.SEM_EVENTOS_GPS);

  if (timeData.pctUndetermined !== null && timeData.pctUndetermined > INDETERMINATE_LIMIT_PCT)
    inconsistencies.push(DAILY_INCONSISTENCY.TEMPO_INDETERMINADO_ACIMA_LIMITE);

  // ── Status ────────────────────────────────────────────────────────────────
  const hasBlockingInconsistency = inconsistencies.some(i => !i.includes('(alerta)'));

  const status: FichaDiariaStatus = (() => {
    // Jornada ativa hoje → EM_ANDAMENTO (não inconsistente por falta de horímetro final)
    if (hasActiveJourney) return 'EM_ANDAMENTO';
    // Dia fechado com inconsistência real → INCONSISTENTE
    if (hasBlockingInconsistency) return 'INCONSISTENTE';
    // Tem JOURNEY_END com horímetro final → FINALIZADO
    const allFinalized = journeys.every(j => !j.hasJourneyEnd || j.hourmeterEnd !== null);
    if (journeys.some(j => j.hasJourneyEnd) && allFinalized) return 'FINALIZADO';
    // Dia fechado sem eventos suficientes → PENDENTE
    return 'PENDENTE';
  })();

  const validated = status === 'FINALIZADO' && !hasBlockingInconsistency;

  console.info(
    '[daily-sheet-builder] fleetCode=' + fleetCode +
    ' date=' + date +
    ' events=' + dayEvents.length +
    ' journeys=' + journeys.length +
    ' status=' + status +
    ' inconsistencies=' + inconsistencies.length,
  );

  const ficha: FichaDiaria = {
    id: tenantId + '|' + fleetCode + '|' + date,
    date, periodStart, periodEnd, tenantId, fleetCode, equipmentId,
    operatorRegistration,
    operatorName,
    operationCode,
    operationName,
    implementCode,
    implementName,
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
    validatedBy: null,
    validatedAt: null,
    eventCount: dayEvents.length,
    isDayOpen,
  };

  return { ok: true, ficha };
}

// ── Multi-fleet daily list ────────────────────────────────────────────────────
/**
 * Gera fichas diárias para TODAS as frotas ativas no tenant para uma data.
 * Frotas sem nenhum evento no dia são omitidas.
 */
export function buildDailySheetList(params: {
  tenantId: string;
  date: string;
  fleetCodeFilter?: string | null;
}): FichaDiaria[] {
  const { tenantId, date, fleetCodeFilter } = params;
  const liveFleet = ServerStorage.getLiveFleet(tenantId);

  const fichas: FichaDiaria[] = [];
  const { periodStart, periodEnd } = dayPeriod(date);
  const allEvents = ServerStorage.getEvents(tenantId);

  // Pre-filter events to the day window to avoid re-scanning
  const dayEvents = allEvents.filter(e => inPeriod(e.timestamp ?? e.receivedAt, periodStart, periodEnd));

  // Get unique equipmentIds that have events today
  const activeEquipmentIds = new Set(dayEvents.map(e => e.equipmentId));

  for (const machine of liveFleet) {
    if (fleetCodeFilter && machine.fleetCode !== fleetCodeFilter) continue;
    if (!activeEquipmentIds.has(machine.equipmentId)) {
      // No events today — skip (don't generate empty fichas for inactive equipment)
      continue;
    }
    const result = buildDailySheet({ tenantId, fleetCode: machine.fleetCode, date });
    if (result.ok) fichas.push(result.ficha);
  }

  return fichas.sort((a, b) => a.fleetCode.localeCompare(b.fleetCode));
}
