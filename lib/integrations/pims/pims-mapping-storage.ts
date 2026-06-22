import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { PimsMapping, PimsMappingStatus, PimsMappingType } from './pims-mapping-types';

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
  return path.join(tenantDir(tenantId), 'pims-mappings.json');
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

function normalize(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function readAll(tenantId: string): PimsMapping[] {
  return readJson<PimsMapping[]>(filePath(tenantId), []).filter(Boolean);
}

function writeAll(tenantId: string, items: PimsMapping[]): void {
  writeJsonAtomic(filePath(tenantId), items);
}

function assertSupported(value: string, set: Set<string>, label: string): void {
  if (!set.has(value)) throw new Error(`${label} invalido`);
}

const TYPES = new Set<PimsMappingType>(['OPERATION', 'STOP_REASON', 'COST_CENTER', 'EQUIPMENT', 'OPERATOR', 'IMPLEMENT', 'WORK_ORDER', 'FICHA_FIELD']);
const STATUSES = new Set<PimsMappingStatus>(['ACTIVE', 'INACTIVE', 'PENDING_REVIEW']);

export const PimsMappingStorage = {
  getFilePath(tenantId: string): string {
    return filePath(tenantId);
  },

  listByTenant(
    tenantId: string,
    filters: { type?: PimsMappingType; status?: PimsMappingStatus; q?: string } = {},
  ): PimsMapping[] {
    let items = readAll(tenantId);
    if (filters.type) items = items.filter((item) => item.type === filters.type);
    if (filters.status) items = items.filter((item) => item.status === filters.status);
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      items = items.filter((item) =>
        [item.type, item.siloCode, item.siloName ?? '', item.pimsCode, item.pimsName ?? '', item.description ?? '', item.status]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(clone);
  },

  listActiveByTenant(tenantId: string): PimsMapping[] {
    return this.listByTenant(tenantId, { status: 'ACTIVE' });
  },

  findActiveByCode(tenantId: string, type: PimsMappingType, siloCode: string): PimsMapping | undefined {
    const code = normalize(siloCode);
    if (!code) return undefined;
    return readAll(tenantId).find((item) => item.type === type && item.status === 'ACTIVE' && item.siloCode === code);
  },

  getById(tenantId: string, id: string): PimsMapping | undefined {
    return readAll(tenantId).find((item) => item.id === id);
  },

  create(input: Omit<PimsMapping, 'id' | 'createdAt' | 'updatedAt'> & { createdBy?: string }): PimsMapping {
    assertSupported(input.type, TYPES, 'Tipo');
    assertSupported(input.status, STATUSES, 'Status');
    if (!normalize(input.siloCode)) throw new Error('siloCode obrigatorio');
    if (!normalize(input.pimsCode)) throw new Error('pimsCode obrigatorio');

    const record: PimsMapping = {
      id: randomUUID(),
      tenantId: input.tenantId,
      type: input.type,
      siloCode: normalize(input.siloCode),
      siloName: normalize(input.siloName) || undefined,
      pimsCode: normalize(input.pimsCode),
      pimsName: normalize(input.pimsName) || undefined,
      description: normalize(input.description) || undefined,
      status: input.status,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: normalize(input.createdBy) || undefined,
      updatedBy: normalize(input.createdBy) || undefined,
    };

    const items = readAll(input.tenantId);
    items.push(record);
    writeAll(input.tenantId, items);
    return clone(record);
  },

  update(
    tenantId: string,
    id: string,
    patch: Partial<Omit<PimsMapping, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>,
  ): PimsMapping | null {
    const items = readAll(tenantId);
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const current = items[index];
    const next: PimsMapping = {
      ...current,
      ...patch,
      siloCode: patch.siloCode !== undefined ? normalize(patch.siloCode) : current.siloCode,
      siloName: patch.siloName !== undefined ? normalize(patch.siloName) || undefined : current.siloName,
      pimsCode: patch.pimsCode !== undefined ? normalize(patch.pimsCode) : current.pimsCode,
      pimsName: patch.pimsName !== undefined ? normalize(patch.pimsName) || undefined : current.pimsName,
      description: patch.description !== undefined ? normalize(patch.description) || undefined : current.description,
      updatedAt: nowIso(),
    };
    if (patch.type) assertSupported(next.type, TYPES, 'Tipo');
    if (patch.status) assertSupported(next.status, STATUSES, 'Status');
    items[index] = next;
    writeAll(tenantId, items);
    return clone(next);
  },

  inactivate(tenantId: string, id: string): PimsMapping | null {
    return this.update(tenantId, id, { status: 'INACTIVE' });
  },

  seed(tenantId: string, items: PimsMapping[]): void {
    writeAll(tenantId, items.map((item) => ({ ...item, tenantId, siloCode: normalize(item.siloCode), pimsCode: normalize(item.pimsCode) })));
  },
};
