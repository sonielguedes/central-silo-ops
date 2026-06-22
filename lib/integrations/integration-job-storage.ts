import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  IntegrationJob,
  IntegrationJobSource,
  IntegrationJobStatus,
  IntegrationJobType,
  IntegrationLogLevel,
  IntegrationSystem,
} from './integration-job-types';
import { IntegrationLogStorage } from './integration-log-storage';

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
  return path.join(tenantDir(tenantId), 'integration-jobs.json');
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
const TYPES = new Set<IntegrationJobType>([
  'EXPORT_FICHA_OPERADOR',
  'EXPORT_JOURNEY',
  'EXPORT_STOP_EVENTS',
  'EXPORT_FUELINGS',
  'SYNC_MASTER_DATA',
  'TEST_CONNECTION',
  'SEND_PIMS_HOMOLOGATION',
  'MANUAL',
]);
const SOURCES = new Set<IntegrationJobSource>(['MANUAL', 'SYSTEM', 'API']);

function assertSupported(value: string, set: Set<string>, label: string): void {
  if (!set.has(value as never)) throw new Error(`${label} invalido`);
}

function readJobs(tenantId: string): IntegrationJob[] {
  return readJson<IntegrationJob[]>(filePath(tenantId), []).filter(Boolean);
}

function writeJobs(tenantId: string, jobs: IntegrationJob[]): void {
  writeJsonAtomic(filePath(tenantId), jobs);
}

function normalizeText(value?: string): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

function toDateValue(value?: string) {
  if (!value) return undefined;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? undefined : ts;
}

function matchesDateRange(item: IntegrationJob, from?: string, to?: string): boolean {
  const created = toDateValue(item.createdAt);
  if (created === undefined) return true;
  const fromValue = toDateValue(from);
  const toValue = toDateValue(to);
  if (fromValue !== undefined && created < fromValue) return false;
  if (toValue !== undefined && created > toValue) return false;
  return true;
}

function matchesQuery(item: IntegrationJob, q?: string): boolean {
  const term = q?.trim().toLowerCase();
  if (!term) return true;
  return [
    item.system,
    item.type,
    item.status,
    item.title,
    item.description ?? '',
    item.lastErrorCode ?? '',
    item.lastErrorMessage ?? '',
    item.source,
    item.id,
    item.configId ?? '',
    JSON.stringify(item.payload ?? {}),
    JSON.stringify(item.result ?? {}),
  ]
    .join(' ')
    .toLowerCase()
    .includes(term);
}

function appendLog(tenantId: string, input: {
  jobId?: string;
  configId?: string;
  system: IntegrationSystem;
  level: IntegrationLogLevel;
  event: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}) {
  IntegrationLogStorage.create({
    tenantId,
    jobId: input.jobId,
    configId: input.configId,
    system: input.system,
    level: input.level,
    event: input.event,
    message: input.message,
    metadata: input.metadata,
    createdBy: input.createdBy,
  });
}

function statusAllowsCancel(status: IntegrationJobStatus): boolean {
  return status === 'PENDING' || status === 'RETRYING';
}

function statusAllowsRetry(status: IntegrationJobStatus): boolean {
  return status === 'FAILED' || status === 'CANCELED';
}

export const IntegrationJobStorage = {
  getFilePath(tenantId: string): string {
    return filePath(tenantId);
  },

  listByTenant(
    tenantId: string,
    filters: {
      system?: IntegrationSystem;
      status?: IntegrationJobStatus;
      type?: IntegrationJobType;
      from?: string;
      to?: string;
      q?: string;
      configId?: string;
    } = {},
  ): IntegrationJob[] {
    let items = readJobs(tenantId);
    if (filters.system) items = items.filter((item) => item.system === filters.system);
    if (filters.status) items = items.filter((item) => item.status === filters.status);
    if (filters.type) items = items.filter((item) => item.type === filters.type);
    if (filters.configId) items = items.filter((item) => item.configId === filters.configId);
    items = items.filter((item) => matchesDateRange(item, filters.from, filters.to));
    items = items.filter((item) => matchesQuery(item, filters.q));
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone);
  },

  listRecentByTenant(tenantId: string, limit = 10): IntegrationJob[] {
    return readJobs(tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(0, limit))
      .map(clone);
  },

  getById(tenantId: string, id: string): IntegrationJob | undefined {
    return readJobs(tenantId).find((item) => item.id === id);
  },

  create(input: {
    tenantId: string;
    system: IntegrationSystem;
    type: IntegrationJobType;
    title: string;
    description?: string;
    payload?: Record<string, unknown>;
    result?: Record<string, unknown>;
    maxAttempts?: number;
    configId?: string;
    source?: IntegrationJobSource;
    createdBy?: string;
  }): IntegrationJob {
    assertSupported(input.system, SYSTEMS, 'Sistema');
    assertSupported(input.type, TYPES, 'Tipo');
    assertSupported(input.source ?? 'MANUAL', SOURCES, 'Origem');
    if (!input.title?.trim()) throw new Error('Titulo obrigatorio');
    const jobs = readJobs(input.tenantId);
    const job: IntegrationJob = {
      id: randomUUID(),
      tenantId: input.tenantId,
      system: input.system,
      configId: normalizeText(input.configId),
      type: input.type,
      status: 'PENDING',
      title: input.title.trim(),
      description: normalizeText(input.description),
      payload: input.payload ? clone(input.payload) : undefined,
      result: input.result ? clone(input.result) : undefined,
      attempts: 0,
      maxAttempts: Math.min(10, Math.max(1, input.maxAttempts ?? 3)),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      createdBy: normalizeText(input.createdBy),
      updatedBy: normalizeText(input.createdBy),
      source: input.source ?? 'MANUAL',
    };

    jobs.push(job);
    writeJobs(input.tenantId, jobs);
    appendLog(input.tenantId, {
      jobId: job.id,
      configId: job.configId,
      system: job.system,
      level: 'INFO',
      event: 'JOB_CREATED',
      message: 'Job de integracao criado manualmente.',
      metadata: {
        type: job.type,
        title: job.title,
        source: job.source,
        maxAttempts: job.maxAttempts,
      },
      createdBy: job.createdBy,
    });
    return clone(job);
  },

  update(tenantId: string, id: string, patch: Partial<IntegrationJob>): IntegrationJob | null {
    const jobs = readJobs(tenantId);
    const index = jobs.findIndex((item) => item.id === id);
    if (index === -1) return null;
    jobs[index] = {
      ...jobs[index],
      ...patch,
      updatedAt: nowIso(),
    };
    writeJobs(tenantId, jobs);
    return clone(jobs[index]);
  },

  cancel(tenantId: string, id: string, actor?: string): IntegrationJob | null {
    const jobs = readJobs(tenantId);
    const index = jobs.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const current = jobs[index];
    if (!statusAllowsCancel(current.status)) return null;
    const next: IntegrationJob = {
      ...current,
      status: 'CANCELED',
      canceledAt: nowIso(),
      updatedAt: nowIso(),
      updatedBy: normalizeText(actor),
    };
    jobs[index] = next;
    writeJobs(tenantId, jobs);
    appendLog(tenantId, {
      jobId: id,
      configId: current.configId,
      system: current.system,
      level: 'WARN',
      event: 'JOB_CANCELED',
      message: 'Job cancelado manualmente.',
      metadata: { status: current.status },
      createdBy: normalizeText(actor),
    });
    return clone(next);
  },

  retry(tenantId: string, id: string, actor?: string): IntegrationJob | null {
    const jobs = readJobs(tenantId);
    const index = jobs.findIndex((item) => item.id === id);
    if (index === -1) return null;
    const current = jobs[index];
    if (!statusAllowsRetry(current.status)) return null;
    const next: IntegrationJob = {
      ...current,
      status: 'RETRYING',
      attempts: Math.min(current.maxAttempts, current.attempts + 1),
      lastErrorCode: undefined,
      lastErrorMessage: undefined,
      canceledAt: undefined,
      updatedAt: nowIso(),
      updatedBy: normalizeText(actor),
    };
    jobs[index] = next;
    writeJobs(tenantId, jobs);
    appendLog(tenantId, {
      jobId: id,
      configId: current.configId,
      system: current.system,
      level: 'INFO',
      event: 'JOB_RETRY_REQUESTED',
      message: 'Retry solicitado para job de integracao.',
      metadata: { previousStatus: current.status, attempts: next.attempts },
      createdBy: normalizeText(actor),
    });
    return clone(next);
  },

  setRunning(tenantId: string, id: string, actor?: string): IntegrationJob | null {
    return this.update(tenantId, id, {
      status: 'RUNNING',
      attempts: this.getById(tenantId, id)?.attempts ? this.getById(tenantId, id)!.attempts + 1 : 1,
      startedAt: nowIso(),
      updatedBy: normalizeText(actor),
    });
  },

  setSuccess(tenantId: string, id: string, result?: Record<string, unknown>, actor?: string): IntegrationJob | null {
    const current = this.getById(tenantId, id);
    if (!current) return null;
    return this.update(tenantId, id, {
      status: 'SUCCESS',
      result: result ? clone(result) : current.result,
      finishedAt: nowIso(),
      lastErrorCode: undefined,
      lastErrorMessage: undefined,
      updatedBy: normalizeText(actor),
    });
  },

  setFailed(tenantId: string, id: string, errorCode: string, errorMessage: string, actor?: string): IntegrationJob | null {
    const current = this.getById(tenantId, id);
    if (!current) return null;
    const next = this.update(tenantId, id, {
      status: 'FAILED',
      lastErrorCode: errorCode,
      lastErrorMessage: errorMessage,
      finishedAt: nowIso(),
      updatedBy: normalizeText(actor),
    });
    if (next) {
      appendLog(tenantId, {
        jobId: id,
        configId: current.configId,
        system: current.system,
        level: 'ERROR',
        event: 'JOB_FAILED',
        message: errorMessage,
        metadata: { errorCode },
        createdBy: normalizeText(actor),
      });
    }
    return next;
  },

  getDashboardStats(
    tenantId: string,
    dateRange?: { from?: string; to?: string },
  ): {
    total: number;
    pending: number;
    running: number;
    failed: number;
    success: number;
    canceled: number;
    retrying: number;
    recent: IntegrationJob[];
  } {
    const jobs = this.listByTenant(tenantId, {
      from: dateRange?.from,
      to: dateRange?.to,
    });

    return {
      total: jobs.length,
      pending: jobs.filter((item) => item.status === 'PENDING').length,
      running: jobs.filter((item) => item.status === 'RUNNING').length,
      failed: jobs.filter((item) => item.status === 'FAILED').length,
      success: jobs.filter((item) => item.status === 'SUCCESS').length,
      canceled: jobs.filter((item) => item.status === 'CANCELED').length,
      retrying: jobs.filter((item) => item.status === 'RETRYING').length,
      recent: jobs.slice(0, 5),
    };
  },

  listByPeriod(tenantId: string, from?: string, to?: string): IntegrationJob[] {
    return this.listByTenant(tenantId, { from, to });
  },

  appendLog,
  canCancel: statusAllowsCancel,
  canRetry: statusAllowsRetry,
};
