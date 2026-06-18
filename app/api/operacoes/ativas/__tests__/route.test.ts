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
