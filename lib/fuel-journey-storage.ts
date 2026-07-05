import fs from 'fs';
import path from 'path';

const DATA_ROOT =
  process.env.SILO_STORAGE_DIR ||
  process.env.SILO_DATA_DIR ||
  (process.env.NODE_ENV === 'production' ? '/app/data' : './data');

export type FuelJourneyEventType =
  | 'JOURNEY_START'
  | 'POST_REFUEL'
  | 'FUEL_SUPPLY'
  | 'TANK_REFILL'
  | 'STOP_STARTED'
  | 'STOP_REASON_ADDED'
  | 'STOP_ENDED'
  | 'JOURNEY_END';

export interface FuelJourneyEventRecord {
  id: string;
  eventId: string;
  tenantId: string;
  companyCode: string;
  deviceId: string;
  appModule: 'FUEL_CONTROL';
  appName: 'SILO FuelControl';
  type: FuelJourneyEventType;
  occurredAt: string;
  receivedAt: string;
  source: 'APK';
  payload: Record<string, unknown>;
}

export interface FuelJourneyEventInput {
  eventId: string;
  tenantId: string;
  companyCode: string;
  deviceId: string;
  type: FuelJourneyEventType;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export class FuelJourneyStorage {
  private static getFile(tenantId: string): string {
    const dir = path.join(DATA_ROOT, tenantId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'fuel-journey-events.json');
  }

  private static readAll(tenantId: string): FuelJourneyEventRecord[] {
    const file = this.getFile(tenantId);
    if (!fs.existsSync(file)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private static writeAll(tenantId: string, records: FuelJourneyEventRecord[]): void {
    const file = this.getFile(tenantId);
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(records, null, 2));
    fs.renameSync(tmp, file);
  }

  static isDuplicate(tenantId: string, eventId: string): boolean {
    return this.readAll(tenantId).some((event) => event.eventId === eventId);
  }

  static save(input: FuelJourneyEventInput): 'SYNCED' | 'DUPLICATE' {
    const records = this.readAll(input.tenantId);
    if (records.some((event) => event.eventId === input.eventId)) return 'DUPLICATE';

    records.push({
      id: `fuel-jrny-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventId: input.eventId,
      tenantId: input.tenantId,
      companyCode: input.companyCode,
      deviceId: input.deviceId,
      appModule: 'FUEL_CONTROL',
      appName: 'SILO FuelControl',
      type: input.type,
      occurredAt: input.occurredAt,
      receivedAt: new Date().toISOString(),
      source: 'APK',
      payload: input.payload,
    });

    this.writeAll(input.tenantId, records);
    return 'SYNCED';
  }

  static getAll(tenantId: string, options?: { type?: FuelJourneyEventType }): FuelJourneyEventRecord[] {
    const records = this.readAll(tenantId);
    const filtered = options?.type
      ? records.filter((event) => event.type === options.type)
      : records;
    return filtered.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  }
}
