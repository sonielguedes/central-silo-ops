import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-pims-mappings-api-'));
process.env.SILO_STORAGE_DIR = ROOT;
process.env.SILO_AUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_SECRET = 'test-secret';

jest.mock('@/lib/auth/session', () => ({
  resolveSessionFromRequest: jest.fn(),
}));

const { resolveSessionFromRequest } = jest.requireMock('@/lib/auth/session') as { resolveSessionFromRequest: jest.Mock };

let GET: typeof import('../route').GET;
let POST: typeof import('../route').POST;
let PUT: typeof import('../[id]/route').PUT;
let DEL: typeof import('../[id]/route').DELETE;

function session(role: string, tenantId = 'tenant-a') {
  return { id: 'usr-1', name: 'Robson', email: 'robson@example.com', role, scope: 'TENANT' as const, tenantId, activeTenantId: tenantId, defaultTenantId: tenantId, accessGroupId: role, expiresAt: new Date(Date.now() + 3600_000).toISOString(), mustChangePassword: false, lastLoginAt: null };
}

function req(url: string, method = 'GET', body?: Record<string, unknown>) {
  return new NextRequest(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
}

beforeAll(async () => {
  ({ GET, POST } = await import('../route'));
  ({ PUT, DELETE: DEL } = await import('../[id]/route'));
});

beforeEach(() => {
  fs.rmSync(ROOT, { recursive: true, force: true });
  fs.mkdirSync(ROOT, { recursive: true });
  resolveSessionFromRequest.mockReset();
});

describe('PIMS mappings api', () => {
  it('cria, lista, atualiza e inativa por tenant', async () => {
    resolveSessionFromRequest.mockReturnValue(session('ADMIN_EMPRESA', 'tenant-a'));
    const created = await POST(req('http://localhost/api/integracoes/pims/mappings', 'POST', { type: 'OPERATION', siloCode: '1005', pimsCode: 'PIMS_OP_1005', status: 'ACTIVE' }));
    expect(created.status).toBe(201);
    const body = await created.json();
    const id = body.item.id as string;

    const list = await GET(req('http://localhost/api/integracoes/pims/mappings'));
    expect((await list.json()).items).toHaveLength(1);

    const updated = await PUT(req(`http://localhost/api/integracoes/pims/mappings/${id}`, 'PUT', { pimsCode: 'PIMS_OP_1005_X' }), { params: { id } });
    expect(updated.status).toBe(200);

    const deleted = await DEL(req(`http://localhost/api/integracoes/pims/mappings/${id}`, 'DELETE'), { params: { id } });
    expect(deleted.status).toBe(200);
  });

  it('bloqueia usuario sem permissao', async () => {
    resolveSessionFromRequest.mockReturnValue(session('CONSULTA', 'tenant-a'));
    const res = await GET(req('http://localhost/api/integracoes/pims/mappings'));
    expect(res.status).toBe(403);
  });
});
