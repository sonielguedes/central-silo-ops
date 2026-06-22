import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TotvsValidationResult } from './totvs-mapping-types';

const DATA_ROOT = process.env.SILO_STORAGE_DIR || process.env.SILO_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/app/data' : './data');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function tenantDir(tenantId: string) {
  const dir = path.join(DATA_ROOT, tenantId);
  ensureDir(dir);
  return dir;
}

function filePath(tenantId: string) {
  return path.join(tenantDir(tenantId), 'totvs-validation-results.json');
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

function readAll(tenantId: string): TotvsValidationResult[] {
  return readJson<TotvsValidationResult[]>(filePath(tenantId), []).filter(Boolean);
}

function writeAll(tenantId: string, items: TotvsValidationResult[]): void {
  writeJsonAtomic(filePath(tenantId), items);
}

export const TotvsValidationStorage = {
  getFilePath(tenantId: string): string {
    return filePath(tenantId);
  },

  listByTenant(tenantId: string): TotvsValidationResult[] {
    return readAll(tenantId).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt)).map(clone);
  },

  listRecentByTenant(tenantId: string, limit = 10): TotvsValidationResult[] {
    return this.listByTenant(tenantId).slice(0, Math.max(0, limit));
  },

  getById(tenantId: string, id: string): TotvsValidationResult | undefined {
    return readAll(tenantId).find((item) => item.id === id);
  },

  create(input: TotvsValidationResult): TotvsValidationResult {
    const items = readAll(input.tenantId);
    const result: TotvsValidationResult = {
      ...input,
      id: input.id || randomUUID(),
      checkedAt: input.checkedAt || nowIso(),
    };
    items.push(result);
    writeAll(input.tenantId, items);
    return clone(result);
  },
};
