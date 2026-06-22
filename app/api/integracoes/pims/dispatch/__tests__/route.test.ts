import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-pims-dispatch-route-'));
process.env.SILO_STORAGE_DIR = ROOT;
process.env.SILO_AUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_SECRET = 'test-secret';

jest.mock('@/lib/auth/session', () => ({
  resolveSessionFromRequest: jest.fn(),
}));

jest.mock('@/lib/integrations/pims/pims-validation-engine', () => ({
  validatePimsOperationalData: jest.fn(),
}));

const { resolveSessionFromRequest } = jest.requireMock('@/lib/auth/session') as { resolveSessionFromRequest: jest.Mock };
const { validatePimsOperationalData } = jest.requireMock('@/lib/integrations/pims/pims-validation-engine') as { validatePimsOperationalData: jest.Mock };

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
  validatePimsOperationalData.mockReset();
});

describe('PIMS dispatch api', () => {
  it('cria envio homologado e lista dispatches do tenant', async () => {
    const { IntegrationConfigStorage } = await import('@/lib/integrations/integration-config-storage');
    resolveSessionFromRequest.mockReturnValue(session('ADMIN_EMPRESA', 'tenant-a'));
    validatePimsOperationalData.mockReturnValue({ status: 'SUCCESS', issues: [] });

    IntegrationConfigStorage.create('tenant-a', {
      system: 'PIMS',
      name: 'PIMS Homologação',
      environment: 'HOMOLOGACAO',
      baseUrl: 'https://pims-hml.example.com',
      authType: 'NONE',
      timeoutMs: 5000,
      retryCount: 0,
      status: 'ACTIVE',
    }, { userId: 'u-1', userName: 'User 1', userRole: 'ADMIN_EMPRESA' });

    const response = await POST(req('http://localhost/api/integracoes/pims/dispatch', 'POST', {
      periodStart: '2026-06-22',
      periodEnd: '2026-06-22',
      targetDataType: 'FULL_OPERATIONAL_PACKAGE',
      mockMode: true,
      referenceId: 'ref-1',
    }));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.dispatch.status).toBe('SUCCESS');
    expect(fs.readFileSync(body.requestPath, 'utf-8')).toContain('FULL_OPERATIONAL_PACKAGE');
    expect(fs.existsSync(body.responsePath)).toBe(true);
  });

  it('bloqueia produção', async () => {
    const { IntegrationConfigStorage } = await import('@/lib/integrations/integration-config-storage');

    resolveSessionFromRequest.mockReturnValue(session('ADMIN_EMPRESA', 'tenant-a'));
    validatePimsOperationalData.mockReturnValue({ status: 'SUCCESS', issues: [] });

    const config = IntegrationConfigStorage.create('tenant-a', {
      system: 'PIMS',
      name: 'PIMS Produção',
      environment: 'PRODUCAO',
      baseUrl: 'https://pims.example.com',
      authType: 'NONE',
      timeoutMs: 5000,
      retryCount: 0,
      status: 'ACTIVE',
    }, { userId: 'u-1', userName: 'User 1', userRole: 'ADMIN_EMPRESA' });

    const response = await POST(req('http://localhost/api/integracoes/pims/dispatch', 'POST', {
      configId: config.id,
      periodStart: '2026-06-22',
      periodEnd: '2026-06-22',
      targetDataType: 'FULL_OPERATIONAL_PACKAGE',
      mockMode: true,
    }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('PIMS_PRODUCTION_BLOCKED');
  });
});
