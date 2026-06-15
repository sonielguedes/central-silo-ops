/**
 * Tests for POST /api/mobile/shift/start
 *
 * Equipment resolution:
 *   1. PRIMARY  -- cadastro-equipamentos.json via CadastroStorage
 *   2. FALLBACK -- equipments.json (legacy, read-only)
 *
 * Operator resolution:
 *   cadastro-operadores.json via CadastroStorage
 *
 * New multi-tenant contract: { equipmentCode, operatorRegistration, hourmeterStart, startedAt }
 * authenticated only by X-Company-Token -- no mobileToken required in the body.
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';

// -- Mocks ---------------------------------------------------------------------

jest.mock('@/lib/audit/audit-log', () => ({ auditFromRequest: jest.fn() }));

let mockMobileAuth: { ok: boolean; tenantId?: string; status?: number; response?: object | string } = {
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
          { status: mockMobileAuth.status ?? 401 },
        ),
      };
    }
    return { ok: true, tenantId: mockMobileAuth.tenantId, companyToken: 'tok-company' };
  }),
}));

// CadastroStorage -- in-memory per-tenant, per-entity store.
type CadastroItem = Record<string, unknown>;
let equipamentosStore: CadastroItem[] = [];
let operadoresStore: CadastroItem[] = [];

jest.mock('@/lib/cadastro-storage', () => ({
  CadastroStorage: {
    getAll: jest.fn((tenantId: string, entity: string) => {
      const src = entity === 'operadores' ? operadoresStore : equipamentosStore;
      return src.filter(
        (i) => i.tenantId === tenantId && i.entityStatus !== 'ARQUIVADO' && !i.deletedAt,
      );
    }),
  },
}));

// ServerStorage -- legacy path + side-effect sinks.
let legacyStore: Record<string, unknown>[] = [];
const updateEquipment = jest.fn();
const updateLiveState = jest.fn();
const saveEvent = jest.fn();

jest.mock('@/lib/server-storage', () => ({
  ServerStorage: {
    getEquipmentById: jest.fn((id: string, tenantId: string) =>
      legacyStore.find((e) => e.id === id && e.tenantId === tenantId),
    ),
    getEquipmentByFleetCode: jest.fn((code: string, tenantId: string) =>
      legacyStore.find((e) => e.code === code && e.tenantId === tenantId),
    ),
    updateEquipment: (...args: unknown[]) => updateEquipment(...args),
    updateLiveState: (...args: unknown[]) => updateLiveState(...args),
    saveEvent: (...args: unknown[]) => saveEvent(...args),
  },
}));

// -- Helpers -------------------------------------------------------------------

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/mobile/shift/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-company-token': 'tok-company' },
    body: JSON.stringify(body),
  });
}

const activeEquip = (over: CadastroItem = {}): CadastroItem => ({
  id: 'pbzr0u9vl',
  code: '2026',
  tenantId: 'tenant-a',
  status: 'ATIVO',
  entityStatus: 'ATIVO',
  mobileEnabled: true,
  ...over,
});

const activeOperator = (over: CadastroItem = {}): CadastroItem => ({
  id: 'op-x',
  registration: '01',
  name: 'Operador Um',
  status: 'ATIVO',
  entityStatus: 'ATIVO',
  tenantId: 'tenant-a',
  ...over,
});

beforeEach(() => {
  mockMobileAuth = { ok: true, tenantId: 'tenant-a' };
  equipamentosStore = [];
  operadoresStore = [];
  legacyStore = [];
  updateEquipment.mockClear();
  updateLiveState.mockClear();
  saveEvent.mockClear();
  saveEvent.mockReturnValue('SYNCED');
});

// -- Tests ---------------------------------------------------------------------

describe('POST /api/mobile/shift/start', () => {
  test('1. equipamento inexistente -> 404', async () => {
    operadoresStore = [activeOperator()];
    const res = await POST(makeReq({ equipmentCode: '9999', operatorRegistration: '01' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Equipamento nao encontrado');
  });

  test('2. mobileEnabled=false -> 403 desabilitado para mobile', async () => {
    equipamentosStore = [activeEquip({ mobileEnabled: false })];
    operadoresStore = [activeOperator()];
    const res = await POST(makeReq({ equipmentCode: '2026', operatorRegistration: '01' }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Equipamento desabilitado para mobile');
  });

  test('2b. mobileEnabled ausente -> habilitado (200)', async () => {
    const e = activeEquip();
    delete e.mobileEnabled;
    equipamentosStore = [e];
    operadoresStore = [activeOperator()];
    const res = await POST(makeReq({ equipmentCode: '2026', operatorRegistration: '01' }));
    expect(res.status).toBe(200);
  });

  test('3. entityStatus=INATIVO -> 403 inativo', async () => {
    equipamentosStore = [activeEquip({ entityStatus: 'INATIVO' })];
    operadoresStore = [activeOperator()];
    const res = await POST(makeReq({ equipmentCode: '2026', operatorRegistration: '01' }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Equipamento inativo');
  });

  test('4. contrato novo (equipmentCode + operatorRegistration + hourmeterStart + startedAt) -> 200', async () => {
    equipamentosStore = [activeEquip()];
    operadoresStore = [activeOperator()];
    const startedAt = '2026-06-14T10:00:00.000Z';
    const res = await POST(
      makeReq({ equipmentCode: '2026', operatorRegistration: '01', hourmeterStart: 0.15, startedAt }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.status).toBe('OK');
    expect(json.equipmentCode).toBe('2026');
    expect(json.operatorRegistration).toBe('01');
    expect(json.hourmeterStart).toBe(0.15);
    expect(json.startedAt).toBe(startedAt);

    // SHIFT_START event captures the full enriched payload.
    expect(saveEvent).toHaveBeenCalled();
    const evt = saveEvent.mock.calls[0][0];
    expect(evt.type).toBe('SHIFT_START');
    expect(evt.timestamp).toBe(startedAt);
    expect(evt.payload).toMatchObject({
      equipmentId: 'pbzr0u9vl',
      equipmentCode: '2026',
      operatorId: 'op-x',
      operatorRegistration: '01',
      hourmeterStart: 0.15,
      startedAt,
    });
    expect(evt.payload.shiftId).toBeDefined();

    // hourmeter seeded into live-state.
    const live = updateLiveState.mock.calls[0][3];
    expect(live.hourmeterStart).toBe(0.15);
    expect(live.hourmeterCurrent).toBe(0.15);
  });

  test('5. lookup por equipmentId / fleetCode / equipmentCode', async () => {
    equipamentosStore = [activeEquip()];
    operadoresStore = [activeOperator()];
    for (const payload of [
      { equipmentId: 'pbzr0u9vl' },
      { fleetCode: '2026' },
      { equipmentCode: '2026' },
    ]) {
      const res = await POST(makeReq({ ...payload, operatorRegistration: '01' }));
      expect(res.status).toBe(200);
    }
  });

  test('5b. mobileToken NAO exigido mesmo quando cadastro define um', async () => {
    equipamentosStore = [activeEquip({ mobileToken: 'SECRET' })];
    operadoresStore = [activeOperator()];
    // body without mobileToken -> still authorised via X-Company-Token only
    const res = await POST(makeReq({ equipmentCode: '2026', operatorRegistration: '01' }));
    expect(res.status).toBe(200);
  });

  test('6. operador inexistente -> 404', async () => {
    equipamentosStore = [activeEquip()];
    operadoresStore = [];
    const res = await POST(makeReq({ equipmentCode: '2026', operatorRegistration: '99' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Operador nao encontrado');
  });

  test('7. operador inativo -> 403', async () => {
    equipamentosStore = [activeEquip()];
    operadoresStore = [activeOperator({ status: 'INATIVO' })];
    const res = await POST(makeReq({ equipmentCode: '2026', operatorRegistration: '01' }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Operador inativo');
  });

  test('8. operador nao informado -> 404 Operador nao encontrado', async () => {
    equipamentosStore = [activeEquip()];
    const res = await POST(makeReq({ equipmentCode: '2026' }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Operador nao encontrado');
  });

  test('8b. operador aceito via matricula', async () => {
    equipamentosStore = [activeEquip()];
    operadoresStore = [activeOperator({ registration: '', matricula: '01' })];
    const res = await POST(makeReq({ equipmentCode: '2026', matricula: '01' }));
    expect(res.status).toBe(200);
  });

  test('8c. operador aceito via operatorId direto', async () => {
    equipamentosStore = [activeEquip()];
    operadoresStore = [activeOperator({ id: 'op-77', registration: '' })];
    const res = await POST(makeReq({ equipmentCode: '2026', operatorId: 'op-77' }));
    expect(res.status).toBe(200);
    expect((await res.json()).operatorId).toBe('op-77');
  });

  test('9. cross-tenant: mesma code, tenant diferente -> 404', async () => {
    equipamentosStore = [activeEquip({ tenantId: 'tenant-b' })];
    operadoresStore = [activeOperator()];
    const res = await POST(makeReq({ equipmentCode: '2026', operatorRegistration: '01' }));
    expect(res.status).toBe(404);
  });

  test('10. auth falha -> resposta do guard', async () => {
    mockMobileAuth = { ok: false, status: 401, response: 'X-Company-Token is required' };
    const res = await POST(makeReq({ equipmentCode: '2026', operatorRegistration: '01' }));
    expect(res.status).toBe(401);
  });

  test('11. cenario SG01 / equipamento 2026 / operador 01 (contrato novo)', async () => {
    mockMobileAuth = { ok: true, tenantId: 'sg01-1781359594113' };
    equipamentosStore = [activeEquip({ tenantId: 'sg01-1781359594113', mobileEnabled: true })];
    operadoresStore = [activeOperator({ tenantId: 'sg01-1781359594113', registration: '01' })];

    const res = await POST(
      makeReq({ equipmentCode: '2026', operatorRegistration: '01', hourmeterStart: 0.15, startedAt: '2026-06-14T10:00:00.000Z' }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe('OK');
  });

  test('12. fallback legado equipments.json', async () => {
    legacyStore = [
      {
        id: 'leg-1',
        code: 'L99',
        tenantId: 'tenant-a',
        entityStatus: 'ATIVO',
        status: 'ATIVO',
        mobileEnabled: true,
      },
    ];
    operadoresStore = [activeOperator()];
    const res = await POST(makeReq({ equipmentCode: 'L99', operatorRegistration: '01' }));
    expect(res.status).toBe(200);
  });
  test('13. contrato legado: equipmentId + mobileToken=company-token + operatorId -> 200 (token nao rejeitado)', async () => {
    equipamentosStore = [activeEquip({ mobileToken: 'EQUIP-SECRET' })];
    operadoresStore = [activeOperator({ id: '34ueo7r30', registration: '01' })];
    const res = await POST(
      makeReq({
        equipmentId: 'pbzr0u9vl',
        mobileToken: 'COMPANY-TOKEN-VALUE',
        operatorId: '34ueo7r30',
        startTimestamp: '2026-06-14T10:00:00.000Z',
      }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.operatorId).toBe('34ueo7r30');
  });
});
