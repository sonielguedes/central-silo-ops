import fs from 'fs';
import os from 'os';
import path from 'path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-integration-jobs-'));
process.env.SILO_STORAGE_DIR = root;

describe('integration job storage', () => {
  beforeEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    jest.resetModules();
  });

  it('cria jobs por tenant e isola leitura', async () => {
    const { IntegrationJobStorage } = await import('@/lib/integrations/integration-job-storage');

    const job = IntegrationJobStorage.create({
      tenantId: 'tenant-a',
      system: 'PIMS',
      type: 'EXPORT_FICHA_OPERADOR',
      title: 'Exportação manual',
      maxAttempts: 3,
      source: 'MANUAL',
      createdBy: 'user-1',
    });

    expect(job.tenantId).toBe('tenant-a');
    expect(job.status).toBe('PENDING');
    expect(IntegrationJobStorage.listByTenant('tenant-a', {}).length).toBe(1);
    expect(IntegrationJobStorage.listByTenant('tenant-b', {}).length).toBe(0);
  });

  it('cancela apenas pendentes e retry apenas falhos/cancelados', async () => {
    const { IntegrationJobStorage } = await import('@/lib/integrations/integration-job-storage');

    const job = IntegrationJobStorage.create({
      tenantId: 'tenant-a',
      system: 'TOTVS',
      type: 'EXPORT_FUELINGS',
      title: 'Abastecimentos',
      maxAttempts: 2,
      source: 'MANUAL',
      createdBy: 'user-1',
    });

    const canceled = IntegrationJobStorage.cancel('tenant-a', job.id, 'user-1');
    expect(canceled?.status).toBe('CANCELED');
    expect(IntegrationJobStorage.cancel('tenant-a', job.id, 'user-1')).toBeNull();

    const retried = IntegrationJobStorage.retry('tenant-a', job.id, 'user-1');
    expect(retried?.status).toBe('RETRYING');
    expect(retried?.attempts).toBe(1);
  });

  it('registra logs e mascara metadata sensivel', async () => {
    const { IntegrationJobStorage } = await import('@/lib/integrations/integration-job-storage');
    const { IntegrationLogStorage } = await import('@/lib/integrations/integration-log-storage');

    const job = IntegrationJobStorage.create({
      tenantId: 'tenant-a',
      system: 'PIMS',
      type: 'TEST_CONNECTION',
      title: 'Teste',
      maxAttempts: 1,
      source: 'API',
      createdBy: 'user-1',
      payload: { apiKey: 'abc123', token: 'secret' },
    });

    const logs = IntegrationLogStorage.listByTenant('tenant-a', { jobId: job.id });
    expect(logs.some((log) => log.event === 'JOB_CREATED')).toBe(true);
    expect(JSON.stringify(logs)).not.toContain('abc123');
    expect(JSON.stringify(logs)).not.toContain('secret');
  });
});

