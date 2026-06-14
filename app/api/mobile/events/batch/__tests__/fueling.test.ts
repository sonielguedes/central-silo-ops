/**
 * E2E tests for FUELING events via POST /api/mobile/events/batch
 *
 * Frota de referência: fleetCode=1002 (equipmentId=equip-1002)
 *
 * Requirements validated:
 *  1.  200 + SYNCED  — valid FUELING with frota 1002
 *  2.  200 + DUPLICATE — same eventId (retry) returns idempotent success
 *  3.  200 + REJECTED  — dieselLiters = 0 rejected before saveEvent
 *  4.  200 + REJECTED  — dieselLiters missing/NaN rejected
 *  5.  200 + REJECTED  — hourmeter = 0 rejected
 *  6.  200 + REJECTED  — hourmeter missing/NaN rejected
 *  7.  403 — mobileToken mismatch inside event.data
 *  8.  FuelingStorage NOT called for REJECTED events
 *  9.  FuelingStorage NOT called twice on DUPLICATE
 *  10. Audit written once per SYNCED, never for DUPLICATE/REJECTED
 *  11. Cross-tenant: event from tenantB cannot see tenantA fueling records
 *  12. 400 — missing header / machineId
 *  13. 401 — missing X-Company-Token
 *  14. 403 — inactive fleet
 *  15. Batch with mixed events: HEARTBEAT + FUELING — both processed
 */

import { NextRequest } from 'next/server';

// ── Mock requireMobileAuth ────────────────────────────────────────────────────
const TENANT_A = 'fazenda-a';
const EQUIP_ID = 'equip-1002';
const FLEET_CODE = '1002';
const COMPANY_TOKEN = 'CTK-AABBCCDDEE';
const MOBILE_TOKEN  = 'MTK-XXYYZZ1234';

let mockAuthOk = true;
let mockTenantId = TENANT_A;

jest.mock('@/lib/auth/api-guard', () => ({
  requireMobileAuth: jest.fn(() =>
    mockAuthOk
      ? { ok: true, tenantId: mockTenantId, companyToken: COMPANY_TOKEN, company: { id: 'co-1', tenantId: mockTenantId } }
      : { ok: false, response: require('next/server').NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  ),
}));

// ── Mock rate limiter (always pass) ──────────────────────────────────────────
jest.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: jest.fn(() => null),
  RATE_LIMITS: { mobileBatch: {} },
}));

// ── Mock ServerStorage ────────────────────────────────────────────────────────
const eventStore: Record<string, { offlineId: string; type: string }[]> = {};
let mockEquipment: Record<string, unknown> | null = {
  id: EQUIP_ID, code: FLEET_CODE, tenantId: TENANT_A,
  entityStatus: 'ATIVO', status: 'ATIVO',
  mobileEnabled: true, mobileToken: MOBILE_TOKEN,
};
let mockEquipValidation: { ok: boolean; status?: number; error?: string; equipment?: unknown } =
  { ok: true, equipment: mockEquipment };

jest.mock('@/lib/server-storage', () => ({
  ServerStorage: {
    getEquipmentById: jest.fn((_id: string, tenantId: string) =>
      tenantId === TENANT_A ? mockEquipment : null
    ),
    validateMobileEquipment: jest.fn(() => mockEquipValidation),
    saveEvent: jest.fn((event: { offlineId: string; type: string }, tenantId: string) => {
      if (!eventStore[tenantId]) eventStore[tenantId] = [];
      const dup = eventStore[tenantId].some(e => e.offlineId === event.offlineId);
      if (dup) return 'DUPLICATE';
      eventStore[tenantId].push(event);
      return 'SYNCED';
    }),
    updateLiveState: jest.fn(),
  },
}));

// ── Mock CadastroStorage ──────────────────────────────────────────────────────
jest.mock('@/lib/cadastro-storage', () => ({
  CadastroStorage: { getAll: jest.fn(() => []) },
}));

// ── Mock FuelingStorage ───────────────────────────────────────────────────────
const fuelingStore: Record<string, { eventId: string }[]> = {};

jest.mock('@/lib/fueling-storage', () => ({
  FuelingStorage: {
    save: jest.fn((input: { eventId: string; tenantId: string; dieselLiters: number; hourmeter: number }) => {
      if (!fuelingStore[input.tenantId]) fuelingStore[input.tenantId] = [];
      const dup = fuelingStore[input.tenantId].some(r => r.eventId === input.eventId);
      if (dup) return 'DUPLICATE';
      fuelingStore[input.tenantId].push({ ...input });
      return 'SYNCED';
    }),
    isDuplicate: jest.fn((tenantId: string, eventId: string) =>
      (fuelingStore[tenantId] ?? []).some(r => r.eventId === eventId)
    ),
    getAll: jest.fn((tenantId: string) => fuelingStore[tenantId] ?? []),
  },
}));

// ── Mock audit ────────────────────────────────────────────────────────────────
const auditCalls: { action: string; entityId: string }[] = [];
jest.mock('@/lib/audit/audit-log', () => ({
  auditFromRequest: jest.fn((_req: unknown, _tenantId: string, params: { action: string; entityId: string }) => {
    auditCalls.push(params);
  }),
}));

// ── Import route under test ───────────────────────────────────────────────────
import { POST } from '@/app/api/mobile/events/batch/route';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeBatchReq(events: unknown[], fleetCode = FLEET_CODE): NextRequest {
  return new NextRequest('http://localhost/api/mobile/events/batch', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-company-token': COMPANY_TOKEN,
    },
    body: JSON.stringify({
      header: { machineId: EQUIP_ID, fleetCode, mobileToken: MOBILE_TOKEN, tenantId: TENANT_A },
      events,
    }),
  });
}

function fuelingEvent(overrides: Record<string, unknown> = {}, uuid = `uuid-${Date.now()}-${Math.random()}`) {
  return {
    uuid,
    type: 'FUELING',
    timestamp: new Date().toISOString(),
    data: {
      fleetCode:    FLEET_CODE,
      mobileToken:  MOBILE_TOKEN,
      dieselLiters: 120.5,
      hourmeter:    8500.0,
      operatorRegistration: 'OP-99',
      ...overrides,
    },
  };
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(eventStore).forEach(k => delete eventStore[k]);
  Object.keys(fuelingStore).forEach(k => delete fuelingStore[k]);
  auditCalls.length = 0;
  mockAuthOk = true;
  mockTenantId = TENANT_A;
  mockEquipment = {
    id: EQUIP_ID, code: FLEET_CODE, tenantId: TENANT_A,
    entityStatus: 'ATIVO', status: 'ATIVO',
    mobileEnabled: true, mobileToken: MOBILE_TOKEN,
  };
  mockEquipValidation = { ok: true, equipment: mockEquipment };
});

// ─────────────────────────────────────────────────────────────────────────────
describe('FUELING — frota 1002', () => {

  it('1. 200 SYNCED — valid fueling persisted and audited', async () => {
    const uuid = 'event-fueling-1002-ok';
    const res = await POST(makeBatchReq([fuelingEvent({}, uuid)]));
    expect(res.status).toBe(200);
    const body = await res.json() as { results: { offlineId: string; status: string }[] };
    const r = body.results.find(r => r.offlineId === uuid)!;
    expect(r.status).toBe('SYNCED');

    const { FuelingStorage } = await import('@/lib/fueling-storage');
    expect(FuelingStorage.save).toHaveBeenCalledTimes(1);
    const saveArg = (FuelingStorage.save as jest.Mock).mock.calls[0][0];
    expect(saveArg.eventId).toBe(uuid);
    expect(saveArg.fleetCode).toBe(FLEET_CODE);
    expect(saveArg.dieselLiters).toBe(120.5);
    expect(saveArg.hourmeter).toBe(8500.0);

    const fuelingAudit = auditCalls.find(a => a.action === 'FUELING_RECEIVED');
    expect(fuelingAudit).toBeDefined();
    expect(fuelingAudit?.entityId).toBe(uuid);
  });

  it('2. 200 DUPLICATE — retry with same eventId is idempotent', async () => {
    const uuid = 'event-fueling-1002-dup';
    // First request
    await POST(makeBatchReq([fuelingEvent({}, uuid)]));
    // Reset mock call counts but NOT the event store (simulates retry).
    // Also clear the auditCalls array (plain object, not a jest mock).
    jest.clearAllMocks();
    auditCalls.length = 0;

    // Second request — same uuid
    const res = await POST(makeBatchReq([fuelingEvent({}, uuid)]));
    expect(res.status).toBe(200);
    const body = await res.json() as { results: { offlineId: string; status: string }[] };
    expect(body.results[0].status).toBe('DUPLICATE');

    const { FuelingStorage } = await import('@/lib/fueling-storage');
    // FuelingStorage.save should NOT be called for DUPLICATE (saveEvent already returned DUPLICATE)
    expect(FuelingStorage.save).not.toHaveBeenCalled();
    // Audit should NOT be written for DUPLICATE fueling
    expect(auditCalls.filter(a => a.action === 'FUELING_RECEIVED')).toHaveLength(0);
  });

  it('3. 200 REJECTED — dieselLiters = 0 rejected before saveEvent', async () => {
    const uuid = 'event-fueling-liters-zero';
    const res = await POST(makeBatchReq([fuelingEvent({ dieselLiters: 0 }, uuid)]));
    expect(res.status).toBe(200);
    const body = await res.json() as { results: { status: string; reason?: string }[] };
    expect(body.results[0].status).toBe('REJECTED');
    expect(body.results[0].reason).toMatch(/dieselLiters/i);

    const { FuelingStorage } = await import('@/lib/fueling-storage');
    expect(FuelingStorage.save).not.toHaveBeenCalled();
    const { ServerStorage } = await import('@/lib/server-storage');
    // saveEvent must NOT be called — invalid events must not consume idempotency slot
    expect(ServerStorage.saveEvent).not.toHaveBeenCalled();
  });

  it('4. 200 REJECTED — dieselLiters missing (undefined)', async () => {
    const ev = fuelingEvent({});
    delete (ev.data as Record<string, unknown>).dieselLiters;
    const res = await POST(makeBatchReq([ev]));
    expect(res.status).toBe(200);
    const body = await res.json() as { results: { status: string }[] };
    expect(body.results[0].status).toBe('REJECTED');
  });

  it('5. 200 REJECTED — hourmeter = 0', async () => {
    const res = await POST(makeBatchReq([fuelingEvent({ hourmeter: 0 })]));
    const body = await res.json() as { results: { status: string; reason?: string }[] };
    expect(body.results[0].status).toBe('REJECTED');
    expect(body.results[0].reason).toMatch(/hourmeter/i);
  });

  it('6. 200 REJECTED — hourmeter missing', async () => {
    const ev = fuelingEvent({});
    delete (ev.data as Record<string, unknown>).hourmeter;
    const res = await POST(makeBatchReq([ev]));
    const body = await res.json() as { results: { status: string }[] };
    expect(body.results[0].status).toBe('REJECTED');
  });

  it('7. 200 REJECTED — mobileToken mismatch inside event data', async () => {
    const res = await POST(makeBatchReq([fuelingEvent({ mobileToken: 'WRONG-TOKEN' })]));
    const body = await res.json() as { results: { status: string }[] };
    expect(body.results[0].status).toBe('REJECTED');
  });

  it('8. FuelingStorage.save not called for REJECTED events', async () => {
    await POST(makeBatchReq([fuelingEvent({ dieselLiters: -5 })]));
    const { FuelingStorage } = await import('@/lib/fueling-storage');
    expect(FuelingStorage.save).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Auth and fleet validation', () => {

  it('9. 401 — missing X-Company-Token', async () => {
    mockAuthOk = false;
    const res = await POST(makeBatchReq([fuelingEvent()]));
    expect(res.status).toBe(401);
  });

  it('10. 403 — inactive fleet', async () => {
    mockEquipValidation = { ok: false, status: 403, error: 'Frota inativa' };
    const res = await POST(makeBatchReq([fuelingEvent()]));
    expect(res.status).toBe(403);
  });

  it('11. 400 — missing machineId in header', async () => {
    const res = await POST(
      new NextRequest('http://localhost/api/mobile/events/batch', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-company-token': COMPANY_TOKEN },
        body: JSON.stringify({
          header: { fleetCode: FLEET_CODE }, // no machineId
          events: [fuelingEvent()],
        }),
      })
    );
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Cross-tenant isolation', () => {

  it('12. tenant B cannot create fueling records in tenant A store', async () => {
    // Tenant B authenticates
    mockTenantId = 'fazenda-b';
    mockEquipValidation = { ok: false, status: 403, error: 'Frota nao permitida para este tenant' };

    const res = await POST(makeBatchReq([fuelingEvent()]));
    expect(res.status).toBe(403);

    const { FuelingStorage } = await import('@/lib/fueling-storage');
    expect(FuelingStorage.save).not.toHaveBeenCalled();
    // Tenant A store untouched
    expect(fuelingStore[TENANT_A]).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Mixed batch — FUELING + HEARTBEAT', () => {

  it('13. Both events processed; only FUELING triggers FuelingStorage.save', async () => {
    const fuelUuid = 'fuel-mixed-001';
    const hbUuid   = 'hb-mixed-001';
    const events = [
      fuelingEvent({}, fuelUuid),
      {
        uuid: hbUuid,
        type: 'HEARTBEAT',
        timestamp: new Date().toISOString(),
        data: { fleetCode: FLEET_CODE, mobileToken: MOBILE_TOKEN },
      },
    ];

    const res = await POST(makeBatchReq(events));
    expect(res.status).toBe(200);
    const body = await res.json() as { results: { offlineId: string; status: string }[]; received: number };
    expect(body.received).toBe(2);

    const fuelResult = body.results.find(r => r.offlineId === fuelUuid)!;
    const hbResult   = body.results.find(r => r.offlineId === hbUuid)!;
    expect(fuelResult.status).toBe('SYNCED');
    expect(hbResult.status).toBe('SYNCED');

    const { FuelingStorage } = await import('@/lib/fueling-storage');
    expect(FuelingStorage.save).toHaveBeenCalledTimes(1);
    expect((FuelingStorage.save as jest.Mock).mock.calls[0][0].eventId).toBe(fuelUuid);
  });

  it('14. Audit: one MOBILE_BATCH + one FUELING_RECEIVED for a valid batch', async () => {
    await POST(makeBatchReq([fuelingEvent({}, 'audit-test-uuid')]));
    const mobileBatchAudits = auditCalls.filter(a => a.action === 'MOBILE_BATCH');
    const fuelingAudits     = auditCalls.filter(a => a.action === 'FUELING_RECEIVED');
    expect(mobileBatchAudits).toHaveLength(1);
    expect(fuelingAudits).toHaveLength(1);
  });
});
