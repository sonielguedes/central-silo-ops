/**
 * fueling-storage.ts — Server-side persistence for FUELING events received via
 * POST /api/mobile/events/batch.
 *
 * Storage: {tenantId}/fueling-records.json (one file per tenant)
 * Atomic writes: write to .tmp then fs.renameSync — safe under concurrent requests.
 * Idempotency key: eventId (= APK outbox offlineId UUID) per tenant.
 */

import fs from 'fs';
import path from 'path';

// ── Storage root ─────────────────────────────────────────────────────────────
const DATA_ROOT =
  process.env.SILO_STORAGE_DIR ||
  process.env.SILO_DATA_DIR ||
  (process.env.NODE_ENV === 'production' ? '/app/data' : './data');

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FuelingRecord {
  /** Server-generated UUID for this record. */
  id: string;
  /** APK outbox offlineId (UUID). Used as idempotency key within a tenant. */
  eventId: string;
  tenantId: string;
  /** Frota abastecida no campo. */
  fleetCode: string;
  /** Caminhão comboio que originou o evento. */
  truckFleetCode: string;
  equipmentId: string;
  dieselLiters: number;
  hourmeter: number;
  fuelType?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  operatorRegistration?: string;
  operatorName?: string;
  operationCode?: string;
  targetFleetCode?: string;
  /** ISO timestamp from the APK event (when the fueling happened on the machine). */
  fueledAt: string;
  /** ISO timestamp when the Central received and persisted the record. */
  receivedAt: string;
  /** Persisted sync outcome for the record itself. */
  syncStatus: 'SYNCED';
  /** Always 'APK' — reserved for future integration sources (CENTRAL, MQTT). */
  source: 'APK';
}

export interface FuelingRecordInput {
  eventId: string;
  tenantId: string;
  equipmentId: string;
  fleetCode: string;
  truckFleetCode: string;
  dieselLiters: number;
  hourmeter: number;
  fuelType?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  operatorRegistration?: string;
  operatorName?: string;
  operationCode?: string;
  targetFleetCode?: string;
  fueledAt: string;
}

// ── Storage class ─────────────────────────────────────────────────────────────

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
      return parsed.map((record: FuelingRecord & { truckFleetCode?: string; targetFleetCode?: string; syncStatus?: string }) => ({
        ...record,
        truckFleetCode: record.truckFleetCode ?? record.fleetCode,
        targetFleetCode: record.targetFleetCode ?? record.fleetCode,
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

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Check idempotency: returns true if a record with this eventId already exists
   * for the given tenant. Call BEFORE save to implement "at-most-once" semantics.
   */
  static isDuplicate(tenantId: string, eventId: string): boolean {
    return this.readAll(tenantId).some((r) => r.eventId === eventId);
  }

  /**
   * Persist a new fueling record atomically.
   * Returns 'SYNCED' if saved, 'DUPLICATE' if eventId already present (idempotent).
   */
  static save(input: FuelingRecordInput): 'SYNCED' | 'DUPLICATE' {
    const records = this.readAll(input.tenantId);
    if (records.some((r) => r.eventId === input.eventId)) return 'DUPLICATE';

    const record: FuelingRecord = {
      id:                   `fuel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      eventId:              input.eventId,
      tenantId:             input.tenantId,
      fleetCode:            input.fleetCode,
      truckFleetCode:       input.truckFleetCode,
      equipmentId:          input.equipmentId,
      dieselLiters:         input.dieselLiters,
      hourmeter:            input.hourmeter,
      fuelType:             input.fuelType,
      gpsLatitude:          input.gpsLatitude,
      gpsLongitude:         input.gpsLongitude,
      operatorRegistration: input.operatorRegistration,
      operatorName:         input.operatorName,
      operationCode:        input.operationCode,
      targetFleetCode:      input.targetFleetCode,
      fueledAt:             input.fueledAt,
      receivedAt:           new Date().toISOString(),
      syncStatus:           'SYNCED',
      source:               'APK',
    };

    records.push(record);
    this.writeAll(input.tenantId, records);
    return 'SYNCED';
  }

  /** Return all fueling records for a tenant, newest first. */
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
      records = records.filter((r) => r.truckFleetCode === options.truckFleetCode);
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
