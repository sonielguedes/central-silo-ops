import { FuelJourneyStorage } from './fuel-journey-storage';
import { FuelingStorage, type FuelingRecord } from './fueling-storage';

const TZ = 'America/Sao_Paulo';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FuelJourneyStatus = 'FINALIZADA' | 'ATIVA' | 'INCONSISTENTE';
export type FuelJourneySyncStatus = 'SYNCED' | 'PENDENTE_SYNC' | 'ERRO_SYNC';
export type FuelJourneyEventType = 'JOURNEY_START' | 'PRODUCT_LOAD' | 'POST_REFUEL' | 'FUEL_SUPPLY' | 'JOURNEY_END';

type SourceType = 'APK' | 'WEB' | 'UNKNOWN';

type JourneyBaseEvent = {
  tenantId: string;
  companyCode?: string;
  journeyId: string;
  offlineId: string;
  type: FuelJourneyEventType;
  occurredAt: string;
  source: SourceType;
  syncStatus: FuelJourneySyncStatus;
  payload: Record<string, unknown>;
};

export interface FuelJourneyTimelineItem {
  offlineId: string;
  type: FuelJourneyEventType;
  label: string;
  occurredAt: string;
  occurredAtLabel: string;
  summary: string;
  source: SourceType;
  syncStatus: FuelJourneySyncStatus;
}

export interface FuelJourneyFuelingItem {
  offlineId: string;
  occurredAt: string;
  occurredAtLabel: string;
  fleetCode: string;
  fleetDescription?: string;
  operatorName?: string;
  operatorRegistration?: string;
  pumpCode?: string;
  product?: string;
  liters: number;
  meterStart?: number;
  meterEnd?: number;
  hourmeter?: number;
  odometer?: number;
  source: SourceType;
  syncStatus: FuelJourneySyncStatus;
}

export interface FuelJourneySummary {
  tenantId: string;
  companyCode?: string;
  journeyId: string;
  status: FuelJourneyStatus;
  syncStatus: FuelJourneySyncStatus;
  calculationMode?: string;
  calculationModeLabel?: string;
  comboioFleetCode?: string;
  comboioDescription?: string;
  driverRegistration?: string;
  driverName?: string;
  shift?: string;
  deviceId?: string;
  source?: string;
  startedAt?: string;
  startedAtLabel: string;
  finishedAt?: string;
  finishedAtLabel: string;
  kmInicial?: number;
  kmFinal?: number;
  distanciaPercorrida?: number;
  tanqueInicial?: number;
  totalCarregadoPosto?: number;
  totalAbastecidoMaquinas?: number;
  saldoTeorico?: number;
  saldoFinalAutomatico?: number;
  tanqueFinal?: number;
  diferenca?: number;
  fuelingCount: number;
  dieselLiters: number;
  totalLiters: number;
  eventCount: number;
  timelineCount: number;
  divergent: boolean;
  orphan: boolean;
  hasDuplicate: boolean;
  timeline: FuelJourneyTimelineItem[];
  fuelings: FuelJourneyFuelingItem[];
}

export interface FuelJourneyDetail {
  summary: FuelJourneySummary;
  timeline: FuelJourneyTimelineItem[];
  fuelings: FuelJourneyFuelingItem[];
}

export interface FuelJourneyFilters {
  tenantId: string;
  companyCode?: string;
  journeyId?: string;
  from?: string;
  to?: string;
  status?: FuelJourneyStatus;
  comboio?: string;
  driver?: string;
  source?: string;
  q?: string;
}

function clean(value?: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function isTruthySyncStatus(value: unknown): FuelJourneySyncStatus | undefined {
  const normalized = clean(value).toUpperCase();
  if (!normalized) return undefined;
  if (normalized.includes('ERRO') || normalized.includes('ERROR') || normalized.includes('FAILED')) return 'ERRO_SYNC';
  if (normalized.includes('PEND') || normalized.includes('WAIT')) return 'PENDENTE_SYNC';
  if (normalized.includes('SYNC')) return 'SYNCED';
  return undefined;
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const valueOf = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${valueOf('day')}/${valueOf('month')}/${valueOf('year')} ${valueOf('hour')}:${valueOf('minute')}`;
}

function formatDateKey(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date);
}

function formatModeLabel(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  if (normalized === 'AUTOMATICO' || normalized === 'AUTOMÁTICO') return 'Automático';
  if (normalized === 'MANUAL') return 'Manual';
  return value;
}

function resolveJourneyComboio(record: {
  comboioFleetCode?: string | null;
  comboioDescription?: string | null;
  tankCode?: string | null;
  deviceAlias?: string | null;
}): string {
  const candidate =
    clean(record.comboioFleetCode) ||
    clean(record.comboioDescription) ||
    clean(record.tankCode) ||
    clean(record.deviceAlias);
  if (!candidate || isUuid(candidate)) return 'Não informado';
  return candidate;
}

function normalizeComboioKey(value?: string | null): string {
  const candidate = clean(value);
  return candidate && !isUuid(candidate) ? candidate.toLowerCase() : '';
}

function dedupeByEventId<T extends { offlineId: string }>(events: T[]): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const event of events) {
    if (seen.has(event.offlineId)) continue;
    seen.add(event.offlineId);
    output.push(event);
  }
  return output;
}

function normalizeJourneyRecord(record: Awaited<ReturnType<typeof FuelJourneyStorage.getAll>>[number]): JourneyBaseEvent | null {
  const payload = record.payload ?? {};
  const journeyId = clean(payload.journeyId);
  if (!journeyId) return null;
  const occurredAt = clean(record.occurredAt);
  const syncStatus = isTruthySyncStatus(payload.syncStatus) ?? isTruthySyncStatus(payload.status) ?? 'SYNCED';
  const type = record.type as FuelJourneyEventType;
  return {
    tenantId: record.tenantId,
    companyCode: clean(record.companyCode) || undefined,
    journeyId,
    offlineId: clean(record.eventId),
    type,
    occurredAt,
    source: clean(payload.source).toUpperCase() === 'WEB' ? 'WEB' : 'APK',
    syncStatus,
    payload,
  };
}

function normalizeFuelingRecord(record: FuelingRecord): JourneyBaseEvent | null {
  const journeyId = clean(record.journeyId);
  if (!journeyId) return null;
  return {
    tenantId: record.tenantId,
    companyCode: undefined,
    journeyId,
    offlineId: clean(record.eventId),
    type: 'FUEL_SUPPLY',
    occurredAt: clean(record.fueledAt),
    source: clean(record.source).toUpperCase() === 'WEB' ? 'WEB' : 'APK',
    syncStatus: record.syncStatus === 'SYNCED' ? 'SYNCED' : 'PENDENTE_SYNC',
    payload: {
      fleetCode: record.fleetCode,
      fleetDescription: record.fleetDescription,
      operatorName: record.operatorName,
      operatorRegistration: record.operatorRegistration,
      pumpCode: record.pumpCode,
      productCode: record.fuelType,
      productDescription: record.fuelType,
      fuelType: record.fuelType,
      meterStart: record.hourmeter,
      meterEnd: record.hourmeter,
      liters: record.dieselLiters,
      hourmeter: record.hourmeter,
      odometer: record.odometer,
      source: record.source,
      syncStatus: record.syncStatus,
    },
  };
}

function timelineLabel(type: FuelJourneyEventType): string {
  switch (type) {
    case 'JOURNEY_START':
      return 'Início da jornada';
    case 'PRODUCT_LOAD':
      return 'Carregamento no posto';
    case 'POST_REFUEL':
      return 'Pós-abastecimento';
    case 'FUEL_SUPPLY':
      return 'Abastecimento';
    case 'JOURNEY_END':
      return 'Finalização da jornada';
  }
}

function timelineSummary(event: JourneyBaseEvent): string {
  if (event.type === 'FUEL_SUPPLY') {
    const liters = asNumber(event.payload.liters) ?? 0;
    const fleetCode = clean(event.payload.fleetCode) || '—';
    return `${fleetCode} abastecida com ${liters.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`;
  }
  if (event.type === 'JOURNEY_START') return `Comboio ${resolveJourneyComboio(event.payload)} iniciou jornada`;
  if (event.type === 'JOURNEY_END') return `Comboio ${resolveJourneyComboio(event.payload)} encerrou jornada`;
  if (event.type === 'PRODUCT_LOAD') return `Combustível carregado no posto`;
  return `Evento ${event.type}`;
}

function eventSortWeight(type: FuelJourneyEventType): number {
  switch (type) {
    case 'JOURNEY_START':
      return 0;
    case 'PRODUCT_LOAD':
      return 1;
    case 'POST_REFUEL':
      return 2;
    case 'FUEL_SUPPLY':
      return 3;
    case 'JOURNEY_END':
      return 4;
  }
}

function makeTimelineItem(event: JourneyBaseEvent): FuelJourneyTimelineItem {
  return {
    offlineId: event.offlineId,
    type: event.type,
    label: timelineLabel(event.type),
    occurredAt: event.occurredAt,
    occurredAtLabel: formatDateTime(event.occurredAt),
    summary: timelineSummary(event),
    source: event.source,
    syncStatus: event.syncStatus,
  };
}

function makeFuelingItem(event: JourneyBaseEvent): FuelJourneyFuelingItem {
  const payload = event.payload;
  return {
    offlineId: event.offlineId,
    occurredAt: event.occurredAt,
    occurredAtLabel: formatDateTime(event.occurredAt),
    fleetCode: clean(payload.fleetCode),
    fleetDescription: clean(payload.fleetDescription) || undefined,
    operatorName: clean(payload.operatorName) || undefined,
    operatorRegistration: clean(payload.operatorRegistration) || undefined,
    pumpCode: clean(payload.pumpCode) || undefined,
    product: clean(payload.productDescription) || clean(payload.productCode) || clean(payload.fuelType) || undefined,
    liters: asNumber(payload.liters) ?? 0,
    meterStart: asNumber(payload.meterStart),
    meterEnd: asNumber(payload.meterEnd),
    hourmeter: asNumber(payload.hourmeter),
    odometer: asNumber(payload.odometer),
    source: event.source,
    syncStatus: event.syncStatus,
  };
}

function mergeEvents(tenantId: string): JourneyBaseEvent[] {
  const journeys = dedupeByEventId(
    FuelJourneyStorage.getAll(tenantId).map(normalizeJourneyRecord).filter((event): event is JourneyBaseEvent => Boolean(event)),
  );
  const fuelings = dedupeByEventId(
    FuelingStorage.getAll(tenantId).map(normalizeFuelingRecord).filter((event): event is JourneyBaseEvent => Boolean(event)),
  );
  return [...journeys, ...fuelings].sort((a, b) => {
    const aTime = Date.parse(a.occurredAt);
    const bTime = Date.parse(b.occurredAt);
    if (aTime !== bTime) return aTime - bTime;
    return eventSortWeight(a.type) - eventSortWeight(b.type);
  });
}

function journeyIdentityKey(item: FuelJourneySummary): string {
  const companyCode = clean(item.companyCode).toLowerCase();
  const comboio = normalizeComboioKey(item.comboioFleetCode) || normalizeComboioKey(item.comboioDescription);
  return `${companyCode}::${comboio}`;
}

function cloneSummary(item: FuelJourneySummary): FuelJourneySummary {
  return {
    ...item,
    timeline: [...item.timeline],
    fuelings: [...item.fuelings],
  };
}

function enforceSingleActiveJourneyPerComboio(items: FuelJourneySummary[]): FuelJourneySummary[] {
  const groups = new Map<string, FuelJourneySummary[]>();
  for (const item of items) {
    if (item.status !== 'ATIVA') continue;
    const key = journeyIdentityKey(item);
    if (!key || key.endsWith('::')) continue;
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  if (groups.size === 0) return items;

  const byJourneyId = new Map(items.map((item) => [item.journeyId, cloneSummary(item)]));
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    const sorted = [...group].sort((a, b) => (b.startedAt || b.finishedAt || '').localeCompare(a.startedAt || a.finishedAt || '') || b.journeyId.localeCompare(a.journeyId));
    for (const duplicate of sorted.slice(1)) {
      const target = byJourneyId.get(duplicate.journeyId);
      if (!target) continue;
      target.status = 'INCONSISTENTE';
      target.divergent = true;
      target.hasDuplicate = true;
    }
  }

  return items.map((item) => byJourneyId.get(item.journeyId) ?? cloneSummary(item));
}

function groupKey(event: JourneyBaseEvent): string {
  return `${event.tenantId}::${event.journeyId}`;
}

function toSummary(events: JourneyBaseEvent[]): FuelJourneySummary {
  const base = events[0];
  const start = events.find((event) => event.type === 'JOURNEY_START');
  const end = [...events].reverse().find((event) => event.type === 'JOURNEY_END');
  const fuelings = events.filter((event) => event.type === 'FUEL_SUPPLY').map(makeFuelingItem);
  const timeline = dedupeByEventId(events).map(makeTimelineItem).sort((a, b) => {
    const aTime = Date.parse(a.occurredAt);
    const bTime = Date.parse(b.occurredAt);
    if (aTime !== bTime) return aTime - bTime;
    return eventSortWeight(a.type) - eventSortWeight(b.type);
  });

  const hasStart = Boolean(start);
  const hasEnd = Boolean(end);
  const orphan = !hasStart && events.length > 0;
  const syncStatus = events.some((event) => event.syncStatus === 'ERRO_SYNC')
    ? 'ERRO_SYNC'
    : events.some((event) => event.syncStatus === 'PENDENTE_SYNC')
      ? 'PENDENTE_SYNC'
      : 'SYNCED';
  const status: FuelJourneyStatus = orphan ? 'INCONSISTENTE' : hasEnd ? 'FINALIZADA' : 'ATIVA';
  const startPayload = start?.payload ?? {};
  const endPayload = end?.payload ?? {};

  const saldoFinalAutomatico = asNumber(endPayload.saldoFinalAutomatico);
  const totalLiters = fuelings.reduce((sum, item) => sum + (Number(item.liters) || 0), 0);
  const divergent = Boolean(orphan || (saldoFinalAutomatico != null && saldoFinalAutomatico < 0) || syncStatus !== 'SYNCED');

  return {
    tenantId: base.tenantId,
    companyCode: events.find((event) => event.companyCode)?.companyCode,
    journeyId: base.journeyId,
    status,
    syncStatus,
    calculationMode: clean(endPayload.calculationMode) || undefined,
    calculationModeLabel: formatModeLabel(clean(endPayload.calculationMode)) || undefined,
    comboioFleetCode: clean(startPayload.comboioFleetCode) || clean(endPayload.comboioFleetCode) || undefined,
    comboioDescription: clean(startPayload.comboioDescription) || clean(endPayload.comboioDescription) || undefined,
    driverRegistration: clean(startPayload.driverRegistration) || clean(endPayload.driverRegistration) || undefined,
    driverName: clean(startPayload.driverName) || clean(endPayload.driverName) || undefined,
    shift: clean(startPayload.shift) || clean(endPayload.shift) || undefined,
    deviceId: clean(base.payload.deviceId) || undefined,
    source: clean(endPayload.source) || clean(startPayload.source) || 'APK',
    startedAt: clean(startPayload.startedAt) || base.occurredAt,
    startedAtLabel: formatDateTime(clean(startPayload.startedAt) || base.occurredAt),
    finishedAt: clean(endPayload.finishedAt) || (hasEnd ? end?.occurredAt : undefined),
    finishedAtLabel: clean(endPayload.finishedAt) || (hasEnd ? end?.occurredAt : undefined)
      ? formatDateTime(clean(endPayload.finishedAt) || (hasEnd ? end?.occurredAt : undefined))
      : 'Em andamento',
    kmInicial: asNumber(startPayload.kmInicial) ?? asNumber(endPayload.kmInicial),
    kmFinal: asNumber(endPayload.kmFinal),
    distanciaPercorrida: asNumber(endPayload.distanciaPercorrida),
    tanqueInicial: asNumber(startPayload.tanqueInicial) ?? asNumber(endPayload.tanqueInicial),
    totalCarregadoPosto: asNumber(endPayload.totalCarregadoPosto),
    totalAbastecidoMaquinas: asNumber(endPayload.totalAbastecidoMaquinas),
    saldoTeorico: asNumber(endPayload.saldoTeorico),
    saldoFinalAutomatico,
    tanqueFinal: asNumber(endPayload.tanqueFinal),
    diferenca: asNumber(endPayload.diferenca),
    fuelingCount: fuelings.length,
    dieselLiters: Math.round(totalLiters * 10) / 10,
    totalLiters: Math.round(totalLiters * 10) / 10,
    eventCount: events.length,
    timelineCount: timeline.length,
    divergent,
    orphan,
    hasDuplicate: false,
    timeline,
    fuelings,
  };
}

function matchesFilter(item: FuelJourneySummary, filters: Omit<FuelJourneyFilters, 'tenantId'>): boolean {
  if (filters.companyCode && item.companyCode !== filters.companyCode) return false;
  if (filters.status && item.status !== filters.status) return false;
  if (filters.comboio && !(resolveJourneyComboio({ comboioFleetCode: item.comboioFleetCode, comboioDescription: item.comboioDescription }).toLowerCase().includes(filters.comboio.toLowerCase()))) return false;
  if (filters.driver && !(clean(item.driverName).toLowerCase().includes(filters.driver.toLowerCase()) || clean(item.driverRegistration).includes(filters.driver))) return false;
  if (filters.source && !(clean(item.source).toLowerCase().includes(filters.source.toLowerCase()))) return false;
  if (filters.q) {
    const term = filters.q.toLowerCase();
    const haystack = [
      item.journeyId,
      item.companyCode ?? '',
      item.comboioFleetCode ?? '',
      item.comboioDescription ?? '',
      item.driverName ?? '',
      item.driverRegistration ?? '',
      item.shift ?? '',
      item.status,
      item.syncStatus,
    ].join(' ').toLowerCase();
    if (!haystack.includes(term)) return false;
  }
  return true;
}

function withinRange(item: FuelJourneySummary, from?: string, to?: string): boolean {
  const pivot = item.startedAt || item.finishedAt;
  if (!pivot) return true;
  const ts = Date.parse(pivot);
  if (Number.isNaN(ts)) return true;
  if (from) {
    const fromTs = Date.parse(from);
    if (!Number.isNaN(fromTs) && ts < fromTs) return false;
  }
  if (to) {
    const toTs = Date.parse(to);
    if (!Number.isNaN(toTs) && ts > toTs) return false;
  }
  return true;
}

export function dedupeFuelJourneyEvents<T extends { offlineId: string }>(events: T[]): T[] {
  return dedupeByEventId(events);
}

export function resolveJourneyStatus(events: Array<{ type: FuelJourneyEventType; syncStatus?: FuelJourneySyncStatus }>): {
  status: FuelJourneyStatus;
  syncStatus: FuelJourneySyncStatus;
  orphan: boolean;
} {
  const hasStart = events.some((event) => event.type === 'JOURNEY_START');
  const hasEnd = events.some((event) => event.type === 'JOURNEY_END');
  const syncStatus = events.some((event) => event.syncStatus === 'ERRO_SYNC')
    ? 'ERRO_SYNC'
    : events.some((event) => event.syncStatus === 'PENDENTE_SYNC')
      ? 'PENDENTE_SYNC'
      : 'SYNCED';
  return {
    status: !hasStart && events.length > 0 ? 'INCONSISTENTE' : hasEnd ? 'FINALIZADA' : 'ATIVA',
    syncStatus,
    orphan: !hasStart && events.length > 0,
  };
}

export function listFuelJourneys(filters: FuelJourneyFilters): FuelJourneySummary[] {
  const events = mergeEvents(filters.tenantId);
  const groups = new Map<string, JourneyBaseEvent[]>();
  for (const event of events) {
    if (filters.journeyId && event.journeyId !== filters.journeyId) continue;
    const key = groupKey(event);
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }

  const items = Array.from(groups.values()).map(toSummary).filter((item) => withinRange(item, filters.from, filters.to) && matchesFilter(item, filters));
  return enforceSingleActiveJourneyPerComboio(
    items.sort((a, b) => (b.startedAt || b.finishedAt || '').localeCompare(a.startedAt || a.finishedAt || '') || b.journeyId.localeCompare(a.journeyId)),
  );
}

export function getFuelJourneyDetails(tenantId: string, journeyId: string, companyCode?: string): FuelJourneyDetail | null {
  const items = listFuelJourneys({ tenantId, journeyId, companyCode });
  const summary = items[0];
  if (!summary) return null;
  return {
    summary,
    timeline: summary.timeline,
    fuelings: summary.fuelings,
  };
}

export function calculateJourneyKpis(journeys: FuelJourneySummary[], date?: string): {
  journeysToday: number;
  finalized: number;
  active: number;
  dieselLiters: number;
  saldoFinalTotal: number;
  divergences: number;
  inconsistent: number;
  pendingSync: number;
} {
  const today = date ? new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(date)) : new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  const journeysToday = journeys.filter((journey) => formatDateKey(journey.startedAt) === today).length;
  const finalized = journeys.filter((journey) => journey.status === 'FINALIZADA').length;
  const active = journeys.filter((journey) => journey.status === 'ATIVA').length;
  const dieselLiters = Math.round(journeys.reduce((sum, journey) => sum + journey.dieselLiters, 0) * 10) / 10;
  const saldoFinalTotal = Math.round(journeys.reduce((sum, journey) => sum + (journey.status === 'FINALIZADA' ? (journey.saldoFinalAutomatico ?? 0) : 0), 0) * 10) / 10;
  const divergences = journeys.filter((journey) => journey.divergent).length;
  const inconsistent = journeys.filter((journey) => journey.status === 'INCONSISTENTE').length;
  const pendingSync = journeys.filter((journey) => journey.syncStatus === 'PENDENTE_SYNC').length;

  return { journeysToday, finalized, active, dieselLiters, saldoFinalTotal, divergences, inconsistent, pendingSync };
}

export function listFuelJourneyFuelings(tenantId: string, journeyId?: string): FuelJourneyFuelingItem[] {
  const summaries = listFuelJourneys({ tenantId, journeyId });
  return summaries.flatMap((journey) => journey.fuelings);
}

export function findActiveFuelJourneyByComboio(tenantId: string, companyCode: string | undefined, comboioFleetCode: string | undefined): FuelJourneySummary | null {
  const comboioKey = normalizeComboioKey(comboioFleetCode);
  if (!comboioKey) return null;

  const active = listFuelJourneys({
    tenantId,
    companyCode,
    status: 'ATIVA',
  }).filter((item) => {
    const itemKey = normalizeComboioKey(item.comboioFleetCode) || normalizeComboioKey(item.comboioDescription);
    return itemKey === comboioKey;
  });

  if (!active.length) return null;
  return active.sort((a, b) => (b.startedAt || b.finishedAt || '').localeCompare(a.startedAt || a.finishedAt || '') || b.journeyId.localeCompare(a.journeyId))[0];
}

export { formatDateTime as formatFuelJourneyDateTime, resolveJourneyComboio };
