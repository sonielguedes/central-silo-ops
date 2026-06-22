import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-abastecimentos-api-'));

jest.mock('@/lib/auth/api-guard', () => ({
  requireTenant: jest.fn((req: NextRequest) => {
    const tenantId = req.headers.get('x-silo-tenant')?.trim() || 'tenant-a';
    return { ok: true, tenantId };
  }),
}));

beforeEach(() => {
  process.env.SILO_STORAGE_DIR = tmp;
  jest.resetModules();
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.mkdirSync(path.join(tmp, 'tenant-a'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'tenant-b'), { recursive: true });

  fs.writeFileSync(path.join(tmp, 'tenant-a', 'fueling-records.json'), JSON.stringify([
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
      operatorName: 'Robson Silva',
      fueledAt: '2026-06-21T10:00:00.000-03:00',
      receivedAt: '2026-06-21T10:01:00.000-03:00',
      syncStatus: 'SYNCED',
      source: 'APK',
    },
  ], null, 2));

  fs.writeFileSync(path.join(tmp, 'tenant-b', 'fueling-records.json'), JSON.stringify([
    {
      id: 'r2',
      eventId: 'fuel-002',
      tenantId: 'tenant-b',
      fleetCode: '200',
      truckFleetCode: '200',
      pumpCode: 'BOMBA-99',
      equipmentId: '200',
      dieselLiters: 10,
      hourmeter: 300,
      fuelType: 'Diesel S-10',
      operatorName: 'Outro',
      fueledAt: '2026-06-21T10:00:00.000-03:00',
      receivedAt: '2026-06-21T10:01:00.000-03:00',
      syncStatus: 'SYNCED',
      source: 'APK',
    },
  ], null, 2));
});

it('returns real tenant-scoped fuel data', async () => {
  const { GET } = await import('../route');
  const req = new NextRequest('http://localhost/api/abastecimentos?date=2026-06-21', {
    headers: { 'x-silo-tenant': 'tenant-a' },
  });

  const res = await GET(req);
  expect(res.status).toBe(200);

  const json = await res.json();
  expect(json.summary).toMatchObject({
    litersDay: 58.5,
    totalEvents: 1,
    pending: 0,
    inconsistent: 0,
  });
  expect(json.records).toHaveLength(1);
  expect(json.records[0].tenantId).toBe('tenant-a');
  expect(json.recentRecords).toHaveLength(1);
});

it('does not leak other tenant data', async () => {
  const { GET } = await import('../route');
  const req = new NextRequest('http://localhost/api/abastecimentos?date=2026-06-21', {
    headers: { 'x-silo-tenant': 'tenant-b' },
  });

  const res = await GET(req);
  const json = await res.json();
  expect(json.records).toHaveLength(1);
  expect(json.records[0].tenantId).toBe('tenant-b');
});
