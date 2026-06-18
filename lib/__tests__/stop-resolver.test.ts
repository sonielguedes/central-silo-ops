/**
 * Testes de resolveStop() -- Adendo de Paradas
 *
 * Casos obrigatorios (12):
 *  1. Evento PARADA com stopCode + stopDescription -> usa dados do evento
 *  2. Evento PARADA com stopCode apenas -> catalogo enriquece descricao
 *  3. Evento PARADA com stopCode, codigo sem catalogo -> code preenchido, desc null
 *  4. Evento PARADA com d.code (nao d.stopCode) -> ainda resolve
 *  5. Live-state com stopCode + stopDescription -> usa live-state
 *  6. Live-state com stopCode apenas -> catalogo enriquece descricao
 *  7. Live-state com stopCode, sem catalogo -> code preenchido, desc null
 *  8. Sem nenhum dado de parada -> { code: null, description: null, source: 'NONE' }
 *  9. Evento mais recente vence live-state (prioridade)
 * 10. Dois eventos -> usa o mais recente (por timestamp)
 * 11. Maquina PARADO sem stopCode/stopDescription no live-state -> NONE
 * 12. Evento com stopReason (variante de nome) -> desc resolvida
 */

import { resolveStop } from '../stop-resolver';
import type { EquipmentLiveState } from '@/lib/types';
import type { MobileEvent } from '@/lib/server-storage';
import type { StopCatalogEntry } from '../stop-resolver';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CATALOG: StopCatalogEntry[] = [
  { code: 'PAR-01', description: 'Chuva' },
  { code: 'PAR-02', description: 'Manutencao preventiva' },
];

function makeMachine(overrides: Partial<EquipmentLiveState> = {}): EquipmentLiveState {
  return {
    equipmentId:      'eq-001',
    fleetCode:        '2026',
    tenantId:         'sg01-tenant',
    status:           'PARADO',
    updatedAt:        '2026-06-17T20:00:00.000Z',
    ...overrides,
  } as EquipmentLiveState;
}

function makeEvent(overrides: Partial<MobileEvent> & { payload?: Record<string, unknown> } = {}): MobileEvent {
  return {
    offlineId:   'evt-' + Math.random().toString(36).slice(2),
    equipmentId: 'eq-001',
    tenantId:    'sg01-tenant',
    type:        'PARADA',
    timestamp:   '2026-06-17T19:00:00.000Z',
    payload:     {},
    receivedAt:  '2026-06-17T19:00:01.000Z',
    ...overrides,
  };
}

// ── Caso 1: evento com stopCode + stopDescription ─────────────────────────────
test('Caso 1 -- evento PARADA com stopCode + stopDescription usa dados do evento', () => {
  const machine = makeMachine();
  const events  = [makeEvent({ payload: { stopCode: 'PAR-01', stopDescription: 'Chuva forte' } })];

  const result = resolveStop(machine, events, CATALOG);

  expect(result.source).toBe('EVENT');
  expect(result.code).toBe('PAR-01');
  expect(result.description).toBe('Chuva forte');
});

// ── Caso 2: evento com stopCode apenas -> catalogo enriquece ──────────────────
test('Caso 2 -- evento PARADA com stopCode apenas: catalogo enriquece descricao', () => {
  const machine = makeMachine();
  const events  = [makeEvent({ payload: { stopCode: 'PAR-01' } })];

  const result = resolveStop(machine, events, CATALOG);

  expect(result.source).toBe('EVENT');
  expect(result.code).toBe('PAR-01');
  expect(result.description).toBe('Chuva');
});

// ── Caso 3: evento stopCode sem entrada no catalogo ───────────────────────────
test('Caso 3 -- evento com stopCode sem catalogo: code preenchido, desc null', () => {
  const machine = makeMachine();
  const events  = [makeEvent({ payload: { stopCode: 'PAR-99' } })];

  const result = resolveStop(machine, events, CATALOG);

  expect(result.source).toBe('EVENT');
  expect(result.code).toBe('PAR-99');
  expect(result.description).toBeNull();
});

// ── Caso 4: evento com d.code (variante sem stopCode) ────────────────────────
test('Caso 4 -- evento com payload.code (nao payload.stopCode) ainda resolve', () => {
  const machine = makeMachine();
  const events  = [makeEvent({ payload: { code: 'PAR-02' } })];

  const result = resolveStop(machine, events, CATALOG);

  expect(result.source).toBe('EVENT');
  expect(result.code).toBe('PAR-02');
  expect(result.description).toBe('Manutencao preventiva');
});

// ── Caso 5: live-state com stopCode + stopDescription ────────────────────────
test('Caso 5 -- live-state com stopCode + stopDescription usa live-state', () => {
  const machine = makeMachine({ stopCode: 'PAR-01', stopDescription: 'Chuva' });
  const events: MobileEvent[] = [];

  const result = resolveStop(machine, events, CATALOG);

  expect(result.source).toBe('LIVE_STATE');
  expect(result.code).toBe('PAR-01');
  expect(result.description).toBe('Chuva');
});

// ── Caso 6: live-state stopCode apenas -> catalogo enriquece ─────────────────
test('Caso 6 -- live-state com stopCode apenas: catalogo enriquece descricao', () => {
  const machine = makeMachine({ stopCode: 'PAR-02' });
  const events: MobileEvent[] = [];

  const result = resolveStop(machine, events, CATALOG);

  expect(result.source).toBe('LIVE_STATE');
  expect(result.code).toBe('PAR-02');
  expect(result.description).toBe('Manutencao preventiva');
});

// ── Caso 7: live-state stopCode sem catalogo ──────────────────────────────────
test('Caso 7 -- live-state com stopCode sem catalogo: code preenchido, desc null', () => {
  const machine = makeMachine({ stopCode: 'PAR-99' });
  const events: MobileEvent[] = [];

  const result = resolveStop(machine, events, []);

  expect(result.source).toBe('LIVE_STATE');
  expect(result.code).toBe('PAR-99');
  expect(result.description).toBeNull();
});

// ── Caso 8: sem nenhum dado de parada ────────────────────────────────────────
test('Caso 8 -- sem dados de parada: source NONE e campos null', () => {
  const machine = makeMachine({ status: 'OPERANDO' });
  const events: MobileEvent[] = [];

  const result = resolveStop(machine, events, CATALOG);

  expect(result.source).toBe('NONE');
  expect(result.code).toBeNull();
  expect(result.description).toBeNull();
});

// ── Caso 9: evento vence live-state (prioridade) ──────────────────────────────
test('Caso 9 -- evento PARADA mais recente vence live-state na prioridade', () => {
  const machine = makeMachine({ stopCode: 'PAR-01', stopDescription: 'Chuva (live)' });
  const events  = [
    makeEvent({
      timestamp: '2026-06-17T19:30:00.000Z',
      payload:   { stopCode: 'PAR-02', stopDescription: 'Manutencao (evento)' },
    }),
  ];

  const result = resolveStop(machine, events, CATALOG);

  expect(result.source).toBe('EVENT');
  expect(result.code).toBe('PAR-02');
  expect(result.description).toBe('Manutencao (evento)');
});

// ── Caso 10: multiplos eventos -> mais recente vence ─────────────────────────
test('Caso 10 -- com multiplos eventos PARADA usa o mais recente (maior timestamp)', () => {
  const machine = makeMachine();
  const events  = [
    makeEvent({
      timestamp: '2026-06-17T18:00:00.000Z',
      payload:   { stopCode: 'PAR-01', stopDescription: 'Evento antigo' },
    }),
    makeEvent({
      timestamp: '2026-06-17T20:00:00.000Z',
      payload:   { stopCode: 'PAR-02', stopDescription: 'Evento recente' },
    }),
    makeEvent({
      timestamp: '2026-06-17T17:00:00.000Z',
      payload:   { stopCode: 'PAR-01', stopDescription: 'Evento mais antigo' },
    }),
  ];

  const result = resolveStop(machine, events, CATALOG);

  expect(result.source).toBe('EVENT');
  expect(result.description).toBe('Evento recente');
  expect(result.code).toBe('PAR-02');
});

// ── Caso 11: maquina PARADO sem campos de stop no live-state ──────────────────
test('Caso 11 -- maquina PARADO sem stopCode/stopDescription no live-state retorna NONE', () => {
  const machine = makeMachine({ status: 'PARADO', stopCode: undefined, stopDescription: undefined, stopReason: undefined });
  const events: MobileEvent[] = [];

  const result = resolveStop(machine, events, CATALOG);

  expect(result.source).toBe('NONE');
  expect(result.code).toBeNull();
  expect(result.description).toBeNull();
});

// ── Caso 12: evento com stopReason (variante de nome) ────────────────────────
test('Caso 12 -- evento com payload.stopReason (variante) resolve descricao', () => {
  const machine = makeMachine();
  const events  = [
    makeEvent({ payload: { stopCode: 'PAR-01', stopReason: 'Chuva via stopReason' } }),
  ];

  const result = resolveStop(machine, events, CATALOG);

  expect(result.source).toBe('EVENT');
  expect(result.code).toBe('PAR-01');
  expect(result.description).toBe('Chuva via stopReason');
});
