import { buildFichaIntegrationJobInput } from '@/lib/integrations/ficha-integration';

let mockSheetResult: any;
let mockOverlay: any;

jest.mock('@/lib/daily-sheet-builder', () => ({
  buildDailySheet: jest.fn(() => mockSheetResult),
  calculateTotalHours: jest.requireActual('@/lib/daily-sheet-builder').calculateTotalHours,
}));

jest.mock('@/lib/ficha-store', () => ({
  FichaStore: {
    get: jest.fn(() => mockOverlay),
  },
  deriveFichaStatus: jest.fn(({ computedStatus, overlay }: any) => {
    if (overlay?.exported) return 'EXPORTADO';
    if (overlay?.validated) return 'VALIDADO';
    return computedStatus;
  }),
  getEffectiveBlockingInconsistencies: jest.fn(() => []),
}));

beforeEach(() => {
  mockSheetResult = {
    ok: true,
    ficha: {
      id: 'tenant-a|2026|2026-06-17',
      date: '2026-06-17',
      periodStart: '2026-06-17T03:00:00.000Z',
      periodEnd: '2026-06-18T02:59:59.999Z',
      tenantId: 'tenant-a',
      fleetCode: '2026',
      equipmentId: 'eq-2026',
      operatorRegistration: '00125',
      operatorName: 'RAIMUNDO NONATO',
      operationCode: 'OP-PLANTIO',
      operationName: 'PLANTIO',
      implementCode: 'SULC',
      implementName: 'SULCADOR',
      workOrderNumber: '100',
      costCenterName: 'PLANTIO',
      hourmeterStart: 0.5,
      hourmeterCurrent: 0.7,
      hourmeterEnd: 1.6,
      totalHourmeter: 1.1,
      durationMinutes: 30,
      minutesOperating: 20,
      minutesStopped: 10,
      minutesUndetermined: 0,
      pctUndetermined: 0,
      startedAt: '2026-06-17T10:00:00.000Z',
      endedAt: '2026-06-17T11:00:00.000Z',
      journeys: [],
      stops: [],
      trailSummary: { points: 1, firstGpsAt: '2026-06-17T10:00:00.000Z', lastGpsAt: '2026-06-17T10:05:00.000Z', distanceKm: 0.1 },
      status: 'PENDENTE',
      inconsistencies: [],
      validated: false,
      eventCount: 2,
      isDayOpen: false,
    },
  };
  mockOverlay = { validated: true, validatedBy: 'usuario', validatedAt: '2026-06-17T11:10:00.000Z', exported: false, correctedFields: {} };
});

test('gera payload validado e limpa centro de custo quando vem da operacao', () => {
  const built = buildFichaIntegrationJobInput({
    tenantId: 'tenant-a',
    fleetCode: '2026',
    date: '2026-06-17',
    targetSystem: 'PIMS',
    targetAdapter: 'PIMS_FILE',
  });

  expect(built.ok).toBe(true);
  expect(built.finalStatus).toBe('VALIDADO');
  expect(built.payload?.centroCusto).toBeNull();
  expect(built.payload?.horimetroFinal).toBe(1.6);
  expect(built.payload?.statusFicha).toBe('VALIDADO');
  expect(built.payloadHash).toEqual(expect.any(String));
});

test('bloqueia ficha em andamento', () => {
  mockOverlay = { validated: false, exported: false, correctedFields: {} };
  mockSheetResult.ficha.status = 'EM_ANDAMENTO';
  const built = buildFichaIntegrationJobInput({
    tenantId: 'tenant-a',
    fleetCode: '2026',
    date: '2026-06-17',
  });

  expect(built.ok).toBe(false);
  expect(built.status).toBe(422);
  expect(built.error).toMatch(/andamento/i);
});
