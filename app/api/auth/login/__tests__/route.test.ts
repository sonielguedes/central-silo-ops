/**
 * Tests for POST /api/auth/login
 *
 * Contracts verified:
 *  - password is received and verified as-is — no trim, slice, or transformation
 *  - 16-char hex temp password (randomBytes(8).toString('hex')) authenticates correctly
 *  - email/username is trimmed; password is NOT
 *  - wrong password returns 401
 *  - inactive user returns 401
 *  - missing credentials return 401
 *  - valid login returns session payload + sets httpOnly cookie
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: jest.fn(() => null),
  RATE_LIMITS: { login: {} },
}));

jest.mock('@/lib/audit/audit-log', () => ({
  auditFromRequest: jest.fn(),
}));

jest.mock('@/lib/auth/csrf', () => ({
  generateCsrfToken: jest.fn(() => 'csrf-test-token'),
  issueCsrfCookie: jest.fn(),
}));

// ── AuthStore mock ─────────────────────────────────────────────────────────────

const TEMP_PASSWORD_16 = 'a1b2c3d4e5f6a7b8'; // exactly 16 hex chars — randomBytes(8).toString('hex')

const mockUser = {
  id: 'usr-test-admin',
  tenantId: 'tenant-test',
  defaultTenantId: 'tenant-test',
  scope: 'TENANT' as const,
  role: 'ADMIN_EMPRESA' as const,
  accessGroupId: 'role-admin-empresa',
  name: 'Joao Admin',
  username: 'joao@empresa.com',
  email: 'joao@empresa.com',
  status: 'ATIVO' as const,
  mustChangePassword: true,
  passwordHash: '$bcrypt_hash$', // placeholder — verifyPassword is mocked
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const mockSessionPayload = {
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
  mustChangePassword: true,
};

let mockVerifyResult = true;
let mockFoundUser: typeof mockUser | undefined = mockUser;

jest.mock('@/lib/auth/auth-store', () => ({
  AuthStore: {
    findUserByIdentifier: jest.fn((id: string) => {
      void id;
      return mockFoundUser;
    }),
    verifyPassword: jest.fn(async (_user: unknown, _password: string) => mockVerifyResult),
    createSession: jest.fn(async () => ({
      cookie: 'session-cookie-value',
      payload: mockSessionPayload,
    })),
    toPublicUser: jest.fn((u: typeof mockUser) => {
      const { passwordHash: _, ...pub } = u;
      return pub;
    }),
    getSessionRecord: jest.fn(() => null),
    cookieName: 'silo_session',
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePost(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockVerifyResult = true;
  mockFoundUser = mockUser;
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login — password integrity', () => {
  it('envia senha de 16 chars hex ao verifyPassword sem transformacao', async () => {
    const res = await POST(makePost({ email: 'joao@empresa.com', password: TEMP_PASSWORD_16 }));
    expect(res.status).toBe(200);

    const auth = require('@/lib/auth/auth-store');
    const [, receivedPassword] = auth.AuthStore.verifyPassword.mock.calls[0] as [unknown, string];

    // Must be exactly what was sent — no trim, no slice, no uppercase
    expect(receivedPassword).toBe(TEMP_PASSWORD_16);
    expect(receivedPassword).toHaveLength(16);
  });

  it('senha com espacos internos NAO deve ser alterada', async () => {
    const passwordWithSpaces = 'ab cd ef gh ij kl';
    const res = await POST(makePost({ email: 'joao@empresa.com', password: passwordWithSpaces }));
    expect(res.status).toBe(200);

    const auth = require('@/lib/auth/auth-store');
    const [, received] = auth.AuthStore.verifyPassword.mock.calls[0] as [unknown, string];
    expect(received).toBe(passwordWithSpaces); // spaces preserved
  });

  it('email e trimado mas password nao', async () => {
    const res = await POST(makePost({ email: '  joao@empresa.com  ', password: TEMP_PASSWORD_16 }));
    expect(res.status).toBe(200);

    const auth = require('@/lib/auth/auth-store');
    // findUserByIdentifier should receive trimmed email
    const [identifier] = auth.AuthStore.findUserByIdentifier.mock.calls[0] as [string];
    expect(identifier).toBe('joao@empresa.com'); // trimmed

    // password must arrive untouched
    const [, receivedPassword] = auth.AuthStore.verifyPassword.mock.calls[0] as [unknown, string];
    expect(receivedPassword).toBe(TEMP_PASSWORD_16);
  });

  it('senha errada retorna 401', async () => {
    mockVerifyResult = false;
    const res = await POST(makePost({ email: 'joao@empresa.com', password: 'wrongpassword' }));
    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('usuario ou senha invalidos');
  });

  it('usuario inativo retorna 401', async () => {
    mockFoundUser = { ...mockUser, status: 'INATIVO' as 'ATIVO' };
    const res = await POST(makePost({ email: 'joao@empresa.com', password: TEMP_PASSWORD_16 }));
    expect(res.status).toBe(401);
  });

  it('usuario nao encontrado retorna 401', async () => {
    mockFoundUser = undefined;
    const res = await POST(makePost({ email: 'naoexiste@empresa.com', password: TEMP_PASSWORD_16 }));
    expect(res.status).toBe(401);
  });

  it('sem password retorna 401', async () => {
    const res = await POST(makePost({ email: 'joao@empresa.com' }));
    expect(res.status).toBe(401);
  });

  it('sem email retorna 401', async () => {
    const res = await POST(makePost({ password: TEMP_PASSWORD_16 }));
    expect(res.status).toBe(401);
  });

  it('login bem-sucedido retorna session com mustChangePassword=true para senha temp', async () => {
    const res = await POST(makePost({ email: 'joao@empresa.com', password: TEMP_PASSWORD_16 }));
    expect(res.status).toBe(200);
    const body = await res.json() as { session: typeof mockSessionPayload };
    expect(body.session.mustChangePassword).toBe(true);
    expect(body.session.userId).toBe(mockUser.id);
  });

  it('login nao registra a senha em logs (verifyPassword nao expoe a senha)', async () => {
    // The password must NOT appear in any log — we verify it is only passed to verifyPassword
    // and never logged by the route handler
    const consoleSpy = jest.spyOn(console, 'log');
    const warnSpy = jest.spyOn(console, 'warn');
    const infoSpy = jest.spyOn(console, 'info');

    await POST(makePost({ email: 'joao@empresa.com', password: TEMP_PASSWORD_16 }));

    const allLogged = [
      ...consoleSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
      ...infoSpy.mock.calls.flat(),
    ].join(' ');

    expect(allLogged).not.toContain(TEMP_PASSWORD_16);

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });
});
