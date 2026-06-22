import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-integracoes-logs-api-'));
process.env.SILO_STORAGE_DIR = TMP_ROOT;
process.env.SILO_AUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_SECRET = 'test-secret';

jest.mock('@/lib/auth/session', () => ({
  resolveSessionFromRequest: jest.fn(),
}));

const { resolveSessionFromRequest } = jest.requireMock('@/lib/auth/session') as {
  resolveSessionFromRequest: jest.Mock;
};

let GET: typeof import('../route').GET;

function makeSession(role: string, tenantId = 'tenant-a') {
  return {
    id: 'usr-1',
    name: 'Robson',
    email: 'robson@example.com',
    role,
    scope: 'TENANT' as const,
    tenantId,
    activeTenantId: tenantId,
    defaultTenantId: tenantId,
    accessGroupId: role,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    mustChangePassword: false,
    lastLoginAt: null,
  };
}

beforeAll(async () => {
  ({ GET } = await import('../route'));
});

beforeEach(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  resolveSessionFromRequest.mockReset();
});

describe('integracoes logs api', () => {
  it('lista logs do tenant atual e bloqueia outros tenants', async () => {
    const { IntegrationLogStorage } = await import('@/lib/integrations/integration-log-storage');
    IntegrationLogStorage.create({
      tenantId: 'tenant-a',
      system: 'PIMS',
      level: 'INFO',
      event: 'JOB_CREATED',
      message: 'Job criado.',
      createdBy: 'user-1',
    });

    resolveSessionFromRequest.mockReturnValue(makeSession('ADMIN_EMPRESA', 'tenant-a'));
    const res = await GET(new NextRequest('http://localhost/api/integracoes/logs'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);

    resolveSessionFromRequest.mockReturnValue(makeSession('ADMIN_EMPRESA', 'tenant-b'));
    const other = await GET(new NextRequest('http://localhost/api/integracoes/logs'));
    const otherBody = await other.json();
    expect(otherBody.items).toHaveLength(0);
  });

  it('bloqueia usuario sem permissao', async () => {
    resolveSessionFromRequest.mockReturnValue(makeSession('CONSULTA', 'tenant-a'));
    const res = await GET(new NextRequest('http://localhost/api/integracoes/logs'));
    expect(res.status).toBe(403);
  });
});

