import fs from 'fs';
import path from 'path';
import { buildPayloadHash } from '@/lib/integrations/payloads/operator-sheet-payload';
import type {
  IntegrationExportJob,
  IntegrationExportResult,
  IntegrationJobStatus,
  IntegrationOperationType,
  IntegrationSourceModule,
  IntegrationTargetSystem,
} from '@/lib/integrations/integration-types';

type JobInput = {
  tenantId: string;
  sourceModule: IntegrationSourceModule;
  sourceType: string;
  sourceId: string;
  targetSystem: IntegrationTargetSystem;
  targetAdapter: string;
  operationType: IntegrationOperationType;
  payload: Record<string, unknown>;
  createdBy: string;
  maxAttempts?: number;
  payloadHash?: string;
};

type JobFilters = {
  targetSystem?: string;
  sourceModule?: string;
  status?: IntegrationJobStatus;
  from?: string;
  to?: string;
  sourceId?: string;
};

function resolveStorageDir(): string {
  const dir =
    process.env.SILO_STORAGE_DIR ||
    process.env.SILO_DATA_DIR ||
    (process.env.NODE_ENV === 'production' ? '/app/data' : './data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const DATA_ROOT = resolveStorageDir();

function tenantDir(tenantId: string): string {
  const dir = path.join(DATA_ROOT, tenantId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function jobsFile(tenantId: string): string {
  return path.join(tenantDir(tenantId), 'integration-export-jobs.json');
}

function readJobs(tenantId: string): IntegrationExportJob[] {
  const file = jobsFile(tenantId);
  if (!fs.existsSync(file)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJobs(tenantId: string, jobs: IntegrationExportJob[]): void {
  const file = jobsFile(tenantId);
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(jobs, null, 2));
  fs.renameSync(tmp, file);
}

function now(): string {
  return new Date().toISOString();
}

function makeId(): string {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isActiveStatus(status: IntegrationJobStatus): boolean {
  return status === 'PENDING' || status === 'PROCESSING' || status === 'EXPORTED' || status === 'ACKNOWLEDGED' || status === 'REPROCESS_REQUIRED';
}

function cloneJob(job: IntegrationExportJob): IntegrationExportJob {
  return JSON.parse(JSON.stringify(job)) as IntegrationExportJob;
}

export const IntegrationExportJobStore = {
  getFilePath(tenantId: string): string {
    return jobsFile(tenantId);
  },

  createJob(input: JobInput): IntegrationExportJob {
    const payload = input.payload ?? {};
    const payloadHash = input.payloadHash || buildPayloadHash(payload);
    const jobs = readJobs(input.tenantId);
    const duplicate = jobs.find(job => job.payloadHash === payloadHash && isActiveStatus(job.status));
    if (duplicate) return cloneJob(duplicate);

    const job: IntegrationExportJob = {
      id: makeId(),
      tenantId: input.tenantId,
      sourceModule: input.sourceModule,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      targetSystem: input.targetSystem,
      targetAdapter: input.targetAdapter,
      operationType: input.operationType,
      payload,
      payloadHash,
      status: 'PENDING',
      attemptCount: 0,
      maxAttempts: input.maxAttempts ?? 3,
      lastAttemptAt: null,
      exportedAt: null,
      acknowledgedAt: null,
      errorMessage: null,
      createdAt: now(),
      updatedAt: now(),
      createdBy: input.createdBy,
    };

    jobs.push(job);
    writeJobs(input.tenantId, jobs);
    return cloneJob(job);
  },

  getJobById(tenantId: string, id: string): IntegrationExportJob | null {
    const found = readJobs(tenantId).find(job => job.id === id);
    return found ? cloneJob(found) : null;
  },

  listJobs(tenantId: string, filters: JobFilters): IntegrationExportJob[] {
    let jobs = readJobs(tenantId);
    if (filters.targetSystem) jobs = jobs.filter(job => job.targetSystem === filters.targetSystem);
    if (filters.sourceModule) jobs = jobs.filter(job => job.sourceModule === filters.sourceModule);
    if (filters.status) jobs = jobs.filter(job => job.status === filters.status);
    if (filters.sourceId) jobs = jobs.filter(job => job.sourceId === filters.sourceId);
    if (filters.from) jobs = jobs.filter(job => job.createdAt >= filters.from!);
    if (filters.to) jobs = jobs.filter(job => job.createdAt <= filters.to!);
    return jobs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(cloneJob);
  },

  updateJobStatus(
    tenantId: string,
    id: string,
    status: IntegrationJobStatus,
    patch: Partial<IntegrationExportJob> = {},
  ): IntegrationExportJob | null {
    const jobs = readJobs(tenantId);
    const idx = jobs.findIndex(job => job.id === id);
    if (idx === -1) return null;
    jobs[idx] = {
      ...jobs[idx],
      ...patch,
      status,
      updatedAt: now(),
    };
    writeJobs(tenantId, jobs);
    return cloneJob(jobs[idx]);
  },

  markProcessing(tenantId: string, id: string): IntegrationExportJob | null {
    const jobs = readJobs(tenantId);
    const idx = jobs.findIndex(job => job.id === id);
    if (idx === -1) return null;
    jobs[idx] = {
      ...jobs[idx],
      status: 'PROCESSING',
      attemptCount: jobs[idx].attemptCount + 1,
      lastAttemptAt: now(),
      updatedAt: now(),
      errorMessage: null,
    };
    writeJobs(tenantId, jobs);
    return cloneJob(jobs[idx]);
  },

  markExported(tenantId: string, id: string, result: IntegrationExportResult): IntegrationExportJob | null {
    const jobs = readJobs(tenantId);
    const idx = jobs.findIndex(job => job.id === id);
    if (idx === -1) return null;
    jobs[idx] = {
      ...jobs[idx],
      status: 'EXPORTED',
      exportedAt: now(),
      updatedAt: now(),
      errorMessage: null,
      fileName: result.fileName ?? jobs[idx].fileName ?? null,
      externalId: result.externalId ?? jobs[idx].externalId ?? null,
      protocol: result.protocol ?? jobs[idx].protocol ?? null,
      acknowledgedAt: jobs[idx].acknowledgedAt ?? null,
    };
    writeJobs(tenantId, jobs);
    return cloneJob(jobs[idx]);
  },

  markFailed(tenantId: string, id: string, error: string): IntegrationExportJob | null {
    const jobs = readJobs(tenantId);
    const idx = jobs.findIndex(job => job.id === id);
    if (idx === -1) return null;
    jobs[idx] = {
      ...jobs[idx],
      status: 'FAILED',
      errorMessage: error,
      lastAttemptAt: now(),
      updatedAt: now(),
    };
    writeJobs(tenantId, jobs);
    return cloneJob(jobs[idx]);
  },

  retryJob(tenantId: string, id: string): IntegrationExportJob | null {
    const jobs = readJobs(tenantId);
    const idx = jobs.findIndex(job => job.id === id);
    if (idx === -1) return null;
    jobs[idx] = {
      ...jobs[idx],
      status: 'PENDING',
      errorMessage: null,
      updatedAt: now(),
    };
    writeJobs(tenantId, jobs);
    return cloneJob(jobs[idx]);
  },

  cancelJob(tenantId: string, id: string): IntegrationExportJob | null {
    const jobs = readJobs(tenantId);
    const idx = jobs.findIndex(job => job.id === id);
    if (idx === -1) return null;
    if (!['PENDING', 'FAILED', 'REPROCESS_REQUIRED'].includes(jobs[idx].status)) return null;
    jobs[idx] = {
      ...jobs[idx],
      status: 'CANCELLED',
      updatedAt: now(),
    };
    writeJobs(tenantId, jobs);
    return cloneJob(jobs[idx]);
  },
};
