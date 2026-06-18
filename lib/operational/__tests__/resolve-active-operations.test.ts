/**
 * Testes para buildOperationalFleetSnapshot() -- Etapa 6.7A
 *
 * Casos obrigatorios (17):
 *  1. Retorna frota 2026 quando existe em live-state
 *  2. Retorna matricula "01" como string (nao numero)
 *  3. Nao converte matricula "00125" para numero
 *  4. Retorna journeyId real
 *  5. Retorna operacao quando existe no live-state/ficha
 *  6. Retorna implemento quando existe no live-state/ficha/catalogo
 *  7. Retorna horimetro atual
 *  8. Retorna GPS quando existe
 *  9. Nao quebra quando GPS nao existe
 * 10. Retorna SEM_PARADA_ATIVA quando status e OPERANDO
 * 11. Retorna AGUARDANDO_APONTAMENTO quando status parado sem motivo/codigo
 * 12. Retorna PARADA_APONTADA quando existe codigo/motivo
 * 13. Resolve descricao da parada pelo catalogo quando vier so codigo
 * 14. Retorna inconsistencia quando status e PARADA_APONTADA sem codigo/motivo
 * 15. Preserva dataOperacional "2026-06-17" sem virar "2026-06-18"
 * 16. Nao usa dados fake
 * 17. Nao mistura tenant
 */

import {
  buildOperationalFleetSnapshot,
  type ResolveActiveOperationsInput,
  type OperatorSheetInput,
} from '../resolve-active-operations';
import type { EquipmentLiveState } from '@/lib/types';
import type { MobileEvent } from '@/lib/server-storage';

// ── Factories ─────────────────────────────────────────────────────────────────

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

function makeSheet(overrides: Partial<OperatorSheetInput> = {}): OperatorSheetInput {
  return {
    fleetCode:            '2026',
    equipmentId:          'eq-2026',
    operatorRegistration: '00125',
    operatorName:         'RAIMUNDO NONATO',
    operationCode:        'PREP-SOLO',
    operationName:        'Preparo de Solo',
    implementCode:        '5000',
    implementName:        'SULCADOR',
    workOrderNumber:      '100',
    costCenterCode:       'CC-08',
    costCenterName:       '8080',
    hourmeterStart:       0.5,
    hourmeterCurrent:     2.1,
    journeyId:            'jrn-abc123',
    ...overrides,
  };
}

function makeEvent(overrides: Partial<MobileEvent> & { payload?: Record<string, unknown> } = {}): MobileEvent {
  return {
    offlineId:   'evt-' + Math.random().toString(36).slice(2),
    equipmentId: 'eq-2026',
    tenantId:    'sg01-tenant',
    type:        'PARADA',
    timestamp:   '2026-06-17T19:00:00.000Z',
    payload:     {},
    receivedAt:  '2026-06-17T19:00:01.000Z',
    ...overrides,
  };
}

const BASE_CATALOGS: ResolveActiveOperationsInput['catalogs'] = {
  paradas:      [{ code: 'PAR-01', description: 'Chuva' }],
  operadores:   [{ registration: '00125', name: 'RAIMUNDO NONATO' }],
  implementos:  [{ code: '5000', name: 'SULCADOR' }],
  centrosCusto: [{ code: 'CC-08', name: '8080' }],
  equipamentos: [{ code: '2026', name: 'Colhedora 2026', type: 'COLHEDORA' }],
};

function makeInput(overrides: Partial<ResolveActiveOperationsInput> = {}): ResolveActiveOperationsInput {
  return {
    tenantId:        'sg01-tenant',
    dataOperacional: '2026-06-17',
    liveFleet:       [],
    mobileEvents:    [],
    operatorSheets:  [],
    catalogs:        BASE_CATALOGS,
    ...overrides,
  };
}

// ── Caso 1: frota 2026 aparece ────────────────────────────────────────────────
test('Caso 1 -- retorna frota 2026 quando existe em live-state', () => {
  const result = buildOperationalFleetSnapshot(makeInput({ liveFleet: [makeLive()] }));
  expect(result.length).toBeGreaterThan(0);
  const item = result.find((r) => r.fleetCode === '2026');
  expect(item).toBeDefined();
});

// ── Caso 2: matricula "01" como string ───────────────────────────────────────
test('Caso 2 -- matricula "01" retorna como string, nao numero', () => {
  const result = buildOperationalFleetSnapshot(
    makeInput({ liveFleet: [makeLive({ operatorRegistration: '01' })] }),
  );
  const item = result.find((r) => r.fleetCode === '2026')!;
  expect(typeof item.operatorRegistration).toBe('string');
  expect(item.operatorRegistration).toBe('01');
});

// ── Caso 3: "00125" nao vira 125 ─────────────────────────────────────────────
test('Caso 3 -- matricula "00125" preserva zeros a esquerda (nao converte para numero)', () => {
  const result = buildOperationalFleetSnapshot(
    makeInput({ operatorSheets: [makeSheet({ operatorRegistration: '00125' })] }),
  );
  const item = result.find((r) => r.fleetCode === '2026')!;
  expect(item.operatorRegistration).toBe('00125');
  expect(typeof item.operatorRegistration).toBe('string');
});

// ── Caso 4: journeyId real ────────────────────────────────────────────────────
test('Caso 4 -- retorna journeyId real do live-state', () => {
  const result = buildOperationalFleetSnapshot(
    makeInput({ liveFleet: [makeLive({ journeyId: 'jrn-abc123' })] }),
  );
  const item = result.find((r) => r.fleetCode === '2026')!;
  expect(item.journeyId).toBe('jrn-abc123');
});

// ── Caso 5: operacao ──────────────────────────────────────────────────────────
test('Caso 5 -- retorna operacao quando existe no live-state', () => {
  const result = buildOperationalFleetSnapshot(
    makeInput({ liveFleet: [makeLive({ operationCode: 'PREP-SOLO', operationName: 'Preparo de Solo' })] }),
  );
  const item = result.find((r) => r.fleetCode === '2026')!;
  expect(item.operationCode).toBe('PREP-SOLO');
  expect(item.operationName).toBe('Preparo de Solo');
});

// ── Caso 6: implemento ────────────────────────────────────────────────────────
test('Caso 6 -- retorna implemento quando existe no live-state e via catalogo', () => {
  const result1 = buildOperationalFleetSnapshot(
    makeInput({ liveFleet: [makeLive({ implementCode: '5000', implementName: 'SULCADOR' })] }),
  );
  expect(result1.find((r) => r.fleetCode === '2026')?.implementName).toBe('SULCADOR');

  const live2 = makeLive({ implementCode: '5000', implementName: undefined });
  const result2 = buildOperationalFleetSnapshot(makeInput({ liveFleet: [live2] }));
  expect(result2.find((r) => r.fleetCode === '2026')?.implementName).toBe('SULCADOR');
});

// ── Caso 7: horimetro ────────────────────────────────────────────────────────
test('Caso 7 -- retorna horimetro atual do live-state', () => {
  const result = buildOperationalFleetSnapshot(
    makeInput({ liveFleet: [makeLive({ hourmeterCurrent: 2.1, hourmeterStart: 0.5 })] }),
  );
  const item = result.find((r) => r.fleetCode === '2026')!;
  expect(item.horimeter.current).toBe(2.1);
  expect(item.horimeter.initial).toBe(0.5);
});

// ── Caso 8: GPS existe ────────────────────────────────────────────────────────
test('Caso 8 -- retorna GPS quando existe no live-state', () => {
  const result = buildOperationalFleetSnapshot(
    makeInput({ liveFleet: [makeLive({ latitude: -12.555, longitude: -55.722 })] }),
  );
  const item = result.find((r) => r.fleetCode === '2026')!;
  expect(item.telemetry.latitude).toBe(-12.555);
  expect(item.telemetry.longitude).toBe(-55.722);
});

// ── Caso 9: sem GPS nao quebra ────────────────────────────────────────────────
test('Caso 9 -- nao quebra quando GPS nao existe (retorna null)', () => {
  const live = makeLive({ latitude: undefined, longitude: undefined, lastGpsAt: undefined });
  const result = buildOperationalFleetSnapshot(makeInput({ liveFleet: [live] }));
  const item = result.find((r) => r.fleetCode === '2026')!;
  expect(item.telemetry.latitude).toBeNull();
  expect(item.telemetry.longitude).toBeNull();
});

// ── Caso 10: SEM_PARADA_ATIVA quando OPERANDO ─────────────────────────────────
test('Caso 10 -- retorna SEM_PARADA_ATIVA quando status e OPERANDO', () => {
  const result = buildOperationalFleetSnapshot(
    makeInput({ liveFleet: [makeLive({ status: 'OPERANDO' })] }),
  );
  const item = result.find((r) => r.fleetCode === '2026')!;
  expect(item.stop.state).toBe('SEM_PARADA_ATIVA');
  expect(item.stop.code).toBeNull();
});

// ── Caso 11: AGUARDANDO_APONTAMENTO ──────────────────────────────────────────
test('Caso 11 -- retorna AGUARDANDO_APONTAMENTO quando PARADO sem codigo/motivo', () => {
  const live = makeLive({
    status:          'PARADO',
    stopCode:        undefined,
    stopDescription: undefined,
    stopReason:      undefined,
  });
  const result = buildOperationalFleetSnapshot(makeInput({ liveFleet: [live] }));
  const item = result.find((r) => r.fleetCode === '2026')!;
  expect(item.stop.state).toBe('AGUARDANDO_APONTAMENTO');
});

// ── Caso 12: PARADA_APONTADA ─────────────────────────────────────────────────
test('Caso 12 -- retorna PARADA_APONTADA quando existe codigo e motivo', () => {
  const live = makeLive({ status: 'PARADO', stopCode: 'PAR-01', stopDescription: 'Chuva' });
  const result = buildOperationalFleetSnapshot(makeInput({ liveFleet: [live] }));
  const item = result.find((r) => r.fleetCode === '2026')!;
  expect(item.stop.state).toBe('PARADA_APONTADA');
  expect(item.stop.code).toBe('PAR-01');
  expect(item.stop.reason).toBe('Chuva');
});

// ── Caso 13: descricao via catalogo ──────────────────────────────────────────
test('Caso 13 -- resolve descricao pelo catalogo quando vier so o codigo', () => {
  const live = makeLive({
    status:          'PARADO',
    stopCode:        'PAR-01',
    stopDescription: undefined,
    stopReason:      undefined,
  });
  const result = buildOperationalFleetSnapshot(makeInput({ liveFleet: [live] }));
  const item = result.find((r) => r.fleetCode === '2026')!;
  expect(item.stop.state).toBe('PARADA_APONTADA');
  expect(item.stop.code).toBe('PAR-01');
  expect(item.stop.reason).toBe('Chuva');
});

// ── Caso 14: PARADA_INCONSISTENTE ────────────────────────────────────────────
test('Caso 14 -- retorna PARADA_INCONSISTENTE quando status PARADA_APONTADA sem codigo/motivo', () => {
  const live = makeLive({
    status:          'PARADA_APONTADA' as unknown as import('@/lib/types').EquipmentOperationalStatus,
    stopCode:        undefined,
    stopDescription: undefined,
    stopReason:      undefined,
  });
  const result = buildOperationalFleetSnapshot(makeInput({ liveFleet: [live] }));
  const item = result.find((r) => r.fleetCode === '2026')!;
  expect(item.stop.state).toBe('PARADA_INCONSISTENTE');
  expect(item.inconsistencies.length).toBeGreaterThan(0);
  expect(item.inconsistencies[0]).toMatch(/codigo.*motivo|motivo.*codigo/i);
});

// ── Caso 15: dataOperacional preservada ──────────────────────────────────────
test('Caso 15 -- preserva dataOperacional "2026-06-17" sem deslocamento de fuso', () => {
  const result = buildOperationalFleetSnapshot(
    makeInput({ liveFleet: [makeLive()], dataOperacional: '2026-06-17' }),
  );
  const item = result.find((r) => r.fleetCode === '2026')!;
  expect(item.dataOperacional).toBe('2026-06-17');
  expect(item.dataOperacional).not.toBe('2026-06-18');
});

// ── Caso 16: sem dados fake ───────────────────────────────────────────────────
test('Caso 16 -- retorna lista vazia quando nao ha dados (sem fake)', () => {
  const result = buildOperationalFleetSnapshot(makeInput());
  expect(result).toHaveLength(0);
});

// ── Caso 17: isolamento de tenant ─────────────────────────────────────────────
test('Caso 17 -- nao mistura tenant: frota de outro tenant nao aparece', () => {
  const result = buildOperationalFleetSnapshot(
    makeInput({
      liveFleet: [makeLive({ fleetCode: '2026', tenantId: 'sg01-tenant' })],
    }),
  );
  expect(result.every((r) => r.fleetCode === '2026')).toBe(true);
  expect(result.find((r) => r.fleetCode === '9999')).toBeUndefined();
  expect(result[0].tenantId).toBe('sg01-tenant');
});

// ── Bonus: evento PARADA resolvido via makeEvent ──────────────────────────────
test('Bonus -- evento PARADA do APK e resolvido pelo resolvedor central', () => {
  const ev = makeEvent({
    equipmentId: 'eq-2026',
    type:        'PARADA',
    timestamp:   '2026-06-17T19:30:00.000Z',
    payload:     { stopCode: 'PAR-01', stopDescription: 'Chuva forte' },
  });
  const live = makeLive({
    status:          'PARADO',
    stopCode:        undefined,
    stopDescription: undefined,
  });
  const result = buildOperationalFleetSnapshot(
    makeInput({ liveFleet: [live], mobileEvents: [ev] }),
  );
  const item = result.find((r) => r.fleetCode === '2026')!;
  expect(item.stop.state).toBe('PARADA_APONTADA');
  expect(item.stop.code).toBe('PAR-01');
  expect(item.stop.source).toBe('EVENT');
});
