import fs from 'fs';
import os from 'os';
import path from 'path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-integration-logs-'));
process.env.SILO_STORAGE_DIR = root;

describe('integration log storage', () => {
  beforeEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    jest.resetModules();
  });

  it('cria e lista logs por tenant', async () => {
    const { IntegrationLogStorage } = await import('@/lib/integrations/integration-log-storage');

    const log = IntegrationLogStorage.create({
      tenantId: 'tenant-a',
      system: 'PIMS',
      level: 'INFO',
      event: 'JOB_CREATED',
      message: 'Job criado.',
      createdBy: 'user-1',
      metadata: { token: 'abc', nested: { password: '123' } },
    });

    expect(log.tenantId).toBe('tenant-a');
    const items = IntegrationLogStorage.listByTenant('tenant-a', {});
    expect(items).toHaveLength(1);
    expect(IntegrationLogStorage.listByTenant('tenant-b', {}).length).toBe(0);
    expect(JSON.stringify(items[0].metadata)).not.toContain('abc');
    expect(JSON.stringify(items[0].metadata)).not.toContain('123');
  });

  it('filtra por busca e nivel', async () => {
    const { IntegrationLogStorage } = await import('@/lib/integrations/integration-log-storage');

    IntegrationLogStorage.create({
      tenantId: 'tenant-a',
      system: 'TOTVS',
      level: 'ERROR',
      event: 'JOB_FAILED',
      message: 'Falha de integração.',
      createdBy: 'user-1',
    });

    const filtered = IntegrationLogStorage.listByTenant('tenant-a', { level: 'ERROR', q: 'falha' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].event).toBe('JOB_FAILED');
  });
});

