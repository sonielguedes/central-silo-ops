import { ServerStorage } from '@/lib/server-storage';
import { buildDailySheetList } from '@/lib/daily-sheet-builder';
import { PimsMappingStorage } from './pims-mapping-storage';
import type {
  PimsMappingType,
  PimsValidationInput,
  PimsValidationIssue,
  PimsValidationIssueType,
  PimsValidationResult,
  PimsValidationStatus,
} from './pims-mapping-types';

type ValidationBucket = Record<PimsMappingType, Set<string>>;

function asString(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function toIsoDate(value?: string): string | null {
  if (!value) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d);
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

function createBuckets(): ValidationBucket {
  return {
    OPERATION: new Set(),
    STOP_REASON: new Set(),
    COST_CENTER: new Set(),
    EQUIPMENT: new Set(),
    OPERATOR: new Set(),
    IMPLEMENT: new Set(),
    WORK_ORDER: new Set(),
    FICHA_FIELD: new Set(),
  };
}

function pushCode(bucket: Set<string>, value: unknown): void {
  const next = asString(value);
  if (next) bucket.add(next);
}

function issue(type: PimsValidationIssueType, message: string, field?: string, siloCode?: string, suggestedAction?: string): PimsValidationIssue {
  return { type, message, field, siloCode, suggestedAction };
}

const MAP_TYPE_TO_ISSUE: Record<PimsMappingType, PimsValidationIssueType> = {
  OPERATION: 'MISSING_OPERATION_MAPPING',
  STOP_REASON: 'MISSING_STOP_REASON_MAPPING',
  COST_CENTER: 'MISSING_COST_CENTER_MAPPING',
  EQUIPMENT: 'MISSING_EQUIPMENT_MAPPING',
  OPERATOR: 'MISSING_OPERATOR_MAPPING',
  IMPLEMENT: 'MISSING_IMPLEMENT_MAPPING',
  WORK_ORDER: 'MISSING_REQUIRED_FIELD',
  FICHA_FIELD: 'MISSING_REQUIRED_FIELD',
};

function mapTypeToIssue(type: PimsMappingType): PimsValidationIssueType {
  return MAP_TYPE_TO_ISSUE[type];
}

function collectOperationalData(tenantId: string, periodStart: string, periodEnd: string, filters?: PimsValidationInput['filters']) {
  const dates = listDatesInclusive(periodStart, periodEnd);
  const fichas = dates.flatMap((date) => {
    const raw = buildDailySheetList({ tenantId, date, fleetCodeFilter: filters?.fleetCode ?? null });
    return raw as unknown as Array<Record<string, unknown>>;
  });
  const rawEvents = ServerStorage.getEvents(tenantId).filter((event) => {
    const ts = asString(event.timestamp) || asString(event.receivedAt);
    const day = ts ? (toIsoDate(ts) ?? ts.slice(0, 10)) : '';
    return !!day && day >= periodStart && day <= periodEnd;
  });
  return { fichas, rawEvents };
}

function matchesFilters(record: Record<string, unknown>, filters?: PimsValidationInput['filters']): boolean {
  if (!filters) return true;
  const fleetCode = asString(record.fleetCode);
  const opReg = asString(record.operatorRegistration ?? record.registration);
  const journeyId = asString(record.journeyId);
  const journeyMatch = Array.isArray(record.journeys)
    ? (record.journeys as Array<Record<string, unknown>>).some((item) => asString(item.journeyId) === filters.journeyId)
    : false;
  if (filters.fleetCode && fleetCode !== filters.fleetCode) return false;
  if (filters.operatorRegistration && opReg !== filters.operatorRegistration) return false;
  if (filters.journeyId && journeyId !== filters.journeyId && !journeyMatch) return false;
  return true;
}

function collectCodesFromRecords(input: {
  buckets: ValidationBucket;
  fichas: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
}): void {
  for (const ficha of input.fichas) {
    pushCode(input.buckets.EQUIPMENT, ficha.fleetCode);
    pushCode(input.buckets.OPERATOR, ficha.operatorRegistration);
    pushCode(input.buckets.OPERATION, ficha.operationCode);
    pushCode(input.buckets.IMPLEMENT, ficha.implementCode);
    pushCode(input.buckets.WORK_ORDER, ficha.workOrderNumber);
    pushCode(input.buckets.COST_CENTER, ficha.costCenterCode ?? ficha.costCenterName ?? ficha.costCenter);
    for (const stop of (ficha.stops as Array<Record<string, unknown>> | undefined) ?? []) {
      pushCode(input.buckets.STOP_REASON, stop.code);
    }
  }

  for (const event of input.events) {
    const payload = (event.payload as Record<string, unknown> | undefined) ?? {};
    pushCode(input.buckets.EQUIPMENT, payload.fleetCode);
    pushCode(input.buckets.EQUIPMENT, payload.equipmentCode);
    pushCode(input.buckets.OPERATOR, payload.operatorRegistration ?? payload.registration);
    pushCode(input.buckets.OPERATION, payload.operationCode);
    pushCode(input.buckets.IMPLEMENT, payload.implementCode);
    pushCode(input.buckets.COST_CENTER, payload.costCenterCode ?? payload.costCenterName ?? payload.costCenter);
    pushCode(input.buckets.WORK_ORDER, payload.workOrderNumber ?? payload.workOrder);
    pushCode(input.buckets.STOP_REASON, payload.stopReasonCode ?? payload.stopCode);
  }
}

export function validatePimsOperationalData(input: PimsValidationInput): PimsValidationResult {
  const periodStart = toIsoDate(input.periodStart) ?? new Date().toISOString().slice(0, 10);
  const periodEnd = toIsoDate(input.periodEnd) ?? periodStart;
  const mappings = PimsMappingStorage.listActiveByTenant(input.tenantId);
  const mappingLookup = new Set(mappings.map((mapping) => `${mapping.type}:${mapping.siloCode}`));
  const data = collectOperationalData(input.tenantId, periodStart, periodEnd, input.filters);
  const buckets = createBuckets();
  collectCodesFromRecords({
    buckets,
    fichas: data.fichas.filter((item) => matchesFilters(item, input.filters)),
    events: data.rawEvents as unknown as Array<Record<string, unknown>>,
  });

  const totalRecords = data.fichas.length + data.rawEvents.length;
  if (totalRecords === 0) {
    return {
      id: '',
      tenantId: input.tenantId,
      status: 'WARNING',
      targetDataType: input.targetDataType,
      referenceId: input.referenceId,
      journeyId: input.filters?.journeyId,
      fleetCode: input.filters?.fleetCode,
      operatorRegistration: input.filters?.operatorRegistration,
      issues: [{
        type: 'MISSING_REQUIRED_FIELD',
        message: 'Nenhum registro operacional encontrado para o filtro informado.',
        suggestedAction: 'Ajuste o periodo ou os filtros e tente novamente.',
      }],
      checkedAt: '',
      checkedBy: input.checkedBy,
    };
  }

  const issues: PimsValidationIssue[] = [];
  const typeBuckets: Array<[PimsMappingType, Set<string>]> = [
    ['OPERATION', buckets.OPERATION],
    ['STOP_REASON', buckets.STOP_REASON],
    ['COST_CENTER', buckets.COST_CENTER],
    ['EQUIPMENT', buckets.EQUIPMENT],
    ['OPERATOR', buckets.OPERATOR],
    ['IMPLEMENT', buckets.IMPLEMENT],
  ];

  for (const [type, codes] of typeBuckets) {
    for (const code of codes) {
      if (!mappingLookup.has(`${type}:${code}`)) {
        issues.push(issue(
          mapTypeToIssue(type),
          `${type === 'OPERATOR' ? 'Operador' : type === 'EQUIPMENT' ? 'Frota/equipamento' : type === 'STOP_REASON' ? 'Parada' : type === 'COST_CENTER' ? 'Centro de custo' : type === 'IMPLEMENT' ? 'Implemento' : 'Operação'} ${code} não possui mapeamento PIMS.`,
          type === 'OPERATION' ? 'operationCode' : type === 'STOP_REASON' ? 'stopReasonCode' : type === 'COST_CENTER' ? 'costCenterCode' : type === 'EQUIPMENT' ? 'fleetCode' : type === 'OPERATOR' ? 'operatorRegistration' : 'implementCode',
          code,
          `Cadastre o mapeamento de ${type.toLowerCase()} antes do envio.`,
        ));
      }
    }
  }

  for (const ficha of data.fichas) {
    const start = (ficha.hourmeterStart as number | null | undefined) ?? null;
    const end = (ficha.hourmeterEnd as number | null | undefined) ?? null;
    const total = (ficha.totalHourmeter as number | null | undefined) ?? null;
    const isFinal = String(ficha.status ?? '').toUpperCase() === 'FINALIZADO';
    if (start === null) {
      issues.push(issue('INVALID_HOURMETER', 'hourmeterStart obrigatório para Ficha Operador.', 'hourmeterStart', asString(ficha.fleetCode), 'Garanta o horímetro inicial antes do envio.'));
    }
    if (isFinal && end === null) {
      issues.push(issue('INVALID_HOURMETER', 'hourmeterEnd obrigatório quando a ficha estiver FINALIZADA.', 'hourmeterEnd', asString(ficha.fleetCode), 'Finalize a jornada com horímetro final.'));
    }
    if (isFinal && total === null) {
      issues.push(issue('INVALID_HOURMETER', 'totalHourmeter obrigatório quando a ficha estiver FINALIZADA.', 'totalHourmeter', asString(ficha.fleetCode), 'Corrija o horímetro final.'));
    }
  }

  const unique = new Map<string, PimsValidationIssue>();
  for (const item of issues) {
    unique.set([item.type, item.field ?? '', item.siloCode ?? '', item.message].join('|'), item);
  }

  const finalIssues = [...unique.values()];
  const status: PimsValidationStatus = finalIssues.length === 0 ? 'SUCCESS' : 'WARNING';

  return {
    id: '',
    tenantId: input.tenantId,
    status,
    targetDataType: input.targetDataType,
    referenceId: input.referenceId,
    journeyId: input.filters?.journeyId,
    fleetCode: input.filters?.fleetCode,
    operatorRegistration: input.filters?.operatorRegistration,
    issues: finalIssues,
    checkedAt: '',
    checkedBy: input.checkedBy,
  };
}
