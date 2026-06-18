import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-integrations-id-'));

jest.mock('@/lib/auth/api-guard', () => ({
  requireTenant: jest.fn(() => ({ ok: true, tenantId: 'tenant-a' })),
}));

jest.mock('@/lib/auth/rbac-server', () => ({
  requirePermission: jest.fn(() => null),
}));

jest.mock('@/lib/audit/audit-log', () => ({
  auditFromRequest: jest.fn(),
}));

beforeEach(() => {
  process.env.SILO_STORAGE_DIR = tempDir;
  jest.resetModules();
});

async function loadStore() {
  return import('@/lib/integrations/export-job-store');
}

async function loadRoutes() {
  return {
    detail: await import('@/app/api/integrations/export-jobs/[id]/route'),
    retry: await import('@/app/api/integrations/export-jobs/[id]/retry/route'),
    cancel: await import('@/app/api/integrations/export-jobs/[id]/cancel/route'),
    download: await import('@/app/api/integrations/export-jobs/[id]/download/route'),
  };
}

function makeReq(method = 'GET') {
  return new NextRequest('http://localhost/api/integrations/export-jobs/job-1', {
    method,
    headers: { 'content-type': 'application/json' },
  });
}

test('GET detail retorna job', async () => {
  const { IntegrationExportJobStore } = await loadStore();
  const job = IntegrationExportJobStore.createJob({
    tenantId: 'tenant-a',
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'FICHA_OPERADOR',
    sourceId: 'tenant-a|2026|2026-06-17',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
    operationType: 'CREATE',
    payload: { a: 1 },
    createdBy: 'user',
    payloadHash: 'hash-detail-1',
  });
  const { detail } = await loadRoutes();
  const res = await detail.GET(makeReq(), { params: { id: job.id } });
  expect(res.status).toBe(200);
  expect((await res.json()).job.id).toBe(job.id);
});

test('POST retry reexporta job com falha', async () => {
  const { IntegrationExportJobStore } = await loadStore();
  const job = IntegrationExportJobStore.createJob({
    tenantId: 'tenant-a',
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'FICHA_OPERADOR',
    sourceId: 'tenant-a|2026|2026-06-17',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
    operationType: 'CREATE',
    payload: { a: 1 },
    createdBy: 'user',
    payloadHash: 'hash-retry-1',
  });
  IntegrationExportJobStore.markFailed('tenant-a', job.id, 'erro');

  const { retry } = await loadRoutes();
  const res = await retry.POST(makeReq('POST'), { params: { id: job.id } });
  expect(res.status).toBe(200);
  expect((await res.json()).job.status).toBe('EXPORTED');
});

test('POST cancel bloqueia job pendente', async () => {
  const { IntegrationExportJobStore } = await loadStore();
  const job = IntegrationExportJobStore.createJob({
    tenantId: 'tenant-a',
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'FICHA_OPERADOR',
    sourceId: 'tenant-a|2026|2026-06-17',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
    operationType: 'CREATE',
    payload: { a: 2 },
    createdBy: 'user',
    payloadHash: 'hash-cancel-1',
  });
  const { cancel } = await loadRoutes();
  const res = await cancel.POST(makeReq('POST'), { params: { id: job.id } });
  expect(res.status).toBe(200);
  expect((await res.json()).job.status).toBe('CANCELLED');
});

test('GET download devolve arquivo gerado', async () => {
  const { IntegrationExportJobStore } = await loadStore();
  const job = IntegrationExportJobStore.createJob({
    tenantId: 'tenant-a',
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'FICHA_OPERADOR',
    sourceId: 'tenant-a|2026|2026-06-17',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
    operationType: 'CREATE',
    payload: { a: 3 },
    createdBy: 'user',
    payloadHash: 'hash-download-1',
  });
  IntegrationExportJobStore.markExported('tenant-a', job.id, { success: true, fileName: 'test.json' });
  const fileDir = path.join(tempDir, 'tenant-a', 'exports', 'pims');
  fs.mkdirSync(fileDir, { recursive: true });
  fs.writeFileSync(path.join(fileDir, 'test.json'), '{"ok":true}', 'utf-8');

  const { download } = await loadRoutes();
  const res = await download.GET(makeReq('GET'), { params: { id: job.id } });
  expect(res.status).toBe(200);
  expect(res.headers.get('content-disposition')).toContain('test.json');
});

