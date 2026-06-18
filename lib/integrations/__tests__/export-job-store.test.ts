import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, expect, test } from '@jest/globals';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
  jest.resetModules();
  delete process.env.SILO_STORAGE_DIR;
  delete process.env.SILO_DATA_DIR;
});

test('creates, lists and retrieves jobs per tenant', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-integration-'));
  tempDirs.push(root);
  process.env.SILO_STORAGE_DIR = root;

  const { IntegrationExportJobStore } = await import('@/lib/integrations/export-job-store');

  const created = IntegrationExportJobStore.createJob({
    tenantId: 'tenant-a',
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'DAILY_OPERATOR_SHEET',
    sourceId: 'sheet-1',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
    operationType: 'CREATE',
    createdBy: 'user-1',
    payload: { sheetId: 'sheet-1' },
  });

  expect(created.tenantId).toBe('tenant-a');
  expect(created.status).toBe('PENDING');
  expect(IntegrationExportJobStore.getJobById('tenant-a', created.id)?.id).toBe(created.id);
  expect(IntegrationExportJobStore.listJobs('tenant-a', {}).length).toBe(1);
  expect(IntegrationExportJobStore.listJobs('tenant-b', {}).length).toBe(0);
});
