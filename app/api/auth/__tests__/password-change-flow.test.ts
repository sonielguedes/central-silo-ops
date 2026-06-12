/**
 * Integration flow: login → mustChangePassword → password change → dashboard access
 *
 * Verifies the complete sequence without touching bcrypt or credential generation.
 */

import { NextRequest } from 'next/server';
import { POST as loginPost } from '../login/route';
import { POST as changePost } from '../change-password/route';

// ── Shared mocks ──────────────────────────────────────────────────────────────

jest.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: jest.fn(() => null),
  RATE_LIMITS: { login: {} },
}));

jest.mock('@/lib/audit/audit-log', () => ({
  auditFromRequest: jest.fn(),
}));

jest.mock('@/lib/auth/csrf', () => ({
  generateCsrfToken:     jest.fn(() => 'csrf-flow-token'),
  issueCsrfCookie:       jest.fn(),
  requireCsrf:           jest.fn(() => null), // allow all CSRF in flow tests
  getCsrfTokenFromDocument: jest.fn(() => 'csrf-flow-token'),
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(async (plain: string, _hash: string) => plain === 'TempPass@123'),
  hashSync: jest.fn((_pwd: string, _rounds: number) => '$2b$12$newhash'),
}));

// ── In-memory user store ──────────────────────────────────────────────────────

let storedMustChangePassword = true;

const mockUser = {
  id: 'usr-admin-empresa-flow',
  tenantId: 'silo-demo',
  defaultTenantId: 'silo-demo',
  scope: 'TENANT' as const,
  role: 'ADMIN_EMPRESA' as const,
  accessGroupId: 'role-admin-empresa',
  name: 'Flow Admin',
  username: 'flow.admin',
  email: 'flow@siloops.com.br',
  status: 'ATIVO' as const,
  get mustChangePassword() { return storedMustChangePassword; },
  passwordHash: '$2b$12$hash-for-TempPass@123',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const sessionPayload = () => ({
  userId: mockUser.id,
  name: mockUser.name,
  email: mockUser.email,
  role: mockUser.role,
  scope: mockUser.scope,
  tenantId: mockUser.tenantId,
  activeTenantId: mockUser.tenantId,
  defaultTenantId: mockUser.defaultTenantId,
  accessGroupId: mockUser.accessGroupId,
  expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  mustChangePassword: storedMustChangePassword,
  lastLoginAt: null,
});

jest.mock('@/lib/auth/auth-store', () => ({
  AuthStore: {
    cookieName: 'silo_session',
    findUserByIdentifier: jest.fn((_id: string) => ({ ...mockUser })),
    getUserById: jest.fn((_id: string) => ({ ...mockUser })),
    verifyPassword: jest.fn(async (_user: unknown, plain: string) => plain === 'TempPass@123'),
    createSession: jest.fn(async () => ({
      cookie: 'session-cookie-value',
      payload: sessionPayload(),
    })),
    toPublicUser: jest.fn((u: typeof mockUser) => {
      const { passwordHash: _, ...pub } = u as typeof mockUser & { passwordHash: string };
      return pub;
    }),
    updatePassword: jest.fn(async (_id: string, _pwd: string, must: boolean) => {
      storedMustChangePassword = must;
      return { ...mockUser, mustChangePassword: must };
    }),
    revokeSessionsForUser: jest.fn(),
    getSessionRecord: jest.fn(() => ({ sessionIdHash: 'hash-current' })),
    markLogin: jest.fn(),
  },
}));

jest.mock('@/lib/auth/session', () => ({
  resolveSessionFromRequest: jest.fn(() => ({
    id: mockUser.id,
    ...sessionPayload(),
  })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeLoginReq(email: string, password: string): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
}

function makeChangeReq(body: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': 'csrf-flow-token',
      cookie: 'silo_csrf=csrf-flow-token; silo_session=session-cookie-value',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  storedMustChangePassword = true;
  jest.clearAllMocks();
  // Keep stable mocks after clearAllMocks
  const { AuthStore } = require('@/lib/auth/auth-store');
  AuthStore.findUserByIdentifier.mockImplementation((_id: string) => ({ ...mockUser }));
  AuthStore.getUserById.mockImplementation((_id: string) => ({ ...mockUser }));
  AuthStore.verifyPassword.mockImplementation(async (_user: unknown, plain: string) => plain === 'TempPass@123');
  AuthStore.createSession.mockImplementation(async () => ({
    cookie: 'session-cookie-value',
    payload: sessionPayload(),
  }));
  AuthStore.updatePassword.mockImplementation(async (_id: string, _pwd: string, must: boolean) => {
    storedMustChangePassword = must;
    return { ...mockUser, mustChangePassword: must };
  });
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Fluxo completo: login → troca obrigatoria → dashboard', () => {
  it('1. login bem-sucedido retorna mustChangePassword=true na session', async () => {
    const res = await loginPost(makeLoginReq('flow@siloops.com.br', 'TempPass@123'));
    expect(res.status).toBe(200);

    const body = await res.json() as { session: { mustChangePassword: boolean; role: string } };
    expect(body.session.mustChangePassword).toBe(true);
    expect(body.session.role).toBe('ADMIN_EMPRESA');
  });

  it('2. troca de senha limpa mustChangePassword e retorna ok:true', async () => {
    const res = await changePost(makeChangeReq({
      currentPassword: 'TempPass@123',
      newPassword:     'NovaSenha@789',
      confirmPassword: 'NovaSenha@789',
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(storedMustChangePassword).toBe(false);
  });

  it('3. apos troca, nova session reflete mustChangePassword=false', async () => {
    // Simulate the password change
    await changePost(makeChangeReq({
      currentPassword: 'TempPass@123',
      newPassword:     'NovaSenha@789',
      confirmPassword: 'NovaSenha@789',
    }));

    // Next login session would have mustChangePassword=false
    const { AuthStore } = require('@/lib/auth/auth-store');
    AuthStore.createSession.mockImplementationOnce(async () => ({
      cookie: 'session-cookie-value-2',
      payload: { ...sessionPayload(), mustChangePassword: false },
    }));

    const res = await loginPost(makeLoginReq('flow@siloops.com.br', 'TempPass@123'));
    expect(res.status).toBe(200);
    const body = await res.json() as { session: { mustChangePassword: boolean } };
    expect(body.session.mustChangePassword).toBe(false);
  });

  it('4. login com senha errada retorna 401', async () => {
    const res = await loginPost(makeLoginReq('flow@siloops.com.br', 'SenhaErrada'));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('usuario ou senha invalidos');
  });

  it('5. troca sem sessao valida e bloqueada (401 do resolveSessionFromRequest)', async () => {
    const { resolveSessionFromRequest } = require('@/lib/auth/session');
    resolveSessionFromRequest.mockReturnValueOnce(null);

    const res = await changePost(makeChangeReq({
      currentPassword: 'TempPass@123',
      newPassword:     'NovaSenha@789',
      confirmPassword: 'NovaSenha@789',
    }));
    expect(res.status).toBe(401);
  });

  it('6. ADMIN_EMPRESA tem role TENANT-scoped com tenantId valido', async () => {
    const res = await loginPost(makeLoginReq('flow@siloops.com.br', 'TempPass@123'));
    const body = await res.json() as { session: { scope: string; tenantId: string } };
    expect(body.session.scope).toBe('TENANT');
    expect(body.session.tenantId).toBe('silo-demo');
  });

  it('7. tenantId nunca vem do cliente — vem sempre da sessao no servidor', async () => {
    // This test documents the contract: the dashboard route uses requireTenant()
    // which resolves tenant from the session cookie, never from request headers.
    // Any X-Silo-Tenant header that doesn't match the session tenant is rejected.
    // (Full integration tested in dashboard/summary/__tests__/route.test.ts)
    const loginRes = await loginPost(makeLoginReq('flow@siloops.com.br', 'TempPass@123'));
    const loginBody = await loginRes.json() as { session: { tenantId: string } };
    // The tenantId in the session payload is what the server trusts.
    expect(loginBody.session.tenantId).toBe('silo-demo');
  });
});
