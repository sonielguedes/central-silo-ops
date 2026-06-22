import { buildDailySheetList } from '@/lib/daily-sheet-builder';
import { FuelJourneyStorage } from '@/lib/fuel-journey-storage';
import { FuelingStorage } from '@/lib/fueling-storage';
import type {
  TotvsMappingType,
  TotvsValidationInput,
  TotvsValidationIssue,
  TotvsValidationIssueType,
  TotvsValidationResult,
  TotvsValidationStatus,
} from './totvs-mapping-types';
import { TotvsMappingStorage } from './totvs-mapping-storage';

type EvidenceSource = 'FICHA_OPERADOR' | 'FUEL_JOURNEY' | 'FUELINGS';

type EvidenceRecord = {
  source: EvidenceSource;
  referenceId?: string;
  fleetCode?: string;
  operatorRegistration?: string;
  costCenterCode?: string;
  workOrderNumber?: string;
  equipmentCode?: string;
  fuelTruckCode?: string;
  fuelPumpCode?: string;
  productCode?: string;
  implementCode?: string;
  journeyId?: string;
  calculationMode?: string;
};

function asString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function toIsoDate(value?: string): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(parsed);
}

function listDatesInclusive(from: string, to: string): string[] {
  const start = new Date(`${from}T03:00:00.000Z`);
  const end = new Date(`${to}T03:00:00.000Z`);
  const items: string[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
    items.push(cursor.toISOString().slice(0, 10));
  }
  return items;
}

function issue(type: TotvsValidationIssueType, message: string, field?: string, siloCode?: string, suggestedAction?: string): TotvsValidationIssue {
  return { type, message, field, siloCode, suggestedAction };
}

function bucketTypeToIssue(type: TotvsMappingType): TotvsValidationIssueType {
  const map: Record<TotvsMappingType, TotvsValidationIssueType> = {
    COST_CENTER: 'MISSING_COST_CENTER_MAPPING',
    WORK_ORDER: 'MISSING_WORK_ORDER_MAPPING',
    EQUIPMENT: 'MISSING_EQUIPMENT_MAPPING',
    FUEL_TRUCK: 'MISSING_FUEL_TRUCK_MAPPING',
    PRODUCT: 'MISSING_PRODUCT_MAPPING',
    FUEL_PUMP: 'MISSING_FUEL_PUMP_MAPPING',
    OPERATOR: 'MISSING_OPERATOR_MAPPING',
    IMPLEMENT: 'MISSING_IMPLEMENT_MAPPING',
  };
  return map[type];
}

function collectFichas(tenantId: string, periodStart: string, periodEnd: string, fleetCode?: string): EvidenceRecord[] {
  const dates = listDatesInclusive(periodStart, periodEnd);
  const fichas = dates.flatMap((date) => buildDailySheetList({ tenantId, date, fleetCodeFilter: fleetCode ?? null }) as unknown as Array<Record<string, unknown>>);
  return fichas.map((ficha) => ({
    source: 'FICHA_OPERADOR',
    referenceId: asString(ficha.id) || undefined,
    fleetCode: asString(ficha.fleetCode) || undefined,
    operatorRegistration: asString(ficha.operatorRegistration),
    costCenterCode: asString(ficha.costCenterName ?? ficha.costCenterCode ?? ficha.costCenter),
    workOrderNumber: asString(ficha.workOrderNumber),
    equipmentCode: asString(ficha.fleetCode),
    implementCode: asString(ficha.implementCode),
    journeyId: asString((ficha.journeys as Array<Record<string, unknown>> | undefined)?.[0]?.journeyId),
  }));
}

function collectJourneys(tenantId: string, periodStart: string, periodEnd: string, filters?: TotvsValidationInput['filters']): EvidenceRecord[] {
  return FuelJourneyStorage.getAll(tenantId)
    .filter((item) => {
      const day = toIsoDate(item.occurredAt);
      if (!day || day < periodStart || day > periodEnd) return false;
      if (filters?.journeyId && item.payload?.journeyId !== filters.journeyId) return false;
      if (filters?.fleetCode && asString(item.payload?.fleetCode) !== filters.fleetCode) return false;
      return true;
    })
    .map((item) => ({
      source: 'FUEL_JOURNEY',
      referenceId: item.eventId,
      journeyId: asString(item.payload?.journeyId) || undefined,
      fleetCode: asString(item.payload?.fleetCode) || undefined,
      operatorRegistration: asString(item.payload?.operatorRegistration ?? item.payload?.registration),
      costCenterCode: asString(item.payload?.costCenterCode ?? item.payload?.costCenterName),
      workOrderNumber: asString(item.payload?.workOrderNumber ?? item.payload?.workOrder),
      equipmentCode: asString(item.payload?.equipmentCode ?? item.payload?.fleetCode),
      fuelTruckCode: asString(item.payload?.truckFleetCode ?? item.payload?.pumpCode),
      fuelPumpCode: asString(item.payload?.pumpCode),
      calculationMode: asString(item.payload?.calculationMode),
    }));
}

function collectFuelings(tenantId: string, periodStart: string, periodEnd: string, filters?: TotvsValidationInput['filters']): EvidenceRecord[] {
  return FuelingStorage.getAll(tenantId, { from: `${periodStart}T00:00:00.000Z`, to: `${periodEnd}T23:59:59.999Z`, fleetCode: filters?.fleetCode })
    .filter((item) => {
      if (filters?.operatorRegistration && asString(item.operatorRegistration) !== filters.operatorRegistration) return false;
      if (filters?.journeyId && asString(item.journeyId) !== filters.journeyId) return false;
      return true;
    })
    .map((item) => ({
      source: 'FUELINGS',
      referenceId: item.eventId,
      fleetCode: item.fleetCode,
      operatorRegistration: asString(item.operatorRegistration) || undefined,
      fuelTruckCode: asString(item.truckFleetCode ?? item.pumpCode),
      fuelPumpCode: asString(item.pumpCode),
      productCode: asString(item.fuelType),
      equipmentCode: asString(item.fleetCode),
      journeyId: asString(item.journeyId) || undefined,
    }));
}

function collectOperationalEvidence(input: TotvsValidationInput, periodStart: string, periodEnd: string): EvidenceRecord[] {
  const primary = collectFichas(input.tenantId, periodStart, periodEnd, input.filters?.fleetCode);
  if (input.targetDataType === 'FICHA_OPERADOR' && primary.length > 0) return primary;

  const journey = collectJourneys(input.tenantId, periodStart, periodEnd, input.filters);
  if (input.targetDataType === 'FUEL_JOURNEY' && journey.length > 0) return journey;

  const fuelings = collectFuelings(input.tenantId, periodStart, periodEnd, input.filters);
  if (input.targetDataType === 'FUELINGS' && fuelings.length > 0) return fuelings;

  if (primary.length > 0) return primary;
  if (journey.length > 0) return journey;
  if (fuelings.length > 0) return fuelings;
  return [];
}

function addCode(bucket: Set<string>, value: unknown): void {
  const next = asString(value);
  if (next) bucket.add(next);
}

function createBuckets(): Record<TotvsMappingType, Set<string>> {
  return {
    COST_CENTER: new Set<string>(),
    WORK_ORDER: new Set<string>(),
    EQUIPMENT: new Set<string>(),
    FUEL_TRUCK: new Set<string>(),
    PRODUCT: new Set<string>(),
    FUEL_PUMP: new Set<string>(),
    OPERATOR: new Set<string>(),
    IMPLEMENT: new Set<string>(),
  };
}

function collectCodes(records: EvidenceRecord[]): Record<TotvsMappingType, Set<string>> {
  const buckets = createBuckets();
  for (const record of records) {
    addCode(buckets.EQUIPMENT, record.fleetCode);
    addCode(buckets.EQUIPMENT, record.equipmentCode);
    addCode(buckets.OPERATOR, record.operatorRegistration);
    addCode(buckets.COST_CENTER, record.costCenterCode);
    addCode(buckets.WORK_ORDER, record.workOrderNumber);
    addCode(buckets.IMPLEMENT, record.implementCode);
    addCode(buckets.FUEL_TRUCK, record.fuelTruckCode);
    addCode(buckets.FUEL_PUMP, record.fuelPumpCode);
    addCode(buckets.PRODUCT, record.productCode);
  }
  return buckets;
}

function dedupeIssues(issues: TotvsValidationIssue[]): TotvsValidationIssue[] {
  const unique = new Map<string, TotvsValidationIssue>();
  for (const issue of issues) {
    unique.set([issue.type, issue.field ?? '', issue.siloCode ?? '', issue.message].join('|'), issue);
  }
  return [...unique.values()];
}

export function validateTotvsPreValidation(input: TotvsValidationInput): TotvsValidationResult {
  const periodStart = toIsoDate(input.periodStart) ?? new Date().toISOString().slice(0, 10);
  const periodEnd = toIsoDate(input.periodEnd) ?? periodStart;
  const mappings = TotvsMappingStorage.listActiveByTenant(input.tenantId);
  const lookup = new Set(mappings.map((mapping) => `${mapping.type}:${mapping.siloCode}`));
  const records = collectOperationalEvidence(input, periodStart, periodEnd);

  if (records.length === 0) {
    return {
      id: '',
      tenantId: input.tenantId,
      status: 'WARNING',
      targetDataType: input.targetDataType,
      periodStart,
      periodEnd,
      referenceId: input.referenceId,
      journeyId: input.filters?.journeyId,
      fleetCode: input.filters?.fleetCode,
      operatorRegistration: input.filters?.operatorRegistration,
      sourceCount: 0,
      sources: [],
      issues: [issue('MISSING_REQUIRED_FIELD', 'Nenhum registro operacional encontrado para o filtro informado.', undefined, undefined, 'Ajuste o periodo ou os filtros e tente novamente.')],
      checkedAt: '',
      checkedBy: input.checkedBy,
    };
  }

  const issues: TotvsValidationIssue[] = [];
  const buckets = collectCodes(records);

  for (const [type, codes] of Object.entries(buckets) as Array<[TotvsMappingType, Set<string>]>) {
    for (const code of codes) {
      if (!lookup.has(`${type}:${code}`)) {
        issues.push(issue(
          bucketTypeToIssue(type),
          `${type.replace(/_/g, ' ')} ${code} nao possui mapeamento TOTVS.`,
          type === 'COST_CENTER' ? 'costCenterCode' : type === 'WORK_ORDER' ? 'workOrderNumber' : type === 'EQUIPMENT' ? 'equipmentCode' : type === 'FUEL_TRUCK' ? 'fuelTruckCode' : type === 'PRODUCT' ? 'productCode' : type === 'FUEL_PUMP' ? 'fuelPumpCode' : type === 'OPERATOR' ? 'operatorRegistration' : 'implementCode',
          code,
          `Cadastre o mapeamento de ${type.toLowerCase()} antes do envio.`,
        ));
      }
    }
  }

  const finalIssues = dedupeIssues(issues);
  const status: TotvsValidationStatus = finalIssues.length === 0 ? 'SUCCESS' : 'WARNING';

  return {
    id: '',
    tenantId: input.tenantId,
    status,
    targetDataType: input.targetDataType,
    periodStart,
    periodEnd,
    referenceId: input.referenceId,
    journeyId: input.filters?.journeyId,
    fleetCode: input.filters?.fleetCode,
    operatorRegistration: input.filters?.operatorRegistration,
    sourceCount: records.length,
    sources: [...new Set(records.map((record) => record.source))],
    issues: finalIssues,
    checkedAt: '',
    checkedBy: input.checkedBy,
  };
}
