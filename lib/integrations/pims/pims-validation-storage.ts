import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PimsValidationResult } from './pims-mapping-types';

const DATA_ROOT =
  process.env.SILO_STORAGE_DIR ||
  process.env.SILO_DATA_DIR ||
  (process.env.NODE_ENV === 'production' ? '/app/data' : './data');

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function tenantDir(tenantId: string) {
  const dir = path.join(DATA_ROOT, tenantId);
  ensureDir(dir);
  return dir;
}

function filePath(tenantId: string) {
  return path.join(tenantDir(tenantId), 'pims-validation-results.json');
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

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function readAll(tenantId: string): PimsValidationResult[] {
  return readJson<PimsValidationResult[]>(filePath(tenantId), []).filter(Boolean);
}

function writeAll(tenantId: string, items: PimsValidationResult[]): void {
  writeJsonAtomic(filePath(tenantId), items);
}

export const PimsValidationStorage = {
  getFilePath(tenantId: string): string {
    return filePath(tenantId);
  },

  listByTenant(tenantId: string): PimsValidationResult[] {
    return readAll(tenantId).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt)).map(clone);
  },

  create(input: Omit<PimsValidationResult, 'id' | 'checkedAt'>): PimsValidationResult {
    const record: PimsValidationResult = {
      ...input,
      id: randomUUID(),
      checkedAt: new Date().toISOString(),
    };
    const items = readAll(input.tenantId);
    items.push(record);
    writeAll(input.tenantId, items);
    return clone(record);
  },

  seed(tenantId: string, items: PimsValidationResult[]): void {
    writeAll(tenantId, items.map((item) => ({ ...item, tenantId })));
  },
};
