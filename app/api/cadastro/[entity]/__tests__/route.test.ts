/**
 * Tests for POST /api/cadastro/[entity] (modelos)
 *
 * Contracts verified:
 *  1. ADMIN_EMPRESA creates model in own tenant → 201
 *  2. body.tenantId silently replaced by session tenant (isolation)
 *  3. Cross-tenant x-silo-tenant header rejected → 403
 *  4. Missing CSRF token → 403
 *  5. SUPER_ADMIN with activeTenantId creates model → 201
 *  6. Tenant isolation: GET returns only own-tenant items
 *  7. Missing name → 422
 *  8. Duplicate name within same tenant → 409
 *  9. No session → 401
 */

import { NextRequest } from 'next/server';
import { POST, GET } from '../route';

// ── Shared mocks ──────────────────────────────────────────────────────────────

jest.mock('@/lib/audit/audit-log', () => ({
  auditFromRequest: jest.fn(),
}));

jest.mock('@/lib/auth/auth-store', () => ({
  AuthStore: {
    listUsers: jest.fn(() => []),
    toPublicUser: jest.fn((u: unknown) => u),
    cookieName: 'silo_session',
  },
}));

// Demo block: not in demo env for tests
jest.mock('@/lib/auth/api-guard', () => {
  const actual = jest.requireActual('@/lib/auth/api-guard') as Record<string, unknown>;
  return {
    ...actual,
    blockWriteInDemo: jest.fn(() => null),
    requireTenant: jest.fn(), // configured per describe block
  };
});

// CSRF: allow by default; set mockCsrfFail=true to simulate missing token
let mockCsrfFail = false;
jest.mock('@/lib/auth/csrf', () => ({
  requireCsrf: jest.fn(() => {
    if (mockCsrfFail) {
      const { NextResponse } = require('next/server');
      return NextResponse.json({ error: 'CSRF invalido' }, { status: 403 });
    }
    return null;
  }),
}));

// resolveSessionFromRequest — used internally by requirePermission
let mockSessionScope: 'TENANT' | 'PLATFORM' = 'TENANT';
let mockSessionRole: string = 'ADMIN_EMPRESA';
let mockSessionTenantId: string | null = 'silo-demo';
jest.mock('@/lib/auth/session', () => ({
  resolveSessionFromRequest: jest.fn(() => ({
    id: 'usr-test',
    name: 'Test User',
    email: 'test@silo.com',
    get role() { return mockSessionRole; },
    get scope() { return mockSessionScope; },
    get tenantId() { return mockSessionTenantId; },
    get activeTenantId() { return mockSessionTenantId; },
    defaultTenantId: 'silo-demo',
    accessGroupId: 'role-admin-empresa',
    expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    mustChangePassword: false,
    lastLoginAt: null,
  })),
}));

// CadastroStorage: in-memory store per test
type StorageItem = Record<string, unknown>;
let inMemoryStore: StorageItem[] = [];

jest.mock('@/lib/cadastro-storage', () => ({
  ALLOWED_ENTITIES: [
    'modelos', 'tipos', 'equipamentos', 'operadores', 'fazendas', 'talhoes',
    'paradas', 'implementos', 'grupos', 'perfis', 'estados', 'operacoes',
    'alerts', 'checklist-models', 'users', 'access-groups', 'units',
    'timeline', 'fleet-activities', 'telemetry',
  ],
  CadastroStorage: {
    getAll: jest.fn((tenantId: string, _entity: string) =>
      inMemoryStore.filter(i => i.tenantId === tenantId)
    ),
    getAllRaw: jest.fn((tenantId: string, _entity: string) =>
      inMemoryStore.filter(i => i.tenantId === tenantId)
    ),
    create: jest.fn((tenantId: string, _entity: string, body: StorageItem) => {
      const item: StorageItem = {
        ...body,
        id: 'gen-' + Math.random().toString(36).slice(2, 9),
        tenantId, // always from session — overwrites any body.tenantId
        entityStatus: 'ATIVO',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      inMemoryStore.push(item);
      return item;
    }),
    getById: jest.fn((tenantId: string, _entity: string, id: string) =>
      inMemoryStore.find(i => i.tenantId === tenantId && i.id === id) ?? null
    ),
  },
}));

// ── Request helpers ───────────────────────────────────────────────────────────

function makePostReq(
  entity: string,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {}
): NextRequest {
  return new NextRequest(`http://localhost/api/cadastro/${entity}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': 'valid-csrf',
      cookie: 'silo_csrf=valid-csrf; silo_session=session-value',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

function makeGetReq(entity: string): NextRequest {
  return new NextRequest(`http://localhost/api/cadastro/${entity}`, {
    method: 'GET',
    headers: { cookie: 'silo_session=session-value' },
  });
}

function makeParams(entity: string) {
  return { params: { entity } };
}

// ── Accessor for mocked requireTenant ────────────────────────────────────────

function getRequireTenant() {
  return (jest.requireMock('@/lib/auth/api-guard') as { requireTenant: jest.Mock }).requireTenant;
}

function getCadastroStorage() {
  return (jest.requireMock('@/lib/cadastro-storage') as {
    CadastroStorage: {
      getAll: jest.Mock;
      getAllRaw: jest.Mock;
      create: jest.Mock;
      getById: jest.Mock;
    };
  }).CadastroStorage;
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  inMemoryStore = [];
  mockCsrfFail = false;
  mockSessionScope = 'TENANT';
  mockSessionRole = 'ADMIN_EMPRESA';
  mockSessionTenantId = 'silo-demo';
  jest.clearAllMocks();

  const { blockWriteInDemo } = jest.requireMock('@/lib/auth/api-guard') as { blockWriteInDemo: jest.Mock };
  blockWriteInDemo.mockReturnValue(null);

  // Restore session mock after clearAllMocks
  const { resolveSessionFromRequest } = jest.requireMock('@/lib/auth/session') as { resolveSessionFromRequest: jest.Mock };
  resolveSessionFromRequest.mockImplementation(() => ({
    id: 'usr-test',
    name: 'Test User',
    email: 'test@silo.com',
    role: mockSessionRole,
    scope: mockSessionScope,
    tenantId: mockSessionTenantId,
    activeTenantId: mockSessionTenantId,
    defaultTenantId: 'silo-demo',
    accessGroupId: 'role-admin-empresa',
    expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
    mustChangePassword: false,
    lastLoginAt: null,
  }));

  const cs = getCadastroStorage();
  cs.getAll.mockImplementation((tenantId: string) =>
    inMemoryStore.filter(i => i.tenantId === tenantId)
  );
  cs.getAllRaw.mockImplementation((tenantId: string) =>
    inMemoryStore.filter(i => i.tenantId === tenantId)
  );
  cs.create.mockImplementation((tenantId: string, _entity: string, body: StorageItem) => {
    const item: StorageItem = {
      ...body,
      id: 'gen-' + Math.random().toString(36).slice(2, 9),
      tenantId,
      entityStatus: 'ATIVO',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };
    inMemoryStore.push(item);
    return item;
  });
  cs.getById.mockImplementation((tenantId: string, _entity: string, id: string) =>
    inMemoryStore.find(i => i.tenantId === tenantId && i.id === id) ?? null
  );
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/cadastro/modelos — ADMIN_EMPRESA', () => {
  beforeEach(() => {
    getRequireTenant().mockReturnValue({ ok: true, tenantId: 'silo-demo' });
  });

  it('1. ADMIN_EMPRESA cria modelo no proprio tenant → 201', async () => {
    const req = makePostReq('modelos', { name: 'Trator JD 5075E', brand: 'John Deere', typeId: 'tipo-1' });
    const res = await POST(req, makeParams('modelos'));

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.name).toBe('Trator JD 5075E');
    expect(body.tenantId).toBe('silo-demo');
    expect(body.id).toBeTruthy();
  });

  it('2. body.tenantId ignorado — item fica no tenant da sessao', async () => {
    const req = makePostReq('modelos', {
      name: 'Colheitadeira S680',
      brand: 'John Deere',
      typeId: 'tipo-2',
      tenantId: 'tenant-malicioso', // must be ignored
    });
    const res = await POST(req, makeParams('modelos'));

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.tenantId).toBe('silo-demo');
    expect(body.tenantId).not.toBe('tenant-malicioso');
  });

  it('3. Sem CSRF → 403', async () => {
    mockCsrfFail = true;
    const req = makePostReq('modelos', { name: 'Plantadeira XP' });
    const res = await POST(req, makeParams('modelos'));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/csrf/i);
  });

  it('4. name ausente → 422', async () => {
    const req = makePostReq('modelos', { brand: 'John Deere', typeId: 'tipo-1' });
    const res = await POST(req, makeParams('modelos'));
    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/name/i);
  });

  it('5. name em branco → 422', async () => {
    const req = makePostReq('modelos', { name: '   ', brand: 'John Deere' });
    const res = await POST(req, makeParams('modelos'));
    expect(res.status).toBe(422);
  });

  it('6. Nome duplicado no mesmo tenant → 409', async () => {
    inMemoryStore.push({ id: 'existing-1', tenantId: 'silo-demo', name: 'Trator JD 5075E', entityStatus: 'ATIVO' });

    const req = makePostReq('modelos', { name: 'Trator JD 5075E', brand: 'John Deere' });
    const res = await POST(req, makeParams('modelos'));
    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/nome|name/i);
  });

  it('7. Mesmo nome em tenant diferente e permitido (isolamento)', async () => {
    inMemoryStore.push({ id: 'other-record', tenantId: 'outro-tenant', name: 'Trator JD 5075E', entityStatus: 'ATIVO' });

    const req = makePostReq('modelos', { name: 'Trator JD 5075E', brand: 'John Deere' });
    const res = await POST(req, makeParams('modelos'));
    // silo-demo store has no conflict — outro-tenant record is invisible
    expect(res.status).toBe(201);
  });
});

describe('POST /api/cadastro/modelos — cross-tenant rejection', () => {
  it('8. Header x-silo-tenant diferente do session tenant → 403', async () => {
    const { NextResponse } = await import('next/server');
    getRequireTenant().mockReturnValue({
      ok: false,
      response: NextResponse.json({ error: 'Acesso a tenant nao autorizado.' }, { status: 403 }),
    });

    const req = makePostReq('modelos', { name: 'Modelo Cruzado' }, { 'x-silo-tenant': 'outro-tenant' });
    const res = await POST(req, makeParams('modelos'));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/tenant/i);
  });
});

describe('POST /api/cadastro/modelos — SUPER_ADMIN', () => {
  it('9. SUPER_ADMIN com activeTenantId cria modelo → 201', async () => {
    mockSessionScope = 'PLATFORM';
    mockSessionRole = 'SUPER_ADMIN_SILO';
    mockSessionTenantId = 'silo-enterprise';
    getRequireTenant().mockReturnValue({ ok: true, tenantId: 'silo-enterprise' });

    // Update session mock after changing scope/role
    const { resolveSessionFromRequest } = jest.requireMock('@/lib/auth/session') as { resolveSessionFromRequest: jest.Mock };
    resolveSessionFromRequest.mockReturnValue({
      id: 'usr-super',
      name: 'Super Admin',
      email: 'super@silo.com',
      role: 'SUPER_ADMIN_SILO',
      scope: 'PLATFORM',
      tenantId: null,
      activeTenantId: 'silo-enterprise',
      defaultTenantId: 'silo-platform',
      accessGroupId: 'role-super-admin-silo',
      expiresAt: new Date(Date.now() + 8 * 3600 * 1000).toISOString(),
      mustChangePassword: false,
      lastLoginAt: null,
    });

    const req = makePostReq('modelos', { name: 'Pulverizador P600', brand: 'Jacto', typeId: 'tipo-3' });
    const res = await POST(req, makeParams('modelos'));

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.tenantId).toBe('silo-enterprise');
    expect(body.name).toBe('Pulverizador P600');
  });
});

describe('POST /api/cadastro/modelos — sem sessao', () => {
  it('10. Sem sessao valida → 401', async () => {
    const { NextResponse } = await import('next/server');
    getRequireTenant().mockReturnValue({
      ok: false,
      response: NextResponse.json(
        { error: 'Sessao nao identificada. Faca login novamente.' },
        { status: 401 }
      ),
    });

    const req = makePostReq('modelos', { name: 'Modelo Sem Sessao' });
    const res = await POST(req, makeParams('modelos'));
    expect(res.status).toBe(401);
  });
});

describe('GET /api/cadastro/modelos — isolamento de tenant', () => {
  it('11. GET retorna apenas registros do proprio tenant', async () => {
    getRequireTenant().mockReturnValue({ ok: true, tenantId: 'silo-demo' });

    inMemoryStore.push(
      { id: 'mdl-1', tenantId: 'silo-demo',    name: 'Modelo Demo',  entityStatus: 'ATIVO' },
      { id: 'mdl-2', tenantId: 'outro-tenant', name: 'Modelo Outro', entityStatus: 'ATIVO' },
    );

    const req = makeGetReq('modelos');
    const res = await GET(req, makeParams('modelos'));

    expect(res.status).toBe(200);
    const body = await res.json() as Array<Record<string, unknown>>;
    expect(body).toHaveLength(1);
    expect(body[0].tenantId).toBe('silo-demo');
    expect(body.some(i => i.tenantId === 'outro-tenant')).toBe(false);
  });
});

// ── POST /api/cadastro/equipamentos ──────────────────────────────────────────
// Verifies entity-specific validation: equipamentos require `code`, not `name`.

describe('POST /api/cadastro/equipamentos — validacao por entidade', () => {
  beforeEach(() => {
    getRequireTenant().mockReturnValue({ ok: true, tenantId: 'silo-demo' });
  });

  it('1. Payload valido com code → 201', async () => {
    const req = makePostReq('equipamentos', {
      code: '1002',
      typeId: 'tipo-1',
      modelId: 'modelo-1',
      manufacturer: 'John Deere',
      hourmeter: 0,
      status: 'ATIVO',
      mobileEnabled: false,
    });
    const res = await POST(req, makeParams('equipamentos'));

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.code).toBe('1002');
    expect(body.tenantId).toBe('silo-demo');
    expect(body.id).toBeTruthy();
  });

  it('2. code ausente → 422 (name nao exigido para equipamentos)', async () => {
    const req = makePostReq('equipamentos', {
      typeId: 'tipo-1',
      modelId: 'modelo-1',
      hourmeter: 0,
      status: 'ATIVO',
    });
    const res = await POST(req, makeParams('equipamentos'));

    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/code/i);
  });

  it('3. Enviar apenas name sem code → 422 (equipamentos exigem code)', async () => {
    const req = makePostReq('equipamentos', {
      name: 'Trator JD 5075E',
      typeId: 'tipo-1',
    });
    const res = await POST(req, makeParams('equipamentos'));

    expect(res.status).toBe(422);
    const body = await res.json() as { error: string };
    // Must complain about code, NOT name
    expect(body.error).toMatch(/code/i);
    expect(body.error).not.toMatch(/^campo obrigatorio ausente: name/i);
  });

  it('4. code duplicado no mesmo tenant → 409', async () => {
    inMemoryStore.push({
      id: 'equip-existing',
      tenantId: 'silo-demo',
      code: '1002',
      entityStatus: 'ATIVO',
    });

    const req = makePostReq('equipamentos', {
      code: '1002',
      typeId: 'tipo-1',
      modelId: 'modelo-1',
    });
    const res = await POST(req, makeParams('equipamentos'));

    expect(res.status).toBe(409);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/codigo|code/i);
  });

  it('5. Mesmo code em tenant diferente e permitido (isolamento)', async () => {
    // A record with code=1002 exists, but in a different tenant
    inMemoryStore.push({
      id: 'equip-other',
      tenantId: 'outro-tenant',
      code: '1002',
      entityStatus: 'ATIVO',
    });

    // silo-demo has no code=1002 yet — creation must succeed
    const req = makePostReq('equipamentos', {
      code: '1002',
      typeId: 'tipo-1',
      modelId: 'modelo-1',
    });
    const res = await POST(req, makeParams('equipamentos'));

    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.tenantId).toBe('silo-demo');
    expect(body.code).toBe('1002');
  });
});
