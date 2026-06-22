import fs from 'fs';
import os from 'os';
import path from 'path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-fuel-journeys-'));
process.env.SILO_STORAGE_DIR = root;

describe('fuel journeys aggregator', () => {
  beforeEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    jest.resetModules();
  });

  async function load() {
    const mod = await import('../fuel-journeys');
    const { FuelJourneyStorage } = await import('../fuel-journey-storage');
    const { FuelingStorage } = await import('../fueling-storage');
    return { ...mod, FuelJourneyStorage, FuelingStorage };
  }

  it('consolida JOURNEY_START + JOURNEY_END como FINALIZADA', async () => {
    const { FuelJourneyStorage, listFuelJourneys, getFuelJourneyDetails } = await load();

    FuelJourneyStorage.save({
      eventId: 'start-1',
      tenantId: 'tenant-a',
      companyCode: '001',
      deviceId: 'dev-1',
      type: 'JOURNEY_START',
      occurredAt: '2026-06-22T08:00:00.000-03:00',
      payload: {
        journeyId: 'journey-1',
        comboioFleetCode: '770',
        driverRegistration: '01',
        driverName: 'Robson Silva',
        shift: 'Dia',
        kmInicial: 180,
        tanqueInicial: 15000,
        startedAt: '2026-06-22T08:00:00.000-03:00',
        source: 'APK',
      },
    });
    FuelJourneyStorage.save({
      eventId: 'end-1',
      tenantId: 'tenant-a',
      companyCode: '001',
      deviceId: 'dev-1',
      type: 'JOURNEY_END',
      occurredAt: '2026-06-22T12:29:00.000-03:00',
      payload: {
        journeyId: 'journey-1',
        comboioFleetCode: '770',
        driverRegistration: '01',
        driverName: 'Robson Silva',
        shift: 'Dia',
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
        startedAt: '2026-06-22T08:00:00.000-03:00',
        finishedAt: '2026-06-22T12:29:00.000-03:00',
        status: 'FINALIZADA',
        source: 'APK',
      },
    });

    const journeys = listFuelJourneys({ tenantId: 'tenant-a' });
    expect(journeys).toHaveLength(1);
    expect(journeys[0].status).toBe('FINALIZADA');
    expect(journeys[0].finishedAtLabel).toBe('22/06/2026 12:29');
    const detail = getFuelJourneyDetails('tenant-a', 'journey-1');
    expect(detail?.summary.status).toBe('FINALIZADA');
  });

  it('marca jornada sem JOURNEY_END como ATIVA', async () => {
    const { FuelJourneyStorage, getFuelJourneyDetails } = await load();
    FuelJourneyStorage.save({
      eventId: 'start-2',
      tenantId: 'tenant-a',
      companyCode: '001',
      deviceId: 'dev-1',
      type: 'JOURNEY_START',
      occurredAt: '2026-06-22T08:00:00.000-03:00',
      payload: {
        journeyId: 'journey-2',
        comboioFleetCode: '770',
        driverRegistration: '01',
        driverName: 'Robson Silva',
        shift: 'Dia',
        kmInicial: 180,
        tanqueInicial: 15000,
        startedAt: '2026-06-22T08:00:00.000-03:00',
        source: 'APK',
      },
    });

    expect(getFuelJourneyDetails('tenant-a', 'journey-2')?.summary.status).toBe('ATIVA');
    expect(getFuelJourneyDetails('tenant-a', 'journey-2')?.summary.finishedAtLabel).toBe('Em andamento');
  });

  it('vincula FUEL_SUPPLY por journeyId e ignora duplicidade por offlineId', async () => {
    const { FuelJourneyStorage, FuelingStorage, listFuelJourneys } = await load();
    FuelJourneyStorage.save({
      eventId: 'start-3',
      tenantId: 'tenant-a',
      companyCode: '001',
      deviceId: 'dev-1',
      type: 'JOURNEY_START',
      occurredAt: '2026-06-22T08:00:00.000-03:00',
      payload: { journeyId: 'journey-3', comboioFleetCode: '770', driverRegistration: '01', driverName: 'Robson Silva', shift: 'Dia', kmInicial: 180, tanqueInicial: 15000, startedAt: '2026-06-22T08:00:00.000-03:00', source: 'APK' },
    });
    FuelingStorage.save({
      eventId: 'fuel-1',
      tenantId: 'tenant-a',
      equipmentId: '2026',
      fleetCode: '2026',
      truckFleetCode: '770',
      pumpCode: 'BOMBA-01',
      dieselLiters: 100,
      hourmeter: 500,
      fuelType: 'Diesel S-10',
      journeyId: 'journey-3',
      fueledAt: '2026-06-22T10:00:00.000-03:00',
    });
    const file = path.join(root, 'tenant-a', 'fueling-records.json');
    fs.writeFileSync(file, JSON.stringify([
      JSON.parse(fs.readFileSync(file, 'utf-8'))[0],
      JSON.parse(fs.readFileSync(file, 'utf-8'))[0],
    ], null, 2));

    const journeys = listFuelJourneys({ tenantId: 'tenant-a' });
    expect(journeys[0].fuelingCount).toBe(1);
    expect(journeys[0].dieselLiters).toBe(100);
  });

  it('isola tenant e marca evento orfao como INCONSISTENTE', async () => {
    const { FuelingStorage, listFuelJourneys } = await load();
    FuelingStorage.save({
      eventId: 'fuel-orphan',
      tenantId: 'tenant-a',
      equipmentId: '2026',
      fleetCode: '2026',
      truckFleetCode: '770',
      pumpCode: 'BOMBA-01',
      dieselLiters: 50,
      hourmeter: 400,
      fuelType: 'Diesel S-10',
      journeyId: 'journey-orphan',
      fueledAt: '2026-06-22T09:00:00.000-03:00',
    });

    expect(listFuelJourneys({ tenantId: 'tenant-b' })).toEqual([]);
    expect(listFuelJourneys({ tenantId: 'tenant-a' })[0].status).toBe('INCONSISTENTE');
  });

  it('marca divergencia quando saldoFinalAutomatico e negativo e expõe badge Automático', async () => {
    const { FuelJourneyStorage, getFuelJourneyDetails, calculateJourneyKpis, listFuelJourneys } = await load();
    FuelJourneyStorage.save({
      eventId: 'start-4',
      tenantId: 'tenant-a',
      companyCode: '001',
      deviceId: 'dev-1',
      type: 'JOURNEY_START',
      occurredAt: '2026-06-22T08:00:00.000-03:00',
      payload: { journeyId: 'journey-4', comboioFleetCode: '770', driverRegistration: '01', driverName: 'Robson Silva', shift: 'Dia', kmInicial: 180, tanqueInicial: 15000, startedAt: '2026-06-22T08:00:00.000-03:00', source: 'APK' },
    });
    FuelJourneyStorage.save({
      eventId: 'end-4',
      tenantId: 'tenant-a',
      companyCode: '001',
      deviceId: 'dev-1',
      type: 'JOURNEY_END',
      occurredAt: '2026-06-22T12:29:00.000-03:00',
      payload: { journeyId: 'journey-4', comboioFleetCode: '770', driverRegistration: '01', driverName: 'Robson Silva', shift: 'Dia', kmInicial: 180, kmFinal: 580, distanciaPercorrida: 400, tanqueInicial: 15000, totalCarregadoPosto: 0, totalAbastecidoMaquinas: 3676, saldoTeorico: 11324, saldoFinalAutomatico: -2, tanqueFinal: 11324, diferenca: -2, calculationMode: 'AUTOMATICO', startedAt: '2026-06-22T08:00:00.000-03:00', finishedAt: '2026-06-22T12:29:00.000-03:00', status: 'FINALIZADA', source: 'APK' },
    });

    const detail = getFuelJourneyDetails('tenant-a', 'journey-4');
    expect(detail?.summary.divergent).toBe(true);
    expect(detail?.summary.calculationModeLabel).toBe('Automático');
    expect(calculateJourneyKpis(listFuelJourneys({ tenantId: 'tenant-a' })).divergences).toBe(1);
  });

  it('não duplica timeline nem soma litros duas vezes para duplicados por offlineId', async () => {
    const { FuelJourneyStorage, FuelingStorage, getFuelJourneyDetails } = await load();
    FuelJourneyStorage.save({
      eventId: 'start-5',
      tenantId: 'tenant-a',
      companyCode: '001',
      deviceId: 'dev-1',
      type: 'JOURNEY_START',
      occurredAt: '2026-06-22T08:00:00.000-03:00',
      payload: { journeyId: 'journey-5', comboioFleetCode: '770', driverRegistration: '01', driverName: 'Robson Silva', shift: 'Dia', kmInicial: 180, tanqueInicial: 15000, startedAt: '2026-06-22T08:00:00.000-03:00', source: 'APK' },
    });
    FuelingStorage.save({
      eventId: 'fuel-dup',
      tenantId: 'tenant-a',
      equipmentId: '2026',
      fleetCode: '2026',
      truckFleetCode: '770',
      pumpCode: 'BOMBA-01',
      dieselLiters: 100,
      hourmeter: 500,
      fuelType: 'Diesel S-10',
      journeyId: 'journey-5',
      fueledAt: '2026-06-22T10:00:00.000-03:00',
    });
    const file = path.join(root, 'tenant-a', 'fueling-records.json');
    const current = JSON.parse(fs.readFileSync(file, 'utf-8'));
    fs.writeFileSync(file, JSON.stringify([current[0], { ...current[0] }], null, 2));

    const detail = getFuelJourneyDetails('tenant-a', 'journey-5');
    expect(detail?.summary.fuelingCount).toBe(1);
    expect(detail?.summary.totalLiters).toBe(100);
    expect(detail?.timeline).toHaveLength(2);
  });

  it('mantém no máximo uma jornada ATIVA por tenant/company/comboio e rebaixa duplicadas para INCONSISTENTE', async () => {
    const { FuelJourneyStorage, listFuelJourneys } = await load();
    FuelJourneyStorage.save({
      eventId: 'start-a',
      tenantId: 'tenant-a',
      companyCode: '001',
      deviceId: 'dev-1',
      type: 'JOURNEY_START',
      occurredAt: '2026-06-22T08:00:00.000-03:00',
      payload: { journeyId: 'journey-a', comboioFleetCode: '770', driverRegistration: '01', driverName: 'Robson Silva', shift: 'Dia', kmInicial: 180, tanqueInicial: 15000, startedAt: '2026-06-22T08:00:00.000-03:00', source: 'APK' },
    });
    FuelJourneyStorage.save({
      eventId: 'start-b',
      tenantId: 'tenant-a',
      companyCode: '001',
      deviceId: 'dev-1',
      type: 'JOURNEY_START',
      occurredAt: '2026-06-22T08:05:00.000-03:00',
      payload: { journeyId: 'journey-b', comboioFleetCode: '770', driverRegistration: '01', driverName: 'Robson Silva', shift: 'Dia', kmInicial: 181, tanqueInicial: 15000, startedAt: '2026-06-22T08:05:00.000-03:00', source: 'APK' },
    });

    const journeys = listFuelJourneys({ tenantId: 'tenant-a', companyCode: '001' });
    expect(journeys.filter((item) => item.status === 'ATIVA')).toHaveLength(1);
    expect(journeys.filter((item) => item.status === 'INCONSISTENTE')).toHaveLength(1);
    expect(journeys[0].status).toBe('ATIVA');
  });
});
