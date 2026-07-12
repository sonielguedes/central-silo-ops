import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/api-guard', () => ({ requireTenant: jest.fn(() => ({ ok: true, tenantId: 'tenant-a' })) }));
jest.mock('@/lib/auth/rbac-server', () => ({ requirePermission: jest.fn(() => null) }));
jest.mock('@/lib/auth/session', () => ({ resolveSessionFromRequest: jest.fn(() => ({ id: 'user-1', name: 'SONIEL' })) }));
jest.mock('@/lib/operator-sheet-builder', () => ({ buildOperatorSheet: jest.fn() }));
jest.mock('@/lib/server-storage', () => ({ ServerStorage: { saveEvent: jest.fn() } }));
jest.mock('@/lib/ficha-store', () => ({ FichaStore: { applyMultiCorrection: jest.fn() } }));

import { buildOperatorSheet } from '@/lib/operator-sheet-builder';
import { ServerStorage } from '@/lib/server-storage';
import { POST } from '../route';

const build = buildOperatorSheet as jest.MockedFunction<typeof buildOperatorSheet>;
const baseFicha = { journeyId: 'journey-1', equipmentId: 'eq-1', fleetCode: '2026', startedAt: null, startedAtForCorrection: '2026-07-12T07:04:00.000Z', endedAt: null, hourmeterStart: 10 };

function request(body: unknown) {
  return new NextRequest('http://localhost/api/operacional/fichas/journey-1/correcoes/encerrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

async function post(body: unknown, journeyId = 'journey-1') {
  return POST(request(body), { params: { journeyId } });
}

beforeEach(() => {
  jest.clearAllMocks();
  build.mockReturnValue({ ok: true, ficha: baseFicha as never });
});

test('payload válido registra MANUAL_JOURNEY_END', async () => {
  const response = await post({ endedAt: '2026-07-12T21:16:00.000Z', hourmeterEnd: 10.3, reason: 'Jornada esquecida aberta.', fleetCode: '2026' });
  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toMatchObject({ success: true });
  expect(ServerStorage.saveEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'MANUAL_JOURNEY_END', payload: expect.objectContaining({ source: 'CENTRAL_ADMIN' }) }), 'tenant-a');
});

test('motivo ausente retorna MISSING_REASON', async () => { const response = await post({ endedAt: '2026-07-12T21:16:00.000Z', reason: '' }); expect(response.status).toBe(400); await expect(response.json()).resolves.toMatchObject({ code: 'MISSING_REASON' }); });
test('endedAt inválido retorna INVALID_ENDED_AT', async () => { const response = await post({ endedAt: 'quebrado', reason: 'Motivo válido' }); expect(response.status).toBe(400); await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_ENDED_AT' }); });
test('endedAt anterior retorna ENDED_AT_BEFORE_START', async () => { const response = await post({ endedAt: '2026-07-12T06:00:00.000Z', reason: 'Motivo válido' }); expect(response.status).toBe(400); await expect(response.json()).resolves.toMatchObject({ code: 'ENDED_AT_BEFORE_START' }); });
test('horímetro menor retorna INVALID_HOURMETER', async () => { const response = await post({ endedAt: '2026-07-12T21:16:00.000Z', hourmeterEnd: 9, reason: 'Motivo válido' }); expect(response.status).toBe(400); await expect(response.json()).resolves.toMatchObject({ code: 'INVALID_HOURMETER' }); });
test('journey inexistente usa fallback por frota', async () => { build.mockReturnValueOnce({ ok: false, status: 404, error: 'não encontrada' }).mockReturnValueOnce({ ok: true, ficha: baseFicha as never }); const response = await post({ endedAt: '2026-07-12T21:16:00.000Z', reason: 'Motivo válido', fleetCode: '2026' }, 'inexistente'); expect(response.status).toBe(200); expect(build).toHaveBeenLastCalledWith({ tenantId: 'tenant-a', journeyId: null, fleetCode: '2026' }); });
test('journey inexistente retorna erro claro', async () => { build.mockReturnValue({ ok: false, status: 404, error: 'não encontrada' }); const response = await post({ endedAt: '2026-07-12T21:16:00.000Z', reason: 'Motivo válido' }, 'inexistente'); expect(response.status).toBe(404); await expect(response.json()).resolves.toMatchObject({ code: 'JOURNEY_NOT_FOUND' }); });
test('journey encerrada retorna 409', async () => { build.mockReturnValue({ ok: true, ficha: { ...baseFicha, endedAt: '2026-07-12T20:00:00.000Z' } as never }); const response = await post({ endedAt: '2026-07-12T21:16:00.000Z', reason: 'Motivo válido' }); expect(response.status).toBe(409); await expect(response.json()).resolves.toMatchObject({ code: 'JOURNEY_ALREADY_CLOSED' }); });
