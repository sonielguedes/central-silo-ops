import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/api-guard', () => ({ requireTenant: jest.fn(() => ({ ok: true, tenantId: 'tenant-a' })) }));
jest.mock('@/lib/auth/rbac-server', () => ({ requirePermission: jest.fn(() => null) }));
jest.mock('@/lib/daily-sheet-builder', () => ({ buildDailySheet: jest.fn(), buildDailySheetList: jest.fn(), calculateTotalHours: jest.fn(() => null) }));
jest.mock('@/lib/ficha-store', () => ({
  FichaStore: { get: jest.fn(() => null), validate: jest.fn(() => ({ validated: true })) },
  deriveFichaStatus: jest.fn(),
  getEffectiveBlockingInconsistencies: jest.fn(),
}));

import { buildDailySheet } from '@/lib/daily-sheet-builder';
import { deriveFichaStatus, FichaStore, getEffectiveBlockingInconsistencies } from '@/lib/ficha-store';
import { PATCH } from '../route';

const build = buildDailySheet as jest.MockedFunction<typeof buildDailySheet>;
const status = deriveFichaStatus as jest.MockedFunction<typeof deriveFichaStatus>;
const blocking = getEffectiveBlockingInconsistencies as jest.MockedFunction<typeof getEffectiveBlockingInconsistencies>;
const ficha = { fleetCode: '2026', date: '2026-07-12', journeys: [], inconsistencies: [], status: 'PENDENTE', isDayOpen: false, hourmeterStart: null, hourmeterEnd: null };

function request(body: unknown) {
  return new NextRequest('http://localhost/api/ficha-operador', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

beforeEach(() => {
  jest.clearAllMocks();
  build.mockReturnValue({ ok: true, ficha: ficha as never });
  status.mockReturnValue('PENDENTE');
  blocking.mockReturnValue([]);
});

test('contrato de validação válido retorna sucesso', async () => {
  const response = await PATCH(request({ action: 'validate', fleetCode: '2026', date: '2026-07-12', actor: 'SONIEL' }));
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ ok: true });
  expect(FichaStore.validate).toHaveBeenCalledWith('tenant-a', '2026', '2026-07-12', 'SONIEL');
});

test('payload incompleto retorna erro claro', async () => { const response = await PATCH(request({ action: 'validate' })); expect(response.status).toBe(400); await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_VALIDATION_PAYLOAD' }); });
test('jornada em andamento retorna código claro', async () => { status.mockReturnValue('EM_ANDAMENTO'); const response = await PATCH(request({ action: 'validate', fleetCode: '2026', date: '2026-07-12' })); expect(response.status).toBe(422); await expect(response.json()).resolves.toMatchObject({ code: 'JOURNEY_IN_PROGRESS' }); });
test('inconsistência crítica retorna código e lista', async () => { blocking.mockReturnValue(['OPERADOR_NAO_IDENTIFICADO']); const response = await PATCH(request({ action: 'validate', fleetCode: '2026', date: '2026-07-12' })); expect(response.status).toBe(422); await expect(response.json()).resolves.toMatchObject({ code: 'BLOCKING_INCONSISTENCIES', blocking: ['OPERADOR_NAO_IDENTIFICADO'] }); });
test('ficha inexistente não cria validação fantasma', async () => { build.mockReturnValue({ ok: false, status: 404, error: 'Ficha não encontrada' }); const response = await PATCH(request({ action: 'validate', fleetCode: '2026', date: '2026-07-12' })); expect(response.status).toBe(404); await expect(response.json()).resolves.toMatchObject({ code: 'SHEET_NOT_FOUND' }); expect(FichaStore.validate).not.toHaveBeenCalled(); });
