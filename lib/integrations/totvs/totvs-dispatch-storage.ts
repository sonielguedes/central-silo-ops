import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TotvsDispatch, TotvsDispatchSearch, TotvsDispatchStatus } from './totvs-dispatch-types';

const DATA_ROOT = process.env.SILO_STORAGE_DIR || process.env.SILO_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/app/data' : './data');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.+/g, '_');
}

function tenantDir(tenantId: string) {
  const dir = path.join(DATA_ROOT, tenantId);
  ensureDir(dir);
  return dir;
}

function payloadDir(tenantId: string, dispatchId: string) {
  return path.join(tenantDir(tenantId), 'totvs-payloads', sanitizeSegment(dispatchId));
}

function filePath(tenantId: string) {
  return path.join(tenantDir(tenantId), 'totvs-dispatches.json');
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file: string, value: unknown): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

function nowIso() {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readAll(tenantId: string): TotvsDispatch[] {
  return readJson<TotvsDispatch[]>(filePath(tenantId), []).filter(Boolean);
}

function writeAll(tenantId: string, items: TotvsDispatch[]): void {
  writeJsonAtomic(filePath(tenantId), items);
}

function normalize(value?: string): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

function matchesQuery(item: TotvsDispatch, q?: string): boolean {
  const term = q?.trim().toLowerCase();
  if (!term) return true;
  return [
    item.id,
    item.configId,
    item.dataType,
    item.status,
    item.referenceId ?? '',
    item.journeyId ?? '',
    item.fleetCode ?? '',
    item.comboioFleetCode ?? '',
    item.operatorRegistration ?? '',
    item.driverRegistration ?? '',
    item.lastErrorCode ?? '',
    item.lastErrorMessage ?? '',
    item.totvsProtocol ?? '',
  ].join(' ').toLowerCase().includes(term);
}

function matchesDateRange(item: TotvsDispatch, from?: string, to?: string): boolean {
  const created = Date.parse(item.createdAt);
  if (Number.isNaN(created)) return true;
  if (from) {
    const fromTs = Date.parse(from);
    if (!Number.isNaN(fromTs) && created < fromTs) return false;
  }
  if (to) {
    const toTs = Date.parse(to);
    if (!Number.isNaN(toTs) && created > toTs) return false;
  }
  return true;
}

function ensurePayloadPaths(tenantId: string, dispatchId: string): { requestPayloadPath: string; responsePayloadPath: string } {
  const dir = payloadDir(tenantId, dispatchId);
  ensureDir(dir);
  return {
    requestPayloadPath: path.join(dir, 'request.json'),
    responsePayloadPath: path.join(dir, 'response.json'),
  };
}

function createRecordPaths(record: Partial<TotvsDispatch> & { tenantId: string; id: string }): TotvsDispatch {
  const paths = ensurePayloadPaths(record.tenantId, record.id);
  return {
    id: record.id,
    tenantId: record.tenantId,
    configId: record.configId ?? '',
    environment: 'HOMOLOGACAO',
    dataType: record.dataType ?? 'FUEL_JOURNEY',
    referenceId: normalize(record.referenceId),
    journeyId: normalize(record.journeyId),
    fleetCode: normalize(record.fleetCode),
    comboioFleetCode: normalize(record.comboioFleetCode),
    operatorRegistration: normalize(record.operatorRegistration),
    driverRegistration: normalize(record.driverRegistration),
    status: (record.status ?? 'PENDING') as TotvsDispatchStatus,
    validationResultId: normalize(record.validationResultId),
    exportId: normalize(record.exportId),
    jobId: normalize(record.jobId),
    requestPayloadPath: normalize(record.requestPayloadPath) ?? paths.requestPayloadPath,
    responsePayloadPath: normalize(record.responsePayloadPath) ?? paths.responsePayloadPath,
    httpStatus: record.httpStatus,
    totvsProtocol: normalize(record.totvsProtocol),
    totvsMessage: normalize(record.totvsMessage),
    attempts: Math.max(0, record.attempts ?? 0),
    maxAttempts: Math.max(1, record.maxAttempts ?? 3),
    lastErrorCode: normalize(record.lastErrorCode),
    lastErrorMessage: normalize(record.lastErrorMessage),
    createdAt: record.createdAt ?? nowIso(),
    updatedAt: record.updatedAt ?? nowIso(),
    sentAt: record.sentAt,
    finishedAt: record.finishedAt,
    createdBy: normalize(record.createdBy),
  };
}

export const TotvsDispatchStorage = {
  getFilePath(tenantId: string): string {
    return filePath(tenantId);
  },

  getRequestPath(tenantId: string, dispatchId: string): string {
    return ensurePayloadPaths(tenantId, sanitizeSegment(dispatchId)).requestPayloadPath;
  },

  getResponsePath(tenantId: string, dispatchId: string): string {
    return ensurePayloadPaths(tenantId, sanitizeSegment(dispatchId)).responsePayloadPath;
  },

  listByTenant(tenantId: string, filters: TotvsDispatchSearch = {}): TotvsDispatch[] {
    let items = readAll(tenantId);
    if (filters.status) items = items.filter((item) => item.status === filters.status);
    if (filters.dataType) items = items.filter((item) => item.dataType === filters.dataType);
    if (filters.fleetCode) items = items.filter((item) => item.fleetCode === filters.fleetCode);
    if (filters.comboioFleetCode) items = items.filter((item) => item.comboioFleetCode === filters.comboioFleetCode);
    if (filters.operatorRegistration) items = items.filter((item) => item.operatorRegistration === filters.operatorRegistration);
    if (filters.driverRegistration) items = items.filter((item) => item.driverRegistration === filters.driverRegistration);
    if (filters.from || filters.to) items = items.filter((item) => matchesDateRange(item, filters.from, filters.to));
    if (filters.q) items = items.filter((item) => matchesQuery(item, filters.q));
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
  },

  listRecentByTenant(tenantId: string, limit = 10): TotvsDispatch[] {
    return readAll(tenantId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, Math.max(0, limit)).map(clone);
  },

  getById(tenantId: string, id: string): TotvsDispatch | undefined {
    return readAll(tenantId).find((item) => item.id === id);
  },

  create(input: Omit<TotvsDispatch, 'id' | 'createdAt' | 'updatedAt' | 'requestPayloadPath' | 'responsePayloadPath' | 'environment'> & {
    requestPayloadPath?: string;
    responsePayloadPath?: string;
  }): TotvsDispatch {
    const record = createRecordPaths({
      ...input,
      id: randomUUID(),
    });
    const items = readAll(input.tenantId);
    items.push(record);
    writeAll(input.tenantId, items);
    return clone(record);
  },

  update(tenantId: string, id: string, patch: Partial<TotvsDispatch>): TotvsDispatch | null {
    const items = readAll(tenantId);
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    items[index] = {
      ...items[index],
      ...patch,
      updatedAt: nowIso(),
    };
    writeAll(tenantId, items);
    return clone(items[index]);
  },

  writeRequestPayload(tenantId: string, id: string, payload: unknown): string {
    const item = this.getById(tenantId, id);
    if (!item) throw new Error('Dispatch nao encontrado');
    ensureDir(path.dirname(item.requestPayloadPath ?? ''));
    fs.writeFileSync(item.requestPayloadPath!, JSON.stringify(payload, null, 2), 'utf-8');
    return item.requestPayloadPath!;
  },

  writeResponsePayload(tenantId: string, id: string, payload: unknown): string {
    const item = this.getById(tenantId, id);
    if (!item) throw new Error('Dispatch nao encontrado');
    ensureDir(path.dirname(item.responsePayloadPath ?? ''));
    fs.writeFileSync(item.responsePayloadPath!, JSON.stringify(payload, null, 2), 'utf-8');
    return item.responsePayloadPath!;
  },

  seed(tenantId: string, items: TotvsDispatch[]): void {
    writeAll(tenantId, items.map((item) => createRecordPaths({ ...item, tenantId, id: item.id })));
  },
};
