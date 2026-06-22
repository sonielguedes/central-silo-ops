import { FuelingRecord, FuelingStorage } from '@/lib/fueling-storage';

export interface FuelingDashboardFilters {
  date?: string;
  fleet?: string;
  truck?: string;
  fuel?: string;
}

export interface FuelingDashboardSummary {
  litersDay: number;
  totalEvents: number;
  pending: number;
  inconsistent: number;
  topFuelType: string | null;
  topFuelTypeLiters: number;
}

export interface FuelingDashboardPayload {
  summary: FuelingDashboardSummary;
  records: FuelingRecord[];
  recentRecords: FuelingRecord[];
}

function dayRange(date?: string) {
  if (!date) return {};
  return {
    from: new Date(`${date}T00:00:00.000-03:00`).toISOString(),
    to: new Date(`${date}T23:59:59.999-03:00`).toISOString(),
  };
}

export function listFuelingsByTenant(tenantId: string): FuelingRecord[] {
  return FuelingStorage.getAll(tenantId);
}

export function listFuelingsByPeriod(tenantId: string, from: string, to: string): FuelingRecord[] {
  return FuelingStorage.getAll(tenantId, { from, to });
}

export function listRecentFuelingsByTenant(tenantId: string, limit = 5): FuelingRecord[] {
  return FuelingStorage.getAll(tenantId).slice(0, Math.max(0, limit));
}

export function getFuelDashboardStats(
  tenantId: string,
  dateRange: { from?: string; to?: string } = {},
): FuelingDashboardSummary {
  const records = FuelingStorage.getAll(tenantId, dateRange);
  const inconsistent = records.filter(isInconsistent).length;
  const pending = records.filter((r) => r.syncStatus !== 'SYNCED').length;
  const litersDay = records.reduce((sum, record) => sum + (Number(record.dieselLiters) || 0), 0);

  const fuelTotals = new Map<string, number>();
  for (const record of records) {
    const key = String(record.fuelType ?? 'Desconhecido').trim() || 'Desconhecido';
    fuelTotals.set(key, (fuelTotals.get(key) ?? 0) + (Number(record.dieselLiters) || 0));
  }
  let topFuelType: string | null = null;
  let topFuelTypeLiters = 0;
  for (const [fuelType, liters] of fuelTotals.entries()) {
    if (liters > topFuelTypeLiters) {
      topFuelType = fuelType;
      topFuelTypeLiters = liters;
    }
  }

  return {
    litersDay: Math.round(litersDay * 10) / 10,
    totalEvents: records.length,
    pending,
    inconsistent,
    topFuelType,
    topFuelTypeLiters: Math.round(topFuelTypeLiters * 10) / 10,
  };
}

function isInconsistent(record: FuelingRecord): boolean {
  const hasInvalidGps =
    (record.gpsLatitude != null || record.gpsLongitude != null) &&
    (
      !Number.isFinite(record.gpsLatitude as number) ||
      !Number.isFinite(record.gpsLongitude as number) ||
      record.gpsLatitude === 0 ||
      record.gpsLongitude === 0
    );

  return !Number.isFinite(record.dieselLiters) ||
    record.dieselLiters <= 0 ||
    !Number.isFinite(record.hourmeter) ||
    record.hourmeter <= 0 ||
    hasInvalidGps;
}

export function buildFuelingDashboard(
  tenantId: string,
  filters: FuelingDashboardFilters = {},
): FuelingDashboardPayload {
  const date = dayRange(filters.date);
  const records = FuelingStorage.getAll(tenantId, {
    ...date,
    targetFleetCode: filters.fleet?.trim() || undefined,
    truckFleetCode: filters.truck?.trim() || undefined,
    fuelType: filters.fuel?.trim() || undefined,
  });
  const summary = getFuelDashboardStats(tenantId, date);

  return {
    summary,
    records,
    recentRecords: listRecentFuelingsByTenant(tenantId, 5),
  };
}
