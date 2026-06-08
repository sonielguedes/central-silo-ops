/**
 * operational-time-core.ts
 * Shared math and journey logic for C4.4 (eficiência) and C4.5 (tempo operacional).
 * Single source of truth: clamp, classification, residual, percent, inconsistencies.
 */

import { CadastroStorage } from '@/lib/cadastro-storage';
import { MobileEvent, ServerStorage } from '@/lib/server-storage';
import { buildOperatorSheet } from '@/lib/operator-sheet-builder';

// ── Shared types ─────────────────────────────────────────────────────────────

export interface StopSlice {
  code: string;
  description: string;
  group: 'IMPRODUTIVA' | 'MANUTENCAO';
  hours: number;
  startedAt?: string;
}

export interface JourneySlice {
  journeyId: string;
  fleetCode: string;
  equipmentId: string;
  operatorRegistration: string;
  operatorName: string;
  operationCode: string;
  operationName: string;
  implementCode: string;
  implementName: string;
  startedAt?: string;
  endedAt?: string;
  status: 'PENDENTE' | 'FINALIZADO';
  hourmeterStart?: number;
  hourmeterEnd?: number;
  totalHourmeter?: number;
  inconsistencies: string[];
  stops: StopSlice[];
}

export interface Catalogs {
  operators: Map<string, Record<string, unknown>>;
  operations: Map<string, Record<string, unknown>>;
  stops: Map<string, Record<string, unknown>>;
  implements: Map<string, Record<string, unknown>>;
  equipment: Map<string, Record<string, unknown>>;
}

/** Result of computing hours for a single journey after clamp/residual */
export interface JourneyComputed {
  total: number;
  productive: number;
  stopUnproductive: number;
  stopMaintenance: number;
  hasReliableJourney: boolean;
}

// ── Primitive helpers ────────────────────────────────────────────────────────

export const MIN_VALID_TIMESTAMP = Date.UTC(2020, 0, 1);

export function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function percent(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, round((part / total) * 100)));
}

export function timestampMs(ts?: string): number | undefined {
  if (!ts) return undefined;
  const value = new Date(ts).getTime();
  return Number.isFinite(value) && value >= MIN_VALID_TIMESTAMP ? value : undefined;
}

export function validIso(ts?: string): string | undefined {
  const value = timestampMs(ts);
  return value !== undefined ? new Date(value).toISOString() : undefined;
}

export function diffHours(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const a = timestampMs(start);
  const b = timestampMs(end);
  return a !== undefined && b !== undefined && b >= a ? (b - a) / 3_600_000 : 0;
}

export function hourBucket(ts?: string): string | undefined {
  const value = timestampMs(ts);
  if (value === undefined) return undefined;
  const d = new Date(value);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

export function inRange(ts: string | undefined, from: Date, to: Date): boolean {
  const t = timestampMs(ts);
  return t !== undefined && t >= from.getTime() && t <= to.getTime();
}

export function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function esc(value: unknown): string {
  const text = value == null ? '' : String(value);
  return text.includes(';') || text.includes('"') || text.includes('\n')
    ? '"' + text.replace(/"/g, '""') + '"'
    : text;
}

// ── Classification ───────────────────────────────────────────────────────────

export function isMaintenanceStop(code: string, description: string, catalog?: Record<string, unknown>): boolean {
  const catalogGroup = normalizeText(str(catalog?.group) || str(catalog?.type) || str(catalog?.category));
  if (catalogGroup === 'manutencao') return true;
  const text = normalizeText([code, description, str(catalog?.name), str(catalog?.description)].join(' '));
  return ['manutencao', 'mecanica', 'oficina', 'corretiva', 'preventiva'].some(term => text.includes(term));
}

// ── Catalog loading ──────────────────────────────────────────────────────────

export function makeCatalogs(tenantId: string): Catalogs {
  const mapBy = (entity: string, fields: string[]) => {
    const map = new Map<string, Record<string, unknown>>();
    for (const row of CadastroStorage.getAll(tenantId, entity) as Array<Record<string, unknown>>) {
      for (const field of fields) {
        const key = str(row[field]);
        if (key) map.set(key, row);
      }
    }
    return map;
  };

  return {
    operators: mapBy('operadores', ['registration', 'matricula', 'code', 'id']),
    operations: mapBy('operacoes', ['code', 'type', 'id']),
    stops: mapBy('paradas', ['code', 'id']),
    implements: mapBy('implementos', ['code', 'id']),
    equipment: mapBy('equipamentos', ['code', 'fleetCode', 'id']),
  };
}

// ── Catalog name resolution ──────────────────────────────────────────────────

export function firstName(catalog: Map<string, Record<string, unknown>>, key: string, fallback = ''): string {
  const row = key ? catalog.get(key) : undefined;
  return str(row?.name) || str(row?.description) || fallback;
}

export function firstCode(catalog: Map<string, Record<string, unknown>>, key: string, fallback = ''): string {
  const row = key ? catalog.get(key) : undefined;
  return str(row?.code) || str(row?.fleetCode) || fallback;
}

// ── Period resolution ────────────────────────────────────────────────────────

export function resolveDefaultPeriod(events: MobileEvent[], from?: string | null, to?: string | null): { from: string; to: string } {
  const validDates = events
    .map(event => new Date(event.timestamp).getTime())
    .filter((value): value is number => Number.isFinite(value) && value >= MIN_VALID_TIMESTAMP)
    .sort((a, b) => a - b);

  const now = new Date();
  const fallbackFrom = validDates[0] ? new Date(validDates[0]) : new Date(now.getTime() - 24 * 3_600_000);
  return {
    from: from || fallbackFrom.toISOString(),
    to: to || now.toISOString(),
  };
}

// ── Journey collection ───────────────────────────────────────────────────────

function getPayload(event: MobileEvent): Record<string, unknown> {
  return (event.payload || {}) as Record<string, unknown>;
}

function ensureJourney(map: Map<string, JourneySlice>, journeyId: string): JourneySlice {
  let item = map.get(journeyId);
  if (!item) {
    item = {
      journeyId,
      fleetCode: '',
      equipmentId: '',
      operatorRegistration: '',
      operatorName: '',
      operationCode: '',
      operationName: '',
      implementCode: '',
      implementName: '',
      status: 'PENDENTE',
      inconsistencies: [],
      stops: [],
    };
    map.set(journeyId, item);
  }
  return item;
}

function applyCommonFields(journey: JourneySlice, event: MobileEvent, catalogs: Catalogs): void {
  const p = getPayload(event);
  journey.fleetCode = journey.fleetCode || str(p.fleetCode) || firstCode(catalogs.equipment, str(p.equipmentId) || event.equipmentId);
  journey.equipmentId = journey.equipmentId || str(p.equipmentId) || event.equipmentId;
  journey.operatorRegistration = journey.operatorRegistration || str(p.operatorRegistration) || str(p.registration) || str(p.operatorId);
  journey.operatorName = journey.operatorName || str(p.operatorName) || firstName(catalogs.operators, journey.operatorRegistration);
  journey.operationCode = journey.operationCode || str(p.operationCode);
  journey.operationName = journey.operationName || str(p.operationName) || firstName(catalogs.operations, journey.operationCode);
  journey.implementCode = journey.implementCode || str(p.implementCode);
  journey.implementName = journey.implementName || str(p.implementName) || firstName(catalogs.implements, journey.implementCode);
  journey.hourmeterStart = journey.hourmeterStart ?? num(p.hourmeterStart);
}

export function collectJourneys(params: {
  tenantId: string;
  events: MobileEvent[];
  catalogs: Catalogs;
  fromDate: Date;
  toDate: Date;
  fleetCode?: string | null;
  operatorRegistration?: string | null;
}): JourneySlice[] {
  const journeys = new Map<string, JourneySlice>();
  const stopSeen = new Set<string>();

  for (const event of params.events) {
    const p = getPayload(event);
    const journeyId = str(p.journeyId);
    if (!journeyId) continue;
    if (!inRange(event.timestamp, params.fromDate, params.toDate)) continue;

    const journey = ensureJourney(journeys, journeyId);
    applyCommonFields(journey, event, params.catalogs);

    if (event.type === 'JOURNEY_START') {
      journey.startedAt = journey.startedAt || validIso(event.timestamp);
      journey.hourmeterStart = journey.hourmeterStart ?? num(p.hourmeterStart) ?? num(p.hourmeter);
    }

    if (event.type === 'STOP_REASON' || event.type === 'PARADA') {
      const code = str(p.stopCode) || str(p.code);
      if (code) {
        const catalog = params.catalogs.stops.get(code);
        const description = str(p.stopDescription) || str(p.description) || str(p.reason) || firstName(params.catalogs.stops, code, code);
        const seconds = num(p.stopDurationSeconds) ?? num(p.durationSeconds);
        const startedAt = validIso(str(p.stopStartedAt) || str(p.startedAt) || event.timestamp);
        if (!startedAt) continue;
        const dedupeKey = [journeyId, code, startedAt].join('|');
        if (stopSeen.has(dedupeKey)) continue;
        stopSeen.add(dedupeKey);
        const endedAt = validIso(str(p.stopEndedAt) || str(p.endedAt));
        const hours = seconds !== undefined ? seconds / 3600 : diffHours(startedAt, endedAt);
        const group = isMaintenanceStop(code, description, catalog) ? 'MANUTENCAO' : 'IMPRODUTIVA';
        journey.stops.push({ code, description, group, hours: Math.max(0, hours), startedAt });
      }
    }

    if (event.type === 'JOURNEY_END') {
      journey.status = 'FINALIZADO';
      journey.endedAt = validIso(str(p.endedAt) || event.timestamp);
      journey.hourmeterStart = journey.hourmeterStart ?? num(p.hourmeterStart);
      journey.hourmeterEnd = num(p.hourmeterEnd) ?? num(p.hourmeter);
      const total = num(p.totalHourmeter);
      journey.totalHourmeter = total !== undefined && total >= 0
        ? total
        : journey.hourmeterEnd !== undefined && journey.hourmeterStart !== undefined
          ? Math.max(0, journey.hourmeterEnd - journey.hourmeterStart)
          : undefined;
    }
  }

  const live = ServerStorage.getLiveFleet(params.tenantId);
  for (const state of live) {
    const journeyId = str(state.journeyId);
    if (!journeyId || !journeys.has(journeyId)) continue;
    const journey = journeys.get(journeyId)!;
    journey.fleetCode = journey.fleetCode || state.fleetCode;
    journey.equipmentId = journey.equipmentId || state.equipmentId;
    journey.operatorRegistration = journey.operatorRegistration || str(state.operatorRegistration) || str(state.registration);
    journey.operatorName = journey.operatorName || str(state.operatorName) || str(state.currentOperator);
    journey.operationCode = journey.operationCode || str(state.operationCode);
    journey.operationName = journey.operationName || str(state.operationName) || str(state.currentOperation);
    journey.implementCode = journey.implementCode || str(state.implementCode);
    journey.implementName = journey.implementName || str((state as unknown as Record<string, unknown>).implementName);
    journey.hourmeterStart = journey.hourmeterStart ?? state.hourmeterStart;
    journey.hourmeterEnd = journey.hourmeterEnd ?? state.hourmeterEnd;
    journey.totalHourmeter = journey.totalHourmeter ?? state.totalHourmeter;
    if (state.status === 'FINALIZADO') journey.status = 'FINALIZADO';
  }

  for (const journey of journeys.values()) {
    if (!journey.fleetCode) continue;
    const ficha = buildOperatorSheet({
      tenantId: params.tenantId,
      fleetCode: journey.fleetCode,
      journeyId: journey.journeyId,
    });
    if (!ficha.ok) continue;
    journey.operatorRegistration = journey.operatorRegistration || ficha.ficha.operatorRegistration || '';
    journey.operatorName = journey.operatorName || ficha.ficha.operatorName || firstName(params.catalogs.operators, journey.operatorRegistration, 'Nao informado');
    journey.operationCode = journey.operationCode || ficha.ficha.operationCode || '';
    journey.operationName = journey.operationName || ficha.ficha.operationName || firstName(params.catalogs.operations, journey.operationCode, 'Nao informado');
    journey.implementCode = journey.implementCode || ficha.ficha.implementCode || '';
    journey.implementName = journey.implementName || ficha.ficha.implementName || firstName(params.catalogs.implements, journey.implementCode, 'Nao informado');
  }

  return Array.from(journeys.values()).filter(journey => {
    if (params.fleetCode && journey.fleetCode !== params.fleetCode) return false;
    if (params.operatorRegistration && journey.operatorRegistration !== params.operatorRegistration) return false;
    return true;
  });
}

// ── Journey total hours (horímetro principal) ────────────────────────────────

export function journeyTotalHours(journey: JourneySlice): number {
  if (journey.status === 'FINALIZADO' && journey.totalHourmeter !== undefined && journey.totalHourmeter >= 0) {
    return journey.totalHourmeter;
  }
  return diffHours(journey.startedAt, journey.endedAt);
}

// ── Clamp stops & compute residual productive ────────────────────────────────

export function computeJourneyHours(journey: JourneySlice): JourneyComputed {
  const total = journeyTotalHours(journey);

  // Clamp each stop to journey total
  let rawStopUnproductive = 0;
  let rawStopMaintenance = 0;
  for (const stop of journey.stops) {
    if (stop.hours > total && total > 0) {
      journey.inconsistencies.push(`stop ${stop.code} duração ${round(stop.hours)}h excede jornada ${round(total)}h – limitada`);
      stop.hours = total;
    }
    if (stop.group === 'IMPRODUTIVA') rawStopUnproductive += stop.hours;
    else rawStopMaintenance += stop.hours;
  }

  // Priority: MANUTENCAO > IMPRODUTIVA > PRODUTIVA
  let stopMaintenance = rawStopMaintenance;
  let stopUnproductive = rawStopUnproductive;
  const rawStopTotal = stopMaintenance + stopUnproductive;

  if (rawStopTotal > total && total > 0) {
    journey.inconsistencies.push('stopHours excede totalHours – recalculado');
    stopMaintenance = Math.min(stopMaintenance, total);
    stopUnproductive = Math.min(stopUnproductive, Math.max(0, total - stopMaintenance));
  }

  // Productive = residual
  const productive = (journey.operationCode || journey.operationName)
    ? Math.max(0, total - stopMaintenance - stopUnproductive)
    : 0;

  // Keep original inconsistency flag
  if (rawStopUnproductive > total && total > 0) {
    if (!journey.inconsistencies.includes('unproductiveHours excede totalHours')) {
      journey.inconsistencies.push('unproductiveHours excede totalHours');
    }
  }

  // Reliable journey check
  const hasReliableJourney = !!journey.journeyId && journey.journeyId.length > 0
    && !!(journey.startedAt || journey.endedAt || journey.status === 'FINALIZADO');

  return { total, productive, stopUnproductive, stopMaintenance, hasReliableJourney };
}

// ── Cap summary totals ───────────────────────────────────────────────────────

export function capSummaryHours(totalHours: number, maint: number, unprod: number, prod: number): { maintenanceHours: number; unproductiveHours: number; productiveHours: number } {
  if (totalHours <= 0) return { maintenanceHours: maint, unproductiveHours: unprod, productiveHours: prod };
  const maintenanceHours = Math.min(maint, totalHours);
  const unproductiveHours = Math.min(unprod, Math.max(0, totalHours - maintenanceHours));
  const productiveHours = Math.min(prod, Math.max(0, totalHours - maintenanceHours - unproductiveHours));
  return { maintenanceHours, unproductiveHours, productiveHours };
}

// ── Timeline helper ──────────────────────────────────────────────────────────

export function addTimeline(
  map: Map<string, { productiveHours: number; unproductiveHours: number; maintenanceHours: number }>,
  hour: string | undefined,
  field: 'productiveHours' | 'unproductiveHours' | 'maintenanceHours',
  value: number,
): void {
  if (!hour || value <= 0) return;
  const current = map.get(hour) || { productiveHours: 0, unproductiveHours: 0, maintenanceHours: 0 };
  current[field] += value;
  map.set(hour, current);
}
