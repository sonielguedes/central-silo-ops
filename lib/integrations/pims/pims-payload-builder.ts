import { buildDailySheetList } from '@/lib/daily-sheet-builder';
import { FuelingStorage } from '@/lib/fueling-storage';
import type { PimsValidationIssue, PimsValidationStatus, PimsValidationTargetDataType } from './pims-mapping-types';

function toDate(value?: string): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString().slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function listDatesInclusive(from: string, to: string): string[] {
  const start = new Date(`${from}T03:00:00.000Z`);
  const end = new Date(`${to}T03:00:00.000Z`);
  const dates: string[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)) {
    dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

function flatMap<T, R>(items: T[], mapper: (item: T) => R[]): R[] {
  return items.reduce<R[]>((acc, item) => acc.concat(mapper(item)), []);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export interface PimsDispatchPayloadSummary {
  recordCount: number;
  fichaCount: number;
  journeyCount: number;
  stopCount: number;
  fuelingCount: number;
}

export interface PimsDispatchPayload {
  tenantId: string;
  dispatchId: string;
  configId?: string;
  generatedAt: string;
  periodStart: string;
  periodEnd: string;
  targetDataType: PimsValidationTargetDataType;
  referenceId?: string;
  mockMode: boolean;
  validation: {
    status: PimsValidationStatus;
    issues: PimsValidationIssue[];
  };
  summary: PimsDispatchPayloadSummary;
  records: Array<Record<string, unknown>>;
}

export async function loadPimsDispatchRecords(tenantId: string, periodStart?: string, periodEnd?: string): Promise<Array<Record<string, unknown>>> {
  const from = toDate(periodStart);
  const to = toDate(periodEnd ?? periodStart);
  const dates = listDatesInclusive(from, to);
  const fichas = flatMap(dates, (date) => buildDailySheetList({ tenantId, date }));
  const fuelings = FuelingStorage.getAll(tenantId, {
    from: `${from}T00:00:00.000Z`,
    to: `${to}T23:59:59.999Z`,
  });

  const fichaRecords = fichas.map((ficha) => ({ recordType: 'FICHA_OPERADOR', ...ficha }));
  const journeyRecords = flatMap(fichas, (ficha) => (ficha.journeys ?? []).map((journey) => ({
    recordType: 'JOURNEY',
    tenantId: ficha.tenantId,
    date: ficha.date,
    fleetCode: ficha.fleetCode,
    ...journey,
  })));
  const stopRecords = flatMap(fichas, (ficha) => (ficha.journeys ?? []).flatMap((journey) => (journey.stops ?? []).map((stop) => ({
    recordType: 'STOP_EVENTS',
    tenantId: ficha.tenantId,
    date: ficha.date,
    fleetCode: ficha.fleetCode,
    journeyId: journey.journeyId,
    ...stop,
  }))));
  const fuelingRecords = fuelings.map((fueling) => ({
    recordType: 'FUELINGS',
    tenantId,
    occurredAt: fueling.fueledAt,
    fleetCode: fueling.fleetCode,
    fleetDescription: fueling.fleetDescription,
    operatorRegistration: fueling.operatorRegistration,
    operatorName: fueling.operatorName,
    fuelType: fueling.fuelType,
    pumpCode: fueling.pumpCode,
    liters: fueling.dieselLiters,
    hourmeter: fueling.hourmeter,
    odometer: fueling.odometer,
    journeyId: fueling.journeyId,
  }));

  return [...fichaRecords, ...journeyRecords, ...stopRecords, ...fuelingRecords].map(asRecord);
}

export function buildPimsDispatchPayload(input: {
  tenantId: string;
  dispatchId: string;
  configId?: string;
  generatedAt?: string;
  periodStart: string;
  periodEnd: string;
  targetDataType: PimsValidationTargetDataType;
  referenceId?: string;
  mockMode: boolean;
  validation: { status: PimsValidationStatus; issues: PimsValidationIssue[] };
  records: Array<Record<string, unknown>>;
}): PimsDispatchPayload {
  const summary: PimsDispatchPayloadSummary = {
    recordCount: input.records.length,
    fichaCount: input.records.filter((item) => item.recordType === 'FICHA_OPERADOR').length,
    journeyCount: input.records.filter((item) => item.recordType === 'JOURNEY').length,
    stopCount: input.records.filter((item) => item.recordType === 'STOP_EVENTS').length,
    fuelingCount: input.records.filter((item) => item.recordType === 'FUELINGS').length,
  };

  return {
    tenantId: input.tenantId,
    dispatchId: input.dispatchId,
    configId: input.configId,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    targetDataType: input.targetDataType,
    referenceId: input.referenceId,
    mockMode: input.mockMode,
    validation: input.validation,
    summary,
    records: input.records,
  };
}

