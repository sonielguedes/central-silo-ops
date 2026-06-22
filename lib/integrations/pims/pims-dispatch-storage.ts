import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PimsDispatch, PimsDispatchInput, PimsDispatchSearch, PimsDispatchStatus } from './pims-dispatch-types';

const DATA_ROOT = process.env.SILO_STORAGE_DIR || process.env.SILO_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/app/data' : './data');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function tenantDir(tenantId: string) {
  const dir = path.join(DATA_ROOT, tenantId);
  ensureDir(dir);
  return dir;
}

function payloadDir(tenantId: string, dispatchId: string) {
  return path.join(tenantDir(tenantId), 'pims-payloads', dispatchId.replace(/[^a-zA-Z0-9_-]/g, '_'));
}

function filePath(tenantId: string) {
  return path.join(tenantDir(tenantId), 'pims-dispatches.json');
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

function readAll(tenantId: string): PimsDispatch[] {
  return readJson<PimsDispatch[]>(filePath(tenantId), []).filter(Boolean);
}

function writeAll(tenantId: string, items: PimsDispatch[]): void {
  writeJsonAtomic(filePath(tenantId), items);
}

function normalize(value?: string): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

function normalizePath(value?: string): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

function matchesQuery(item: PimsDispatch, q?: string): boolean {
  const term = q?.trim().toLowerCase();
  if (!term) return true;
  return [
    item.id,
    item.configId ?? '',
    item.jobId ?? '',
    item.targetDataType,
    item.status,
    item.referenceId ?? '',
    JSON.stringify(item.request ?? {}),
    JSON.stringify(item.payloadSummary ?? {}),
    item.lastErrorCode ?? '',
    item.lastErrorMessage ?? '',
  ].join(' ').toLowerCase().includes(term);
}

function matchesDateRange(item: PimsDispatch, from?: string, to?: string): boolean {
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

function ensurePayloadPaths(tenantId: string, dispatchId: string): { requestPath: string; responsePath: string } {
  const dir = payloadDir(tenantId, dispatchId);
  ensureDir(dir);
  return {
    requestPath: path.join(dir, 'request.json'),
    responsePath: path.join(dir, 'response.json'),
  };
}

export const PimsDispatchStorage = {
  getFilePath(tenantId: string): string {
    return filePath(tenantId);
  },

  getRequestPath(tenantId: string, dispatchId: string): string {
    return ensurePayloadPaths(tenantId, dispatchId).requestPath;
  },

  getResponsePath(tenantId: string, dispatchId: string): string {
    return ensurePayloadPaths(tenantId, dispatchId).responsePath;
  },

  listByTenant(tenantId: string, filters: PimsDispatchSearch = {}): PimsDispatch[] {
    let items = readAll(tenantId);
    if (filters.status) items = items.filter((item) => item.status === filters.status);
    if (filters.from || filters.to) items = items.filter((item) => matchesDateRange(item, filters.from, filters.to));
    if (filters.q) items = items.filter((item) => matchesQuery(item, filters.q));
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
  },

  getById(tenantId: string, id: string): PimsDispatch | undefined {
    return readAll(tenantId).find((item) => item.id === id);
  },

  create(input: Omit<PimsDispatchInput, 'status' | 'attempts' | 'maxAttempts' | 'request'> & {
    status?: PimsDispatchStatus;
    attempts?: number;
    maxAttempts?: number;
    request?: Record<string, unknown>;
    requestPath?: string;
    responsePath?: string;
  }): PimsDispatch {
    const record: PimsDispatch = {
      id: randomUUID(),
      tenantId: input.tenantId,
      configId: normalize(input.configId),
      jobId: normalize(input.jobId),
      validationResultId: normalize(input.validationResultId),
      targetDataType: input.targetDataType,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      referenceId: normalize(input.referenceId),
      filters: input.filters ? {
        fleetCode: normalize(input.filters.fleetCode),
        operatorRegistration: normalize(input.filters.operatorRegistration),
        journeyId: normalize(input.filters.journeyId),
      } : undefined,
      mockMode: Boolean(input.mockMode),
      request: input.request ?? {},
      requestPath: '',
      responsePath: '',
      attempts: Math.max(0, input.attempts ?? 0),
      maxAttempts: Math.max(1, input.maxAttempts ?? 3),
      status: input.status ?? 'PENDING',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: normalize(input.createdBy),
      updatedBy: normalize(input.createdBy),
    };

    const paths = ensurePayloadPaths(input.tenantId, record.id);
    record.requestPath = normalizePath(input.requestPath) ?? paths.requestPath;
    record.responsePath = normalizePath(input.responsePath) ?? paths.responsePath;

    const items = readAll(input.tenantId);
    items.push(record);
    writeAll(input.tenantId, items);
    return clone(record);
  },

  update(tenantId: string, id: string, patch: Partial<PimsDispatch>): PimsDispatch | null {
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
    ensureDir(path.dirname(item.requestPath));
    fs.writeFileSync(item.requestPath, JSON.stringify(payload, null, 2), 'utf-8');
    return item.requestPath;
  },

  writeResponsePayload(tenantId: string, id: string, payload: unknown): string {
    const item = this.getById(tenantId, id);
    if (!item) throw new Error('Dispatch nao encontrado');
    ensureDir(path.dirname(item.responsePath));
    fs.writeFileSync(item.responsePath, JSON.stringify(payload, null, 2), 'utf-8');
    return item.responsePath;
  },

  seed(tenantId: string, items: PimsDispatch[]): void {
    writeAll(tenantId, items.map((item) => ({
      ...item,
      tenantId,
      requestPath: item.requestPath || ensurePayloadPaths(tenantId, item.id).requestPath,
      responsePath: item.responsePath || ensurePayloadPaths(tenantId, item.id).responsePath,
    })));
  },
};
