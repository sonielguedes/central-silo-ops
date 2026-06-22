import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IntegrationExport, ExportStatus, ExportTargetSystem, ExportDataType, ExportFormat } from './integration-export-types';
import { getTenantExportRoot } from './integration-export-files';

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
  return path.join(tenantDir(tenantId), 'integration-exports.json');
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

function readAll(tenantId: string): IntegrationExport[] {
  return readJson<IntegrationExport[]>(filePath(tenantId), []).filter(Boolean);
}

function writeAll(tenantId: string, items: IntegrationExport[]): void {
  writeJsonAtomic(filePath(tenantId), items);
}

export class IntegrationExportStorage {
  static getFilePath(tenantId: string): string {
    return filePath(tenantId);
  }

  static listByTenant(
    tenantId: string,
    filters: {
      targetSystem?: ExportTargetSystem;
      dataType?: ExportDataType;
      format?: ExportFormat;
      status?: ExportStatus;
      from?: string;
      to?: string;
      q?: string;
    } = {},
  ): IntegrationExport[] {
    let items = readAll(tenantId);
    if (filters.targetSystem) items = items.filter((item) => item.targetSystem === filters.targetSystem);
    if (filters.dataType) items = items.filter((item) => item.dataType === filters.dataType);
    if (filters.format) items = items.filter((item) => item.format === filters.format);
    if (filters.status) items = items.filter((item) => item.status === filters.status);
    if (filters.from) items = items.filter((item) => item.createdAt >= filters.from!);
    if (filters.to) items = items.filter((item) => item.createdAt <= filters.to!);
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      items = items.filter((item) =>
        [item.targetSystem, item.dataType, item.format, item.status, item.title, item.description ?? '', item.fileName ?? '', item.errorMessage ?? '']
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
  }

  static getById(tenantId: string, id: string): IntegrationExport | undefined {
    return readAll(tenantId).find((item) => item.id === id);
  }

  static create(input: Omit<IntegrationExport, 'id' | 'createdAt' | 'updatedAt' | 'status'> & { status?: ExportStatus }): IntegrationExport {
    const now = nowIso();
    const record: IntegrationExport = {
      ...input,
      id: randomUUID(),
      status: input.status ?? 'PENDING',
      createdAt: now,
      updatedAt: now,
    };
    const items = readAll(input.tenantId);
    items.push(record);
    writeAll(input.tenantId, items);
    return clone(record);
  }

  static update(tenantId: string, id: string, patch: Partial<IntegrationExport>): IntegrationExport | null {
    const items = readAll(tenantId);
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) return null;
    items[index] = { ...items[index], ...patch, updatedAt: nowIso() };
    writeAll(tenantId, items);
    return clone(items[index]);
  }

  static setStatus(tenantId: string, id: string, status: ExportStatus, patch: Partial<IntegrationExport> = {}): IntegrationExport | null {
    return this.update(tenantId, id, { ...patch, status });
  }

  static removeFileRefs(tenantId: string, id: string): IntegrationExport | null {
    return this.update(tenantId, id, { filePath: undefined });
  }

  static getTenantExportRoot(tenantId: string): string {
    return getTenantExportRoot(tenantId);
  }
}
