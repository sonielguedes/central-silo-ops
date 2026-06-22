import fs from 'fs';
import os from 'os';
import path from 'path';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-totvs-payload-'));
process.env.SILO_STORAGE_DIR = ROOT;

describe('TOTVS payload builder', () => {
  beforeEach(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
    fs.mkdirSync(ROOT, { recursive: true });
    jest.resetModules();
  });

  it('gera payload rastreavel preservando strings', async () => {
    const { buildTotvsDispatchPayload } = await import('../totvs-payload-builder');

    const payload = buildTotvsDispatchPayload({
      schemaVersion: '1.0',
      source: 'SILO_OPS',
      target: 'TOTVS',
      environment: 'HOMOLOGACAO',
      tenantId: 'tenant-a',
      dispatchId: 'dispatch-1',
      generatedAt: '2026-06-22T12:00:00.000Z',
      dataType: 'FUEL_JOURNEY',
      reference: {
        journeyId: 'journey-1',
        comboioFleetCode: '770',
        driverRegistration: '00125',
      },
      mappedData: {
        fuelTruck: { siloCode: '770', totvsCode: '770' },
        driver: { siloCode: '00125', totvsCode: '00125' },
        costCenter: { siloCode: '8080', totvsCode: '8080' },
        workOrder: { siloCode: '100', totvsCode: 'OS000100' },
      },
      operationalData: {
        startedAt: '2026-06-21T18:33:00.000Z',
        finishedAt: '2026-06-22T12:29:00.000Z',
        kmInicial: 180,
        kmFinal: 580,
        distanciaPercorrida: 400,
        tanqueInicial: 15000,
        totalCarregadoPosto: 0,
        totalAbastecidoMaquinas: 3676,
        saldoTeorico: 11324,
        saldoFinalAutomatico: 11324,
        tanqueFinal: 11324,
        diferenca: 0,
        calculationMode: 'AUTOMATICO',
        status: 'FINALIZADA',
      },
      fuelSupplies: [
        {
          fleetCode: '2026',
          equipmentTotvsCode: '2026',
          productCode: 'DIESEL',
          productTotvsCode: 'DIESEL',
          pumpCode: 'BOMBA-01',
          pumpTotvsCode: 'BOMBA-01',
          liters: 3676,
          occurredAt: '2026-06-22T08:10:00.000Z',
        },
      ],
      summary: {
        recordCount: 1,
        journeyCount: 1,
        fuelingCount: 1,
      },
    });

    expect(payload.schemaVersion).toBe('1.0');
    expect(payload.environment).toBe('HOMOLOGACAO');
    expect(payload.reference.comboioFleetCode).toBe('770');
    expect(payload.mappedData.workOrder.totvsCode).toBe('OS000100');
    expect(payload.operationalData.calculationMode).toBe('AUTOMATICO');
    expect(payload.fuelSupplies?.[0]?.pumpCode).toBe('BOMBA-01');
  });
});
