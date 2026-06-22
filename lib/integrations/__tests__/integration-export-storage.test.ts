import fs from 'fs';
import os from 'os';
import path from 'path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-integration-exports-'));
process.env.SILO_STORAGE_DIR = root;

describe('integration export storage', () => {
  beforeEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    jest.resetModules();
  });

  it('cria exportacao por tenant e isola leitura', async () => {
    const { IntegrationExportStorage } = await import('@/lib/integrations/integration-export-storage');

    const item = IntegrationExportStorage.create({
      tenantId: 'tenant-a',
      targetSystem: 'SILO',
      dataType: 'FUELINGS',
      format: 'JSON',
      title: 'Exportacao teste',
      status: 'PENDING',
    });

    expect(item.tenantId).toBe('tenant-a');
    expect(IntegrationExportStorage.listByTenant('tenant-a', {}).length).toBe(1);
    expect(IntegrationExportStorage.listByTenant('tenant-b', {}).length).toBe(0);
  });

  it('atualiza status e campos do arquivo', async () => {
    const { IntegrationExportStorage } = await import('@/lib/integrations/integration-export-storage');
    const item = IntegrationExportStorage.create({
      tenantId: 'tenant-a',
      targetSystem: 'SILO',
      dataType: 'FUELINGS',
      format: 'JSON',
      title: 'Exportacao teste',
      status: 'PENDING',
    });

    const updated = IntegrationExportStorage.setStatus('tenant-a', item.id, 'SUCCESS', {
      fileName: 'export.json',
      filePath: 'exports/abc/export.json',
      recordCount: 3,
    });

    expect(updated?.status).toBe('SUCCESS');
    expect(updated?.recordCount).toBe(3);
    expect(IntegrationExportStorage.getById('tenant-a', item.id)?.fileName).toBe('export.json');
  });
});
