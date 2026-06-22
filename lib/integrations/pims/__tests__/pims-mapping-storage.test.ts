import fs from 'fs';
import os from 'os';
import path from 'path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-pims-mappings-'));
process.env.SILO_STORAGE_DIR = root;

describe('PIMS mapping storage', () => {
  beforeEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    jest.resetModules();
  });

  it('cria, lista por tenant, atualiza e inativa sem vazar dados', async () => {
    const { PimsMappingStorage } = await import('@/lib/integrations/pims/pims-mapping-storage');

    const created = PimsMappingStorage.create({
      tenantId: 'tenant-a',
      type: 'OPERATION',
      siloCode: '1005',
      siloName: 'Aplicacao',
      pimsCode: 'PIMS_OP_1005',
      pimsName: 'Aplicacao Agricola',
      status: 'ACTIVE',
      createdBy: 'usr-1',
    });

    expect(created.siloCode).toBe('1005');
    expect(created.pimsCode).toBe('PIMS_OP_1005');

    PimsMappingStorage.create({
      tenantId: 'tenant-b',
      type: 'OPERATOR',
      siloCode: '01',
      pimsCode: 'PIMS_OPR_01',
      status: 'ACTIVE',
    });

    expect(PimsMappingStorage.listByTenant('tenant-a').length).toBe(1);
    expect(PimsMappingStorage.listByTenant('tenant-b').length).toBe(1);

    const updated = PimsMappingStorage.update('tenant-a', created.id, { pimsCode: 'PIMS_OP_1005_X' });
    expect(updated?.pimsCode).toBe('PIMS_OP_1005_X');

    const inactivated = PimsMappingStorage.inactivate('tenant-a', created.id);
    expect(inactivated?.status).toBe('INACTIVE');
  });

  it('preserva codigo como string', async () => {
    const { PimsMappingStorage } = await import('@/lib/integrations/pims/pims-mapping-storage');
    const created = PimsMappingStorage.create({
      tenantId: 'tenant-a',
      type: 'EQUIPMENT',
      siloCode: '013020443',
      pimsCode: '2026',
      status: 'ACTIVE',
    });

    expect(typeof created.siloCode).toBe('string');
    expect(typeof created.pimsCode).toBe('string');
  });
});
