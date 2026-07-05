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

  it('rejects invalid event type with 400', async () => {
    const res = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'INVALID_TYPE',
          offlineId: 'invalid-type-001',
          occurredAt: '2026-06-21T21:58:00-03:00',
          payload: { journeyId: 'journey-001' },
        },
      ],
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors[0].error).toBe('type invalido');
  });

  it('accepts FUEL_SUPPLY with hourmeter filled, odometer null and attendant fields null', async () => {
    const res = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'FUEL_SUPPLY',
          offlineId: 'fuel-supply-hourmeter-null-attendant',
          occurredAt: '2026-06-21T21:58:00-03:00',
          payload: {
            journeyId: 'journey-001',
            journeyOfflineId: 'journey-offline-001',
            comboio: '770',
            fleetCode: '1401',
            liters: 5,
            hourmeter: 558,
            odometer: null,
            productCode: 'DIESEL_S10',
            productDescription: 'Diesel S-10',
            pumpCode: 'BOMBA - 01',
            driverName: 'sony',
            driverRegistration: '1234',
            attendantName: null,
            attendantRegistration: null,
          },
        },
      ],
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      received: 1,
      synced: 1,
      duplicates: 0,
    });

    const { FuelingStorage } = await import('@/lib/fueling-storage');
    const [saved] = FuelingStorage.getAll('sg01-1781359594113');
    expect(saved).toMatchObject({
      journeyId: 'journey-001',
      journeyOfflineId: 'journey-offline-001',
      fleetCode: '1401',
      dieselLiters: 5,
      hourmeter: 558,
      odometer: null,
      fuelType: 'DIESEL_S10',
    });
  });

  it('accepts JOURNEY_END payload using the APK contract fields', async () => {
    const res = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'JOURNEY_END',
          offlineId: 'journey-end-new-contract',
          occurredAt: '2026-06-21T22:10:00-03:00',
          payload: {
            journeyId: 'journey-new-contract',
            comboioFleetCode: '770',
            driverRegistration: '12345',
            driverName: 'Robson Silva',
            shift: 'Dia',
            kmInicial: 180,
            kmFinal: 981,
            distanciaPercorrida: 801,
            tanqueInicial: 15000,
            totalCarregadoPosto: 0,
            totalAbastecidoMaquinas: 3676,
            saldoTeorico: 11324,
            tanqueFinal: 15000,
            diferenca: 3676,
            startedAt: '2026-06-21T18:33:00-03:00',
            finishedAt: '2026-06-21T22:10:00-03:00',
            status: 'FINALIZADA',
            source: 'APK',
          },
        },
      ],
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      success: true,
      received: 1,
      synced: 1,
      duplicates: 0,
      errors: [],
    });

    const { FuelJourneyStorage } = await import('@/lib/fuel-journey-storage');
    const [saved] = FuelJourneyStorage.getAll('sg01-1781359594113', { type: 'JOURNEY_END' });
    expect(saved?.payload).toMatchObject({
      journeyId: 'journey-new-contract',
      comboioFleetCode: '770',
      driverRegistration: '12345',
      driverName: 'Robson Silva',
      shift: 'Dia',
      kmStart: 180,
      kmFinal: 981,
      distanciaPercorrida: 801,
      tankStartLiters: 15000,
      totalCarregadoPosto: 0,
      totalAbastecidoMaquinas: 3676,
      saldoTeorico: 11324,
      tankFinalLiters: 15000,
      diferenca: 3676,
      startedAt: '2026-06-21T18:33:00-03:00',
      finishedAt: '2026-06-21T22:10:00-03:00',
      status: 'FINALIZADA',
      source: 'APK',
    });
  });

  it('accepts JOURNEY_END payload using the canonical Central contract fields', async () => {
    const res = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'JOURNEY_END',
          offlineId: 'journey-end-canonical',
          occurredAt: '2026-06-21T22:10:00-03:00',
          payload: {
            journeyId: 'journey-canonical',
            journeyOfflineId: 'journey-offline-canonical',
            comboio: '770',
            startedAt: '2026-06-21T18:33:00-03:00',
            endedAt: '2026-06-21T22:10:00-03:00',
            kmInitial: 180,
            kmFinal: 981,
            distanceKm: 801,
            tankInitialLiters: 1500,
            totalLoadedLiters: 0,
            totalSuppliedLiters: 20,
            theoreticalFinalBalanceLiters: 1480,
            realFinalBalanceLiters: 1480,
            divergenceLiters: 0,
            status: 'FINALIZADA',
            source: 'APK',
          },
        },
      ],
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(1);

    const { FuelJourneyStorage } = await import('@/lib/fuel-journey-storage');
    const [saved] = FuelJourneyStorage.getAll('sg01-1781359594113', { type: 'JOURNEY_END' });
    expect(saved?.payload).toMatchObject({
      journeyId: 'journey-canonical',
      journeyOfflineId: 'journey-offline-canonical',
      comboio: '770',
      startedAt: '2026-06-21T18:33:00-03:00',
      endedAt: '2026-06-21T22:10:00-03:00',
      kmInitial: 180,
      kmFinal: 981,
      distanceKm: 801,
      tankInitialLiters: 1500,
      totalLoadedLiters: 0,
      totalSuppliedLiters: 20,
      theoreticalFinalBalanceLiters: 1480,
      realFinalBalanceLiters: 1480,
      divergenceLiters: 0,
      status: 'FINALIZADA',
      source: 'APK',
    });
  });

  it('accepts FUEL_SUPPLY with the canonical journey and comboio linkage fields', async () => {
    const res = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'FUEL_SUPPLY',
          offlineId: 'fuel-supply-canonical',
          occurredAt: '2026-06-21T21:58:00-03:00',
          payload: {
            journeyId: 'journey-canonical',
            journeyOfflineId: 'journey-offline-canonical',
            comboio: '770',
            comboioFleetCode: '770',
            fleetCode: '1401',
            liters: 20,
            meterStart: 1000,
            meterEnd: 1010,
            hourmeter: 13.4,
            productCode: 'DIESEL_S10',
            productDescription: 'Diesel S-10',
            tenantId: 'sg01-1781359594113',
            companyCode: 'SG01',
          },
        },
      ],
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(1);

    const { FuelingStorage } = await import('@/lib/fueling-storage');
    const [saved] = FuelingStorage.getAll('sg01-1781359594113');
    expect(saved).toMatchObject({
      journeyId: 'journey-canonical',
      fleetCode: '1401',
      dieselLiters: 20,
      fuelType: 'DIESEL_S10',
    });
  });

  it('blocks a second JOURNEY_START for the same active comboio without quebrar sync', async () => {
    const first = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'JOURNEY_START',
          offlineId: 'journey-start-first',
          occurredAt: '2026-06-21T21:56:00-03:00',
          payload: {
            journeyId: 'journey-first',
            comboioFleetCode: '770',
            driverRegistration: '12345',
            driverName: 'Robson Silva',
            shift: 'B',
            kmStart: 1000.5,
            tankStartLiters: 250,
          },
        },
      ],
    }));
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      success: true,
      received: 1,
      synced: 1,
      duplicates: 0,
      errors: [],
    });

    const second = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'JOURNEY_START',
          offlineId: 'journey-start-second',
          occurredAt: '2026-06-21T21:57:00-03:00',
          payload: {
            journeyId: 'journey-second',
            comboioFleetCode: '770',
            driverRegistration: '12345',
            driverName: 'Robson Silva',
            shift: 'B',
            kmStart: 1001,
            tankStartLiters: 251,
          },
        },
      ],
    }));

    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({
      success: true,
      received: 1,
      synced: 0,
      duplicates: 1,
      errors: [],
    });

    const { FuelJourneyStorage } = await import('@/lib/fuel-journey-storage');
    const journeys = FuelJourneyStorage.getAll('sg01-1781359594113', { type: 'JOURNEY_START' });
    expect(journeys).toHaveLength(1);
  });

  it('treats the same journeyId as idempotent and accepts JOURNEY_END afterwards', async () => {
    const start = {
      type: 'JOURNEY_START',
      offlineId: 'journey-start-idempotent',
      occurredAt: '2026-06-21T21:56:00-03:00',
      payload: {
        journeyId: 'journey-idempotent',
        comboioFleetCode: '770',
        driverRegistration: '12345',
        driverName: 'Robson Silva',
        shift: 'B',
        kmStart: 1000.5,
        tankStartLiters: 250,
      },
    };

    const first = await POST(makeReq({ ...batchBody(), events: [start] }));
    expect(first.status).toBe(200);
    expect((await first.json()).synced).toBe(1);

    const duplicate = await POST(makeReq({
      ...batchBody(),
      events: [{ ...start, offlineId: 'journey-start-idempotent-resend' }],
    }));
    expect(duplicate.status).toBe(200);
    expect(await duplicate.json()).toMatchObject({
      success: true,
      received: 1,
      synced: 0,
      duplicates: 1,
    });

    const end = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'JOURNEY_END',
          offlineId: 'journey-end-idempotent',
          occurredAt: '2026-06-21T22:10:00-03:00',
          payload: {
            journeyId: 'journey-idempotent',
            comboioFleetCode: '770',
            kmInicial: 180,
            kmFinal: 981,
            distanciaPercorrida: 801,
            tanqueInicial: 15000,
            totalCarregadoPosto: 0,
            totalAbastecidoMaquinas: 3676,
            saldoTeorico: 11324,
            tanqueFinal: 15000,
            diferenca: 0,
            startedAt: '2026-06-21T21:56:00-03:00',
            finishedAt: '2026-06-21T22:10:00-03:00',
            status: 'FINALIZADA',
            source: 'APK',
          },
        },
      ],
    }));
    expect(end.status).toBe(200);
    expect(await end.json()).toEqual({
      success: true,
      received: 1,
      synced: 1,
      duplicates: 0,
      errors: [],
    });

    const afterEnd = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'JOURNEY_START',
          offlineId: 'journey-start-after-end',
          occurredAt: '2026-06-21T22:11:00-03:00',
          payload: {
            journeyId: 'journey-after-end',
            comboioFleetCode: '770',
            driverRegistration: '12345',
            driverName: 'Robson Silva',
            shift: 'B',
            kmStart: 1002,
            tankStartLiters: 252,
          },
        },
      ],
    }));

    expect(afterEnd.status).toBe(200);
    expect(await afterEnd.json()).toEqual({
      success: true,
      received: 1,
      synced: 1,
      duplicates: 0,
      errors: [],
    });
  });

  it('accepts FUEL_SUPPLY with ONLY odometer', async () => {
    const res = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'FUEL_SUPPLY',
          offlineId: 'fuel-supply-odo-only',
          occurredAt: '2026-06-21T21:58:00-03:00',
          payload: {
            journeyId: 'journey-001',
            fleetCode: '1401',
            liters: 1.0,
            hourmeter: null,
            odometer: 55890.0,
          },
        },
      ],
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(1);
  });

  it('accepts FUEL_SUPPLY with ONLY hourmeter', async () => {
    const res = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'FUEL_SUPPLY',
          offlineId: 'fuel-supply-hour-only',
          occurredAt: '2026-06-21T21:58:00-03:00',
          payload: {
            journeyId: 'journey-001',
            fleetCode: '100',
            liters: 115.0,
            hourmeter: 13.4,
            odometer: null,
          },
        },
      ],
    }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.synced).toBe(1);
  });

  it('accepts FUEL_SUPPLY with hourmeter = 0 and odometer = null', async () => {
    const res = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'FUEL_SUPPLY',
          offlineId: 'fuel-supply-hour-zero',
          occurredAt: '2026-06-21T21:58:00-03:00',
          payload: {
            journeyId: 'journey-001',
            fleetCode: '1401',
            liters: 1.0,
            hourmeter: 0,
            odometer: null,
          },
        },
      ],
    }));

    expect(res.status).toBe(200);
  });

  it('accepts FUEL_SUPPLY with hourmeter = null and odometer = 0', async () => {
    const res = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'FUEL_SUPPLY',
          offlineId: 'fuel-supply-odo-zero',
          occurredAt: '2026-06-21T21:58:00-03:00',
          payload: {
            journeyId: 'journey-001',
            fleetCode: '1401',
            liters: 1.0,
            hourmeter: null,
            odometer: 0,
          },
        },
      ],
    }));

    expect(res.status).toBe(200);
  });

  it('accepts FUEL_SUPPLY with hourmeter = 0 and odometer = 0', async () => {
    const res = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'FUEL_SUPPLY',
          offlineId: 'fuel-supply-both-zero',
          occurredAt: '2026-06-21T21:58:00-03:00',
          payload: {
            journeyId: 'journey-001',
            fleetCode: '1401',
            liters: 1.0,
            hourmeter: 0,
            odometer: 0,
          },
        },
      ],
    }));

    expect(res.status).toBe(200);
  });

  it('rejects FUEL_SUPPLY with NEITHER hourmeter NOR odometer', async () => {
    const res = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'FUEL_SUPPLY',
          offlineId: 'fuel-supply-invalid',
          occurredAt: '2026-06-21T21:58:00-03:00',
          payload: {
            journeyId: 'journey-001',
            fleetCode: '1401',
            liters: 1.0,
            hourmeter: null,
            odometer: null,
          },
        },
      ],
    }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errors[0].error).toContain('hourmeter ou odometer validos');
  });

  it('accepts TANK_REFILL and STOP_* events', async () => {
    const res = await POST(makeReq({
      ...batchBody(),
      events: [
        {
          type: 'TANK_REFILL',
          offlineId: 'tank-refill-001',
          occurredAt: '2026-06-21T21:58:00-03:00',
          payload: {
            journeyId: 'journey-001',
            journeyOfflineId: 'journey-offline-001',
            comboio: '770',
            liters: 120,
            reasonCode: 'REABASTECIMENTO',
            reasonDescription: 'Reabastecimento do tanque',
          },
        },
        {
          type: 'STOP_STARTED',
          offlineId: 'stop-started-001',
          occurredAt: '2026-06-21T22:00:00-03:00',
          payload: {
            journeyId: 'journey-001',
            journeyOfflineId: 'journey-offline-001',
            comboio: '770',
            stopCode: 'STOP-01',
            stopDescription: 'Parada operacional',
          },
        },
        {
          type: 'STOP_REASON_ADDED',
          offlineId: 'stop-reason-001',
          occurredAt: '2026-06-21T22:01:00-03:00',
          payload: {
            journeyId: 'journey-001',
            journeyOfflineId: 'journey-offline-001',
            comboio: '770',
            reasonCode: 'ALMOÇO',
            reasonDescription: 'Intervalo de almoço',
          },
        },
        {
          type: 'STOP_ENDED',
          offlineId: 'stop-ended-001',
          occurredAt: '2026-06-21T22:02:00-03:00',
          payload: {
            journeyId: 'journey-001',
            journeyOfflineId: 'journey-offline-001',
            comboio: '770',
            stopCode: 'STOP-01',
            stopDescription: 'Parada operacional',
          },
        },
      ],
    }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      success: true,
      received: 4,
      synced: 4,
      duplicates: 0,
    });
  });
});
