import fs from 'fs';
import path from 'path';

const DATA_ROOT =
  process.env.SILO_STORAGE_DIR ||
  process.env.SILO_DATA_DIR ||
  (process.env.NODE_ENV === 'production' ? '/app/data' : './data');

export interface FuelingRecord {
  id: string;
  eventId: string;
  tenantId: string;
  companyCode?: string;
  fleetCode: string;
  targetFleetCode?: string;
  truckFleetCode?: string;
  comboioFleetCode?: string;
  journeyOfflineId?: string;
  pumpCode?: string;
  equipmentId: string;
  dieselLiters: number;
  hourmeter: number | null;
  fuelType?: string;
  productCode?: string;
  productDescription?: string;
  fleetDescription?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  operatorRegistration?: string;
  operatorName?: string;
  driverRegistration?: string;
  driverName?: string;
  attendantName?: string;
  attendantRegistration?: string | null;
  operationCode?: string;
  deviceId?: string;
  odometer?: number | null;
  durationSeconds?: number;
  averageFlowLitersPerMinute?: number;
  journeyId?: string;
  fueledAt: string;
  receivedAt: string;
  syncStatus: 'SYNCED';
  status?: 'SYNCED';
  source: 'APK';
  origin?: 'APK';
}

export interface FuelingRecordInput {
  eventId: string;
  tenantId: string;
  companyCode?: string;
  equipmentId: string;
  fleetCode: string;
  truckFleetCode?: string;
  comboioFleetCode?: string;
  journeyOfflineId?: string;
  dieselLiters: number;
  hourmeter: number | null;
  fuelType?: string;
  productCode?: string;
  productDescription?: string;
  fleetDescription?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  operatorRegistration?: string;
  operatorName?: string;
  driverRegistration?: string;
  driverName?: string;
  attendantName?: string;
  attendantRegistration?: string | null;
  operationCode?: string;
  targetFleetCode?: string;
  pumpCode?: string;
  deviceId?: string;
  odometer?: number | null;
  durationSeconds?: number;
  averageFlowLitersPerMinute?: number;
  journeyId?: string;
  fueledAt: string;
  origin?: 'APK';
  status?: 'SYNCED';
}

export class FuelingStorage {
  private static getFile(tenantId: string): string {
    const dir = path.join(DATA_ROOT, tenantId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'fueling-records.json');
  }

  private static readAll(tenantId: string): FuelingRecord[] {
    const file = this.getFile(tenantId);
    if (!fs.existsSync(file)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      if (!Array.isArray(parsed)) return [];
      return parsed.map((record: FuelingRecord & { truckFleetCode?: string; pumpCode?: string; targetFleetCode?: string; syncStatus?: string }) => ({
        ...record,
        truckFleetCode: record.truckFleetCode ?? record.comboioFleetCode,
        comboioFleetCode: record.comboioFleetCode ?? record.truckFleetCode,
        targetFleetCode: record.targetFleetCode ?? record.fleetCode,
        driverName: record.driverName ?? record.operatorName,
        driverRegistration: record.driverRegistration ?? record.operatorRegistration,
        productCode: record.productCode ?? record.fuelType,
        productDescription: record.productDescription ?? record.fuelType,
        origin: record.origin ?? record.source ?? 'APK',
        status: record.status ?? 'SYNCED',
        syncStatus: 'SYNCED',
      }));
    } catch {
      return [];
    }
  }

  private static writeAll(tenantId: string, records: FuelingRecord[]): void {
    const file = this.getFile(tenantId);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(records, null, 2));
    fs.renameSync(tmp, file);
  }

  static isDuplicate(tenantId: string, eventId: string): boolean {
    return this.readAll(tenantId).some((r) => r.eventId === eventId);
  }

  static save(input: FuelingRecordInput): 'SYNCED' | 'DUPLICATE' {
    const records = this.readAll(input.tenantId);
    if (records.some((r) => r.eventId === input.eventId)) return 'DUPLICATE';

    const record: FuelingRecord = {
      id: `fuel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventId: input.eventId,
      tenantId: input.tenantId,
      companyCode: input.companyCode,
      fleetCode: input.fleetCode,
      targetFleetCode: input.targetFleetCode ?? input.fleetCode,
      truckFleetCode: input.truckFleetCode ?? input.comboioFleetCode,
      comboioFleetCode: input.comboioFleetCode ?? input.truckFleetCode,
      journeyOfflineId: input.journeyOfflineId,
      pumpCode: input.pumpCode ?? input.truckFleetCode,
      equipmentId: input.equipmentId,
      dieselLiters: input.dieselLiters,
      hourmeter: input.hourmeter,
      fuelType: input.fuelType,
      productCode: input.productCode ?? input.fuelType,
      productDescription: input.productDescription ?? input.fuelType,
      fleetDescription: input.fleetDescription,
      gpsLatitude: input.gpsLatitude,
      gpsLongitude: input.gpsLongitude,
      operatorRegistration: input.operatorRegistration,
      operatorName: input.operatorName,
      driverRegistration: input.driverRegistration,
      driverName: input.driverName,
      attendantName: input.attendantName,
      attendantRegistration: input.attendantRegistration ?? undefined,
      operationCode: input.operationCode,
      deviceId: input.deviceId,
      odometer: input.odometer,
      durationSeconds: input.durationSeconds,
      averageFlowLitersPerMinute: input.averageFlowLitersPerMinute,
      journeyId: input.journeyId,
      fueledAt: input.fueledAt,
      receivedAt: new Date().toISOString(),
      syncStatus: 'SYNCED',
      status: 'SYNCED',
      source: 'APK',
      origin: input.origin ?? 'APK',
    };

    records.push(record);
    this.writeAll(input.tenantId, records);
    return 'SYNCED';
  }

  static getAll(
    tenantId: string,
    options?: {
      from?: string;
      to?: string;
      equipmentId?: string;
      fleetCode?: string;
      truckFleetCode?: string;
      targetFleetCode?: string;
      fuelType?: string;
    },
  ): FuelingRecord[] {
    let records = this.readAll(tenantId);
    if (options?.equipmentId) {
      records = records.filter((r) => r.equipmentId === options.equipmentId);
    }
    if (options?.fleetCode) {
      records = records.filter((r) => r.fleetCode === options.fleetCode);
    }
    if (options?.truckFleetCode) {
      records = records.filter((r) => r.truckFleetCode === options.truckFleetCode || r.pumpCode === options.truckFleetCode);
    }
    if (options?.targetFleetCode) {
      records = records.filter((r) => r.targetFleetCode === options.targetFleetCode);
    }
    if (options?.fuelType) {
      records = records.filter((r) => String(r.fuelType ?? '').toUpperCase() === options.fuelType!.toUpperCase());
    }
    if (options?.from) {
      records = records.filter((r) => r.fueledAt >= options.from!);
    }
    if (options?.to) {
      records = records.filter((r) => r.fueledAt <= options.to!);
    }
    return records.sort((a, b) => b.fueledAt.localeCompare(a.fueledAt));
  }
}
