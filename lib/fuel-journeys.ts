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
  journeyId?: string;
  journeyOfflineId?: string;
  comboioFleetCode?: string;
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
  journeyOfflineId?: string;
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
  tankInitialLiters?: number;
  totalLoadedLiters?: number;
  totalSuppliedLiters?: number;
  theoreticalFinalBalanceLiters?: number;
  realFinalBalanceLiters?: number;
  divergenceLiters?: number;
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
  inconsistencyReasons: string[];
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
  const journeyOfflineId = clean(record.journeyOfflineId);
  if (!journeyId && !journeyOfflineId) return null;
  return {
    tenantId: record.tenantId,
    companyCode: clean(record.companyCode) || undefined,
    journeyId: journeyId || journeyOfflineId,
    offlineId: clean(record.eventId),
    type: 'FUEL_SUPPLY',
    occurredAt: clean(record.fueledAt),
    source: clean(record.source).toUpperCase() === 'WEB' ? 'WEB' : 'APK',
    syncStatus: record.syncStatus === 'SYNCED' ? 'SYNCED' : 'PENDENTE_SYNC',
    payload: {
      companyCode: clean(record.companyCode) || undefined,
      fleetCode: record.fleetCode,
      comboioFleetCode: clean(record.comboioFleetCode) || clean(record.truckFleetCode) || undefined,
      journeyOfflineId: journeyOfflineId || undefined,
      journeyId: journeyId || undefined,
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
    journeyId: clean(payload.journeyId) || undefined,
    journeyOfflineId: clean(payload.journeyOfflineId) || undefined,
    comboioFleetCode: clean(payload.comboioFleetCode) || undefined,
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

type JourneyBundle = {
  tenantId: string;
  companyCode?: string;
  journeyId: string;
  journeyOfflineId?: string;
  comboioFleetCode?: string;
  comboioDescription?: string;
  startedAt?: string;
  finishedAt?: string;
  events: JourneyBaseEvent[];
  fuelings: JourneyBaseEvent[];
};

function loadJourneyEvents(tenantId: string): JourneyBaseEvent[] {
  return dedupeByEventId(
    FuelJourneyStorage.getAll(tenantId).map(normalizeJourneyRecord).filter((event): event is JourneyBaseEvent => Boolean(event)),
  ).sort((a, b) => {
    const aTime = Date.parse(a.occurredAt);
    const bTime = Date.parse(b.occurredAt);
    if (aTime !== bTime) return aTime - bTime;
    return eventSortWeight(a.type) - eventSortWeight(b.type);
  });
}

function loadFuelingEvents(tenantId: string): JourneyBaseEvent[] {
  return dedupeByEventId(
    FuelingStorage.getAll(tenantId).map(normalizeFuelingRecord).filter((event): event is JourneyBaseEvent => Boolean(event)),
  ).sort((a, b) => {
    const aTime = Date.parse(a.occurredAt);
    const bTime = Date.parse(b.occurredAt);
    if (aTime !== bTime) return aTime - bTime;
    return eventSortWeight(a.type) - eventSortWeight(b.type);
  });
}

function makeJourneyBundleFromEvents(events: JourneyBaseEvent[]): JourneyBundle {
  const start = events.find((event) => event.type === 'JOURNEY_START');
  const end = [...events].reverse().find((event) => event.type === 'JOURNEY_END');
  const startPayload = start?.payload ?? {};
  const endPayload = end?.payload ?? {};
  const base = events[0] as JourneyBaseEvent;
  return {
    tenantId: base.tenantId,
    companyCode: events.find((event) => event.companyCode)?.companyCode || clean(startPayload.companyCode) || clean(endPayload.companyCode) || undefined,
    journeyId: base.journeyId,
    journeyOfflineId: clean(startPayload.journeyOfflineId) || clean(endPayload.journeyOfflineId) || undefined,
    comboioFleetCode: clean(startPayload.comboioFleetCode) || clean(startPayload.comboio) || clean(endPayload.comboioFleetCode) || clean(endPayload.comboio) || undefined,
    comboioDescription: clean(startPayload.comboioDescription) || clean(endPayload.comboioDescription) || undefined,
    startedAt: clean(startPayload.startedAt) || base.occurredAt,
    finishedAt: clean(endPayload.finishedAt) || clean(endPayload.endedAt) || (end ? end.occurredAt : undefined),
    events,
    fuelings: [],
  };
}

function bundleComboioKey(bundle: JourneyBundle): string {
  return normalizeComboioKey(bundle.comboioFleetCode) || normalizeComboioKey(bundle.comboioDescription);
}

function fuelingComboioKey(event: JourneyBaseEvent): string {
  return normalizeComboioKey(clean(event.payload.comboioFleetCode) || clean(event.payload.comboio) || clean(event.payload.truckFleetCode));
}

function fuelingJourneyId(event: JourneyBaseEvent): string {
  return clean(event.payload.journeyId);
}

function fuelingJourneyOfflineId(event: JourneyBaseEvent): string {
  return clean(event.payload.journeyOfflineId);
}

function eventOccursWithinBundleWindow(event: JourneyBaseEvent, bundle: JourneyBundle): boolean {
  if (!bundle.startedAt) return false;
  const eventTs = Date.parse(event.occurredAt);
  const startTs = Date.parse(bundle.startedAt);
  if (Number.isNaN(eventTs) || Number.isNaN(startTs)) return false;
  const endTs = bundle.finishedAt ? Date.parse(bundle.finishedAt) : undefined;
  if (eventTs < startTs) return false;
  if (endTs != null && !Number.isNaN(endTs) && eventTs > endTs) return false;
  return true;
}

function matchFuelingToBundle(event: JourneyBaseEvent, bundles: JourneyBundle[]): JourneyBundle | null {
  const jid = fuelingJourneyId(event);
  const joffline = fuelingJourneyOfflineId(event);
  const comboio = fuelingComboioKey(event);
  const companyCode = clean(event.payload.companyCode);
  const eventTs = Date.parse(event.occurredAt);

  let best: { bundle: JourneyBundle; score: number } | null = null;
  for (const bundle of bundles) {
    let score = 0;
    if (jid && bundle.journeyId === jid) score = Math.max(score, 100);
    if (joffline && bundle.journeyOfflineId && bundle.journeyOfflineId === joffline) score = Math.max(score, 90);
    const bundleComboio = bundleComboioKey(bundle);
    if (comboio && bundleComboio && comboio === bundleComboio) score = Math.max(score, 70);
    if (eventTs && eventOccursWithinBundleWindow(event, bundle)) score = Math.max(score, comboio && bundleComboio && comboio === bundleComboio ? 60 : 40);
    if (companyCode && bundle.companyCode && companyCode === bundle.companyCode) score += 5;
    if (score > 0 && (!best || score > best.score)) {
      best = { bundle, score };
    }
  }
  return best?.bundle ?? null;
}

function buildJourneyBundles(tenantId: string): JourneyBundle[] {
  const journeyEvents = loadJourneyEvents(tenantId);
  const fuelings = loadFuelingEvents(tenantId);
  const journeyGroups = new Map<string, JourneyBaseEvent[]>();
  for (const event of journeyEvents) {
    const list = journeyGroups.get(event.journeyId) ?? [];
    list.push(event);
    journeyGroups.set(event.journeyId, list);
  }

  const bundles = Array.from(journeyGroups.values()).map((events) => makeJourneyBundleFromEvents(events));

  for (const fueling of fuelings) {
    const matched = matchFuelingToBundle(fueling, bundles.filter((bundle) => bundle.journeyId !== `fueling-${fueling.offlineId}`));
    if (matched) {
      matched.fuelings.push(fueling);
      continue;
    }

    const syntheticJourneyId = fuelingJourneyId(fueling) || fuelingJourneyOfflineId(fueling) || `fueling-${fueling.offlineId}`;
    let synthetic = bundles.find((bundle) => bundle.journeyId === syntheticJourneyId);
    if (!synthetic) {
      synthetic = {
        tenantId,
        companyCode: clean(fueling.payload.companyCode) || undefined,
        journeyId: syntheticJourneyId,
        journeyOfflineId: fuelingJourneyOfflineId(fueling) || undefined,
        comboioFleetCode: fuelingComboioKey(fueling) || undefined,
        comboioDescription: undefined,
        startedAt: undefined,
        finishedAt: undefined,
        events: [],
        fuelings: [],
      };
      bundles.push(synthetic);
    }
    synthetic.fuelings.push(fueling);
  }

  return bundles.map((bundle) => ({
    ...bundle,
    fuelings: dedupeByEventId(bundle.fuelings).sort((a, b) => {
      const aTime = Date.parse(a.occurredAt);
      const bTime = Date.parse(b.occurredAt);
      if (aTime !== bTime) return aTime - bTime;
      return eventSortWeight(a.type) - eventSortWeight(b.type);
    }),
  }));
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
    inconsistencyReasons: [...(item.inconsistencyReasons ?? [])],
  };
}

function resolveInconsistencyReasons(input: {
  orphan: boolean;
  hasStart: boolean;
  hasEnd: boolean;
  comboioFleetCode?: string;
  syncStatus: FuelJourneySyncStatus;
  diferenca: number;
  fuelings: FuelJourneyFuelingItem[];
  hasDuplicate?: boolean;
}): string[] {
  const reasons: string[] = [];
  if (input.orphan) reasons.push('Evento sem JOURNEY_START associado');
  if (!input.hasStart && input.hasEnd) reasons.push('Jornada sem evento de início');
  if (!input.hasEnd && input.hasStart && input.fuelings.length > 0) reasons.push('Jornada em andamento com abastecimentos vinculados');
  if (!input.comboioFleetCode) reasons.push('Comboio não identificado');
  if (input.syncStatus !== 'SYNCED') reasons.push(`Sincronização ${input.syncStatus}`);
  if (Math.abs(input.diferenca) >= 0.1) reasons.push(`Divergência contábil de ${Math.abs(input.diferenca).toFixed(1)} L`);
  if (input.hasDuplicate) reasons.push('Jornada ativa duplicada para o mesmo comboio');
  return Array.from(new Set(reasons));
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
      target.inconsistencyReasons = Array.from(new Set([...(target.inconsistencyReasons ?? []), 'Jornada ativa duplicada para o mesmo comboio']));
    }
  }

  return items.map((item) => byJourneyId.get(item.journeyId) ?? cloneSummary(item));
}

function toSummary(bundle: JourneyBundle): FuelJourneySummary {
  const base = bundle.events[0] ?? bundle.fuelings[0];
  if (!base) {
    throw new Error(`Journey bundle without base event: ${bundle.journeyId}`);
  }
  const start = bundle.events.find((event) => event.type === 'JOURNEY_START');
  const end = [...bundle.events].reverse().find((event) => event.type === 'JOURNEY_END');
  const fuelings = bundle.fuelings.map(makeFuelingItem);
  const timeline = dedupeByEventId([...bundle.events, ...bundle.fuelings]).map(makeTimelineItem).sort((a, b) => {
    const aTime = Date.parse(a.occurredAt);
    const bTime = Date.parse(b.occurredAt);
    if (aTime !== bTime) return aTime - bTime;
    return eventSortWeight(a.type) - eventSortWeight(b.type);
  });

  const hasStart = Boolean(start);
  const hasEnd = Boolean(end);
  const orphan = !hasStart && (bundle.events.length + bundle.fuelings.length) > 0;
  const syncStatus = [...bundle.events, ...bundle.fuelings].some((event) => event.syncStatus === 'ERRO_SYNC')
    ? 'ERRO_SYNC'
    : [...bundle.events, ...bundle.fuelings].some((event) => event.syncStatus === 'PENDENTE_SYNC')
      ? 'PENDENTE_SYNC'
      : 'SYNCED';

  const status: FuelJourneyStatus = orphan ? 'INCONSISTENTE' : hasEnd ? 'FINALIZADA' : 'ATIVA';

  const startPayload = start?.payload ?? {};
  const endPayload = end?.payload ?? {};

  const tankInitialLiters = asNumber(startPayload.tankInitialLiters ?? startPayload.tankStartLiters ?? startPayload.tanqueInicial ?? endPayload.tankInitialLiters ?? endPayload.tankStartLiters ?? endPayload.tanqueInicial);
  const totalLoadedFromEvents = bundle.events
    .filter((event) => event.type === 'PRODUCT_LOAD')
    .reduce((sum, event) => sum + (asNumber(event.payload.liters) ?? 0), 0);
  const totalLoadedLiters = totalLoadedFromEvents || (asNumber(endPayload.totalLoadedLiters ?? endPayload.totalCarregadoPosto ?? endPayload.totalLoaded) ?? 0);
  const totalSuppliedLiters = fuelings.reduce((sum, item) => sum + (Number(item.liters) || 0), 0);
  const theoreticalFinalBalanceLiters = Math.round(((tankInitialLiters ?? 0) + totalLoadedLiters - totalSuppliedLiters) * 10) / 10;
  const explicitRealFinal = asNumber(endPayload.realFinalBalanceLiters ?? endPayload.saldoFinalReal);
  const automaticFinal = asNumber(endPayload.saldoFinalAutomatico);
  const realFinalBalanceLiters = explicitRealFinal ?? theoreticalFinalBalanceLiters;
  const divergenceLiters = Math.round((realFinalBalanceLiters - theoreticalFinalBalanceLiters) * 10) / 10;
  const automaticMismatch = automaticFinal != null && Math.abs(automaticFinal - theoreticalFinalBalanceLiters) > 0.05;
  const divergent = Boolean(orphan || syncStatus !== 'SYNCED' || automaticMismatch || Math.abs(divergenceLiters) > 0.05);
  const finalBalanceLegacy = automaticFinal ?? realFinalBalanceLiters;
  const comboioFleetCode = bundle.comboioFleetCode || clean(startPayload.comboioFleetCode) || clean(startPayload.comboio) || clean(endPayload.comboioFleetCode) || clean(endPayload.comboio) || undefined;
  const inconsistencyReasons = resolveInconsistencyReasons({
    orphan,
    hasStart,
    hasEnd,
    comboioFleetCode,
    syncStatus,
    diferenca: divergenceLiters,
    fuelings,
    hasDuplicate: false,
  });

  return {
    tenantId: base.tenantId,
    companyCode: bundle.companyCode || bundle.events.find((event) => event.companyCode)?.companyCode || bundle.fuelings.find((event) => event.companyCode)?.companyCode,
    journeyId: bundle.journeyId,
    status,
    syncStatus,
    calculationMode: clean(endPayload.calculationMode) || (explicitRealFinal != null ? 'MANUAL' : 'AUTOMATICO'),
    calculationModeLabel: formatModeLabel(clean(endPayload.calculationMode) || (explicitRealFinal != null ? 'MANUAL' : 'AUTOMATICO')),
    comboioFleetCode,
    comboioDescription: clean(startPayload.comboioDescription) || clean(endPayload.comboioDescription) || undefined,
    journeyOfflineId: bundle.journeyOfflineId || clean(startPayload.journeyOfflineId) || clean(endPayload.journeyOfflineId) || undefined,
    driverRegistration: clean(startPayload.driverRegistration) || clean(endPayload.driverRegistration) || undefined,
    driverName: clean(startPayload.driverName) || clean(endPayload.driverName) || undefined,
    shift: clean(startPayload.shift) || clean(endPayload.shift) || undefined,
    deviceId: clean(base.payload.deviceId) || undefined,
    source: clean(endPayload.source) || clean(startPayload.source) || 'APK',
    startedAt: clean(startPayload.startedAt) || base.occurredAt,
    startedAtLabel: formatDateTime(clean(startPayload.startedAt) || base.occurredAt),
    finishedAt: clean(endPayload.finishedAt) || clean(endPayload.endedAt) || (hasEnd ? end?.occurredAt : undefined),
    finishedAtLabel: clean(endPayload.finishedAt) || clean(endPayload.endedAt) || (hasEnd ? end?.occurredAt : undefined)
      ? formatDateTime(clean(endPayload.finishedAt) || clean(endPayload.endedAt) || (hasEnd ? end?.occurredAt : undefined))
      : 'Em andamento',
    kmInicial: asNumber(startPayload.kmInicial ?? startPayload.kmStart ?? startPayload.kmInitial) ?? asNumber(endPayload.kmInicial ?? endPayload.kmStart ?? endPayload.kmInitial),
    kmFinal: asNumber(endPayload.kmFinal),
    distanciaPercorrida: asNumber(endPayload.distanciaPercorrida ?? endPayload.distanceKm),
    tanqueInicial: tankInitialLiters,
    tankInitialLiters,
    totalCarregadoPosto: totalLoadedLiters,
    totalLoadedLiters,
    totalAbastecidoMaquinas: totalSuppliedLiters,
    totalSuppliedLiters,
    saldoTeorico: theoreticalFinalBalanceLiters,
    theoreticalFinalBalanceLiters,
    saldoFinalAutomatico: finalBalanceLegacy,
    realFinalBalanceLiters,
    divergenceLiters,
    tanqueFinal: finalBalanceLegacy,
    diferenca: divergenceLiters,
    fuelingCount: fuelings.length,
    dieselLiters: Math.round(totalSuppliedLiters * 10) / 10,
    totalLiters: Math.round(totalSuppliedLiters * 10) / 10,
    eventCount: dedupeByEventId([...bundle.events, ...bundle.fuelings]).length,
    timelineCount: timeline.length,
    divergent,
    orphan,
    hasDuplicate: false,
    inconsistencyReasons,
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
  const bundles = buildJourneyBundles(filters.tenantId).filter((bundle) => !filters.journeyId || bundle.journeyId === filters.journeyId);
  const items = bundles.map(toSummary).filter((item) => withinRange(item, filters.from, filters.to) && matchesFilter(item, filters));
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
  const saldoFinalTotal = Math.round(journeys.reduce((sum, journey) => sum + (journey.status === 'FINALIZADA' ? (journey.realFinalBalanceLiters ?? journey.saldoFinalAutomatico ?? 0) : 0), 0) * 10) / 10;
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
