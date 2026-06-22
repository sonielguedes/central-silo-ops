import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-pims-dispatches-route-'));
process.env.SILO_STORAGE_DIR = ROOT;
process.env.SILO_AUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_SECRET = 'test-secret';

jest.mock('@/lib/auth/session', () => ({
  resolveSessionFromRequest: jest.fn(),
}));

const { resolveSessionFromRequest } = jest.requireMock('@/lib/auth/session') as { resolveSessionFromRequest: jest.Mock };

let GET: typeof import('../route').GET;

function session(role: string, tenantId = 'tenant-a') {
  return { id: 'usr-1', name: 'Robson', email: 'robson@example.com', role, scope: 'TENANT' as const, tenantId, activeTenantId: tenantId, defaultTenantId: tenantId, accessGroupId: role, expiresAt: new Date(Date.now() + 3600_000).toISOString(), mustChangePassword: false, lastLoginAt: null };
}

function req(url: string) {
  return new NextRequest(url, { method: 'GET' });
}

beforeAll(async () => {
  ({ GET } = await import('../route'));
});

beforeEach(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.mkdirSync(ROOT, { recursive: true });
  resolveSessionFromRequest.mockReset();
});

describe('PIMS dispatches api', () => {
  it('lista dispatches por tenant', async () => {
    const { PimsDispatchStorage } = await import('@/lib/integrations/pims/pims-dispatch-storage');

    resolveSessionFromRequest.mockReturnValue(session('ADMIN_EMPRESA', 'tenant-a'));
    PimsDispatchStorage.create({
      tenantId: 'tenant-a',
      configId: 'cfg-1',
      targetDataType: 'FULL_OPERATIONAL_PACKAGE',
      periodStart: '2026-06-22',
      periodEnd: '2026-06-22',
      status: 'SUCCESS',
      attempts: 1,
      maxAttempts: 3,
      mockMode: true,
      requestPath: '',
      responsePath: '',
      createdBy: 'user-1',
    });

    const response = await GET(req('http://localhost/api/integracoes/pims/dispatches'));
    expect(response.status).toBe(200);
    expect((await response.json()).items).toHaveLength(1);
  });
});
