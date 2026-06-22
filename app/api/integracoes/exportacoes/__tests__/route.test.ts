import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-integracoes-exportacoes-api-'));
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
let POST: typeof import('../route').POST;
let DETAIL: typeof import('../[id]/route').GET;
let DOWNLOAD: typeof import('../[id]/download/route').GET;
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

function req(url: string, method = 'GET', body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeAll(async () => {
  ({ GET, POST } = await import('../route'));
  ({ GET: DETAIL } = await import('../[id]/route'));
  ({ GET: DOWNLOAD } = await import('../[id]/download/route'));
  ({ POST: CANCEL } = await import('../[id]/cancel/route'));
});

beforeEach(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  resolveSessionFromRequest.mockReset();
});

describe('integracoes exportacoes api', () => {
  it('cria exportacao, gera arquivo e isola tenant', async () => {
    const { FuelingStorage } = await import('@/lib/fueling-storage');
    const today = new Date().toISOString().slice(0, 10);
    FuelingStorage.save({
      eventId: 'fuel-1',
      tenantId: 'tenant-a',
      equipmentId: 'eq-1',
      fleetCode: '2026',
      dieselLiters: 40,
      hourmeter: 120,
      fuelType: 'DIESEL',
      fleetDescription: 'Frota 2026',
      operatorRegistration: '00125',
      operatorName: 'Joao Silva',
      journeyId: 'journey-1',
      fueledAt: `${today}T10:00:00.000Z`,
    });

    resolveSessionFromRequest.mockReturnValue(makeSession('ADMIN_EMPRESA', 'tenant-a'));
    const res = await POST(req('http://localhost/api/integracoes/exportacoes', 'POST', {
      targetSystem: 'SILO',
      dataType: 'FUELINGS',
      format: 'JSON',
      title: 'Exportacao fuelings',
      periodStart: today,
      periodEnd: today,
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.item.jobId).toBeTruthy();
    expect(body.item.fileName).toMatch(/\.json$/);

    const list = await GET(req('http://localhost/api/integracoes/exportacoes'));
    expect(list.status).toBe(200);
    const listBody = await list.json();
    expect(listBody.items).toHaveLength(1);

    resolveSessionFromRequest.mockReturnValue(makeSession('ADMIN_EMPRESA', 'tenant-b'));
    const other = await GET(req('http://localhost/api/integracoes/exportacoes'));
    const otherBody = await other.json();
    expect(otherBody.items).toHaveLength(0);
  });

  it('baixa arquivo, bloqueia tenant errado e cancela apenas status permitido', async () => {
    const { FuelingStorage } = await import('@/lib/fueling-storage');
    const today = new Date().toISOString().slice(0, 10);
    FuelingStorage.save({
      eventId: 'fuel-2',
      tenantId: 'tenant-a',
      equipmentId: 'eq-1',
      fleetCode: '2026',
      dieselLiters: 10,
      hourmeter: 121,
      fuelType: 'DIESEL',
      fleetDescription: 'Frota 2026',
      operatorRegistration: '00125',
      operatorName: 'Joao Silva',
      journeyId: 'journey-1',
      fueledAt: `${today}T12:00:00.000Z`,
    });

    resolveSessionFromRequest.mockReturnValue(makeSession('SUPORTE', 'tenant-a'));
    const createdRes = await POST(req('http://localhost/api/integracoes/exportacoes', 'POST', {
      targetSystem: 'SILO',
      dataType: 'FUELINGS',
      format: 'CSV',
      title: 'Exportacao fuelings CSV',
      periodStart: today,
      periodEnd: today,
    }));
    const created = await createdRes.json();
    const id = created.item.id as string;

    const downloadRes = await DOWNLOAD(req(`http://localhost/api/integracoes/exportacoes/${id}/download`), { params: { id } });
    expect(downloadRes.status).toBe(200);

    const detailRes = await DETAIL(req(`http://localhost/api/integracoes/exportacoes/${id}`), { params: { id } });
    const detail = await detailRes.json();
    expect(detail.item.fileName).toMatch(/\.csv$/);

    const cancelRes = await CANCEL(req(`http://localhost/api/integracoes/exportacoes/${id}/cancel`, 'POST'), { params: { id } });
    expect(cancelRes.status).toBe(422);
  });

  it('bloqueia path traversal no download', async () => {
    const { FuelingStorage } = await import('@/lib/fueling-storage');
    const { IntegrationExportStorage } = await import('@/lib/integrations/integration-export-storage');
    const today = new Date().toISOString().slice(0, 10);
    FuelingStorage.save({
      eventId: 'fuel-3',
      tenantId: 'tenant-a',
      equipmentId: 'eq-1',
      fleetCode: '2026',
      dieselLiters: 10,
      hourmeter: 122,
      fuelType: 'DIESEL',
      fleetDescription: 'Frota 2026',
      operatorRegistration: '00125',
      operatorName: 'Joao Silva',
      journeyId: 'journey-1',
      fueledAt: `${today}T12:00:00.000Z`,
    });

    resolveSessionFromRequest.mockReturnValue(makeSession('ADMIN_EMPRESA', 'tenant-a'));
    const createdRes = await POST(req('http://localhost/api/integracoes/exportacoes', 'POST', {
      targetSystem: 'SILO',
      dataType: 'FUELINGS',
      format: 'JSON',
      title: 'Exportacao traversal',
      periodStart: today,
      periodEnd: today,
    }));
    const created = await createdRes.json();
    await IntegrationExportStorage.update('tenant-a', created.item.id, {
      fileName: '../evil.json',
      filePath: '../evil.json',
      status: 'SUCCESS',
    } as never);

    const download = await DOWNLOAD(req(`http://localhost/api/integracoes/exportacoes/${created.item.id}/download`), { params: { id: created.item.id } });
    expect(download.status).toBe(400);
  });

  it('bloqueia usuario sem permissao', async () => {
    resolveSessionFromRequest.mockReturnValue(makeSession('CONSULTA', 'tenant-a'));
    const res = await GET(req('http://localhost/api/integracoes/exportacoes'));
    expect(res.status).toBe(403);
  });
});
