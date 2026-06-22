import fs from 'fs';
import os from 'os';
import path from 'path';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-totvs-mapping-storage-'));
process.env.SILO_STORAGE_DIR = ROOT;

describe('TOTVS mapping storage', () => {
  beforeEach(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
    fs.mkdirSync(ROOT, { recursive: true });
    jest.resetModules();
  });

  it('isola mapeamentos por tenant e preserva códigos como string', async () => {
    const { TotvsMappingStorage } = await import('../totvs-mapping-storage');

    const createdA = TotvsMappingStorage.create({
      tenantId: 'tenant-a',
      type: 'COST_CENTER',
      siloCode: '008080',
      totvsCode: 'TOTVS_CC_008080',
      status: 'ACTIVE',
    });

    TotvsMappingStorage.create({
      tenantId: 'tenant-b',
      type: 'COST_CENTER',
      siloCode: '9000',
      totvsCode: 'TOTVS_CC_9000',
      status: 'ACTIVE',
    });

    expect(createdA.siloCode).toBe('008080');
    expect(TotvsMappingStorage.listByTenant('tenant-a')).toHaveLength(1);
    expect(TotvsMappingStorage.listByTenant('tenant-b')).toHaveLength(1);
    expect(TotvsMappingStorage.listByTenant('tenant-a')[0]?.siloCode).toBe('008080');
  });

  it('atualiza e arquiva mapeamento', async () => {
    const { TotvsMappingStorage } = await import('../totvs-mapping-storage');

    const created = TotvsMappingStorage.create({
      tenantId: 'tenant-a',
      type: 'PRODUCT',
      siloCode: 'DIESEL',
      totvsCode: 'TOTVS_PROD_DIESEL',
      status: 'ACTIVE',
    });

    const updated = TotvsMappingStorage.update('tenant-a', created.id, { totvsCode: 'TOTVS_PROD_DIESEL_S2' });
    expect(updated?.totvsCode).toBe('TOTVS_PROD_DIESEL_S2');

    const archived = TotvsMappingStorage.archive('tenant-a', created.id);
    expect(archived?.status).toBe('INACTIVE');
    expect(TotvsMappingStorage.listActiveByTenant('tenant-a')).toHaveLength(0);
  });
});
