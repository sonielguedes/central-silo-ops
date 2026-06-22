import fs from 'fs';
import os from 'os';
import path from 'path';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-totvs-validation-'));
process.env.SILO_STORAGE_DIR = ROOT;

describe('TOTVS validation engine', () => {
  beforeEach(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
    fs.mkdirSync(ROOT, { recursive: true });
    jest.resetModules();
  });

  it('aponta faltas de mapeamento com dados reais e retorna warning', async () => {
    const { ServerStorage } = await import('@/lib/server-storage');
    const { FuelJourneyStorage } = await import('@/lib/fuel-journey-storage');
    const { FuelingStorage } = await import('@/lib/fueling-storage');
    const { TotvsMappingStorage } = await import('../totvs-mapping-storage');

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
    FuelJourneyStorage.save({
      eventId: 'journey-1',
      tenantId: 'tenant-a',
      companyCode: 'COMP-1',
      deviceId: 'dev-1',
      type: 'JOURNEY_START',
      occurredAt: `${today}T10:00:00.000Z`,
      payload: { journeyId: 'j-1', fleetCode: '2026', pumpCode: 'BOMBA-01', calculationMode: 'AUTOMATICO' },
    });
    FuelingStorage.save({
      eventId: 'fuel-1',
      tenantId: 'tenant-a',
      equipmentId: 'eq-1',
      fleetCode: '2026',
      dieselLiters: 50,
      hourmeter: 120,
      fuelType: 'DIESEL',
      operatorRegistration: '01',
      operatorName: 'Joao',
      pumpCode: 'BOMBA-01',
      journeyId: 'j-1',
      fueledAt: `${today}T11:00:00.000Z`,
    });

    TotvsMappingStorage.seed('tenant-a', [
      { id: '1', tenantId: 'tenant-a', type: 'COST_CENTER', siloCode: '8080', totvsCode: 'T_CC_8080', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', tenantId: 'tenant-a', type: 'WORK_ORDER', siloCode: 'WO-1', totvsCode: 'T_WO_1', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '3', tenantId: 'tenant-a', type: 'EQUIPMENT', siloCode: '2026', totvsCode: 'T_EQ_2026', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '4', tenantId: 'tenant-a', type: 'FUEL_TRUCK', siloCode: 'BOMBA-01', totvsCode: 'T_TRUCK_1', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '5', tenantId: 'tenant-a', type: 'FUEL_PUMP', siloCode: 'BOMBA-01', totvsCode: 'T_PUMP_01', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '6', tenantId: 'tenant-a', type: 'OPERATOR', siloCode: '01', totvsCode: 'T_OP_01', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '7', tenantId: 'tenant-a', type: 'IMPLEMENT', siloCode: '5000', totvsCode: 'T_IMPL_5000', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ] as never);

    const { validateTotvsPreValidation } = await import('../totvs-validation-engine');
    const result = validateTotvsPreValidation({
      tenantId: 'tenant-a',
      targetDataType: 'FUELINGS',
      periodStart: today,
      periodEnd: today,
    });

    expect(result.status).toBe('WARNING');
    expect(result.issues.some((issue) => issue.siloCode === 'DIESEL')).toBe(true);
  });

  it('retorna warning quando nao ha dados operacionais', async () => {
    const { validateTotvsPreValidation } = await import('../totvs-validation-engine');
    const result = validateTotvsPreValidation({
      tenantId: 'tenant-x',
      targetDataType: 'FUELINGS',
      periodStart: '2026-01-01',
      periodEnd: '2026-01-01',
    });

    expect(result.status).toBe('WARNING');
    expect(result.issues[0]?.message).toBe('Nenhum registro operacional encontrado para o filtro informado.');
  });
});
