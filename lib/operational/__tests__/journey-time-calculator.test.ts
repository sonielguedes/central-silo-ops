import { calculateJourneyTimes } from '../journey-time-calculator';

const at = (hour: string) => `2026-01-01T${hour}:00.000Z`;
const event = (type: string, hour: string, payload?: Record<string, unknown>) => ({ type, occurredAt: at(hour), payload });
const HOUR = 3_600_000;

describe('calculateJourneyTimes', () => {
  test('jornada simples sem parada', () => {
    const result = calculateJourneyTimes({ events: [event('JOURNEY_START', '08:00'), event('JOURNEY_END', '17:00')] });
    expect(result).toMatchObject({ totalMs: 9 * HOUR, stoppedMs: 0, workingMs: 9 * HOUR });
  });
  test('uma parada', () => {
    const result = calculateJourneyTimes({ events: [event('JOURNEY_START', '08:00'), event('STOP_STARTED', '10:00'), event('STOP_ENDED', '10:30'), event('JOURNEY_END', '17:00')] });
    expect(result).toMatchObject({ totalMs: 9 * HOUR, stoppedMs: HOUR / 2, workingMs: 8.5 * HOUR });
  });
  test('duas paradas', () => {
    const result = calculateJourneyTimes({ events: [event('JOURNEY_START', '08:00'), event('STOP_STARTED', '10:00'), event('STOP_ENDED', '10:30'), event('STOP_STARTED', '12:00'), event('STOP_ENDED', '13:00'), event('JOURNEY_END', '17:00')] });
    expect(result.stoppedMs).toBe(1.5 * HOUR);
  });
  test('parada em andamento', () => {
    const result = calculateJourneyTimes({ events: [event('JOURNEY_START', '08:00'), event('STOP_STARTED', '10:00')], now: new Date(at('11:00')) });
    expect(result).toMatchObject({ stoppedMs: HOUR, hasOpenStop: true });
  });
  test('STOP_ENDED órfão não quebra', () => {
    const result = calculateJourneyTimes({ events: [event('JOURNEY_START', '08:00'), event('STOP_ENDED', '10:00'), event('JOURNEY_END', '17:00')] });
    expect(result.hasInvalidSequence).toBe(true);
    expect(result.warnings.join(' ')).toContain('órfão');
  });
  test('ordena eventos embaralhados', () => {
    const result = calculateJourneyTimes({ events: [event('JOURNEY_END', '17:00'), event('STOP_ENDED', '10:30'), event('JOURNEY_START', '08:00'), event('STOP_STARTED', '10:00')] });
    expect(result.stoppedMs).toBe(HOUR / 2);
  });
  test('resolve aliases e motivo', () => {
    const result = calculateJourneyTimes({ events: [
      { eventType: 'JOURNEY_START', timestamp: at('08:00') },
      { payload: { eventType: 'STOP_STARTED', timestamp: at('10:00'), reasonCode: '1000', reasonName: ' MANUTENÇÃO ' } },
      { data: { type: 'STOP_ENDED', occurredAt: at('10:30') } },
      { eventType: 'JOURNEY_END', timestamp: at('17:00') },
    ] });
    expect(result.stops[0].label).toBe('1000 — MANUTENÇÃO');
  });
  test('fim anterior ao início é seguro', () => {
    const result = calculateJourneyTimes({ events: [event('JOURNEY_END', '07:00'), event('JOURNEY_START', '08:00')] });
    expect(result.totalMs).toBe(0);
    expect(result.hasInvalidSequence).toBe(true);
  });
  test('jornada finalizada com parada aberta', () => {
    const result = calculateJourneyTimes({ events: [event('JOURNEY_START', '08:00'), event('STOP_STARTED', '10:00'), event('JOURNEY_END', '17:00')] });
    expect(result).toMatchObject({ stoppedMs: 7 * HOUR, hasOpenStop: true, hasInvalidSequence: true });
  });
  test('fecha logicamente paradas consecutivas', () => {
    const result = calculateJourneyTimes({ events: [event('JOURNEY_START', '08:00'), event('STOP_STARTED', '10:00'), event('STOP_STARTED', '11:00'), event('STOP_ENDED', '12:00'), event('JOURNEY_END', '17:00')] });
    expect(result).toMatchObject({ stoppedMs: 2 * HOUR, hasInvalidSequence: true });
  });
});
