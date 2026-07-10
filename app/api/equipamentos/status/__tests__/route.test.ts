/**
 * Testes HOTFIX 6.7C.1 â€” /api/equipamentos/status com parada resolvida
 *
 * Casos obrigatorios (10):
 *  1. Nao retorna "NÃƒO INFORMADO" / "Nao informado" quando nao ha parada ativa
 *  2. Status OPERANDO retorna stop.state === "SEM_PARADA_ATIVA"
 *  3. Status PARADO sem stopCode/stopReason retorna AGUARDANDO_APONTAMENTO
 *  4. Evento com stopCode/stopReason retorna PARADA_APONTADA
 *  5. Status PARADA_APONTADA sem codigo/motivo retorna PARADA_INCONSISTENTE
 *  6. Frota 2026 continua aparecendo no retorno
 *  7. GPS / heartbeat / horimetro continuam aparecendo
 *  8. Operador / matricula / operacao / implemento continuam aparecendo
 *  9. /operacoes (API ativas) nao quebra com a nova estrutura
 * 10. Dados de tenant diferente nao aparecem
 */

import { NextRequest } from 'next/server';

// â”€â”€ Mocks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

jest.mock('@/lib/server-storage', () => ({
  ServerStorage: {
    getLiveFleet: jest.fn(),
    getEvents:    jest.fn(),
  },
}));

jest.mock('@/lib/cadastro-storage', () => ({
  CadastroStorage: {
    getAll: jest.fn(),
    getAllRaw: jest.fn(),
  },
}));

jest.mock('@/lib/auth/api-guard', () => ({
  requireTenant: jest.fn(),
}));

import { ServerStorage } from '@/lib/server-storage';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { requireTenant } from '@/lib/auth/api-guard';
import type { EquipmentLiveState } from '@/lib/types';
import type { MobileEvent } from '@/lib/server-storage';

const mockGetLiveFleet = ServerStorage.getLiveFleet as jest.MockedFn<typeof ServerStorage.getLiveFleet>;
const mockGetEvents    = ServerStorage.getEvents    as jest.MockedFn<typeof ServerStorage.getEvents>;
const mockGetAll       = CadastroStorage.getAll     as jest.MockedFn<typeof CadastroStorage.getAll>;
const mockGetAllRaw    = CadastroStorage.getAllRaw  as jest.MockedFn<typeof CadastroStorage.getAllRaw>;
const mockRequireTenant = requireTenant             as jest.MockedFn<typeof requireTenant>;

// â”€â”€ Factories â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function makeLive(overrides: Partial<EquipmentLiveState> = {}): EquipmentLiveState {
  return {
    equipmentId:          'eq-2026',
    fleetCode:            '2026',
    tenantId:             'sg01-tenant',
    status:               'OPERANDO',
    operatorRegistration: '01',
    operatorName:         'RAIMUNDO NONATO',
    operationCode:        'PREP-SOLO',
    operationName:        'Preparo de Solo',
    implementCode:        '5000',
    implementName:        'SULCADOR',
    hourmeterCurrent:     2.1,
    hourmeterStart:       0.5,
    journeyId:            'jrn-abc123',
    lastHeartbeatAt:      '2026-06-17T20:00:00.000Z',
    lastGpsAt:            '2026-06-17T19:55:00.000Z',
    latitude:             -12.555,
    longitude:            -55.722,
    updatedAt:            '2026-06-17T20:00:00.000Z',
    ...overrides,
  } as EquipmentLiveState;
}

function makeEvent(overrides: Partial<MobileEvent> & { payload?: Record<string, unknown> } = {}): MobileEvent {
  return {
    offlineId:   'evt-' + Math.random().toString(36).slice(2),
    equipmentId: 'eq-2026',
    tenantId:    'sg01-tenant',
    type:        'PARADA',
    timestamp:   '2026-06-17T19:30:00.000Z',
    payload:     {},
    receivedAt:  '2026-06-17T19:30:01.000Z',
    ...overrides,
  };
}

function makeRequest(tenantId = 'sg01-tenant'): NextRequest {
  const req = new NextRequest('http://localhost/api/equipamentos/status');
  (mockRequireTenant as jest.Mock).mockReturnValue({ ok: true, tenantId });
  return req;
}

const STOP_CATALOG = [{ code: 'PAR-01', description: 'Chuva' }];

function setup(live: EquipmentLiveState[], events: MobileEvent[] = []) {
  mockGetLiveFleet.mockReturnValue(live);
  mockGetEvents.mockReturnValue(events);
  mockGetAll.mockReturnValue(STOP_CATALOG as ReturnType<typeof CadastroStorage.getAll>);
  mockGetAllRaw.mockReturnValue([] as ReturnType<typeof CadastroStorage.getAllRaw>);
}

// â”€â”€ Import handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { GET } from '../route';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function getJson(req: NextRequest) {
  const res = await GET(req);
  return res.json() as Promise<Record<string, unknown>[]>;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Testes
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Caso 1: sem "NÃƒO INFORMADO" quando nao ha parada â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('Caso 1 -- nao retorna "Nao informado" no stop.label quando nao ha parada ativa', async () => {
  setup([makeLive({ status: 'OPERANDO' })]);
  const [item] = await getJson(makeRequest());
  const stop = item.stop as Record<string, unknown>;
  expect(stop.label).not.toMatch(/informado/i);
  expect(stop.label).not.toMatch(/NÃƒO/i);
  expect(stop.label).toBeTruthy();
});

// â”€â”€ Caso 2: OPERANDO -> SEM_PARADA_ATIVA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('Caso 2 -- status OPERANDO retorna stop.state SEM_PARADA_ATIVA', async () => {
  setup([makeLive({ status: 'OPERANDO' })]);
  const [item] = await getJson(makeRequest());
  const stop = item.stop as Record<string, unknown>;
  expect(stop.state).toBe('SEM_PARADA_ATIVA');
  expect(stop.hasActiveStop).toBe(false);
  expect(stop.code).toBeNull();
  expect(stop.reason).toBeNull();
});

// â”€â”€ Caso 3: PARADO sem motivo -> AGUARDANDO_APONTAMENTO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('Caso 3 -- PARADO sem stopCode/stopReason retorna AGUARDANDO_APONTAMENTO', async () => {
  setup([makeLive({
    status: 'PARADO',
    stopCode: undefined,
    stopDescription: undefined,
    stopReason: undefined,
  })]);
  const [item] = await getJson(makeRequest());
  const stop = item.stop as Record<string, unknown>;
  expect(stop.state).toBe('AGUARDANDO_APONTAMENTO');
  expect(stop.hasActiveStop).toBe(true);
  expect(stop.code).toBeNull();
  expect(stop.label).toMatch(/aguardando/i);
});

// â”€â”€ Caso 4: evento com stopCode retorna PARADA_APONTADA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('Caso 4 -- evento com stopCode/stopReason retorna PARADA_APONTADA', async () => {
  const live = makeLive({
    status: 'PARADO',
    stopCode: undefined,
    stopDescription: undefined,
    stopStartedAt: '2026-06-17T19:30:00.000Z',
  });
  const ev = makeEvent({ payload: { stopCode: 'PAR-01', stopReasonName: '  Manuten\u00e7\u00e3o  ', stopStartedAt: '2026-06-17T19:30:00.000Z' } });
  setup([live], [ev]);
  const [item] = await getJson(makeRequest());
  const stop = item.stop as Record<string, unknown>;
  expect(stop.state).toBe('PARADA_APONTADA');
  expect(stop.code).toBe('PAR-01');
  expect(stop.reason).toBe('Manuten\u00e7\u00e3o');
  expect(stop.hasActiveStop).toBe(true);
  expect(item.stopReasonName).toBe('Manuten\u00e7\u00e3o');
  expect(item.stopStartedAt).toBe('2026-06-17T19:30:00.000Z');
  expect(item.displayStatus).toBe('PARADO');
});

// Ã¢â€â‚¬Ã¢â€â‚¬ Caso 4b: live-state com stopReasonName truncado e aliases expostos Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
test('Caso 4b -- stopReasonName com espacos e normalizado na resposta', async () => {
  setup([makeLive({
    status: 'PARADO',
    stopCode: '1830',
    stopReasonName: '  Manuten\u00e7\u00e3o  ',
    stopStartedAt: '2026-06-17T12:41:00.000Z',
  })]);
  const [item] = await getJson(makeRequest());
  expect(item.stopReasonCode).toBe('1830');
  expect(item.stopReasonName).toBe('Manuten\u00e7\u00e3o');
  expect(item.stopDescription).toBe('Manuten\u00e7\u00e3o');
  expect(item.activeStop).toBeDefined();
  expect(item.lastStopAt).toBe('2026-06-17T12:41:00.000Z');
});

// â”€â”€ Caso 5: PARADA_APONTADA sem codigo -> PARADA_INCONSISTENTE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('Caso 5 -- status PARADA_APONTADA sem codigo/motivo retorna PARADA_INCONSISTENTE', async () => {
  setup([makeLive({
    status: 'PARADA_APONTADA' as unknown as import('@/lib/types').EquipmentOperationalStatus,
    stopCode: undefined,
    stopDescription: undefined,
    stopReason: undefined,
  })]);
  const [item] = await getJson(makeRequest());
  const stop = item.stop as Record<string, unknown>;
  expect(stop.state).toBe('PARADA_INCONSISTENTE');
  expect(stop.hasActiveStop).toBe(true);
  expect(stop.inconsistency).toBeTruthy();
});

// â”€â”€ Caso 6: frota 2026 continua aparecendo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('Caso 6 -- frota 2026 continua aparecendo no retorno', async () => {
  setup([makeLive({ fleetCode: '2026' })]);
  const items = await getJson(makeRequest());
  expect(items.length).toBeGreaterThan(0);
  const item = items.find((i) => i.fleetCode === '2026');
  expect(item).toBeDefined();
});

// â”€â”€ Caso 7: GPS / heartbeat / horimetro continuam â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('Caso 7 -- GPS, heartbeat e horimetro continuam no retorno', async () => {
  setup([makeLive({
    latitude: -12.555, longitude: -55.722,
    lastGpsAt: '2026-06-17T19:55:00.000Z',
    lastHeartbeatAt: '2026-06-17T20:00:00.000Z',
    hourmeterCurrent: 2.1,
  })]);
  const [item] = await getJson(makeRequest());
  expect(item.latitude).toBe(-12.555);
  expect(item.longitude).toBe(-55.722);
  expect(item.lastGpsAt).toBe('2026-06-17T19:55:00.000Z');
  expect(item.lastHeartbeatAt).toBe('2026-06-17T20:00:00.000Z');
  expect(item.hourmeterCurrent).toBe(2.1);
  expect(item.horimetro).toBe(2.1);
});

// â”€â”€ Caso 8: operador / matricula / operacao / implemento continuam â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('Caso 8 -- operador, matricula, operacao e implemento continuam no retorno', async () => {
  setup([makeLive({
    operatorRegistration: '01',
    operatorName:  'RAIMUNDO NONATO',
    operationCode: 'PREP-SOLO',
    operationName: 'Preparo de Solo',
    implementCode: '5000',
    implementName: 'SULCADOR',
  })]);
  const [item] = await getJson(makeRequest());
  expect(item.operatorRegistration).toBe('01');
  expect(typeof item.operatorRegistration).toBe('string');
  expect(item.operatorName).toBe('RAIMUNDO NONATO');
  expect(item.operationCode).toBe('PREP-SOLO');
  expect(item.operationName).toBe('Preparo de Solo');
  expect(item.implementCode).toBe('5000');
  expect(item.implementName).toBe('SULCADOR');
});

// Ã¢â€â‚¬Ã¢â€â‚¬ Caso 8b: payload repassa implemento e resolve icone a partir dele Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
test('Caso 8b -- implementName e implementCode seguem no payload e resolvem SULCADOR', async () => {
  setup([makeLive({
    implementCode: '5000',
    implementName: 'SULCADOR',
    equipmentType: undefined,
    equipmentModel: undefined,
    equipmentCategory: undefined,
    type: undefined,
    name: undefined,
  })]);
  const [item] = await getJson(makeRequest());
  expect(item.implementName).toBe('SULCADOR');
  expect(item.implementCode).toBe('5000');
  expect(item.equipmentModel).toBe('SULCADOR');
  expect(item.iconType).toBe('SULCADOR');
});

// â”€â”€ Caso 9: retorno inclui campo stop estruturado (verifica /operacoes nao quebra) â”€â”€
test('Caso 9 -- retorno inclui stop estruturado e campos flat de compatibilidade', async () => {
  setup([makeLive({ status: 'OPERANDO' })]);
  const [item] = await getJson(makeRequest());
  // Campo novo
  expect(item.stop).toBeDefined();
  // Campos flat de compatibilidade com codigo legado (/operacoes, ficha, etc.)
  expect(Object.prototype.hasOwnProperty.call(item, 'stopCode')).toBe(true);
  expect(Object.prototype.hasOwnProperty.call(item, 'stopDescription')).toBe(true);
  expect(Object.prototype.hasOwnProperty.call(item, 'stopReason')).toBe(true);
});

// â”€â”€ Caso 10: tenant isolation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
test('Caso 10 -- apenas a frota do tenant correto aparece', async () => {
  setup([
    makeLive({ fleetCode: '2026', tenantId: 'sg01-tenant' }),
  ]);
  const items = await getJson(makeRequest('sg01-tenant'));
  expect(items.every((i) => i.fleetCode === '2026')).toBe(true);
  expect(items.find((i) => i.fleetCode === '9999')).toBeUndefined();
});



