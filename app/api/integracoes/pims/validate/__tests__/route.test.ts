import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-pims-validate-api-'));
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

function req(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

beforeAll(async () => {
  ({ POST } = await import('../route'));
});

beforeEach(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.mkdirSync(ROOT, { recursive: true });
  resolveSessionFromRequest.mockReset();
});

describe('PIMS validation api', () => {
  it('gera job, log e resultado por tenant', async () => {
    const { ServerStorage } = await import('@/lib/server-storage');
    const { PimsMappingStorage } = await import('@/lib/integrations/pims/pims-mapping-storage');
    const today = new Date().toISOString().slice(0, 10);

    ServerStorage.updateLiveState('tenant-a', 'eq-1', '2026', {
      equipmentId: 'eq-1',
      fleetCode: '2026',
      tenantId: 'tenant-a',
      status: 'FINALIZADO',
      operatorRegistration: '01',
      operatorName: 'Joao',
      operationCode: '1005',
      costCenterCode: '8080',
      implementCode: '5000',
      hourmeterStart: 100,
      hourmeterEnd: 120,
      totalHourmeter: 20,
      updatedAt: new Date().toISOString(),
    } as never);

    PimsMappingStorage.seed('tenant-a', [
      { id: '1', tenantId: 'tenant-a', type: 'OPERATION', siloCode: '1005', pimsCode: 'PIMS_OP_1005', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '2', tenantId: 'tenant-a', type: 'STOP_REASON', siloCode: '3030', pimsCode: 'PIMS_STOP_3030', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '3', tenantId: 'tenant-a', type: 'COST_CENTER', siloCode: '8080', pimsCode: 'PIMS_CC_8080', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '4', tenantId: 'tenant-a', type: 'EQUIPMENT', siloCode: '2026', pimsCode: '2026', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '5', tenantId: 'tenant-a', type: 'OPERATOR', siloCode: '01', pimsCode: 'PIMS_OPR_01', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      { id: '6', tenantId: 'tenant-a', type: 'IMPLEMENT', siloCode: '5000', pimsCode: 'PIMS_IMPL_5000', status: 'ACTIVE', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ] as never);

    resolveSessionFromRequest.mockReturnValue(session('ADMIN_EMPRESA', 'tenant-a'));
    const res = await POST(req('http://localhost/api/integracoes/pims/validate', {
      targetDataType: 'FICHA_OPERADOR',
      periodStart: today,
      periodEnd: today,
      filters: { fleetCode: '2026' },
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.status).toBe('SUCCESS');
    expect(body.issues).toHaveLength(0);

    const { IntegrationJobStorage } = await import('@/lib/integrations/integration-job-storage');
    const { IntegrationLogStorage } = await import('@/lib/integrations/integration-log-storage');
    const { PimsValidationStorage } = await import('@/lib/integrations/pims/pims-validation-storage');
    expect(IntegrationJobStorage.listByTenant('tenant-a', { system: 'PIMS' }).length).toBe(1);
    expect(IntegrationLogStorage.listByTenant('tenant-a', { system: 'PIMS' }).length).toBeGreaterThan(0);
    expect(PimsValidationStorage.listByTenant('tenant-a').length).toBe(1);
  });

  it('bloqueia usuario sem permissao', async () => {
    resolveSessionFromRequest.mockReturnValue(session('CONSULTA', 'tenant-a'));
    const res = await POST(req('http://localhost/api/integracoes/pims/validate', { targetDataType: 'FICHA_OPERADOR' }));
    expect(res.status).toBe(403);
  });
});
