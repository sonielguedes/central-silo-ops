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

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-pims-'));
  tempDirs.push(root);
  process.env.SILO_STORAGE_DIR = root;
  return root;
}

test('PIMS_FILE adapter writes a local export file and marks the job as exported', async () => {
  const root = makeRoot();

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
      dataOperacional: '2026-06-17',
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

// Caso 3: nome do arquivo contém data operacional 2026-06-17
test('PimsFileAdapter gera nome de arquivo com dataOperacional correta (2026-06-17)', async () => {
  makeRoot();

  const { IntegrationExportJobStore } = await import('@/lib/integrations/export-job-store');
  const { PimsFileAdapter } = await import('@/lib/integrations/adapters/pims-file-adapter');

  const job = IntegrationExportJobStore.createJob({
    tenantId: 'tenant-a',
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'DAILY_OPERATOR_SHEET',
    sourceId: 'tenant-a|2026|2026-06-17',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
    operationType: 'CREATE',
    createdBy: 'user-1',
    payload: {
      frota: '2026',
      dataOperacional: '2026-06-17',
    },
  });

  const adapter = new PimsFileAdapter();
  const result = await adapter.export(job);

  expect(result.fileName).toContain('2026-06-17');
});

// Caso 4: nome do arquivo contém frota-2026
test('PimsFileAdapter gera nome de arquivo com frota-2026', async () => {
  makeRoot();

  const { IntegrationExportJobStore } = await import('@/lib/integrations/export-job-store');
  const { PimsFileAdapter } = await import('@/lib/integrations/adapters/pims-file-adapter');

  const job = IntegrationExportJobStore.createJob({
    tenantId: 'tenant-a',
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'DAILY_OPERATOR_SHEET',
    sourceId: 'tenant-a|2026|2026-06-17',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
    operationType: 'CREATE',
    createdBy: 'user-1',
    payload: {
      frota: '2026',
      dataOperacional: '2026-06-17',
    },
  });

  const adapter = new PimsFileAdapter();
  const result = await adapter.export(job);

  expect(result.fileName).toContain('frota-2026');
});

// Caso 5: nome do arquivo NÃO contém frota-unknown
test('PimsFileAdapter nao gera frota-unknown no nome do arquivo', async () => {
  makeRoot();

  const { IntegrationExportJobStore } = await import('@/lib/integrations/export-job-store');
  const { PimsFileAdapter } = await import('@/lib/integrations/adapters/pims-file-adapter');

  const job = IntegrationExportJobStore.createJob({
    tenantId: 'tenant-a',
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'DAILY_OPERATOR_SHEET',
    sourceId: 'tenant-a|2026|2026-06-17',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
    operationType: 'CREATE',
    createdBy: 'user-1',
    payload: {
      frota: '2026',
      dataOperacional: '2026-06-17',
    },
  });

  const adapter = new PimsFileAdapter();
  const result = await adapter.export(job);

  expect(result.fileName).not.toContain('frota-unknown');
});

// Caso 6: erro claro se payload.frota ausente
test('PimsFileAdapter falha com erro claro se payload.frota ausente', async () => {
  makeRoot();

  const { IntegrationExportJobStore } = await import('@/lib/integrations/export-job-store');
  const { PimsFileAdapter } = await import('@/lib/integrations/adapters/pims-file-adapter');

  const job = IntegrationExportJobStore.createJob({
    tenantId: 'tenant-a',
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'DAILY_OPERATOR_SHEET',
    sourceId: 'tenant-a|?|2026-06-17',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
    operationType: 'CREATE',
    createdBy: 'user-1',
    payload: {
      // frota ausente intencionalmente
      dataOperacional: '2026-06-17',
    },
  });

  const adapter = new PimsFileAdapter();
  await expect(adapter.export(job)).rejects.toThrow(/frota ausente/i);
});

// Caso 7: erro claro se payload.dataOperacional ausente
test('PimsFileAdapter falha com erro claro se payload.dataOperacional ausente', async () => {
  makeRoot();

  const { IntegrationExportJobStore } = await import('@/lib/integrations/export-job-store');
  const { PimsFileAdapter } = await import('@/lib/integrations/adapters/pims-file-adapter');

  const job = IntegrationExportJobStore.createJob({
    tenantId: 'tenant-a',
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'DAILY_OPERATOR_SHEET',
    sourceId: 'tenant-a|2026|?',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
    operationType: 'CREATE',
    createdBy: 'user-1',
    payload: {
      frota: '2026',
      // dataOperacional ausente intencionalmente
    },
  });

  const adapter = new PimsFileAdapter();
  await expect(adapter.export(job)).rejects.toThrow(/dataOperacional ausente/i);
});

// Caso 8: data 2026-06-17 não pode virar 2026-06-18 (sem conversão UTC)
test('PimsFileAdapter nao converte data operacional via UTC (2026-06-17 permanece 2026-06-17)', async () => {
  makeRoot();

  const { IntegrationExportJobStore } = await import('@/lib/integrations/export-job-store');
  const { PimsFileAdapter } = await import('@/lib/integrations/adapters/pims-file-adapter');

  const job = IntegrationExportJobStore.createJob({
    tenantId: 'tenant-a',
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'DAILY_OPERATOR_SHEET',
    sourceId: 'tenant-a|2026|2026-06-17',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
    operationType: 'CREATE',
    createdBy: 'user-1',
    payload: {
      frota: '2026',
      dataOperacional: '2026-06-17',
    },
  });

  const adapter = new PimsFileAdapter();
  const result = await adapter.export(job);

  // O nome do arquivo deve conter exatamente a data passada, sem deslocamento UTC
  expect(result.fileName).toContain('2026-06-17');
  expect(result.fileName).not.toContain('2026-06-18');
});
