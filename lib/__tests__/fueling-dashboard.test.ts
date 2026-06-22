import fs from 'fs';
import os from 'os';
import path from 'path';

describe('fueling-dashboard', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-fuel-dashboard-'));

  beforeEach(() => {
    process.env.SILO_STORAGE_DIR = tmp;
    jest.resetModules();
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    fs.mkdirSync(path.join(tmp, 'tenant-a'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'tenant-b'), { recursive: true });

    const tenantAFile = path.join(tmp, 'tenant-a', 'fueling-records.json');
    const tenantBFile = path.join(tmp, 'tenant-b', 'fueling-records.json');

    fs.writeFileSync(tenantAFile, JSON.stringify([
      {
        id: 'r1',
        eventId: 'fuel-001',
        tenantId: 'tenant-a',
        fleetCode: '100',
        truckFleetCode: '100',
        pumpCode: 'BOMBA-01',
        equipmentId: '100',
        dieselLiters: 58.5,
        hourmeter: 1234.5,
        fuelType: 'Diesel S-10',
        fleetDescription: 'Trator John Deere 6110J',
        operatorName: 'Robson Silva',
        targetFleetCode: '100',
        deviceId: 'device-a',
        journeyId: 'journey-a',
        fueledAt: '2026-06-21T10:00:00.000-03:00',
        receivedAt: '2026-06-21T10:01:00.000-03:00',
        syncStatus: 'SYNCED',
        source: 'APK',
      },
      {
        id: 'r2',
        eventId: 'fuel-002',
        tenantId: 'tenant-a',
        fleetCode: '101',
        truckFleetCode: '101',
        pumpCode: 'BOMBA-02',
        equipmentId: '101',
        dieselLiters: 40,
        hourmeter: 850,
        fuelType: 'Diesel S-500',
        operatorName: 'Carlos',
        targetFleetCode: '101',
        deviceId: 'device-a',
        journeyId: 'journey-b',
        fueledAt: '2026-06-20T10:00:00.000-03:00',
        receivedAt: '2026-06-20T10:01:00.000-03:00',
        syncStatus: 'SYNCED',
        source: 'APK',
      },
    ], null, 2));

    fs.writeFileSync(tenantBFile, JSON.stringify([
      {
        id: 'r3',
        eventId: 'fuel-003',
        tenantId: 'tenant-b',
        fleetCode: '200',
        truckFleetCode: '200',
        pumpCode: 'BOMBA-99',
        equipmentId: '200',
        dieselLiters: 10,
        hourmeter: 300,
        fuelType: 'Diesel S-10',
        fueledAt: '2026-06-21T10:00:00.000-03:00',
        receivedAt: '2026-06-21T10:01:00.000-03:00',
        syncStatus: 'SYNCED',
        source: 'APK',
      },
    ], null, 2));
  });

  it('reads real tenant data and computes dashboard stats', async () => {
    const { buildFuelingDashboard, getFuelDashboardStats, listFuelingsByTenant, listRecentFuelingsByTenant, listFuelingsByPeriod } = await import('../fueling-dashboard');

    expect(listFuelingsByTenant('tenant-a')).toHaveLength(2);
    expect(listFuelingsByTenant('tenant-b')).toHaveLength(1);

    const period = listFuelingsByPeriod('tenant-a', '2026-06-21T00:00:00.000-03:00', '2026-06-21T23:59:59.999-03:00');
    expect(period).toHaveLength(1);
    expect(period[0].eventId).toBe('fuel-001');

    const recent = listRecentFuelingsByTenant('tenant-a', 1);
    expect(recent).toHaveLength(1);
    expect(recent[0].eventId).toBe('fuel-001');

    const stats = getFuelDashboardStats('tenant-a', {
      from: '2026-06-21T00:00:00.000-03:00',
      to: '2026-06-21T23:59:59.999-03:00',
    });

    expect(stats).toMatchObject({
      litersDay: 58.5,
      totalEvents: 1,
      pending: 0,
      inconsistent: 0,
      topFuelType: 'Diesel S-10',
      topFuelTypeLiters: 58.5,
    });

    const dashboard = buildFuelingDashboard('tenant-a', { date: '2026-06-21' });
    expect(dashboard.records).toHaveLength(1);
    expect(dashboard.recentRecords).toHaveLength(2);
    expect(dashboard.summary.litersDay).toBe(58.5);
  });

  it('keeps tenant isolation intact', async () => {
    const { listFuelingsByTenant } = await import('../fueling-dashboard');
    expect(listFuelingsByTenant('tenant-a').every((record) => record.tenantId === 'tenant-a')).toBe(true);
    expect(listFuelingsByTenant('tenant-b').every((record) => record.tenantId === 'tenant-b')).toBe(true);
  });
});
