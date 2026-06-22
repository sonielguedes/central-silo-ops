import fs from 'fs';
import os from 'os';
import path from 'path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-integration-export-gen-'));
process.env.SILO_STORAGE_DIR = root;

describe('integration export generator', () => {
  beforeEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    jest.resetModules();
  });

  it('gera pacote JSON e CSV a partir de dados reais', async () => {
    const { ServerStorage } = await import('@/lib/server-storage');
    const { FuelingStorage } = await import('@/lib/fueling-storage');
    const { generateIntegrationExport, toCsv, buildOperationalPackage } = await import('@/lib/integrations/integration-export-generator');

    const today = new Date().toISOString().slice(0, 10);
    const tenantId = 'tenant-a';

    ServerStorage.updateLiveState(tenantId, 'eq-1', '2026', {
      status: 'OPERANDO',
      equipmentId: 'eq-1',
      fleetCode: '2026',
      operatorRegistration: '00125',
      operatorName: 'Joao Silva',
      operationCode: 'OP-01',
      operationName: 'Operacao 01',
      implementCode: 'IMP-7',
      workOrder: 'OS-9',
      hourmeterStart: 100,
      hourmeterCurrent: 110,
    });
    ServerStorage.saveEvent({
      offlineId: 'evt-1',
      equipmentId: 'eq-1',
      type: 'JOURNEY_START',
      timestamp: `${today}T10:00:00.000Z`,
      payload: {
        journeyId: 'journey-1',
        fleetCode: '2026',
        operatorRegistration: '00125',
        operatorName: 'Joao Silva',
        operationCode: 'OP-01',
        operationName: 'Operacao 01',
        implementCode: 'IMP-7',
        workOrderNumber: 'OS-9',
        hourmeterStart: 100,
      },
    }, tenantId);
    FuelingStorage.save({
      eventId: 'fuel-1',
      tenantId,
      equipmentId: 'eq-1',
      fleetCode: '2026',
      dieselLiters: 50,
      hourmeter: 110,
      fuelType: 'DIESEL',
      fleetDescription: 'Frota 2026',
      operatorRegistration: '00125',
      operatorName: 'Joao Silva',
      operationCode: 'OP-01',
      targetFleetCode: '2026',
      pumpCode: 'BOMBA-01',
      journeyId: 'journey-1',
      fueledAt: `${today}T11:00:00.000Z`,
    });

    const ficha = generateIntegrationExport({
      tenantId,
      exportId: 'exp-1',
      targetSystem: 'SILO',
      dataType: 'FICHA_OPERADOR',
      periodStart: today,
      periodEnd: today,
    });
    expect(ficha.recordCount).toBeGreaterThan(0);
    expect(String((ficha.records[0] as Record<string, unknown>).fleetCode)).toBe('2026');
    expect(String((ficha.records[0] as Record<string, unknown>).operatorRegistration)).toBe('00125');

    const fuel = generateIntegrationExport({
      tenantId,
      exportId: 'exp-2',
      targetSystem: 'SILO',
      dataType: 'FUELINGS',
      periodStart: today,
      periodEnd: today,
    });
    const csv = toCsv(fuel.records, 'FUELINGS');
    expect(csv).toContain('fleetCode');
    expect(csv).toContain('2026');
    expect(csv).toContain('00125');

    const pkg = buildOperationalPackage({
      tenantId,
      exportId: 'exp-3',
      targetSystem: 'SILO',
      dataType: 'FULL_OPERATIONAL_PACKAGE',
      periodStart: today,
      periodEnd: today,
      records: fuel.records,
    });
    expect(pkg.schemaVersion).toBe('1.0');
  });
});
