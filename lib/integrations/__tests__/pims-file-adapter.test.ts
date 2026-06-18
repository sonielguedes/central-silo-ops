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

test('PIMS_FILE adapter writes a local export file and marks the job as exported', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-integration-'));
  tempDirs.push(root);
  process.env.SILO_STORAGE_DIR = root;

  const { IntegrationExportJobStore } = await import('@/lib/integrations/export-job-store');
  const { PimsFileAdapter } = await import('@/lib/integrations/adapters/pims-file-adapter');

  const job = IntegrationExportJobStore.createJob({
    tenantId: 'tenant-a',
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'DAILY_OPERATOR_SHEET',
    sourceId: 'sheet-1',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
    operationType: 'CREATE',
    createdBy: 'user-1',
    payload: {
      sheetId: 'sheet-1',
      frota: '2026',
      totalHoras: 1.1,
    },
  });

  const adapter = new PimsFileAdapter();
  const result = await adapter.export(job);

  expect(result.success).toBe(true);
  expect(result.fileName).toContain(job.id);

  const exported = IntegrationExportJobStore.getJobById('tenant-a', job.id);
  expect(exported?.status).toBe('EXPORTED');
  expect(exported?.fileName).toBe(result.fileName);

  const filePath = path.join(root, 'tenant-a', 'exports', 'pims', result.fileName ?? '');
  expect(fs.existsSync(filePath)).toBe(true);
});
