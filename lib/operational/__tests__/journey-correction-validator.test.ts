import { buildCorrectionJourneyKey, getJourneyStartDateTimeForCorrection, normalizeJourneyForCorrection, parseCorrectionDateTime, resolveJourneyStartForCorrection, validateManualJourneyEnd as validate } from '../journey-correction-validator';
const base = { startedAt: '2026-07-12T10:00:00Z', endedAt: '2026-07-12T12:00:00Z', reason: 'Correção administrativa', hourmeterStart: 10 };
test('rejeita motivo ausente', () => expect(validate({ ...base, reason: '' }).ok).toBe(false));
test('rejeita fim anterior', () => expect(validate({ ...base, endedAt: '2026-07-12T09:00:00Z' }).ok).toBe(false));
test('aceita encerramento válido', () => expect(validate({ ...base, hourmeterEnd: 12 })).toMatchObject({ ok: true, hourmeterEnd: 12 }));
test('rejeita horímetro final menor', () => expect(validate({ ...base, hourmeterEnd: 9 }).ok).toBe(false));
test('aceita horímetro final vazio', () => expect(validate({ ...base, hourmeterEnd: '' })).toMatchObject({ ok: true, hourmeterEnd: null }));
test('aceita vírgula decimal', () => expect(validate({ ...base, hourmeterEnd: '10,5' })).toMatchObject({ ok: true, hourmeterEnd: 10.5 }));
test('rejeita horímetro não numérico', () => expect(validate({ ...base, hourmeterEnd: 'abc' }).ok).toBe(false));
test.each([
  '2026-07-12T13:23:00.000Z',
  '2026-07-12T13:23',
  '12/07/2026 13:23',
  '12/07/26 13:23',
])('aceita data/hora %s', endedAt => expect(validate({ ...base, endedAt }).ok).toBe(true));
test('rejeita horário brasileiro anterior ao início', () => expect(validate({ ...base, startedAt: '12/07/2026 03:31', endedAt: '12/07/2026 02:00' }).ok).toBe(false));
test.each(['', '31/02/2026 13:23', 'data quebrada'])('rejeita data/hora inválida %p', value => expect(parseCorrectionDateTime(value)).toBeNull());
test('aceita horímetro 10.3 com inicial 10.0', () => expect(validate({ ...base, hourmeterStart: 10, hourmeterEnd: 10.3 }).ok).toBe(true));
test('resolve início pelo label de jornada com ID', () => expect(validate({ ...base, startedAt: { label: 'd9a8acce-774f-4124-81b8-a4002a2b9786 - 12/07/26, 04:04' }, endedAt: '12/07/2026 17:00' }).ok).toBe(true));
test('resolve início pelo label de jornada sem ID', () => expect(validate({ ...base, startedAt: { label: 'Sem ID - 12/07/26, 03:31' }, endedAt: '12/07/2026 17:00' }).ok).toBe(true));
test('prioriza startedAt ISO técnico', () => expect(validate({ ...base, startedAt: { startedAt: '2026-07-12T04:04:00.000Z', label: 'inválido' }, endedAt: '12/07/2026 17:00' }).ok).toBe(true));
test('rejeita início realmente ausente', () => expect(validate({ ...base, startedAt: {} })).toEqual({ ok: false, error: 'Início da jornada inválido. Reabra a ficha e tente novamente.' }));
test('helper rejeita label sem data', () => expect(getJourneyStartDateTimeForCorrection({ label: 'Sem ID - Início ausente' })).toBeNull());
test('aceita jornada com ID e startedAtForCorrection ISO', () => expect(validate({ ...base, startedAt: { journeyId: 'd9a8acce-774f-4124-81b8-a4002a2b9786', startedAtForCorrection: '2026-07-12T07:04:00.000Z' }, endedAt: '13/07/2026 17:22' }).ok).toBe(true));
test('aceita jornada sem ID e startedAtForCorrection ISO', () => expect(validate({ ...base, startedAt: { journeyId: null, startedAtForCorrection: '2026-07-12T06:31:00.000Z' }, endedAt: '13/07/2026 17:22' }).ok).toBe(true));
test('resolve label quando campo técnico está ausente', () => expect(validate({ ...base, startedAt: { label: '12/07/26, 04:04' }, endedAt: '13/07/2026 17:22' }).ok).toBe(true));
test('aceita encerramento posterior no dia seguinte', () => expect(validate({ ...base, startedAt: { startedAtForCorrection: '2026-07-12T04:04:00.000Z' }, endedAt: '13/07/2026 17:22' }).ok).toBe(true));
test('rejeita encerramento anterior ao início técnico', () => expect(validate({ ...base, startedAt: { startedAtForCorrection: '2026-07-12T17:22:00.000Z' }, endedAt: '12/07/2026 04:04' }).ok).toBe(false));
test('resolve label com UUID e texto após a data', () => expect(resolveJourneyStartForCorrection({ label: 'd9a8acce-774f-4124-81b8-a4002a2b9786 - 12/07/26, 04:04 · aberta' })).not.toBeNull());
test('resolve label com ano completo', () => expect(resolveJourneyStartForCorrection({ label: 'd9a8acce-774f - 12/07/2026 04:04' })).not.toBeNull());
test('resolve campo display por regex', () => expect(resolveJourneyStartForCorrection({ display: 'Sem ID - 12/07/26, 03:31' })).not.toBeNull());
test('normalização preserva objeto completo com ID', () => expect(normalizeJourneyForCorrection({ journeyId: 'uuid-com-hifens', label: 'uuid-com-hifens - 12/07/26, 04:04', hourmeterStart: 10 })).toMatchObject({ journeyId: 'uuid-com-hifens', hourmeterStart: 10, startedAtForCorrection: expect.any(String) }));
test('normalização preserva objeto completo sem ID', () => expect(normalizeJourneyForCorrection({ journeyId: null, label: 'Sem ID - 12/07/26, 03:31', hourmeterStart: 10 })).toMatchObject({ journeyId: null, hourmeterStart: 10, startedAtForCorrection: expect.any(String) }));
test('chave seleciona jornada correta', () => { const journeys = [{ journeyId: 'a', startedAtForCorrection: '2026-07-12T04:04:00Z' }, { journeyId: 'b', startedAtForCorrection: '2026-07-12T05:04:00Z' }]; const key = buildCorrectionJourneyKey(journeys[1], 1); expect(journeys.find((journey, index) => buildCorrectionJourneyKey(journey, index) === key)).toBe(journeys[1]); });
