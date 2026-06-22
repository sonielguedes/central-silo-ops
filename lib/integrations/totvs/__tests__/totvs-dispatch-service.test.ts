import fs from 'fs';
import os from 'os';
import path from 'path';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-totvs-dispatch-service-'));
process.env.SILO_STORAGE_DIR = ROOT;

describe('TOTVS dispatch service', () => {
  beforeEach(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
    fs.mkdirSync(ROOT, { recursive: true });
    jest.resetModules();
  });

  it('bloqueia producao e exige config homologacao ativa', async () => {
    const { IntegrationConfigStorage } = await import('@/lib/integrations/integration-config-storage');
    const { sendTotvsDispatch } = await import('../totvs-dispatch-service');

    IntegrationConfigStorage.create('tenant-a', {
      system: 'TOTVS',
      name: 'Prod',
      environment: 'PRODUCAO',
      baseUrl: 'https://totvs.example.com',
      authType: 'NONE',
      timeoutMs: 5000,
      retryCount: 0,
      status: 'ACTIVE',
    }, { userId: 'u1', userName: 'User', userRole: 'ADMIN_EMPRESA' });

    const result = await sendTotvsDispatch({
      tenantId: 'tenant-a',
      dataType: 'FUEL_JOURNEY',
      journeyId: 'j-1',
      referenceId: 'j-1',
      comboioFleetCode: '770',
      driverRegistration: '00125',
      actor: 'User',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('TOTVS_PRODUCTION_BLOCKED');
    }
  });

  it('simula sucesso em mock mode e salva request/response', async () => {
    const { ServerStorage } = await import('@/lib/server-storage');
    const { FuelJourneyStorage } = await import('@/lib/fuel-journey-storage');
    const { FuelingStorage } = await import('@/lib/fueling-storage');
    const { TotvsMappingStorage } = await import('../totvs-mapping-storage');
    const { IntegrationConfigStorage } = await import('@/lib/integrations/integration-config-storage');
    const { sendTotvsDispatch } = await import('../totvs-dispatch-service');

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
      payload: {
        journeyId: 'j-1',
        fleetCode: '2026',
        pumpCode: 'BOMBA-01',
        truckFleetCode: '770',
        comboioFleetCode: '770',
        operatorRegistration: '01',
        driverRegistration: '00125',
        costCenterCode: '8080',
        workOrderNumber: '1005',
        implementCode: '5000',
        equipmentCode: '2026',
        fuelTruckCode: '770',
        calculationMode: 'AUTOMATICO',
      },
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
      { id: '1', tenantId: 'tenant-a', type: 'COST_CENTER', siloCode: '8080', totvsCode: '8080', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', tenantId: 'tenant-a', type: 'WORK_ORDER', siloCode: '1005', totvsCode: 'OS001005', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '3', tenantId: 'tenant-a', type: 'EQUIPMENT', siloCode: '2026', totvsCode: '2026', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '4', tenantId: 'tenant-a', type: 'FUEL_TRUCK', siloCode: '770', totvsCode: '770', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '5', tenantId: 'tenant-a', type: 'PRODUCT', siloCode: 'DIESEL', totvsCode: 'DIESEL', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '6', tenantId: 'tenant-a', type: 'FUEL_PUMP', siloCode: 'BOMBA-01', totvsCode: 'BOMBA-01', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '7', tenantId: 'tenant-a', type: 'OPERATOR', siloCode: '01', totvsCode: '01', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '8', tenantId: 'tenant-a', type: 'IMPLEMENT', siloCode: '5000', totvsCode: '5000', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ] as never);

    IntegrationConfigStorage.create('tenant-a', {
      system: 'TOTVS',
      name: 'Homolog',
      environment: 'HOMOLOGACAO',
      baseUrl: 'mock://totvs-homolog',
      authType: 'NONE',
      timeoutMs: 5000,
      retryCount: 0,
      status: 'ACTIVE',
    }, { userId: 'u1', userName: 'User', userRole: 'ADMIN_EMPRESA' });

    const result = await sendTotvsDispatch({
      tenantId: 'tenant-a',
      dataType: 'FUEL_JOURNEY',
      journeyId: 'j-1',
      referenceId: 'j-1',
      fleetCode: '2026',
      comboioFleetCode: '770',
      operatorRegistration: '01',
      driverRegistration: '00125',
      periodStart: today,
      periodEnd: today,
      actor: 'User',
    }, {
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.response.received).toBe(true);
      expect(fs.existsSync(result.requestPath)).toBe(true);
      expect(fs.existsSync(result.responsePath)).toBe(true);
    }
  });
});
