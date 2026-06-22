import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-pims-retry-route-'));
process.env.SILO_STORAGE_DIR = ROOT;
process.env.SILO_AUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_SECRET = 'test-secret';

jest.mock('@/lib/auth/session', () => ({
  resolveSessionFromRequest: jest.fn(),
}));

jest.mock('@/lib/integrations/pims/pims-dispatch-service', () => ({
  retryPimsDispatch: jest.fn(),
}));

const { resolveSessionFromRequest } = jest.requireMock('@/lib/auth/session') as { resolveSessionFromRequest: jest.Mock };
const { retryPimsDispatch } = jest.requireMock('@/lib/integrations/pims/pims-dispatch-service') as { retryPimsDispatch: jest.Mock };

let POST: typeof import('../route').POST;

function session(role: string, tenantId = 'tenant-a') {
  return { id: 'usr-1', name: 'Robson', email: 'robson@example.com', role, scope: 'TENANT' as const, tenantId, activeTenantId: tenantId, defaultTenantId: tenantId, accessGroupId: role, expiresAt: new Date(Date.now() + 3600_000).toISOString(), mustChangePassword: false, lastLoginAt: null };
}

function req(url: string, method = 'GET') {
  return new NextRequest(url, { method, headers: { 'content-type': 'application/json' } });
}

beforeAll(async () => {
  ({ POST } = await import('../route'));
});

beforeEach(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.mkdirSync(ROOT, { recursive: true });
  resolveSessionFromRequest.mockReset();
  retryPimsDispatch.mockReset();
});

describe('PIMS dispatch retry api', () => {
  it('encaminha retry para o serviço e devolve item', async () => {
    resolveSessionFromRequest.mockReturnValue(session('ADMIN_EMPRESA', 'tenant-a'));
    retryPimsDispatch.mockResolvedValue({ success: true, dispatch: { id: 'disp-1', status: 'SUCCESS' } });

    const response = await POST(req('http://localhost/api/integracoes/pims/dispatches/disp-1/retry'), { params: { id: 'disp-1' } });

    expect(response.status).toBe(200);
    expect((await response.json()).item.status).toBe('SUCCESS');
    expect(retryPimsDispatch).toHaveBeenCalledWith('tenant-a', 'disp-1', 'Robson');
  });
});
