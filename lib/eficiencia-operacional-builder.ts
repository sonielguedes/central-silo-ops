import { CadastroStorage } from '@/lib/cadastro-storage';
import { MobileEvent, ServerStorage } from '@/lib/server-storage';
import { buildOperatorSheet } from '@/lib/operator-sheet-builder';

export interface EfficiencyReport {
  period: { from: string; to: string };
  summary: {
    totalHours: number;
    productiveHours: number;
    unproductiveHours: number;
    maintenanceHours: number;
    productivePercent: number;
    unproductivePercent: number;
    maintenancePercent: number;
    totalJourneys: number;
    finalizedJourneys: number;
    pendingJourneys: number;
  };
  topStops: Array<{ code: string; description: string; hours: number; percent: number; occurrences: number }>;
  byFleet: Array<{
    fleetCode: string;
    operatorName: string;
    operationName: string;
    implementName: string;
    totalHours: number;
    productiveHours: number;
    unproductiveHours: number;
    maintenanceHours?: number;
    productivePercent?: number;
    unproductivePercent?: number;
    maintenancePercent?: number;
    stopsCount: number;
    finalizedJourneys: number;
    hourmeterInconsistent?: boolean;
    inconsistencies?: string[];
  }>;
  byOperator: Array<{
    registration: string;
    name: string;
    totalHours: number;
    productiveHours: number;
    unproductiveHours: number;
    efficiencyPercent: number;
  }>;
  byOperation: Array<{ code: string; name: string; hours: number; percent: number }>;
  timeline: Array<{ hour: string; productiveHours: number; unproductiveHours: number; maintenanceHours: number }>;
}

export type EfficiencyResult =
  | { ok: true; report: EfficiencyReport }
  | { ok: false; status: number; error: string };

interface Catalogs {
  operators: Map<string, Record<string, unknown>>;
  operations: Map<string, Record<string, unknown>>;
  stops: Map<string, Record<string, unknown>>;
  implements: Map<string, Record<string, unknown>>;
  equipment: Map<string, Record<string, unknown>>;
}

interface StopSlice {
  code: string;
  description: string;
  group: 'IMPRODUTIVA' | 'MANUTENCAO';
  hours: number;
  startedAt?: string;
}

interface JourneySlice {
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

const MIN_VALID_TIMESTAMP = Date.UTC(2020, 0, 1);

const ZERO_SUMMARY: EfficiencyReport['summary'] = {
  totalHours: 0,
  productiveHours: 0,
  unproductiveHours: 0,
  maintenanceHours: 0,
  productivePercent: 0,
  unproductivePercent: 0,
  maintenancePercent: 0,
  totalJourneys: 0,
  finalizedJourneys: 0,
  pendingJourneys: 0,
};

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function percent(part: number, total: number): number {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.min(100, Math.max(0, round((part / total) * 100)));
}

function diffHours(start?: string, end?: string): number {
  if (!start || !end) return 0;
  const a = timestampMs(start);
  const b = timestampMs(end);
  return a !== undefined && b !== undefined && b >= a ? (b - a) / 3_600_000 : 0;
}

function timestampMs(ts?: string): number | undefined {
  if (!ts) return undefined;
  const value = new Date(ts).getTime();
  return Number.isFinite(value) && value >= MIN_VALID_TIMESTAMP ? value : undefined;
}

function validIso(ts?: string): string | undefined {
  const value = timestampMs(ts);
  return value !== undefined ? new Date(value).toISOString() : undefined;
}

function hourBucket(ts?: string): string | undefined {
  const value = timestampMs(ts);
  if (value === undefined) return undefined;
  const d = new Date(value);
  d.setMinutes(0, 0, 0);
  return d.toISOString();
}

function inRange(ts: string | undefined, from: Date, to: Date): boolean {
  const t = timestampMs(ts);
  return t !== undefined && t >= from.getTime() && t <= to.getTime();
}

function normalizeText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isMaintenanceStop(code: string, description: string, catalog?: Record<string, unknown>): boolean {
  const catalogGroup = normalizeText(str(catalog?.group) || str(catalog?.type) || str(catalog?.category));
  if (catalogGroup === 'manutencao') return true;
  const text = normalizeText([code, description, str(catalog?.name), str(catalog?.description)].join(' '));
  return ['manutencao', 'mecanica', 'oficina', 'corretiva', 'preventiva'].some(term => text.includes(term));
}

function makeCatalogs(tenantId: string): Catalogs {
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

function getPayload(event: MobileEvent): Record<string, unknown> {
  return (event.payload || {}) as Record<string, unknown>;
}

function firstName(catalog: Map<string, Record<string, unknown>>, key: string, fallback = ''): string {
  const row = key ? catalog.get(key) : undefined;
  return str(row?.name) || str(row?.description) || fallback;
}

function firstCode(catalog: Map<string, Record<string, unknown>>, key: string, fallback = ''): string {
  const row = key ? catalog.get(key) : undefined;
  return str(row?.code) || str(row?.fleetCode) || fallback;
}

function resolveDefaultPeriod(events: MobileEvent[], from?: string | null, to?: string | null): { from: string; to: string } {
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

function collectJourneys(params: {
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

function journeyTotalHours(journey: JourneySlice): number {
  if (journey.status === 'FINALIZADO' && journey.totalHourmeter !== undefined && journey.totalHourmeter >= 0) {
    return journey.totalHourmeter;
  }
  return diffHours(journey.startedAt, journey.endedAt);
}

function addTimeline(
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

export function buildEfficiencyReport(params: {
  tenantId: string;
  from?: string | null;
  to?: string | null;
  fleetCode?: string | null;
  operatorRegistration?: string | null;
}): EfficiencyResult {
  const allEvents = ServerStorage.getEvents(params.tenantId);
  const period = resolveDefaultPeriod(allEvents, params.from, params.to);
  const fromDate = new Date(period.from);
  const toDate = new Date(period.to);

  if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime())) {
    return { ok: false, status: 400, error: 'Periodo invalido' };
  }
  if (toDate < fromDate) {
    return { ok: false, status: 400, error: 'Periodo final menor que inicial' };
  }

  const catalogs = makeCatalogs(params.tenantId);
  const journeys = collectJourneys({
    tenantId: params.tenantId,
    events: allEvents,
    catalogs,
    fromDate,
    toDate,
    fleetCode: params.fleetCode,
    operatorRegistration: params.operatorRegistration,
  });

  if (journeys.length === 0) {
    return {
      ok: true,
      report: { period, summary: ZERO_SUMMARY, topStops: [], byFleet: [], byOperator: [], byOperation: [], timeline: [] },
    };
  }

  const stopMap = new Map<string, { code: string; description: string; hours: number; occurrences: number }>();
  const fleetMap = new Map<string, EfficiencyReport['byFleet'][number]>();
  const operatorMap = new Map<string, EfficiencyReport['byOperator'][number]>();
  const operationMap = new Map<string, EfficiencyReport['byOperation'][number]>();
  const timelineMap = new Map<string, { productiveHours: number; unproductiveHours: number; maintenanceHours: number }>();

  let totalHours = 0;
  let productiveHours = 0;
  let unproductiveHours = 0;
  let maintenanceHours = 0;
  let finalizedJourneys = 0;

  for (const journey of journeys) {
    const total = journeyTotalHours(journey);

    // --- C4.4 Fix: Clamp each stop duration to journey total ---
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

    // --- C4.4 Fix: Priorizar MANUTENCAO/IMPRODUTIVA, cap ao total ---
    let stopMaintenance = rawStopMaintenance;
    let stopUnproductive = rawStopUnproductive;
    const rawStopTotal = stopMaintenance + stopUnproductive;

    if (rawStopTotal > total && total > 0) {
      journey.inconsistencies.push('stopHours excede totalHours – recalculado');
      // Manutenção tem prioridade, depois improdutiva
      stopMaintenance = Math.min(stopMaintenance, total);
      stopUnproductive = Math.min(stopUnproductive, Math.max(0, total - stopMaintenance));
    }

    // Produtiva = residual após paradas (nunca negativa)
    const productive = (journey.operationCode || journey.operationName)
      ? Math.max(0, total - stopMaintenance - stopUnproductive)
      : 0;

    // Flag de inconsistência original mantida
    if (rawStopUnproductive > total && total > 0) {
      if (!journey.inconsistencies.includes('unproductiveHours excede totalHours')) {
        journey.inconsistencies.push('unproductiveHours excede totalHours');
      }
    }

    // --- C4.4 Fix: journeyId confiável para somar em byFleet ---
    const hasReliableJourney = !!journey.journeyId && journey.journeyId.length > 0
      && (journey.startedAt || journey.endedAt || journey.status === 'FINALIZADO');

    totalHours += total;
    productiveHours += productive;
    unproductiveHours += stopUnproductive;
    maintenanceHours += stopMaintenance;
    if (journey.status === 'FINALIZADO') finalizedJourneys++;

    addTimeline(timelineMap, hourBucket(journey.startedAt || journey.endedAt), 'productiveHours', productive);
    for (const stop of journey.stops) {
      addTimeline(timelineMap, hourBucket(stop.startedAt), stop.group === 'MANUTENCAO' ? 'maintenanceHours' : 'unproductiveHours', stop.hours);
      const key = stop.code || stop.description;
      const current = stopMap.get(key) || { code: stop.code, description: stop.description, hours: 0, occurrences: 0 };
      current.hours += stop.hours;
      current.occurrences += 1;
      stopMap.set(key, current);
    }

    // --- C4.4 Fix: Stops sem journeyId confiável não somam no byFleet ---
    if (!hasReliableJourney) {
      journey.inconsistencies.push('journeyId não confiável – excluído do byFleet');
      // Não acumula no byFleet, mas stops já estão no stopMap/topStops
    } else {
      const fleetKey = journey.fleetCode || 'NAO_INFORMADO';
      const fleet = fleetMap.get(fleetKey) || {
        fleetCode: fleetKey,
        operatorName: journey.operatorName || 'Nao informado',
        operationName: journey.operationName || 'Nao informado',
        implementName: journey.implementName || 'Nao informado',
        totalHours: 0,
        productiveHours: 0,
        unproductiveHours: 0,
        maintenanceHours: 0,
        productivePercent: 0,
        unproductivePercent: 0,
        maintenancePercent: 0,
        stopsCount: 0,
        finalizedJourneys: 0,
        hourmeterInconsistent: false,
        inconsistencies: [],
      };
      fleet.totalHours += total;
      fleet.productiveHours += productive;
      fleet.unproductiveHours += stopUnproductive;
      fleet.maintenanceHours = (fleet.maintenanceHours || 0) + stopMaintenance;
      fleet.stopsCount += journey.stops.length;
      fleet.finalizedJourneys += journey.status === 'FINALIZADO' ? 1 : 0;
      if (journey.inconsistencies.length > 0) {
        fleet.hourmeterInconsistent = true;
        fleet.inconsistencies = Array.from(new Set([...(fleet.inconsistencies || []), ...journey.inconsistencies]));
      }
      fleetMap.set(fleetKey, fleet);
    }

    const opReg = journey.operatorRegistration || 'NAO_INFORMADO';
    const operator = operatorMap.get(opReg) || {
      registration: opReg,
      name: journey.operatorName || firstName(catalogs.operators, opReg, 'Nao informado'),
      totalHours: 0,
      productiveHours: 0,
      unproductiveHours: 0,
      efficiencyPercent: 0,
    };
    operator.totalHours += total;
    operator.productiveHours += productive;
    operator.unproductiveHours += stopUnproductive + stopMaintenance;
    operatorMap.set(opReg, operator);

    const opCode = journey.operationCode || 'NAO_INFORMADO';
    if (productive > 0) {
      const operation = operationMap.get(opCode) || {
        code: opCode,
        name: journey.operationName || firstName(catalogs.operations, opCode, 'Nao informado'),
        hours: 0,
        percent: 0,
      };
      operation.hours += productive;
      operationMap.set(opCode, operation);
    }
  }

  const byFleet = Array.from(fleetMap.values())
    .map(item => {
      const inconsistencies = [...(item.inconsistencies || [])];
      if (item.unproductiveHours > item.totalHours) {
        inconsistencies.push('unproductiveHours excede totalHours da frota');
      }
      if (item.unproductiveHours + (item.maintenanceHours || 0) > item.totalHours) {
        inconsistencies.push('paradas excedem totalHours da frota');
      }
      // --- C4.4 Fix: Cap por frota – mesma lógica de prioridade ---
      const t = item.totalHours;
      let maint = Math.min(item.maintenanceHours || 0, t);
      let unprod = Math.min(item.unproductiveHours, Math.max(0, t - maint));
      let prod = Math.min(item.productiveHours, Math.max(0, t - maint - unprod));
      return {
        ...item,
        totalHours: round(t),
        productiveHours: round(prod),
        unproductiveHours: round(unprod),
        maintenanceHours: round(maint),
        productivePercent: percent(prod, t),
        unproductivePercent: percent(unprod, t),
        maintenancePercent: percent(maint, t),
        hourmeterInconsistent: inconsistencies.length > 0,
        inconsistencies: Array.from(new Set(inconsistencies)),
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);

  const byOperator = Array.from(operatorMap.values())
    .map(item => ({
      ...item,
      totalHours: round(item.totalHours),
      productiveHours: round(item.productiveHours),
      unproductiveHours: round(item.unproductiveHours),
      efficiencyPercent: percent(item.productiveHours, item.totalHours),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  const byOperation = Array.from(operationMap.values())
    .map(item => ({ ...item, hours: round(item.hours), percent: percent(item.hours, totalHours) }))
    .sort((a, b) => b.hours - a.hours);

  const topStops = Array.from(stopMap.values())
    .map(item => ({ ...item, hours: round(item.hours), percent: percent(item.hours, totalHours) }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);

  const timeline = Array.from(timelineMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, item]) => ({
      hour,
      productiveHours: round(item.productiveHours),
      unproductiveHours: round(item.unproductiveHours),
      maintenanceHours: round(item.maintenanceHours),
    }));

  // --- C4.4 Fix: Cap summary so productive+unproductive+maintenance ≤ totalHours ---
  if (totalHours > 0) {
    // Manutenção e improdutiva têm prioridade; produtiva = residual
    maintenanceHours = Math.min(maintenanceHours, totalHours);
    unproductiveHours = Math.min(unproductiveHours, Math.max(0, totalHours - maintenanceHours));
    productiveHours = Math.min(productiveHours, Math.max(0, totalHours - maintenanceHours - unproductiveHours));
  }

  return {
    ok: true,
    report: {
      period,
      summary: {
        totalHours: round(totalHours),
        productiveHours: round(productiveHours),
        unproductiveHours: round(unproductiveHours),
        maintenanceHours: round(maintenanceHours),
        productivePercent: percent(productiveHours, totalHours),
        unproductivePercent: percent(unproductiveHours, totalHours),
        maintenancePercent: percent(maintenanceHours, totalHours),
        totalJourneys: journeys.length,
        finalizedJourneys,
        pendingJourneys: journeys.length - finalizedJourneys,
      },
      topStops,
      byFleet,
      byOperator,
      byOperation,
      timeline,
    },
  };
}

function esc(value: unknown): string {
  const text = value == null ? '' : String(value);
  return text.includes(';') || text.includes('"') || text.includes('\n')
    ? '"' + text.replace(/"/g, '""') + '"'
    : text;
}

export function buildEfficiencyCsv(report: EfficiencyReport): string {
  const rows = [
    'periodo_inicio;periodo_fim;frota;operador;operacao;implemento;grupo;codigo;descricao;horas;percentual;jornadas_finalizadas;paradas',
  ];

  for (const item of report.byFleet) {
    rows.push([
      report.period.from,
      report.period.to,
      item.fleetCode,
      item.operatorName,
      item.operationName,
      item.implementName,
      'PRODUTIVA',
      '',
      'Horas produtivas',
      item.productiveHours.toFixed(2),
      percent(item.productiveHours, item.totalHours).toFixed(2),
      item.finalizedJourneys,
      item.stopsCount,
    ].map(esc).join(';'));

    rows.push([
      report.period.from,
      report.period.to,
      item.fleetCode,
      item.operatorName,
      item.operationName,
      item.implementName,
      'IMPRODUTIVA',
      '',
      'Paradas e improdutividade',
      item.unproductiveHours.toFixed(2),
      percent(item.unproductiveHours, item.totalHours).toFixed(2),
      item.finalizedJourneys,
      item.stopsCount,
    ].map(esc).join(';'));

    rows.push([
      report.period.from,
      report.period.to,
      item.fleetCode,
      item.operatorName,
      item.operationName,
      item.implementName,
      'MANUTENCAO',
      '',
      'Horas de manutencao',
      (item.maintenanceHours || 0).toFixed(2),
      percent(item.maintenanceHours || 0, item.totalHours).toFixed(2),
      item.finalizedJourneys,
      item.stopsCount,
    ].map(esc).join(';'));
  }

  for (const stop of report.topStops) {
    rows.push([
      report.period.from,
      report.period.to,
      '',
      '',
      '',
      '',
      'PARADA',
      stop.code,
      stop.description,
      stop.hours.toFixed(2),
      stop.percent.toFixed(2),
      report.summary.finalizedJourneys,
      stop.occurrences,
    ].map(esc).join(';'));
  }

  return '\uFEFF' + rows.join('\n');
}
