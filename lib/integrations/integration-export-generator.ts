import { buildDailySheetList } from '@/lib/daily-sheet-builder';
import { FuelingStorage } from '@/lib/fueling-storage';
import type { FichaDiaria } from '@/lib/daily-sheet-builder';
import type { FuelingRecord } from '@/lib/fueling-storage';
import type { OperationalExportRecord, ExportDataType, ExportTargetSystem, IntegrationExportFilters, OperationalPackage } from './integration-export-types';

export type ExportGenerationInput = {
  tenantId: string;
  exportId: string;
  targetSystem: ExportTargetSystem;
  dataType: ExportDataType;
  periodStart?: string;
  periodEnd?: string;
  filters?: IntegrationExportFilters;
};

export type GeneratedExportData = {
  records: OperationalExportRecord[];
  recordCount: number;
  emptyMessage?: string;
};

function toBrtDate(iso: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const year = parts.find((part) => part.type === 'year')?.value ?? d.toISOString().slice(0, 4);
  const month = parts.find((part) => part.type === 'month')?.value ?? d.toISOString().slice(5, 7);
  const day = parts.find((part) => part.type === 'day')?.value ?? d.toISOString().slice(8, 10);
  return `${year}-${month}-${day}`;
}

function normalizeIsoDateRangeStart(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.includes('T')) return value;
  return `${value}T00:00:00.000Z`;
}

function normalizeIsoDateRangeEnd(value?: string): string | undefined {
  if (!value) return undefined;
  if (value.includes('T')) return value;
  return `${value}T23:59:59.999Z`;
}

function dateRange(start?: string, end?: string): string[] {
  if (!start || !end) return [toBrtDate(start ?? new Date().toISOString())];
  const days: string[] = [];
  let cursor = new Date(toBrtDate(start) + 'T00:00:00.000Z');
  const finish = new Date(toBrtDate(end) + 'T00:00:00.000Z');
  while (cursor <= finish) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return days;
}

function fichaToRecords(fichas: FichaDiaria[]): OperationalExportRecord[] {
  return fichas.map((ficha) => ({
    recordType: 'FICHA_OPERADOR',
    date: ficha.date,
    periodStart: ficha.periodStart,
    periodEnd: ficha.periodEnd,
    tenantId: ficha.tenantId,
    fleetCode: String(ficha.fleetCode ?? ''),
    equipmentId: String(ficha.equipmentId ?? ''),
    operatorRegistration: ficha.operatorRegistration ? String(ficha.operatorRegistration) : null,
    operatorName: ficha.operatorName ?? null,
    operationCode: ficha.operationCode ? String(ficha.operationCode) : null,
    operationName: ficha.operationName ?? null,
    implementCode: ficha.implementCode ? String(ficha.implementCode) : null,
    implementName: ficha.implementName ?? null,
    workOrderNumber: ficha.workOrderNumber ? String(ficha.workOrderNumber) : null,
    costCenterName: ficha.costCenterName ?? null,
    hourmeterStart: ficha.hourmeterStart,
    hourmeterCurrent: ficha.hourmeterCurrent,
    hourmeterEnd: ficha.hourmeterEnd,
    totalHourmeter: ficha.totalHourmeter,
    status: ficha.status,
    startedAt: ficha.startedAt,
    endedAt: ficha.endedAt,
    journeys: ficha.journeys.length,
    stops: ficha.stops.length,
  }));
}

function journeyToRecords(fichas: FichaDiaria[]): OperationalExportRecord[] {
  const rows: OperationalExportRecord[] = [];
  for (const ficha of fichas) {
    for (const journey of ficha.journeys) {
      rows.push({
        recordType: 'JOURNEY',
        tenantId: ficha.tenantId,
        date: ficha.date,
        fleetCode: String(ficha.fleetCode ?? ''),
        journeyId: journey.journeyId ? String(journey.journeyId) : null,
        startedAt: journey.startedAt,
        endedAt: journey.endedAt,
        operatorRegistration: journey.operatorRegistration ? String(journey.operatorRegistration) : null,
        operatorName: journey.operatorName ?? null,
        operationCode: journey.operationCode ? String(journey.operationCode) : null,
        operationName: journey.operationName ?? null,
        implementCode: journey.implementCode ? String(journey.implementCode) : null,
        implementName: journey.implementName ?? null,
        workOrderNumber: journey.workOrderNumber ? String(journey.workOrderNumber) : null,
        costCenterName: journey.costCenterName ?? null,
        hourmeterStart: journey.hourmeterStart,
        hourmeterEnd: journey.hourmeterEnd,
        totalHourmeter: journey.totalHourmeter,
        hasJourneyEnd: journey.hasJourneyEnd,
      });
    }
  }
  return rows;
}

function stopToRecords(fichas: FichaDiaria[]): OperationalExportRecord[] {
  const rows: OperationalExportRecord[] = [];
  for (const ficha of fichas) {
    for (const journey of ficha.journeys) {
      for (const stop of journey.stops) {
        rows.push({
          recordType: 'STOP_EVENT',
          tenantId: ficha.tenantId,
          date: ficha.date,
          fleetCode: String(ficha.fleetCode ?? ''),
          journeyId: journey.journeyId ? String(journey.journeyId) : null,
          code: stop.code ? String(stop.code) : null,
          description: stop.description ?? null,
          startedAt: stop.startedAt,
          endedAt: stop.endedAt ?? null,
          durationMinutes: stop.durationMinutes ?? null,
        });
      }
    }
  }
  return rows;
}

function fuelToRecords(records: FuelingRecord[]): OperationalExportRecord[] {
  return records.map((record) => ({
    recordType: 'FUELING',
    tenantId: record.tenantId,
    occurredAt: record.fueledAt,
    fleetCode: String(record.fleetCode ?? ''),
    fleetDescription: record.fleetDescription ?? null,
    operatorRegistration: record.operatorRegistration ? String(record.operatorRegistration) : null,
    operatorName: record.operatorName ?? null,
    fuelType: record.fuelType ?? null,
    pumpCode: record.pumpCode ? String(record.pumpCode) : null,
    liters: record.dieselLiters,
    hourmeter: record.hourmeter,
    odometer: record.odometer ?? null,
    journeyId: record.journeyId ? String(record.journeyId) : null,
  }));
}

function filterRecords(records: OperationalExportRecord[], filters?: IntegrationExportFilters): OperationalExportRecord[] {
  if (!filters) return records;
  return records.filter((record) => {
    const raw = record as Record<string, unknown>;
    if (filters.fleetCode && String(raw.fleetCode ?? '') !== filters.fleetCode) return false;
    if (filters.operatorRegistration && String(raw.operatorRegistration ?? '') !== filters.operatorRegistration) return false;
    if (filters.journeyId && String(raw.journeyId ?? '') !== filters.journeyId) return false;
    if (filters.operationCode && String(raw.operationCode ?? '') !== filters.operationCode) return false;
    if (filters.costCenterCode && String(raw.costCenterCode ?? '') !== filters.costCenterCode) return false;
    return true;
  });
}

function loadFichas(tenantId: string, periodStart?: string, periodEnd?: string): FichaDiaria[] {
  const days = dateRange(periodStart, periodEnd);
  const fichas = days.flatMap((date) => buildDailySheetList({ tenantId, date }));
  return fichas;
}

export function generateIntegrationExport(input: ExportGenerationInput): GeneratedExportData {
  let records: OperationalExportRecord[] = [];
  let emptyMessage: string | undefined;

  switch (input.dataType) {
    case 'FICHA_OPERADOR': {
      records = fichaToRecords(loadFichas(input.tenantId, input.periodStart, input.periodEnd));
      break;
    }
    case 'JOURNEYS': {
      records = journeyToRecords(loadFichas(input.tenantId, input.periodStart, input.periodEnd));
      break;
    }
    case 'STOP_EVENTS': {
      records = stopToRecords(loadFichas(input.tenantId, input.periodStart, input.periodEnd));
      break;
    }
    case 'FUELINGS': {
      const fuelings = FuelingStorage.getAll(input.tenantId, {
        from: normalizeIsoDateRangeStart(input.periodStart),
        to: normalizeIsoDateRangeEnd(input.periodEnd),
        fleetCode: input.filters?.fleetCode,
        fuelType: undefined,
      });
      records = fuelToRecords(fuelings);
      break;
    }
    case 'FULL_OPERATIONAL_PACKAGE': {
      const fichas = loadFichas(input.tenantId, input.periodStart, input.periodEnd);
      const fuelings = FuelingStorage.getAll(input.tenantId, {
        from: normalizeIsoDateRangeStart(input.periodStart),
        to: normalizeIsoDateRangeEnd(input.periodEnd),
        fleetCode: input.filters?.fleetCode,
      });
      records = [
        ...fichaToRecords(fichas),
        ...journeyToRecords(fichas),
        ...stopToRecords(fichas),
        ...fuelToRecords(fuelings),
      ];
      break;
    }
    default:
      records = [];
      emptyMessage = 'Dataset nao suportado nesta etapa.';
  }

  records = filterRecords(records, input.filters);
  if (records.length === 0) {
    emptyMessage = 'Dataset sem registros para o periodo selecionado.';
  }

  return {
    records,
    recordCount: records.length,
    emptyMessage,
  };
}

export function buildOperationalPackage(input: ExportGenerationInput & { records: OperationalExportRecord[] }): OperationalPackage {
  return {
    schemaVersion: '1.0',
    source: 'SILO_OPS',
    tenantId: input.tenantId,
    generatedAt: new Date().toISOString(),
    exportId: input.exportId,
    targetSystem: input.targetSystem,
    dataType: input.dataType,
    period: input.periodStart || input.periodEnd ? { start: input.periodStart, end: input.periodEnd } : undefined,
    filters: input.filters,
    records: input.records,
  };
}

export function flattenRecordForCsv(record: OperationalExportRecord): Record<string, string> {
  const raw = record as Record<string, unknown>;
  const flattened: Record<string, string> = { recordType: String(raw.recordType ?? '') };
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'recordType') continue;
    if (value === null || value === undefined) {
      flattened[key] = '';
    } else if (typeof value === 'object') {
      flattened[key] = JSON.stringify(value);
    } else {
      flattened[key] = String(value);
    }
  }
  return flattened;
}

export function toCsv(records: OperationalExportRecord[], dataType: ExportDataType): string {
  const headersByType: Record<ExportDataType, string[]> = {
    FICHA_OPERADOR: ['recordType','date','periodStart','periodEnd','tenantId','fleetCode','equipmentId','operatorRegistration','operatorName','operationCode','operationName','implementCode','implementName','workOrderNumber','costCenterName','hourmeterStart','hourmeterCurrent','hourmeterEnd','totalHourmeter','status','startedAt','endedAt','journeys','stops'],
    JOURNEYS: ['recordType','tenantId','date','fleetCode','journeyId','startedAt','endedAt','operatorRegistration','operatorName','operationCode','operationName','implementCode','implementName','workOrderNumber','costCenterName','hourmeterStart','hourmeterEnd','totalHourmeter','hasJourneyEnd'],
    STOP_EVENTS: ['recordType','tenantId','date','fleetCode','journeyId','code','description','startedAt','endedAt','durationMinutes'],
    HOURMETERS: ['recordType'],
    FUELINGS: ['recordType','tenantId','occurredAt','fleetCode','fleetDescription','operatorRegistration','operatorName','fuelType','pumpCode','liters','hourmeter','odometer','journeyId'],
    EQUIPMENTS: ['recordType'],
    OPERATORS: ['recordType'],
    OPERATIONS: ['recordType'],
    COST_CENTERS: ['recordType'],
    IMPLEMENTS: ['recordType'],
    FULL_OPERATIONAL_PACKAGE: ['recordType','tenantId','date','periodStart','periodEnd','fleetCode','journeyId','code','description','occurredAt','operatorRegistration','operatorName','operationCode','operationName','implementCode','implementName','workOrderNumber','costCenterName','hourmeterStart','hourmeterCurrent','hourmeterEnd','totalHourmeter','status','fuelType','pumpCode','liters','hourmeter','odometer','hasJourneyEnd'],
  };
  const headers = headersByType[dataType];
  const rows = records.map((record) => {
    const flat = flattenRecordForCsv(record);
    return headers.map((header) => {
      const value = flat[header] ?? '';
      return /[;\n\r"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(';');
  });
  return [headers.join(';'), ...rows].join('\n');
}
