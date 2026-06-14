/**
 * Tests for cadastro-first equipment lookup in POST /api/mobile/events/batch
 *
 * Scenarios validated:
 *  1.  200 — machineId matches cadastro item.id (exact id lookup)
 *  2.  200 — machineId matches cadastro item.code (fleet-code lookup)
 *  3.  200 — event.data.equipmentCode matches cadastro item.code
 *  4.  200 — FUELING processed when frota 1002 found in cadastro
 *  5.  404 — cross-tenant: cadastro item tenantId != auth tenantId
 *  6.  403 — mobileEnabled=false in cadastro item
 *  7.  200 — no cadastro match: legacy fallback (ServerStorage) resolves equipment
 */

import { NextRequest } from 'next/server';

// ── Auth mock ─────────────────────────────────────────────────────────────────
const TENANT_A = 'fazenda-lookup-a';
const TENANT_B = 'fazenda-lookup-b';
const COMPANY_TOKEN = 'CTK-LOOKUP-TEST';
const MOBILE_TOKEN  = 'MTK-LOOKUP-7777';
const FLEET_CODE    = '1002';
const EQUIP_ID      = 'equip-cadastro-1002';

let mockTenantId = TENANT_A;
let mockAuthOk   = true;

jest.mock('@/lib/auth/api-guard', () => ({
  requireMobileAuth: jest.fn(() =>
    mockAuthOk
      ? {
          ok: true,
          tenantId: mockTenantId,
          companyToken: COMPANY_TOKEN,
          company: { id: 'co-lookup', tenantId: mockTenantId },
        }
      : {
          ok: false,
          response: require('next/server').NextResponse.json(
            { error: 'Unauthorized' },
            { status: 401 },
          ),
        },
  ),
}));

// ── Rate-limiter (always pass) ────────────────────────────────────────────────
jest.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: jest.fn(() => null),
  RATE_LIMITS: { mobileBatch: {} },
}));

// ── CadastroStorage mock ──────────────────────────────────────────────────────
let mockCadastroItems: Array<Record<string, unknown>> = [];

jest.mock('@/lib/cadastro-storage', () => ({
  CadastroStorage: {
    getAll: jest.fn((_tenantId: string, _entity: string) => mockCadastroItems),
  },
}));

// ── ServerStorage mock ────────────────────────────────────────────────────────
const eventStore: Record<string, { offlineId: string; type: string }[]> = {};

// Legacy equipment returned by fallback path
let mockLegacyEquip: Record<string, unknown> | null = null;
let mockLegacyValidation: { ok: boolean; status?: number; error?: string; equipment?: unknown } = {
  ok: false,
  status: 404,
  error: 'Equipamento nao encontrado',
};

jest.mock('@/lib/server-storage', () => ({
  ServerStorage: {
    getEquipmentById: jest.fn((_id: string) => mockLegacyEquip ?? undefined),
    validateMobileEquipment: jest.fn(() => mockLegacyValidation),
    saveEvent: jest.fn(
      (event: { offlineId: string; type: string }, tenantId: string) => {
        if (!eventStore[tenantId]) eventStore[tenantId] = [];
        const dup = eventStore[tenantId].some(e => e.offlineId === event.offlineId);
        if (dup) return 'DUPLICATE';
        eventStore[tenantId].push(event);
        return 'SYNCED';
      },
    ),
    updateLiveState: jest.fn(),
  },
}));

// ── FuelingStorage mock ───────────────────────────────────────────────────────
const fuelingStore: Record<string, { eventId: string }[]> = {};

jest.mock('@/lib/fueling-storage', () => ({
  FuelingStorage: {
    save: jest.fn(
      (input: { eventId: string; tenantId: string }) => {
        if (!fuelingStore[input.tenantId]) fuelingStore[input.tenantId] = [];
        const dup = fuelingStore[input.tenantId].some(r => r.eventId === input.eventId);
        if (dup) return 'DUPLICATE';
        fuelingStore[input.tenantId].push({ ...input });
        return 'SYNCED';
      },
    ),
    isDuplicate: jest.fn(
      (tenantId: string, eventId: string) =>
        (fuelingStore[tenantId] ?? []).some(r => r.eventId === eventId),
    ),
    getAll: jest.fn((tenantId: string) => fuelingStore[tenantId] ?? []),
  },
}));

// ── Audit mock ────────────────────────────────────────────────────────────────
jest.mock('@/lib/audit/audit-log', () => ({
  auditFromRequest: jest.fn(),
}));

// ── CatalogStorage mock ───────────────────────────────────────────────────────
jest.mock('@/lib/catalog-storage', () => ({
  CatalogStorage: { getAll: jest.fn(() => []) },
}));

// ── Route under test ──────────────────────────────────────────────────────────
import { POST } from '@/app/api/mobile/events/batch/route';

// ── Helpers ───────────────────────────────────────────────────────────────────
function makeBatch(
  machineId: string,
  events: unknown[],
  extra: Record<string, unknown> = {},
): NextRequest {
  return new NextRequest('http://localhost/api/mobile/events/batch', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-company-token': COMPANY_TOKEN,
    },
    body: JSON.stringify({
      header: { machineId, mobileToken: MOBILE_TOKEN, ...extra },
      events,
    }),
  });
}

function heartbeat(uuid = `hb-${Date.now()}-${Math.random()}`) {
  return {
    uuid,
    type: 'HEARTBEAT',
    timestamp: new Date().toISOString(),
    data: { mobileToken: MOBILE_TOKEN },
  };
}

function fuelingEvent(uuid = `fuel-${Date.now()}-${Math.random()}`) {
  return {
    uuid,
    type: 'FUELING',
    timestamp: new Date().toISOString(),
    data: {
      mobileToken:  MOBILE_TOKEN,
      fleetCode:    FLEET_CODE,
      dieselLiters: 50.0,
      hourmeter:    1000.0,
    },
  };
}

/** A valid cadastro item for the reference fleet */
function cadastroItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id:           EQUIP_ID,
    code:         FLEET_CODE,
    tenantId:     TENANT_A,
    entityStatus: 'ATIVO',
    mobileEnabled: true,
    mobileToken:  MOBILE_TOKEN,
    ...overrides,
  };
}

// ── Setup / teardown ──────────────────────────────────────────────────────────
beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(eventStore).forEach(k => delete eventStore[k]);
  Object.keys(fuelingStore).forEach(k => delete fuelingStore[k]);
  mockTenantId  = TENANT_A;
  mockAuthOk    = true;
  mockLegacyEquip = null;
  mockLegacyValidation = { ok: false, status: 404, error: 'Equipamento nao encontrado' };
  mockCadastroItems = [];
});

// ─────────────────────────────────────────────────────────────────────────────
describe('Batch — cadastro-first equipment lookup', () => {

  // ── Test 1: lookup by cadastro item.id ─────────────────────────────────────
  it('1 — finds equipment by item.id matching machineId', async () => {
    mockCadastroItems = [cadastroItem()];  // item.id = EQUIP_ID

    const req = makeBatch(EQUIP_ID, [heartbeat()]);  // machineId = EQUIP_ID
    const res = await POST(req);
    const body = await res.json() as { results?: unknown[] };

    expect(res.status).toBe(200);
    expect(Array.isArray(body.results)).toBe(true);
    // ServerStorage lookup should NOT be reached
    const { ServerStorage } = jest.requireMock<{ ServerStorage: { getEquipmentById: jest.Mock } }>(
      '@/lib/server-storage',
    );
    expect(ServerStorage.getEquipmentById).not.toHaveBeenCalled();
  });

  // ── Test 2: lookup by cadastro item.code ───────────────────────────────────
  it('2 — finds equipment by item.code matching machineId (fleet-code format)', async () => {
    mockCadastroItems = [cadastroItem({ id: 'some-uuid-not-matching' })];

    // machineId sent as the fleet-code string
    const req = makeBatch(FLEET_CODE, [heartbeat()]);
    const res = await POST(req);

    expect(res.status).toBe(200);
    const { ServerStorage } = jest.requireMock<{ ServerStorage: { getEquipmentById: jest.Mock } }>(
      '@/lib/server-storage',
    );
    expect(ServerStorage.getEquipmentById).not.toHaveBeenCalled();
  });

  // ── Test 3: lookup by event.data.equipmentCode ─────────────────────────────
  it('3 — finds equipment by event.data.equipmentCode matching item.code', async () => {
    mockCadastroItems = [cadastroItem({ id: 'no-id-match', code: FLEET_CODE })];

    const event = {
      ...heartbeat(),
      data: {
        mobileToken:    MOBILE_TOKEN,
        equipmentCode:  FLEET_CODE,  // <<< the code path under test
      },
    };
    // machineId does NOT match id or code
    const req = makeBatch('UNKNOWN-MACHINE-XYZ', [event]);
    const res = await POST(req);

    expect(res.status).toBe(200);
  });

  // ── Test 4: FUELING via cadastro lookup ────────────────────────────────────
  it('4 — FUELING returns ACCEPTED/SYNCED when frota 1002 found in cadastro', async () => {
    mockCadastroItems = [cadastroItem()];

    const req = makeBatch(EQUIP_ID, [fuelingEvent()], { fleetCode: FLEET_CODE });
    const res = await POST(req);
    const body = await res.json() as { results?: Array<{ status: string }> };

    expect(res.status).toBe(200);
    const fuelingResult = body.results?.find(r => r.status === 'SYNCED' || r.status === 'ACCEPTED');
    expect(fuelingResult).toBeDefined();
  });

  // ── Test 5: cross-tenant → 404 ─────────────────────────────────────────────
  it('5 — cross-tenant: cadastro item tenantId != auth tenantId → 404', async () => {
    // Item belongs to TENANT_B but auth token says TENANT_A
    mockCadastroItems = [cadastroItem({ tenantId: TENANT_B })];

    const req = makeBatch(EQUIP_ID, [heartbeat()]);
    const res = await POST(req);

    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Equipamento nao encontrado/);
  });

  // ── Test 6: mobileEnabled=false → 403 ─────────────────────────────────────
  it('6 — mobileEnabled=false in cadastro item → 403', async () => {
    mockCadastroItems = [cadastroItem({ mobileEnabled: false })];

    const req = makeBatch(EQUIP_ID, [heartbeat()]);
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/Mobile desabilitado/);
  });

  // ── Test 7: no cadastro match → legacy fallback ────────────────────────────
  it('7 — no cadastro match: falls back to ServerStorage and succeeds', async () => {
    // CadastroStorage returns nothing
    mockCadastroItems = [];

    // Legacy path resolves successfully
    mockLegacyEquip = {
      id: 'legacy-equip-01', code: 'LEGACY-001', tenantId: TENANT_A,
      entityStatus: 'ATIVO', status: 'ATIVO',
      mobileEnabled: true, mobileToken: MOBILE_TOKEN,
    };
    mockLegacyValidation = { ok: true, equipment: mockLegacyEquip };

    const req = makeBatch('legacy-equip-01', [heartbeat()]);
    const res = await POST(req);

    expect(res.status).toBe(200);

    const { ServerStorage } = jest.requireMock<{ ServerStorage: { getEquipmentById: jest.Mock } }>(
      '@/lib/server-storage',
    );
    // Verify the fallback was actually called
    expect(ServerStorage.getEquipmentById).toHaveBeenCalledWith('legacy-equip-01', TENANT_A);
  });

});
