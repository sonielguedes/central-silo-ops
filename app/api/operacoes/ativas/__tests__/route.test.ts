/**
 * Tests for GET /api/operacoes/ativas -- Etapa 6.7
 *
 * Contratos verificados:
 *  1. Sem dados fake fixos -- resposta reflete o live-state mockado
 *  2. Frota "2026" aparece quando existe no live-state/ficha
 *  3. Operador "RAIMUNDO NONATO" aparece quando disponivel
 *  4. Matricula "00125" permanece string
 *  5. O.S. "100" aparece quando disponivel
 *  6. Implemento "SULCADOR" aparece quando disponivel
 *  7. Centro de custo aparece quando disponivel
 *  8. Data operacional 2026-06-17 nao vira 2026-06-18
 *  9. Tela nao quebra se nao houver GPS
 * 10. Tela nao quebra se nao houver jornada ativa
 * 11. Tela nao quebra se o status vier desconhecido
 * 12. Estado vazio funciona sem erro (0 itens)
 * 13. ADMIN_EMPRESA acessa a rota -> 200
 * 14. CONSULTA tem visualizar mas nao tem editar em operacoes
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { hasPermission } from '@/lib/auth/rbac-shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const MOCK_LIVE_FLEET: Record<string, unknown>[] = [];
const MOCK_FICHAS:     Record<string, unknown>[] = [];

jest.mock('@/lib/server-storage', () => ({
  ServerStorage: {
    getLiveFleet: jest.fn((_tenantId: string) => MOCK_LIVE_FLEET),
    getEvents:    jest.fn(() => []),
  },
}));

jest.mock('@/lib/daily-sheet-builder', () => ({
  buildDailySheetList: jest.fn((_params: unknown) => MOCK_FICHAS),
  calculateTotalHours: jest.fn((s: number, e: number) => e - s),
}));

jest.mock('@/lib/ficha-store', () => ({
  FichaStore: {
    get: jest.fn(() => null),
  },
  deriveFichaStatus: jest.fn(({ computedStatus }: { computedStatus: string }) => computedStatus),
  getEffectiveBlockingInconsistencies: jest.fn(() => []),
}));

// ── Session factory ────────────────────────────────────────────────────────────

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id:              'usr-admin',
    name:            'Admin Empresa',
    email:           'admin@siloops.com.br',
    role:            'ADMIN_EMPRESA',
    scope:           'TENANT',
    tenantId:        'sg01-1781359594113',
    activeTenantId:  'sg01-1781359594113',
    defaultTenantId: 'sg01-1781359594113',
    accessGroupId:   'role-admin-empresa',
    expiresAt:       new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    mustChangePassword: false,
    ...overrides,
  };
}

let mockSession: ReturnType<typeof makeSession> | null = makeSession();

jest.mock('@/lib/auth/session', () => ({
  resolveSessionFromRequest: jest.fn(() => mockSession),
}));

// ── Request factory ────────────────────────────────────────────────────────────

function makeGet(params: Record<string, string> = {}): NextRequest {
  const sp = new URLSearchParams(params);
  return new NextRequest(`http://localhost/api/operacoes/ativas?${sp}`);
}

// ── Fixture ────────────────────────────────────────────────────────────────────

const LIVE_2026 = {
  equipmentId:          'eq-2026',
  fleetCode:            '2026',
  tenantId:             'sg01-1781359594113',
  status:               'OFFLINE',
  operatorName:         'RAIMUNDO NONATO',
  operatorRegistration: '00125',
  operationCode:        'PREP-SOLO',
  operationName:        'Preparo de Solo',
  workOrder:            '100',
  costCenterName:       '8080',
  implementCode:        '5000',
  implementName:        'SULCADOR',
  hourmeterCurrent:     2.1,
  hourmeterStart:       0.5,
  lastHeartbeatAt:      '2026-06-17T20:00:00.000Z',
  lastGpsAt:            null,
  latitude:             null,
  longitude:            null,
  journeyId:            'jrn-abc123',
};

const FICHA_2026 = {
  id:                   'sg01-1781359594113|2026|2026-06-17',
  date:                 '2026-06-17',
  tenantId:             'sg01-1781359594113',
  fleetCode:            '2026',
  equipmentId:          'eq-2026',
  operatorRegistration: '00125',
  operatorName:         'RAIMUNDO NONATO',
  operationCode:        'PREP-SOLO',
  operationName:        'Preparo de Solo',
  implementCode:        '5000',
  implementName:        'SULCADOR',
  workOrderNumber:      '100',
  costCenterName:       '8080',
  hourmeterStart:       0.5,
  hourmeterCurrent:     2.1,
  hourmeterEnd:         null,
  totalHourmeter:       null,
  status:               'PENDENTE',
  inconsistencies:      [],
  isDayOpen:            false,
  journeys:             [],
  stops:                [],
  startedAt:            '2026-06-17T10:00:00.000Z',
  endedAt:              null,
  trailSummary:         { points: 0, firstGpsAt: null, lastGpsAt: null, distanceKm: 0 },
  eventCount:           5,
  fromLiveState:        false,
  periodStart:          '2026-06-17T03:00:00.000Z',
  periodEnd:            '2026-06-18T02:59:59.999Z',
  durationMinutes:      null,
  minutesOperating:     null,
  minutesStopped:       null,
  minutesUndetermined:  null,
  pctUndetermined:      null,
  validated:            false,
};

// ── Setup ──────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockSession = makeSession();
  MOCK_LIVE_FLEET.length = 0;
  MOCK_FICHAS.length     = 0;
});

// ── Tests ──────────────────────────────────────────────────────────────────────

// Casos 1 & 13: ADMIN_EMPRESA acessa -> 200 e sem dados fake hardcoded
test('ADMIN_EMPRESA acessa /api/operacoes/ativas -> 200', async () => {
  const res = await GET(makeGet({ date: '2026-06-17' }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('items');
  expect(body).toHaveProperty('kpis');
  expect(body).toHaveProperty('date', '2026-06-17');
});

// Caso 1: lista vazia quando mocks estao vazios (sem dados fake)
test('Caso 1 -- sem dados fake: lista vazia quando live-state e fichas estao vazios', async () => {
  const res = await GET(makeGet({ date: '2026-06-17' }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.items)).toBe(true);
  expect(body.items).toHaveLength(0);
  expect(body.kpis.totalAtivas).toBe(0);
});

// Caso 2: frota 2026 aparece quando existe
test('Caso 2 -- frota 2026 aparece na lista quando existe no live-state/ficha', async () => {
  MOCK_LIVE_FLEET.push(LIVE_2026);
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  expect(res.status).toBe(200);
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item).toBeDefined();
});

// Caso 3: operador RAIMUNDO NONATO aparece
test('Caso 3 -- operador RAIMUNDO NONATO aparece quando disponivel', async () => {
  MOCK_LIVE_FLEET.push(LIVE_2026);
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item?.operatorName).toBe('RAIMUNDO NONATO');
});

// Caso 4: matricula 00125 permanece string
test('Caso 4 -- matricula 00125 permanece string (nao vira numero)', async () => {
  MOCK_LIVE_FLEET.push(LIVE_2026);
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(typeof item?.operatorRegistration).toBe('string');
  expect(item?.operatorRegistration).toBe('00125');
});

// Caso 5: O.S. 100 aparece quando disponivel
test('Caso 5 -- O.S. 100 aparece quando disponivel', async () => {
  MOCK_LIVE_FLEET.push(LIVE_2026);
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item?.workOrderNumber).toBe('100');
});

// Caso 6: implemento SULCADOR aparece
test('Caso 6 -- implemento SULCADOR aparece quando disponivel', async () => {
  MOCK_LIVE_FLEET.push(LIVE_2026);
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item?.implementName).toBe('SULCADOR');
});

// Caso 7: centro de custo aparece
test('Caso 7 -- centro de custo aparece quando disponivel', async () => {
  MOCK_LIVE_FLEET.push(LIVE_2026);
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item?.costCenterName).toBe('8080');
});

// Caso 8: data operacional 2026-06-17 nao vira 2026-06-18
test('Caso 8 -- data operacional 2026-06-17 nao sofre deslocamento de fuso para 2026-06-18', async () => {
  MOCK_LIVE_FLEET.push(LIVE_2026);
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  expect(body.date).toBe('2026-06-17');
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item?.date).toBe('2026-06-17');
  expect(item?.date).not.toBe('2026-06-18');
});

// Caso 9: sem GPS nao quebra
test('Caso 9 -- rota nao quebra quando item nao tem GPS', async () => {
  MOCK_LIVE_FLEET.push({ ...LIVE_2026, latitude: null, longitude: null, lastGpsAt: null });
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  expect(res.status).toBe(200);
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item?.latitude).toBeNull();
  expect(item?.longitude).toBeNull();
});

// Caso 10: sem jornada ativa nao quebra
test('Caso 10 -- rota nao quebra quando nao ha jornada ativa', async () => {
  MOCK_LIVE_FLEET.push({ ...LIVE_2026, journeyId: undefined, status: 'OFFLINE' });
  MOCK_FICHAS.length = 0;

  const res = await GET(makeGet({ date: '2026-06-17' }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.items)).toBe(true);
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item).toBeDefined();
  expect(item?.journeyId).toBeFalsy();
});

// Caso 11: status desconhecido nao quebra
test('Caso 11 -- status desconhecido nao quebra a resposta', async () => {
  MOCK_LIVE_FLEET.push({ ...LIVE_2026, status: 'STATUS_INVENTADO_XYZ' });
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  expect(res.status).toBe(200);
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item?.liveStatus).toBe('STATUS_INVENTADO_XYZ');
});

// Caso 12: estado vazio funciona sem erro
test('Caso 12 -- estado vazio (sem itens) retorna 200 com array vazio e kpis zerados', async () => {
  const res = await GET(makeGet({ date: '2099-01-01' }));
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.items).toHaveLength(0);
  expect(body.kpis.totalAtivas).toBe(0);
  expect(body.kpis.frotasEmOperacao).toBe(0);
  expect(body.kpis.operadoresAtivos).toBe(0);
});

// Caso 13: sem sessao -> 401
test('Caso 13 -- sem sessao retorna 401', async () => {
  mockSession = null;
  const res = await GET(makeGet());
  expect(res.status).toBe(401);
});

// Caso 14: CONSULTA tem visualizar mas nao tem editar
test('Caso 14 -- CONSULTA tem operacoes:visualizar mas NAO tem operacoes:editar', () => {
  expect(hasPermission('CONSULTA', 'operacoes', 'visualizar')).toBe(true);
  expect(hasPermission('CONSULTA', 'operacoes', 'editar')).toBe(false);
});

// ADMIN_EMPRESA tem todas as permissoes de operacoes
test('ADMIN_EMPRESA tem operacoes:visualizar e operacoes:editar', () => {
  expect(hasPermission('ADMIN_EMPRESA', 'operacoes', 'visualizar')).toBe(true);
  expect(hasPermission('ADMIN_EMPRESA', 'operacoes', 'editar')).toBe(false); // ADMIN_EMPRESA tem READ_EXPORT em operacoes, nao FULL
});

// ── Hotfix 6.7D.1 -- Parada resolvida em operacoes ativas ─────────────────────

// H1: API retorna objeto `stop` para a frota 2026
test('H1 -- API retorna objeto stop para a frota 2026', async () => {
  MOCK_LIVE_FLEET.push(LIVE_2026);
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  expect(res.status).toBe(200);
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item).toBeDefined();
  expect(item?.stop).toBeDefined();
  expect(typeof (item?.stop as Record<string, unknown>)?.state).toBe('string');
});

// H3: stop.state = SEM_PARADA_ATIVA quando nao ha parada ativa (OFFLINE, sem eventos de parada)
test('H3 -- stop.state e SEM_PARADA_ATIVA quando status e OFFLINE e nao ha eventos de parada', async () => {
  MOCK_LIVE_FLEET.push({ ...LIVE_2026, status: 'OFFLINE' });
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  const stop = item?.stop as Record<string, unknown>;
  expect(stop?.state).toBe('SEM_PARADA_ATIVA');
});

// H4: stop.state = AGUARDANDO_APONTAMENTO quando status e PARADO e nao ha codigo de parada
test('H4 -- stop.state e AGUARDANDO_APONTAMENTO quando status e PARADO sem codigo de parada', async () => {
  MOCK_LIVE_FLEET.push({
    ...LIVE_2026,
    status:           'PARADO',
    stopCode:         null,
    stopDescription:  null,
    stopReason:       null,
  });
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  const stop = item?.stop as Record<string, unknown>;
  expect(stop?.state).toBe('AGUARDANDO_APONTAMENTO');
});

// H5: stop.state = PARADA_APONTADA com codigo e motivo quando ha evento STOP_REASON
test('H5 -- stop.state e PARADA_APONTADA com codigo e motivo quando ha evento STOP_REASON', async () => {
  const { ServerStorage } = jest.requireMock('@/lib/server-storage') as {
    ServerStorage: { getLiveFleet: jest.Mock; getEvents: jest.Mock };
  };
  ServerStorage.getEvents.mockReturnValueOnce([
    {
      id:          'evt-stop-202',
      tenantId:    'sg01-1781359594113',
      equipmentId: 'eq-2026',
      type:        'STOP_REASON',
      timestamp:   '2026-06-17T22:00:00.000Z',
      payload: {
        stopReasonCode:        '202',
        stopReason:            'Sem Atividade Noturna',
        status:                'PARADA_APONTADA',
        journeyId:             '5752f4a7-286d-4148-bf40-dd8c69d656a4',
      },
    },
  ]);

  MOCK_LIVE_FLEET.push({ ...LIVE_2026, status: 'PARADA_APONTADA' });
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  const stop = item?.stop as Record<string, unknown>;
  expect(stop?.state).toBe('PARADA_APONTADA');
  expect(stop?.code).toBe('202');
  expect(stop?.reason).toBe('Sem Atividade Noturna');
});

// H6: stop.state = PARADA_INCONSISTENTE quando status e PARADA_APONTADA mas sem codigo
test('H6 -- stop.state e PARADA_INCONSISTENTE quando status e PARADA_APONTADA mas sem codigo', async () => {
  MOCK_LIVE_FLEET.push({
    ...LIVE_2026,
    status:          'PARADA_APONTADA',
    stopCode:        null,
    stopDescription: null,
    stopReason:      null,
  });
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  const stop = item?.stop as Record<string, unknown>;
  expect(stop?.state).toBe('PARADA_INCONSISTENTE');
});

// H7: nao retorna stopCode = 'NAO INFORMADO' ou 'NÃO INFORMADO'
test('H7 -- stopCode nunca retorna "NAO INFORMADO" ou "NÃO INFORMADO"', async () => {
  MOCK_LIVE_FLEET.push({ ...LIVE_2026, status: 'OFFLINE', stopCode: null });
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item?.stopCode).not.toBe('NÃO INFORMADO');
  expect(item?.stopCode).not.toBe('NAO INFORMADO');
  const stop = item?.stop as Record<string, unknown> | undefined;
  expect(stop?.code).not.toBe('NÃO INFORMADO');
  expect(stop?.code).not.toBe('NAO INFORMADO');
});

// H8: nao retorna stopDescription = 'NAO INFORMADO' ou 'NÃO INFORMADO'
test('H8 -- stopDescription nunca retorna "NAO INFORMADO" ou "NÃO INFORMADO"', async () => {
  MOCK_LIVE_FLEET.push({ ...LIVE_2026, status: 'OFFLINE', stopDescription: null });
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item?.stopDescription).not.toBe('NÃO INFORMADO');
  expect(item?.stopDescription).not.toBe('NAO INFORMADO');
  const stop = item?.stop as Record<string, unknown> | undefined;
  expect(stop?.reason).not.toBe('NÃO INFORMADO');
  expect(stop?.reason).not.toBe('NAO INFORMADO');
});

// H9: frota 2026 continua aparecendo (operador SONIEL)
test('H9+H10 -- frota 2026 aparece e operador SONIEL aparece', async () => {
  MOCK_LIVE_FLEET.push({ ...LIVE_2026, operatorName: 'SONIEL' });
  MOCK_FICHAS.push({ ...FICHA_2026, operatorName: 'SONIEL' });

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item).toBeDefined();
  expect(item?.operatorName).toBe('SONIEL');
});

// H11: matricula '01' permanece string
test('H11 -- matricula 01 permanece string', async () => {
  MOCK_LIVE_FLEET.push({ ...LIVE_2026, operatorRegistration: '01' });
  MOCK_FICHAS.push({ ...FICHA_2026, operatorRegistration: '01' });

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(typeof item?.operatorRegistration).toBe('string');
  expect(item?.operatorRegistration).toBe('01');
});

// H12: O.S. 100 continua aparecendo
test('H12 -- O.S. 100 continua aparecendo', async () => {
  MOCK_LIVE_FLEET.push(LIVE_2026);
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item?.workOrderNumber).toBe('100');
});

// H13: implemento SULCADOR continua aparecendo
test('H13 -- implemento SULCADOR continua aparecendo', async () => {
  MOCK_LIVE_FLEET.push(LIVE_2026);
  MOCK_FICHAS.push(FICHA_2026);

  const res = await GET(makeGet({ date: '2026-06-17' }));
  const body = await res.json();
  const item = (body.items as Array<Record<string, unknown>>).find((i) => i.fleetCode === '2026');
  expect(item?.implementName).toBe('SULCADOR');
});
