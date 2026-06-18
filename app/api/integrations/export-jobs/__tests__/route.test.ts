import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-integrations-'));

let mockBuilt: any;

jest.mock('@/lib/auth/api-guard', () => ({
  requireTenant: jest.fn(() => ({ ok: true, tenantId: 'tenant-a' })),
}));

jest.mock('@/lib/auth/rbac-server', () => ({
  requirePermission: jest.fn(() => null),
}));

jest.mock('@/lib/audit/audit-log', () => ({
  auditFromRequest: jest.fn(),
}));

jest.mock('@/lib/integrations/ficha-integration', () => ({
  buildFichaIntegrationJobInput: jest.fn(() => mockBuilt),
}));

beforeEach(() => {
  process.env.SILO_STORAGE_DIR = tempDir;
  jest.resetModules();
  mockBuilt = {
    ok: true,
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'FICHA_OPERADOR',
    sourceId: 'tenant-a|2026|2026-06-17',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
    operationType: 'CREATE',
    payload: {
      tenantId: 'tenant-a',
      sheetId: 'tenant-a|2026|2026-06-17',
      dataOperacional: '2026-06-17',
      frota: '2026',
      operador: 'RAIMUNDO NONATO',
      matricula: '00125',
      os: '100',
      operacaoCodigo: 'OP-PLANTIO',
      operacaoDescricao: 'PLANTIO',
      centroCusto: null,
      implementoCodigo: 'SULC',
      implementoDescricao: 'SULCADOR',
      horimetroInicial: 0.5,
      horimetroFinal: 1.6,
      totalHoras: 1.1,
      statusFicha: 'VALIDADO',
      validadoPor: 'usuario',
      validadoEm: '2026-06-17T11:10:00.000Z',
      exportadoEm: null,
      inconsistencias: [],
    },
    payloadHash: 'hash-1',
  };
});

async function loadRoute() {
  return import('@/app/api/integrations/export-jobs/route');
}

function makeReq(url: string, method = 'GET', body?: Record<string, unknown>) {
  return new NextRequest(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

test('GET lista jobs por tenant', async () => {
  const { IntegrationExportJobStore } = await import('@/lib/integrations/export-job-store');
  IntegrationExportJobStore.createJob({
    tenantId: 'tenant-a',
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'FICHA_OPERADOR',
    sourceId: 'tenant-a|2026|2026-06-17',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
    operationType: 'CREATE',
    payload: { a: 1 },
    createdBy: 'user',
    payloadHash: 'hash-list-1',
  });

  const { GET } = await loadRoute();
  const res = await GET(makeReq('http://localhost/api/integrations/export-jobs'));
  expect(res.status).toBe(200);
  const json = await res.json();
  expect(json.items).toHaveLength(1);
});

test('POST cria job, exporta arquivo local e bloqueia duplicidade', async () => {
  const { POST } = await loadRoute();
  const res = await POST(makeReq('http://localhost/api/integrations/export-jobs', 'POST', {
    fleetCode: '2026',
    date: '2026-06-17',
  }));
  expect(res.status).toBe(201);
  const json = await res.json();
  expect(json.ok).toBe(true);
  expect(json.job.status).toBe('EXPORTED');
  expect(json.job.fileName).toContain('pims-ficha-operador');

  const filePath = path.join(tempDir, 'tenant-a', 'exports', 'pims', json.job.fileName);
  expect(fs.existsSync(filePath)).toBe(true);

  const dup = await POST(makeReq('http://localhost/api/integrations/export-jobs', 'POST', {
    fleetCode: '2026',
    date: '2026-06-17',
  }));
  expect(dup.status).toBe(200);
  expect((await dup.json()).duplicated).toBe(true);
});

