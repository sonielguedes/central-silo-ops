import { validateManualJourneyEnd as validate } from '../journey-correction-validator';
const base = { startedAt: '2026-07-12T10:00:00Z', endedAt: '2026-07-12T12:00:00Z', reason: 'Correção administrativa', hourmeterStart: 10 };
test('rejeita motivo ausente', () => expect(validate({ ...base, reason: '' }).ok).toBe(false));
test('rejeita fim anterior', () => expect(validate({ ...base, endedAt: '2026-07-12T09:00:00Z' }).ok).toBe(false));
test('aceita encerramento válido', () => expect(validate({ ...base, hourmeterEnd: 12 })).toMatchObject({ ok: true, hourmeterEnd: 12 }));
test('rejeita horímetro final menor', () => expect(validate({ ...base, hourmeterEnd: 9 }).ok).toBe(false));
test('aceita horímetro final vazio', () => expect(validate({ ...base, hourmeterEnd: '' })).toMatchObject({ ok: true, hourmeterEnd: null }));
test('aceita vírgula decimal', () => expect(validate({ ...base, hourmeterEnd: '10,5' })).toMatchObject({ ok: true, hourmeterEnd: 10.5 }));
test('rejeita horímetro não numérico', () => expect(validate({ ...base, hourmeterEnd: 'abc' }).ok).toBe(false));
