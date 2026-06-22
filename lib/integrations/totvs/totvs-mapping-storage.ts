import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { TotvsMapping, TotvsMappingStatus, TotvsMappingType } from './totvs-mapping-types';

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
  return path.join(tenantDir(tenantId), 'totvs-mappings.json');
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

const TYPES = new Set<TotvsMappingType>(['COST_CENTER', 'WORK_ORDER', 'EQUIPMENT', 'FUEL_TRUCK', 'PRODUCT', 'FUEL_PUMP', 'OPERATOR', 'IMPLEMENT']);
const STATUSES = new Set<TotvsMappingStatus>(['ACTIVE', 'INACTIVE', 'PENDING_REVIEW']);

function assertSupported(value: string, set: Set<string>, label: string): void {
  if (!set.has(value as never)) throw new Error(`${label} invalido`);
}

function readAll(tenantId: string): TotvsMapping[] {
  return readJson<TotvsMapping[]>(filePath(tenantId), []).filter(Boolean);
}

function writeAll(tenantId: string, items: TotvsMapping[]): void {
  writeJsonAtomic(filePath(tenantId), items);
}

function normalizeText(value?: string): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

export const TotvsMappingStorage = {
  getFilePath(tenantId: string): string {
    return filePath(tenantId);
  },

  listByTenant(
    tenantId: string,
    filters: { type?: TotvsMappingType; status?: TotvsMappingStatus; q?: string } = {},
  ): TotvsMapping[] {
    let items = readAll(tenantId);
    if (filters.type) items = items.filter((item) => item.type === filters.type);
    if (filters.status) items = items.filter((item) => item.status === filters.status);
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      items = items.filter((item) =>
        [item.type, item.siloCode, item.siloName ?? '', item.totvsCode, item.totvsName ?? '', item.description ?? '', item.status, item.id]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone);
  },

  listActiveByTenant(tenantId: string): TotvsMapping[] {
    return this.listByTenant(tenantId, { status: 'ACTIVE' });
  },

  getById(tenantId: string, id: string): TotvsMapping | undefined {
    return readAll(tenantId).find((item) => item.id === id);
  },

  findActiveByCode(tenantId: string, type: TotvsMappingType, code: string): TotvsMapping | undefined {
    return this.listActiveByTenant(tenantId).find((item) => item.type === type && item.siloCode === code);
  },

  create(input: {
    tenantId: string;
    type: TotvsMappingType;
    siloCode: string;
    siloName?: string;
    totvsCode: string;
    totvsName?: string;
    description?: string;
    status?: TotvsMappingStatus;
    createdBy?: string;
  }): TotvsMapping {
    assertSupported(input.type, TYPES, 'Tipo');
    assertSupported(input.status ?? 'ACTIVE', STATUSES, 'Status');
    if (!input.siloCode?.trim()) throw new Error('siloCode obrigatorio');
    if (!input.totvsCode?.trim()) throw new Error('totvsCode obrigatorio');

    const items = readAll(input.tenantId);
    const item: TotvsMapping = {
      id: randomUUID(),
      tenantId: input.tenantId,
      type: input.type,
      siloCode: input.siloCode.trim(),
      siloName: normalizeText(input.siloName),
      totvsCode: input.totvsCode.trim(),
      totvsName: normalizeText(input.totvsName),
      description: normalizeText(input.description),
      status: input.status ?? 'ACTIVE',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: normalizeText(input.createdBy),
      updatedBy: normalizeText(input.createdBy),
    };
    items.push(item);
    writeAll(input.tenantId, items);
    return clone(item);
  },

  update(tenantId: string, id: string, patch: Partial<Pick<TotvsMapping, 'type' | 'siloCode' | 'siloName' | 'totvsCode' | 'totvsName' | 'description' | 'status'>> & { updatedBy?: string }): TotvsMapping | null {
    const items = readAll(tenantId);
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    if (patch.type) assertSupported(patch.type, TYPES, 'Tipo');
    if (patch.status) assertSupported(patch.status, STATUSES, 'Status');
    if (patch.siloCode !== undefined && !patch.siloCode.trim()) throw new Error('siloCode obrigatorio');
    if (patch.totvsCode !== undefined && !patch.totvsCode.trim()) throw new Error('totvsCode obrigatorio');

    items[index] = {
      ...items[index],
      ...patch,
      siloCode: patch.siloCode !== undefined ? patch.siloCode.trim() : items[index].siloCode,
      siloName: patch.siloName !== undefined ? normalizeText(patch.siloName) : items[index].siloName,
      totvsCode: patch.totvsCode !== undefined ? patch.totvsCode.trim() : items[index].totvsCode,
      totvsName: patch.totvsName !== undefined ? normalizeText(patch.totvsName) : items[index].totvsName,
      description: patch.description !== undefined ? normalizeText(patch.description) : items[index].description,
      status: patch.status ?? items[index].status,
      updatedAt: nowIso(),
      updatedBy: normalizeText(patch.updatedBy),
    };
    writeAll(tenantId, items);
    return clone(items[index]);
  },

  archive(tenantId: string, id: string, actor?: string): TotvsMapping | null {
    return this.update(tenantId, id, { status: 'INACTIVE', updatedBy: actor });
  },

  seed(tenantId: string, items: TotvsMapping[]): void {
    writeAll(tenantId, items.map((item) => ({ ...item })));
  },
};
