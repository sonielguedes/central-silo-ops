import { parseCorrectionDateTime, validateManualJourneyEnd as validate } from '../journey-correction-validator';
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
