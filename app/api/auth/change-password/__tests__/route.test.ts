/**
 * Tests for POST /api/auth/change-password
 *
 * Contracts verified:
 *  - valid change clears mustChangePassword flag
 *  - wrong current password returns 403
 *  - new password too short returns 400
 *  - mismatch confirmation returns 400
 *  - missing CSRF token returns 403
 *  - inactive/missing user returns 401
 *  - bcrypt is not modified (verifyPassword uses compare, not plain comparison)
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/audit/audit-log', () => ({
  auditFromRequest: jest.fn(),
}));

// CSRF: allow by default; override per-test when needed
let mockCsrfFail = false;
jest.mock('@/lib/auth/csrf', () => ({
  requireCsrf: jest.fn(() => {
    if (mockCsrfFail) {
      const { NextResponse } = require('next/server');
      return NextResponse.json({ error: 'CSRF invalido' }, { status: 403 });
    }
    return null;
  }),
  getCsrfTokenFromDocument: jest.fn(() => 'valid-csrf'),
}));

// ── AuthStore mock ────────────────────────────────────────────────────────────

const mockUser = {
  id: 'usr-admin-empresa',
  tenantId: 'silo-demo',
  defaultTenantId: 'silo-demo',
  scope: 'TENANT' as const,
  role: 'ADMIN_EMPRESA' as const,
  accessGroupId: 'role-admin-empresa',
  name: 'Demo Admin',
  username: 'demo.admin',
  email: 'admin@siloops.com.br',
  status: 'ATIVO' as const,
  mustChangePassword: true,
  passwordHash: '$2b$12$hashedplaceholder',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

let mockBcryptResult = true;
let mockFoundUser: typeof mockUser | undefined = mockUser;
let updatedUser: { mustChangePassword: boolean } | null = null;

jest.mock('@/lib/auth/auth-store', () => ({
  AuthStore: {
    getUserById: jest.fn(() => mockFoundUser),
    updatePassword: jest.fn(async (_id: string, _pwd: string, must: boolean) => {
      updatedUser = { mustChangePassword: must };
      return { ...mockUser, mustChangePassword: must };
    }),
    revokeSessionsForUser: jest.fn(),
    getSessionRecord: jest.fn(() => ({ sessionIdHash: 'hash-current-session' })),
    cookieName: 'silo_session',
  },
}));

// resolveSessionFromRequest mock
const mockSession = {
  id: mockUser.id,
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

jest.mock('@/lib/auth/session', () => ({
  resolveSessionFromRequest: jest.fn(() => mockSession),
}));

// bcryptjs mock — controls verifyPassword result indirectly
jest.mock('bcryptjs', () => ({
  compare: jest.fn(async (_plain: string, _hash: string) => mockBcryptResult),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePost(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': 'valid-csrf',
      cookie: 'silo_csrf=valid-csrf; silo_session=test-session',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockBcryptResult = true;
  mockFoundUser = mockUser;
  updatedUser = null;
  mockCsrfFail = false;
  jest.clearAllMocks();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/auth/change-password', () => {
  it('troca bem-sucedida retorna ok:true e limpa mustChangePassword', async () => {
    const res = await POST(makePost({
      currentPassword: 'tempPass123',
      newPassword: 'NovaSenh@456',
      confirmPassword: 'NovaSenh@456',
    }));
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean };
    expect(body.ok).toBe(true);

    // mustChangePassword deve ser false após a troca
    expect(updatedUser?.mustChangePassword).toBe(false);
  });

  it('senha atual errada retorna 403', async () => {
    mockBcryptResult = false;
    const res = await POST(makePost({
      currentPassword: 'senhaErrada',
      newPassword: 'NovaSenh@456',
      confirmPassword: 'NovaSenh@456',
    }));
    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalida/i);
  });

  it('nova senha muito curta retorna 400', async () => {
    const res = await POST(makePost({
      currentPassword: 'tempPass123',
      newPassword: 'abc',
      confirmPassword: 'abc',
    }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/8 caracteres/i);
  });

  it('confirmacao incompativel retorna 400', async () => {
    const res = await POST(makePost({
      currentPassword: 'tempPass123',
      newPassword: 'NovaSenh@456',
      confirmPassword: 'Diferente789',
    }));
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/confere/i);
  });

  it('campos em branco retorna 400', async () => {
    const res = await POST(makePost({}));
    expect(res.status).toBe(400);
  });

  it('CSRF invalido retorna 403 sem chegar ao bcrypt', async () => {
    mockCsrfFail = true;
    const res = await POST(makePost({
      currentPassword: 'tempPass123',
      newPassword: 'NovaSenh@456',
      confirmPassword: 'NovaSenh@456',
    }));
    expect(res.status).toBe(403);
    const bcrypt = require('bcryptjs');
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('usuario inativo ou inexistente retorna 401', async () => {
    mockFoundUser = { ...mockUser, status: 'INATIVO' as 'ATIVO' };
    const res = await POST(makePost({
      currentPassword: 'tempPass123',
      newPassword: 'NovaSenh@456',
      confirmPassword: 'NovaSenh@456',
    }));
    expect(res.status).toBe(401);
  });

  it('revoga outras sessoes do usuario apos troca', async () => {
    await POST(makePost({
      currentPassword: 'tempPass123',
      newPassword: 'NovaSenh@456',
      confirmPassword: 'NovaSenh@456',
    }));
    const { AuthStore } = require('@/lib/auth/auth-store');
    expect(AuthStore.revokeSessionsForUser).toHaveBeenCalledWith(
      mockUser.id,
      'hash-current-session',
    );
  });

  it('nao expoe a senha em logs', async () => {
    const consoleSpy = jest.spyOn(console, 'log');
    const warnSpy    = jest.spyOn(console, 'warn');
    const infoSpy    = jest.spyOn(console, 'info');

    const plainPassword = 'tempPass123';
    await POST(makePost({
      currentPassword: plainPassword,
      newPassword: 'NovaSenh@456',
      confirmPassword: 'NovaSenh@456',
    }));

    const allLogged = [
      ...consoleSpy.mock.calls.flat(),
      ...warnSpy.mock.calls.flat(),
      ...infoSpy.mock.calls.flat(),
    ].join(' ');

    expect(allLogged).not.toContain(plainPassword);
    consoleSpy.mockRestore();
    warnSpy.mockRestore();
    infoSpy.mockRestore();
  });
});

// ── Atomicity tests ───────────────────────────────────────────────────────────

describe('POST /api/auth/change-password — atomicidade', () => {
  it('falha de persistencia retorna 500 e nao revoga sessoes', async () => {
    // Simulate a disk/atomic-write failure inside updatePassword
    const { AuthStore } = require('@/lib/auth/auth-store');
    AuthStore.updatePassword.mockRejectedValueOnce(new Error('ENOSPC: no space left on device'));

    const res = await POST(makePost({
      currentPassword: 'tempPass123',
      newPassword: 'NovaSenh@456',
      confirmPassword: 'NovaSenh@456',
    }));

    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/persistir/i);

    // Sessions must NOT be revoked — password change did not complete
    expect(AuthStore.revokeSessionsForUser).not.toHaveBeenCalled();
  });

  it('falha de persistencia: mustChangePassword permanece true no payload de erro', async () => {
    const { AuthStore } = require('@/lib/auth/auth-store');
    AuthStore.updatePassword.mockRejectedValueOnce(new Error('disk full'));

    const res = await POST(makePost({
      currentPassword: 'tempPass123',
      newPassword: 'NovaSenh@456',
      confirmPassword: 'NovaSenh@456',
    }));

    // 500 means the write never completed — old hash (and mustChangePassword=true) intact
    expect(res.status).toBe(500);
    // updatePassword was called once but threw — no successful update recorded
    expect(updatedUser).toBeNull();
  });

  it('senha atual invalida nao chama updatePassword (hash antigo preservado)', async () => {
    mockBcryptResult = false; // bcrypt.compare returns false → wrong password
    const { AuthStore } = require('@/lib/auth/auth-store');

    const res = await POST(makePost({
      currentPassword: 'senhaErrada',
      newPassword: 'NovaSenh@456',
      confirmPassword: 'NovaSenh@456',
    }));

    expect(res.status).toBe(403);
    // updatePassword must never be called when current password is wrong
    expect(AuthStore.updatePassword).not.toHaveBeenCalled();
    // No session revocation either
    expect(AuthStore.revokeSessionsForUser).not.toHaveBeenCalled();
  });
});
