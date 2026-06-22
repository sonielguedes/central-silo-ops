import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/api-guard', () => ({
  requireMobileAuth: jest.fn((req: NextRequest) => {
    const token = req.headers.get('x-company-token')?.trim();
    if (!token) {
      const { NextResponse } = require('next/server');
      return { ok: false, response: NextResponse.json({ error: 'X-Company-Token is required' }, { status: 401 }) };
    }
    return {
      ok: true,
      tenantId: 'sg01-1781359594113',
      companyToken: 'TOKEN_COMPLETO',
      company: {
        id: 'company-1',
        tenantId: 'sg01-1781359594113',
        code: 'SG01',
        status: 'ATIVO',
        mobileEnabled: true,
      },
    };
  }),
}));

jest.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: jest.fn(() => null),
  RATE_LIMITS: { mobileBatch: {} },
}));

const auditCalls: Array<{ action: string; entityId: string }> = [];
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-fuel-batch-'));
process.env.SILO_STORAGE_DIR = TMP;

let POST: typeof import('../route').POST;

jest.mock('@/lib/audit/audit-log', () => ({
  auditFromRequest: jest.fn((_req: unknown, _tenantId: string, payload: { action: string; entityId: string }) => {
    auditCalls.push(payload);
  }),
}));

function makeReq(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest('http://localhost/api/mobile/fuel/events/batch', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-company-token': 'TOKEN_COMPLETO',
      'x-tenant-id': 'sg01-1781359594113',
      'x-company-code': 'SG01',
      'x-app-module': 'FUEL_CONTROL',
      'x-app-name': 'SILO FuelControl',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const batchBody = (overrides: Record<string, unknown> = {}) => ({
  companyCode: 'SG01',
  tenantId: 'sg01-1781359594113',
  deviceId: 'debug-device',
  appModule: 'FUEL_CONTROL',
  sentAt: '2026-06-21T21:56:00-03:00',
  events: [
    {
      type: 'JOURNEY_START',
      offlineId: 'journey-start-001',
      occurredAt: '2026-06-21T21:56:00-03:00',
      payload: {
        journeyId: 'journey-001',
        comboioFleetCode: '100',
        driverRegistration: '12345',
        driverName: 'Robson Silva',
        shift: 'B',
        kmStart: '1000.5',
        tankStartLiters: 250,
      },
    },
    {
      type: 'POST_REFUEL',
      offlineId: 'post-refuel-001',
      occurredAt: '2026-06-21T21:57:00-03:00',
      payload: {
        journeyId: 'journey-001',
        comboioFleetCode: '100',
        pumpCode: 'BOMBA-01',
        meterStart: 1000,
        meterEnd: 1010,
        liters: 50.5,
        responsibleName: 'Robson Silva',
      },
    },
    {
      type: 'FUEL_SUPPLY',
      offlineId: 'fuel-supply-001',
      occurredAt: '2026-06-21T21:58:00-03:00',
      payload: {
        journeyId: 'journey-001',
        fleetCode: '100',
        fleetDescription: 'Trator John Deere 6110J',
        operatorName: 'Robson Silva',
        pumpCode: 'BOMBA-01',
        fuelType: 'Diesel S-10',
        liters: 58.5,
        hourmeter: 1234.5,
        odometer: 43210,
        durationSeconds: 120,
        averageFlowLitersPerMinute: 29.25,
      },
    },
    {
      type: 'JOURNEY_END',
      offlineId: 'journey-end-001',
      occurredAt: '2026-06-21T22:10:00-03:00',
      payload: {
        journeyId: 'journey-001',
        comboioFleetCode: '100',
        kmFinal: 1100.5,
        tankFinalLiters: 180,
        totalLoaded: 300,
        totalSupplied: 58.5,
        theoreticalBalance: 241.5,
        difference: -61.5,
      },
    },
  ],
  ...overrides,
});

beforeEach(() => {
  auditCalls.length = 0;
  jest.clearAllMocks();
  fs.rmSync(path.join(TMP, 'sg01-1781359594113'), { recursive: true, force: true });
});

beforeAll(async () => {
  POST = (await import('../route')).POST;
});

describe('POST /api/mobile/fuel/events/batch', () => {
  it('persists the batch and returns the expected summary', async () => {
    const res = await POST(makeReq(batchBody()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      received: 4,
      synced: 4,
      duplicates: 0,
      errors: [],
    });

    const { FuelJourneyStorage } = await import('@/lib/fuel-journey-storage');
    const { FuelingStorage } = await import('@/lib/fueling-storage');

    expect(FuelJourneyStorage.getAll('sg01-1781359594113')).toHaveLength(3);
    expect(FuelingStorage.getAll('sg01-1781359594113')).toHaveLength(1);
    expect(auditCalls).toHaveLength(1);
    expect(auditCalls[0]).toMatchObject({ action: 'FUEL_SUPPLY_RECEIVED', entityId: 'fuel-supply-001' });
  });

  it('returns duplicates when the same offlineId is resent', async () => {
    await POST(makeReq(batchBody()));
    jest.clearAllMocks();
    auditCalls.length = 0;

    const res = await POST(makeReq(batchBody()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      received: 4,
      synced: 0,
      duplicates: 4,
      errors: [],
    });

    const { FuelJourneyStorage } = await import('@/lib/fuel-journey-storage');
    const { FuelingStorage } = await import('@/lib/fueling-storage');
    expect(FuelJourneyStorage.getAll('sg01-1781359594113')).toHaveLength(3);
    expect(FuelingStorage.getAll('sg01-1781359594113')).toHaveLength(1);
  });

  it('rejects missing token with 401', async () => {
    const res = await POST(makeReq(batchBody(), { 'x-company-token': '' }));
    expect(res.status).toBe(401);
  });

  it('rejects tenant/company mismatches with 403', async () => {
    const res = await POST(
      makeReq(batchBody({ tenantId: 'tenant-x' }), {
        'x-tenant-id': 'tenant-x',
      }),
    );
    expect(res.status).toBe(403);
  });

  it('rejects inactive or mobile-disabled companies with 403', async () => {
    const { requireMobileAuth } = await import('@/lib/auth/api-guard');
    (requireMobileAuth as jest.Mock).mockReturnValueOnce({
      ok: true,
      tenantId: 'sg01-1781359594113',
      companyToken: 'TOKEN_COMPLETO',
      company: {
        id: 'company-1',
        tenantId: 'sg01-1781359594113',
        code: 'SG01',
        status: 'INATIVO',
        mobileEnabled: false,
      },
    });

    const res = await POST(makeReq(batchBody()));
    expect(res.status).toBe(403);
  });

  it('rejects invalid payload with 400', async () => {
    const res = await POST(makeReq({ companyCode: 'SG01', tenantId: 'sg01-1781359594113' }));
    expect(res.status).toBe(400);
  });
});
