/**
 * Tests for GET /api/dashboard/summary
 *
 * Contracts verified:
 *  - ADMIN_EMPRESA (TENANT scope) can visualizar dashboard of own tenant → 200
 *  - cross-tenant X-Silo-Tenant header for TENANT user is rejected → 403
 *  - PLATFORM scope with activeTenantId resolves correctly → 200
 *  - unauthenticated request → 401
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/server-storage', () => ({
  ServerStorage: {
    getLiveFleet: jest.fn(() => []),
    getEvents: jest.fn(() => []),
  },
}));

jest.mock('@/lib/cadastro-storage', () => ({
  CadastroStorage: {
    getAll: jest.fn(() => []),
  },
}));

jest.mock('@/lib/audit/audit-log', () => ({
  auditFromRequest: jest.fn(),
}));

// ── Session factory ────────────────────────────────────────────────────────────

function makeAdminEmpresaSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'usr-demo-admin',
    name: 'Demo Admin',
    email: 'admin@siloops.com.br',
    role: 'ADMIN_EMPRESA',
    scope: 'TENANT',
    tenantId: 'silo-demo',
    activeTenantId: 'silo-demo',
    defaultTenantId: 'silo-demo',
    accessGroupId: 'role-admin-empresa',
    expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    mustChangePassword: false,
    ...overrides,
  };
}

let mockResolvedSession: ReturnType<typeof makeAdminEmpresaSession> | null = makeAdminEmpresaSession();

jest.mock('@/lib/auth/session', () => ({
  resolveSessionFromRequest: jest.fn(() => mockResolvedSession),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeGet(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest('http://localhost/api/dashboard/summary', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      cookie: 'silo_session=valid-session-cookie',
      ...headers,
    },
  });
}

beforeEach(() => {
  mockResolvedSession = makeAdminEmpresaSession();
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/dashboard/summary — ADMIN_EMPRESA permissions', () => {
  it('ADMIN_EMPRESA pode visualizar dashboard do proprio tenant → 200', async () => {
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
    const body = await res.json() as { generatedAt: string };
    expect(body).toHaveProperty('generatedAt');
  });

  it('sem sessao retorna 401', async () => {
    mockResolvedSession = null;
    const res = await GET(makeGet());
    expect(res.status).toBe(401);
  });

  it('cabecalho X-Silo-Tenant com tenant diferente da sessao retorna 403 (cross-tenant injection)', async () => {
    // TENANT-scope user session tenantId = 'silo-demo'
    // Header attempts a different tenant → must be rejected
    const res = await GET(makeGet({ 'x-silo-tenant': 'outro-tenant-id' }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/nao autorizado/i);
  });

  it('cabecalho X-Silo-Tenant igual ao tenant da sessao e aceito (sem dano)', async () => {
    // Same tenant as session — no harm but still unnecessary
    const res = await GET(makeGet({ 'x-silo-tenant': 'silo-demo' }));
    expect(res.status).toBe(200);
  });

  it('PLATFORM scope com activeTenantId visualiza dashboard → 200', async () => {
    mockResolvedSession = makeAdminEmpresaSession({
      scope: 'PLATFORM',
      role: 'SUPER_ADMIN_SILO',
      tenantId: null,
      activeTenantId: 'silo-demo',
    });
    const res = await GET(makeGet());
    expect(res.status).toBe(200);
  });
});

// ── RBAC unit: ADMIN_EMPRESA has dashboard:visualizar ─────────────────────────

import { hasPermission } from '@/lib/auth/rbac-shared';

describe('RBAC — ADMIN_EMPRESA tem permissao dashboard:visualizar', () => {
  it('hasPermission(ADMIN_EMPRESA, dashboard, visualizar) === true', () => {
    expect(hasPermission('ADMIN_EMPRESA', 'dashboard', 'visualizar')).toBe(true);
  });

  it('hasPermission(ADMIN_EMPRESA, dashboard, exportar) === true', () => {
    expect(hasPermission('ADMIN_EMPRESA', 'dashboard', 'exportar')).toBe(true);
  });

  it('hasPermission(ADMIN_EMPRESA, administracao, administrar) === false', () => {
    expect(hasPermission('ADMIN_EMPRESA', 'administracao', 'administrar')).toBe(false);
  });
});
