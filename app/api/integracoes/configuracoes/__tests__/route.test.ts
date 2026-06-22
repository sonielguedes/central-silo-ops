import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-integracoes-api-'));
process.env.SILO_STORAGE_DIR = TMP_ROOT;
process.env.SILO_AUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_SECRET = 'test-secret';

jest.mock('@/lib/auth/session', () => ({
  resolveSessionFromRequest: jest.fn(),
}));

jest.mock('@/lib/audit/audit-log', () => ({
  auditFromRequest: jest.fn(),
}));

const { resolveSessionFromRequest } = jest.requireMock('@/lib/auth/session') as {
  resolveSessionFromRequest: jest.Mock;
};

let GET: typeof import('../route').GET;
let POST: typeof import('../route').POST;
let PUT: typeof import('../[id]/route').PUT;
let DEL: typeof import('../[id]/route').DELETE;
let TEST: typeof import('../[id]/testar-conexao/route').POST;

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

function makeReq(body?: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/integracoes/configuracoes', {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeAll(async () => {
  ({ GET, POST } = await import('../route'));
  ({ PUT, DELETE: DEL } = await import('../[id]/route'));
  ({ POST: TEST } = await import('../[id]/testar-conexao/route'));
});

beforeEach(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  resolveSessionFromRequest.mockReset();
  (global as typeof globalThis & { fetch: jest.Mock }).fetch = jest.fn(async () => new Response('', { status: 200 }));
});

describe('integracoes configuracoes api', () => {
  it('cria, lista e mascara segredos apenas do tenant atual', async () => {
    resolveSessionFromRequest.mockReturnValue(makeSession('ADMIN_EMPRESA', 'tenant-a'));

    const createRes = await POST(makeReq({
      system: 'PIMS',
      name: 'PIMS Homologação',
      environment: 'HOMOLOGACAO',
      baseUrl: 'https://pims.example.com/api',
      authType: 'BEARER_TOKEN',
      bearerToken: 'token-completo',
      timeoutMs: 15000,
      retryCount: 3,
      status: 'INACTIVE',
    }));

    expect(createRes.status).toBe(201);
    const createdBody = await createRes.json();
    expect(createdBody.item.hasBearerToken).toBe(true);
    expect(createdBody.item.bearerToken).toBeUndefined();

    const listRes = await GET(makeReq());
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.items).toHaveLength(1);
    expect(listBody.items[0].tenantId).toBe('tenant-a');
    expect(listBody.items[0].bearerToken).toBeUndefined();

    resolveSessionFromRequest.mockReturnValue(makeSession('ADMIN_EMPRESA', 'tenant-b'));
    const otherTenantList = await GET(makeReq());
    expect(otherTenantList.status).toBe(200);
    const otherBody = await otherTenantList.json();
    expect(otherBody.items).toHaveLength(0);
  });

  it('atualiza, inativa e testa conexao', async () => {
    resolveSessionFromRequest.mockReturnValue(makeSession('SUPORTE', 'tenant-a'));

    const createRes = await POST(makeReq({
      system: 'TOTVS',
      name: 'TOTVS Produção',
      environment: 'PRODUCAO',
      baseUrl: 'https://totvs.example.com/api',
      authType: 'API_KEY',
      apiKey: 'api-key-original',
      timeoutMs: 12000,
      retryCount: 2,
      status: 'ACTIVE',
    }));
    const created = await createRes.json();
    const id = created.item.id as string;

    const updateRes = await PUT(
      new NextRequest(`http://localhost/api/integracoes/configuracoes/${id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'TOTVS Atualizado', status: 'ACTIVE' }),
      }),
      { params: { id } },
    );
    expect(updateRes.status).toBe(200);
    const updatedBody = await updateRes.json();
    expect(updatedBody.item.name).toBe('TOTVS Atualizado');

    const testRes = await TEST(
      new NextRequest(`http://localhost/api/integracoes/configuracoes/${id}/testar-conexao`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id } },
    );
    expect(testRes.status).toBe(200);
    const testedBody = await testRes.json();
    expect(testedBody.item.lastConnectionStatus).toBe('SUCCESS');
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('https://totvs.example.com/api');

    const deleteRes = await DEL(
      new NextRequest(`http://localhost/api/integracoes/configuracoes/${id}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
      }),
      { params: { id } },
    );
    expect(deleteRes.status).toBe(200);
    const deletedBody = await deleteRes.json();
    expect(deletedBody.item.status).toBe('INACTIVE');
  });

  it('bloqueia usuarios sem permissao', async () => {
    resolveSessionFromRequest.mockReturnValue(makeSession('CONSULTA', 'tenant-a'));

    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });
});
