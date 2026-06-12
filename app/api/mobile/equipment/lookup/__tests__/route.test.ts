/**
 * Tests for GET /api/mobile/equipment/lookup
 *
 * Lookup strategy:
 *  1. PRIMARY  — cadastro-equipamentos.json via CadastroStorage
 *  2. FALLBACK — equipments.json (legacy, read-only)
 *
 * Contracts verified:
 *  1.  fleetCode ausente → 400
 *  2.  Frota cadastrada (cadastro, mobileEnabled=true) → 200
 *  3.  Frota não encontrada em nenhuma fonte → 404
 *  4.  Frota cadastro mobileEnabled=false → 403
 *  5.  Frota cadastro mobile=false (alias de campo) → 403
 *  6.  Frota cadastro entityStatus=INATIVO → 403
 *  7.  Isolamento cross-tenant: mesma code, tenant diferente → 404
 *  8.  Fallback legado: encontrado em equipments.json → 200
 *  9.  Fallback legado: mobileEnabled=false → 403 (via validateMobileLookupEquipment)
 * 10.  Frota cadastro oculta por entityStatus=ARQUIVADO (filtrado por getAll) → fallback/404
 * 11.  Sem token X-Company-Token → 401
 * 12.  Token inválido → 403
 * 13.  Migração não ocorre: registro não é copiado para equipments.json
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock('@/lib/audit/audit-log', () => ({ auditFromRequest: jest.fn() }));

// requireMobileAuth — controls tenant resolution + auth gate
let mockMobileAuth: { ok: boolean; tenantId?: string; response?: object } = {
  ok: true,
  tenantId: 'tenant-a',
};
jest.mock('@/lib/auth/api-guard', () => ({
  requireMobileAuth: jest.fn(() => {
    if (!mockMobileAuth.ok) {
      const { NextResponse } = require('next/server');
      return {
        ok: false,
        response: NextResponse.json(
          { error: mockMobileAuth.response ?? 'Auth error' },
          { status: (mockMobileAuth as any).status ?? 401 },
        ),
      };
    }
    return { ok: true, tenantId: mockMobileAuth.tenantId };
  }),
  maskToken: jest.fn((t: string) => t ? `${t.slice(0,4)}••••${t.slice(-4)}` : ''),
}));

// CadastroStorage — in-memory per-tenant store
type CadastroItem = Record<string, unknown>;
let cadastroStore: CadastroItem[] = [];

jest.mock('@/lib/cadastro-storage', () => ({
  CadastroStorage: {
    getAll: jest.fn((tenantId: string, _entity: string) =>
      // Mirrors real behaviour: only active (non-ARQUIVADO, non-deleted) records
      cadastroStore.filter(
        (i) =>
          i.tenantId === tenantId &&
          i.entityStatus !== 'ARQUIVADO' &&
          !i.deletedAt,
      ),
    ),
  },
}));

// ServerStorage — legacy path
import type { Equipment } from '@/lib/types/index';
let legacyStore: Equipment[] = [];
let legacyValidationResult: { ok: true; equipment: Equipment } | { ok: false; status: 403 | 404; error: string } = {
  ok: false,
  status: 404,
  error: 'Equipamento nao encontrado',
};

jest.mock('@/lib/server-storage', () => ({
  ServerStorage: {
    getEquipmentByFleetCode: jest.fn((code: string, tenantId: string) =>
      legacyStore.find(
        (e) => e.code === code && e.tenantId === tenantId,
      ) ?? undefined,
    ),
    validateMobileLookupEquipment: jest.fn(() => legacyValidationResult),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(
  fleetCode: string | null,
  headers: Record<string, string> = {},
): NextRequest {
  const url = fleetCode
    ? `http://localhost/api/mobile/equipment/lookup?fleetCode=${encodeURIComponent(fleetCode)}`
    : 'http://localhost/api/mobile/equipment/lookup';
  return new NextRequest(url, {
    method: 'GET',
    headers: {
      'x-company-token': 'CTK-VALID',
      ...headers,
    },
  });
}

function cadastroEquipment(overrides: Partial<CadastroItem> = {}): CadastroItem {
  return {
    id:            'ceq-001',
    tenantId:      'tenant-a',
    code:          '1002',
    fabricante:    'John Deere',
    status:        'trabalhando',
    entityStatus:  'ATIVO',
    mobileEnabled: true,
    mobileToken:   'TK-1002',
    createdAt:     '2024-01-01T00:00:00.000Z',
    updatedAt:     '2024-01-01T00:00:00.000Z',
    version:       1,
    ...overrides,
  };
}

function legacyEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id:            'eq-legacy-1',
    tenantId:      'tenant-a',
    code:          'COL-101',
    brand:         'John Deere',
    typeId:        'et-1',
    modelId:       'em-1',
    status:        'ATIVO' as Equipment['status'],
    entityStatus:  'ATIVO',
    mobileEnabled: true,
    mobileToken:   'TK-COL101',
    hourmeter:     1000,
    lastSignal:    'Agora',
    createdAt:     '2024-01-01T00:00:00.000Z',
    updatedAt:     '2024-01-01T00:00:00.000Z',
    deletedAt:     null,
    createdBy:     'SISTEMA',
    updatedBy:     'SISTEMA',
    version:       1,
    history:       [],
    isADValidated: false,
    requirePasswordChange: false,
    ...overrides,
  } as unknown as Equipment;
}

// ── Reset helpers ─────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  cadastroStore = [];
  legacyStore = [];
  legacyValidationResult = { ok: false, status: 404, error: 'Equipamento nao encontrado' };
  mockMobileAuth = { ok: true, tenantId: 'tenant-a' };
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/mobile/equipment/lookup', () => {
  // 1 ──────────────────────────────────────────────────────────────────────────
  it('fleetCode ausente → 400', async () => {
    const res = await GET(makeReq(null));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/fleetCode/i);
  });

  // 2 ──────────────────────────────────────────────────────────────────────────
  it('frota cadastrada com mobileEnabled=true → 200 com campos corretos', async () => {
    cadastroStore.push(cadastroEquipment());
    const res = await GET(makeReq('1002'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe('1002');
    expect(body.mobileEnabled).toBe(true);
    expect(body.mobileToken).toBe('TK-1002');
    expect(body.tenantId).toBe('tenant-a');
    expect(body.active).toBe(true);
  });

  // 3 ──────────────────────────────────────────────────────────────────────────
  it('frota não encontrada em nenhuma fonte → 404', async () => {
    const res = await GET(makeReq('XXXX'));
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/nao cadastrada/i);
  });

  // 4 ──────────────────────────────────────────────────────────────────────────
  it('frota cadastro mobileEnabled=false → 403', async () => {
    cadastroStore.push(cadastroEquipment({ mobileEnabled: false }));
    const res = await GET(makeReq('1002'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/mobile desabilitado/i);
  });

  // 5 ──────────────────────────────────────────────────────────────────────────
  it('frota cadastro alias mobile=false (campo do formulário) → 403', async () => {
    cadastroStore.push(
      cadastroEquipment({ mobileEnabled: undefined, mobile: false }),
    );
    const res = await GET(makeReq('1002'));
    expect(res.status).toBe(403);
  });

  // 6 ──────────────────────────────────────────────────────────────────────────
  it('frota cadastro entityStatus=INATIVO → 403 (frota inativa)', async () => {
    cadastroStore.push(cadastroEquipment({ entityStatus: 'INATIVO' }));
    const res = await GET(makeReq('1002'));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/frota inativa/i);
  });

  // 7 ──────────────────────────────────────────────────────────────────────────
  it('isolamento cross-tenant: mesmo code em tenant diferente → 404', async () => {
    // Frota 1002 existe apenas em tenant-b, não em tenant-a
    cadastroStore.push(cadastroEquipment({ tenantId: 'tenant-b' }));
    // mockMobileAuth resolve tenant-a
    const res = await GET(makeReq('1002'));
    expect(res.status).toBe(404);
  });

  // 8 ──────────────────────────────────────────────────────────────────────────
  it('fallback legado: frota em equipments.json → 200', async () => {
    const eq = legacyEquipment();
    legacyStore.push(eq);
    legacyValidationResult = { ok: true, equipment: eq };

    const res = await GET(makeReq('COL-101'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.code).toBe('COL-101');
    expect(body.mobileEnabled).toBe(true);
    expect(body.tenantId).toBe('tenant-a');
  });

  // 9 ──────────────────────────────────────────────────────────────────────────
  it('fallback legado: mobileEnabled=false → 403', async () => {
    const eq = legacyEquipment({ mobileEnabled: false });
    legacyStore.push(eq);
    legacyValidationResult = {
      ok: false,
      status: 403,
      error: 'Mobile desabilitado para esta frota',
    };

    const res = await GET(makeReq('COL-101'));
    expect(res.status).toBe(403);
  });

  // 10 ─────────────────────────────────────────────────────────────────────────
  it('frota com entityStatus=ARQUIVADO não aparece no cadastro (filtrada por getAll) → fallback → 404', async () => {
    // getAll mock filters out ARQUIVADO — arquivado record must NOT match
    cadastroStore.push(cadastroEquipment({ entityStatus: 'ARQUIVADO' }));
    // Legacy also empty
    const res = await GET(makeReq('1002'));
    expect(res.status).toBe(404);
  });

  // 11 ─────────────────────────────────────────────────────────────────────────
  it('sem X-Company-Token → 401', async () => {
    mockMobileAuth = { ok: false, tenantId: undefined, response: { error: 'X-Company-Token is required' } } as any;
    (mockMobileAuth as any).status = 401;
    const res = await GET(makeReq('1002'));
    expect(res.status).toBe(401);
  });

  // 12 ─────────────────────────────────────────────────────────────────────────
  it('token inválido → 403', async () => {
    mockMobileAuth = { ok: false, tenantId: undefined, response: { error: 'Token invalido' } } as any;
    (mockMobileAuth as any).status = 403;
    const res = await GET(makeReq('1002'));
    expect(res.status).toBe(403);
  });

  // 13 ─────────────────────────────────────────────────────────────────────────
  it('sem duplicação: frota cadastro encontrada não tenta gravar em equipments.json', async () => {
    const { ServerStorage } = require('@/lib/server-storage');
    cadastroStore.push(cadastroEquipment());

    await GET(makeReq('1002'));

    // getEquipmentByFleetCode must NOT have been called (cadastro path short-circuits)
    expect(ServerStorage.getEquipmentByFleetCode).not.toHaveBeenCalled();
  });

  // ── Normalisation edge cases ─────────────────────────────────────────────────

  it('busca é case-insensitive no code', async () => {
    cadastroStore.push(cadastroEquipment({ code: 'COL-101' }));
    const res = await GET(makeReq('col-101'));
    expect(res.status).toBe(200);
  });

  it('frota cadastro com status operacional "trabalhando" → 200 (não bloqueia)', async () => {
    cadastroStore.push(cadastroEquipment({ status: 'trabalhando', entityStatus: 'ATIVO', mobileEnabled: true }));
    const res = await GET(makeReq('1002'));
    expect(res.status).toBe(200);
  });

  it('name usa fabricante quando presente', async () => {
    cadastroStore.push(cadastroEquipment({ fabricante: 'Case IH', code: '1002' }));
    const res = await GET(makeReq('1002'));
    const body = await res.json();
    expect(body.name).toContain('Case IH');
  });

  it('name usa brand quando fabricante ausente', async () => {
    cadastroStore.push(
      cadastroEquipment({ fabricante: undefined, brand: 'Scania', code: '1002' }),
    );
    const res = await GET(makeReq('1002'));
    const body = await res.json();
    expect(body.name).toContain('Scania');
  });
});
