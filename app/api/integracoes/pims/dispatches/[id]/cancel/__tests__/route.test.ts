import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-pims-cancel-route-'));
process.env.SILO_STORAGE_DIR = ROOT;
process.env.SILO_AUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_SECRET = 'test-secret';

jest.mock('@/lib/auth/session', () => ({
  resolveSessionFromRequest: jest.fn(),
}));

const { resolveSessionFromRequest } = jest.requireMock('@/lib/auth/session') as { resolveSessionFromRequest: jest.Mock };

let POST: typeof import('../route').POST;

function session(role: string, tenantId = 'tenant-a') {
  return { id: 'usr-1', name: 'Robson', email: 'robson@example.com', role, scope: 'TENANT' as const, tenantId, activeTenantId: tenantId, defaultTenantId: tenantId, accessGroupId: role, expiresAt: new Date(Date.now() + 3600_000).toISOString(), mustChangePassword: false, lastLoginAt: null };
}

function req(url: string, method = 'GET', body?: Record<string, unknown>) {
  return new NextRequest(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
}

beforeAll(async () => {
  ({ POST } = await import('../route'));
});

beforeEach(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.mkdirSync(ROOT, { recursive: true });
  resolveSessionFromRequest.mockReset();
});

describe('PIMS dispatch cancel api', () => {
  it('cancela dispatch pendente', async () => {
    const { sendPimsDispatch, cancelPimsDispatch } = await import('@/lib/integrations/pims/pims-dispatch-service');
    const { IntegrationConfigStorage } = await import('@/lib/integrations/integration-config-storage');

    resolveSessionFromRequest.mockReturnValue(session('ADMIN_EMPRESA', 'tenant-a'));

    const config = IntegrationConfigStorage.create('tenant-a', {
      system: 'PIMS',
      name: 'PIMS Homologação',
      environment: 'HOMOLOGACAO',
      baseUrl: 'https://pims-hml.example.com',
      authType: 'NONE',
      timeoutMs: 5000,
      retryCount: 0,
      status: 'ACTIVE',
    }, { userId: 'u-1', userName: 'User 1', userRole: 'ADMIN_EMPRESA' });

    const initial = await sendPimsDispatch({
      tenantId: 'tenant-a',
      periodStart: '2026-06-22',
      periodEnd: '2026-06-22',
      targetDataType: 'FULL_OPERATIONAL_PACKAGE',
      mockMode: true,
      actor: 'User 1',
      configId: config.id,
    }, { validate: async () => ({ status: 'SUCCESS', issues: [] }), loadOperationalRecords: async () => ([{ fleetCode: '2026' }]) });
    if (!initial.success) throw new Error('expected success');

    const { PimsDispatchStorage } = await import('@/lib/integrations/pims/pims-dispatch-storage');
    PimsDispatchStorage.update('tenant-a', initial.dispatch.id, { status: 'PENDING' });

    const response = await POST(req(`http://localhost/api/integracoes/pims/dispatches/${initial.dispatch.id}/cancel`, 'POST'), { params: { id: initial.dispatch.id } });

    expect(response.status).toBe(200);
    expect((await response.json()).item.status).toBe('CANCELED');
    expect(cancelPimsDispatch).toBeDefined();
  });
});
