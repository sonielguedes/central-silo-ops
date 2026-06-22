import fs from 'fs';
import os from 'os';
import path from 'path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-pims-validation-'));
process.env.SILO_STORAGE_DIR = root;

describe('PIMS validation engine', () => {
  beforeEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    jest.resetModules();
  });

  function seedOperationalData() {
    return import('@/lib/server-storage').then(({ ServerStorage }) => {
      const today = new Date().toISOString().slice(0, 10);
      ServerStorage.updateLiveState('tenant-a', 'eq-1', '2026', {
        equipmentId: 'eq-1',
        fleetCode: '2026',
        tenantId: 'tenant-a',
        status: 'FINALIZADO',
        operatorRegistration: '01',
        operatorName: 'Joao',
        operationCode: '1005',
        costCenterCode: '8080',
        implementCode: '5000',
        hourmeterStart: 100,
        hourmeterEnd: 120,
        totalHourmeter: 20,
        updatedAt: new Date().toISOString(),
      } as never);

      ServerStorage.saveEvent({
        offlineId: 'evt-1',
        equipmentId: 'eq-1',
        type: 'JOURNEY_START',
        timestamp: `${today}T10:00:00.000Z`,
        payload: {
          journeyId: 'j-1',
          fleetCode: '2026',
          operatorRegistration: '01',
          operationCode: '1005',
          stopReasonCode: '3030',
          costCenterCode: '8080',
          implementCode: '5000',
        },
      }, 'tenant-a');
    });
  }

  it('detecta faltas de mapeamento reais e retorna warning', async () => {
    const { PimsMappingStorage } = await import('@/lib/integrations/pims/pims-mapping-storage');
    await seedOperationalData();
    PimsMappingStorage.seed('tenant-a', [
      { id: '1', tenantId: 'tenant-a', type: 'OPERATION', siloCode: '1005', pimsCode: 'PIMS_OP_1005', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', tenantId: 'tenant-a', type: 'EQUIPMENT', siloCode: '2026', pimsCode: '2026', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ] as never);

    const { validatePimsOperationalData } = await import('@/lib/integrations/pims/pims-validation-engine');
    const result = validatePimsOperationalData({ tenantId: 'tenant-a', targetDataType: 'FICHA_OPERADOR', periodStart: new Date().toISOString().slice(0, 10), periodEnd: new Date().toISOString().slice(0, 10) });
    expect(result.status).toBe('WARNING');
    expect(result.issues.some((i) => i.type === 'MISSING_STOP_REASON_MAPPING')).toBe(true);
    expect(result.issues.some((i) => i.type === 'MISSING_OPERATOR_MAPPING')).toBe(true);
    expect(result.issues.some((i) => i.type === 'MISSING_COST_CENTER_MAPPING')).toBe(true);
    expect(result.issues.some((i) => i.type === 'MISSING_IMPLEMENT_MAPPING')).toBe(true);
  });

  it('retorna success quando todos os mapeamentos existem', async () => {
    const { PimsMappingStorage } = await import('@/lib/integrations/pims/pims-mapping-storage');
    await seedOperationalData();
    PimsMappingStorage.seed('tenant-a', [
      { id: '1', tenantId: 'tenant-a', type: 'OPERATION', siloCode: '1005', pimsCode: 'PIMS_OP_1005', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', tenantId: 'tenant-a', type: 'STOP_REASON', siloCode: '3030', pimsCode: 'PIMS_STOP_3030', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '3', tenantId: 'tenant-a', type: 'COST_CENTER', siloCode: '8080', pimsCode: 'PIMS_CC_8080', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '4', tenantId: 'tenant-a', type: 'EQUIPMENT', siloCode: '2026', pimsCode: '2026', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '5', tenantId: 'tenant-a', type: 'OPERATOR', siloCode: '01', pimsCode: 'PIMS_OPR_01', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '6', tenantId: 'tenant-a', type: 'IMPLEMENT', siloCode: '5000', pimsCode: 'PIMS_IMPL_5000', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ] as never);

    const { validatePimsOperationalData } = await import('@/lib/integrations/pims/pims-validation-engine');
    const result = validatePimsOperationalData({ tenantId: 'tenant-a', targetDataType: 'FICHA_OPERADOR', periodStart: new Date().toISOString().slice(0, 10), periodEnd: new Date().toISOString().slice(0, 10) });
    expect(result.status).toBe('SUCCESS');
    expect(result.issues).toHaveLength(0);
  });

  it('avisa quando nao houver dados operacionais', async () => {
    const { validatePimsOperationalData } = await import('@/lib/integrations/pims/pims-validation-engine');
    const result = validatePimsOperationalData({ tenantId: 'tenant-x', targetDataType: 'JOURNEY', periodStart: new Date().toISOString().slice(0, 10), periodEnd: new Date().toISOString().slice(0, 10) });
    expect(result.status).toBe('WARNING');
    expect(result.issues[0]?.message).toContain('Nenhum registro operacional encontrado');
  });
});
