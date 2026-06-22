import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-integracoes-jobs-api-'));
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
let DETAIL: typeof import('../[id]/route').GET;
let RETRY: typeof import('../[id]/retry/route').POST;
let CANCEL: typeof import('../[id]/cancel/route').POST;

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

function makeReq(url: string, method = 'GET', body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeAll(async () => {
  ({ GET, POST } = await import('../route'));
  ({ GET: DETAIL } = await import('../[id]/route'));
  ({ POST: RETRY } = await import('../[id]/retry/route'));
  ({ POST: CANCEL } = await import('../[id]/cancel/route'));
});

beforeEach(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  resolveSessionFromRequest.mockReset();
});

describe('integracoes jobs api', () => {
  it('cria, lista e isola jobs por tenant', async () => {
    resolveSessionFromRequest.mockReturnValue(makeSession('ADMIN_EMPRESA', 'tenant-a'));
    const createRes = await POST(makeReq('http://localhost/api/integracoes/jobs', 'POST', {
      system: 'PIMS',
      type: 'EXPORT_FICHA_OPERADOR',
      title: 'Exportação manual',
      maxAttempts: 3,
      source: 'MANUAL',
    }));
    expect(createRes.status).toBe(201);
    const createBody = await createRes.json();
    expect(createBody.item.status).toBe('PENDING');

    const listRes = await GET(makeReq('http://localhost/api/integracoes/jobs'));
    const listBody = await listRes.json();
    expect(listBody.items).toHaveLength(1);

    resolveSessionFromRequest.mockReturnValue(makeSession('ADMIN_EMPRESA', 'tenant-b'));
    const otherRes = await GET(makeReq('http://localhost/api/integracoes/jobs'));
    const otherBody = await otherRes.json();
    expect(otherBody.items).toHaveLength(0);
  });

  it('detalha, cancela e reprocessa jobs com regras de status', async () => {
    resolveSessionFromRequest.mockReturnValue(makeSession('SUPORTE', 'tenant-a'));
    const createRes = await POST(makeReq('http://localhost/api/integracoes/jobs', 'POST', {
      system: 'TOTVS',
      type: 'EXPORT_FUELINGS',
      title: 'Abastecimentos',
      maxAttempts: 2,
      source: 'MANUAL',
    }));
    const created = await createRes.json();
    const id = created.item.id as string;

    const detailRes = await DETAIL(makeReq(`http://localhost/api/integracoes/jobs/${id}`), { params: { id } });
    expect(detailRes.status).toBe(200);

    const cancelRes = await CANCEL(makeReq(`http://localhost/api/integracoes/jobs/${id}/cancel`, 'POST'), { params: { id } });
    expect(cancelRes.status).toBe(200);
    const canceled = await cancelRes.json();
    expect(canceled.item.status).toBe('CANCELED');

    const retryRes = await RETRY(makeReq(`http://localhost/api/integracoes/jobs/${id}/retry`, 'POST'), { params: { id } });
    expect(retryRes.status).toBe(200);
    const retried = await retryRes.json();
    expect(retried.item.status).toBe('RETRYING');
    expect(retried.item.attempts).toBe(1);
  });

  it('bloqueia consulta para usuario sem permissao', async () => {
    resolveSessionFromRequest.mockReturnValue(makeSession('CONSULTA', 'tenant-a'));
    const res = await GET(makeReq('http://localhost/api/integracoes/jobs'));
    expect(res.status).toBe(403);
  });
});

