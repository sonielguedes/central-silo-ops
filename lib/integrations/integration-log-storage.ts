import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { IntegrationLog, IntegrationLogLevel, IntegrationSystem } from './integration-job-types';

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
  return path.join(tenantDir(tenantId), 'integration-logs.json');
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

const SYSTEMS = new Set<IntegrationSystem>(['PIMS', 'TOTVS', 'EXPORTACAO', 'API_EXTERNA']);
const LEVELS = new Set<IntegrationLogLevel>(['INFO', 'WARN', 'ERROR', 'DEBUG']);

function assertSupported(value: string, set: Set<string>, label: string): void {
  if (!set.has(value as never)) throw new Error(`${label} invalido`);
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.includes('token') ||
    normalized.includes('secret') ||
    normalized.includes('password') ||
    normalized.includes('apikey') ||
    normalized.includes('api_key') ||
    normalized.includes('authorization') ||
    normalized.includes('credential') ||
    normalized.includes('bearer') ||
    normalized.includes('headervalue')
  );
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== 'object') return value;
  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    output[key] = isSensitiveKey(key) ? '[REDACTED]' : sanitizeValue(entry);
  }
  return output;
}

function readLogs(tenantId: string): IntegrationLog[] {
  return readJson<IntegrationLog[]>(filePath(tenantId), []).filter(Boolean);
}

function writeLogs(tenantId: string, logs: IntegrationLog[]): void {
  writeJsonAtomic(filePath(tenantId), logs);
}

export const IntegrationLogStorage = {
  getFilePath(tenantId: string): string {
    return filePath(tenantId);
  },

  listByTenant(
    tenantId: string,
    filters: {
      jobId?: string;
      system?: IntegrationSystem;
      level?: IntegrationLogLevel;
      event?: string;
      from?: string;
      to?: string;
      q?: string;
      configId?: string;
    } = {},
  ): IntegrationLog[] {
    let items = readLogs(tenantId);
    if (filters.jobId) items = items.filter((item) => item.jobId === filters.jobId);
    if (filters.configId) items = items.filter((item) => item.configId === filters.configId);
    if (filters.system) items = items.filter((item) => item.system === filters.system);
    if (filters.level) items = items.filter((item) => item.level === filters.level);
    if (filters.event?.trim()) items = items.filter((item) => item.event === filters.event?.trim());
    if (filters.from) items = items.filter((item) => item.createdAt >= filters.from!);
    if (filters.to) items = items.filter((item) => item.createdAt <= filters.to!);
    if (filters.q?.trim()) {
      const q = filters.q.trim().toLowerCase();
      items = items.filter((item) =>
        [item.system, item.level, item.event, item.message, item.jobId ?? '', item.configId ?? '', JSON.stringify(item.metadata ?? {})]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
  },

  create(input: {
    tenantId: string;
    system: IntegrationSystem;
    level: IntegrationLogLevel;
    event: string;
    message: string;
    jobId?: string;
    configId?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string;
  }): IntegrationLog {
    assertSupported(input.system, SYSTEMS, 'Sistema');
    assertSupported(input.level, LEVELS, 'Nivel');
    if (!input.event?.trim()) throw new Error('Evento obrigatorio');
    if (!input.message?.trim()) throw new Error('Mensagem obrigatoria');
    const log: IntegrationLog = {
      id: randomUUID(),
      tenantId: input.tenantId,
      jobId: input.jobId,
      configId: input.configId,
      system: input.system,
      level: input.level,
      event: input.event.trim(),
      message: input.message.trim(),
      metadata: input.metadata ? (sanitizeValue(input.metadata) as Record<string, unknown>) : undefined,
      createdAt: nowIso(),
      createdBy: input.createdBy?.trim() || undefined,
    };

    const logs = readLogs(input.tenantId);
    logs.push(log);
    writeLogs(input.tenantId, logs);
    return clone(log);
  },

  seed(tenantId: string, logs: IntegrationLog[]): void {
    writeLogs(tenantId, logs.map((log) => ({ ...log, metadata: log.metadata ? (sanitizeValue(log.metadata) as Record<string, unknown>) : undefined })));
  },
};
