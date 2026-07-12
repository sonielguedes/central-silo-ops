export type JourneyEventType =
  | 'JOURNEY_START' | 'STOP_STARTED' | 'STOP_ENDED' | 'JOURNEY_END'
  | 'POSITION_UPDATE' | 'HEARTBEAT' | string;

export type JourneyTimeEvent = {
  id?: string;
  type?: JourneyEventType;
  eventType?: JourneyEventType;
  occurredAt?: string | number | Date | null;
  timestamp?: string | number | Date | null;
  createdAt?: string | number | Date | null;
  receivedAt?: string | number | Date | null;
  payload?: Record<string, unknown> | null;
  data?: Record<string, unknown> | null;
};

export type JourneyTimeCalculationInput = {
  events: JourneyTimeEvent[];
  now?: Date;
  journeyStartedAt?: string | number | Date | null;
  journeyEndedAt?: string | number | Date | null;
};

export type StopInterval = {
  startedAt: string;
  endedAt?: string | null;
  durationMs: number;
  status: 'FINALIZADA' | 'EM_ANDAMENTO' | 'ORFA';
  reasonCode?: string | null;
  reasonName?: string | null;
  label: string;
};

export type JourneyTimeCalculationResult = {
  journeyStartedAt?: string | null;
  journeyEndedAt?: string | null;
  totalMs: number;
  stoppedMs: number;
  workingMs: number;
  indeterminateMs: number;
  stops: StopInterval[];
  hasOpenStop: boolean;
  hasInvalidSequence: boolean;
  warnings: string[];
};

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const instant = (value: unknown): number | null => {
  if (value == null || value === '') return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value as string | number).getTime();
  return Number.isFinite(ms) ? ms : null;
};
const iso = (ms: number): string => new Date(ms).toISOString();

function normalized(event: JourneyTimeEvent) {
  const payload = record(event.payload);
  const data = record(event.data);
  const type = text(event.type) ?? text(event.eventType) ?? text(payload.type) ?? text(payload.eventType)
    ?? text(data.type) ?? text(data.eventType) ?? '';
  const at = instant(event.occurredAt) ?? instant(event.timestamp) ?? instant(event.createdAt) ?? instant(event.receivedAt)
    ?? instant(payload.occurredAt) ?? instant(payload.timestamp) ?? instant(data.occurredAt) ?? instant(data.timestamp);
  const normalizedType = type.toUpperCase();
  return { type: normalizedType === 'MANUAL_JOURNEY_END' ? 'JOURNEY_END' : normalizedType, at, values: { ...data, ...payload } };
}

export function formatStopReason(code: unknown, name: unknown): string {
  const cleanCode = text(code);
  const cleanName = text(name);
  return cleanCode && cleanName ? `${cleanCode} — ${cleanName}` : cleanCode ?? cleanName ?? 'Parada sem motivo informado';
}

export function formatJourneyDuration(durationMs: number | null | undefined): string {
  if (durationMs == null || !Number.isFinite(durationMs) || durationMs < 0) return '—';
  const minutes = Math.round(durationMs / 60_000);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
}

export function calculateJourneyTimes(input: JourneyTimeCalculationInput): JourneyTimeCalculationResult {
  const nowMs = instant(input.now ?? new Date()) ?? Date.now();
  const events = input.events.map(normalized).filter((event): event is ReturnType<typeof normalized> & { at: number } => event.at !== null)
    .sort((a, b) => a.at - b.at);
  const warnings: string[] = [];
  const starts = events.filter(event => event.type === 'JOURNEY_START');
  const ends = events.filter(event => event.type === 'JOURNEY_END');
  const startedAt = starts[0]?.at ?? instant(input.journeyStartedAt);
  const endedAt = ends.at(-1)?.at ?? instant(input.journeyEndedAt);
  let invalid = false;
  if (startedAt === null) warnings.push('Jornada sem JOURNEY_START válido.');
  if (startedAt !== null && endedAt !== null && endedAt < startedAt) {
    invalid = true;
    warnings.push('JOURNEY_END anterior ao JOURNEY_START.');
  }
  const effectiveEnd = endedAt ?? nowMs;
  const totalMs = startedAt === null ? 0 : Math.max(0, effectiveEnd - startedAt);
  const stops: StopInterval[] = [];
  let open: { at: number; code: string | null; name: string | null } | null = null;

  for (const event of events) {
    if (event.type === 'STOP_STARTED') {
      if (open) {
        invalid = true;
        warnings.push('STOP_STARTED recebido com parada já aberta; parada anterior fechada logicamente.');
        const durationMs = Math.max(0, event.at - open.at);
        stops.push({ startedAt: iso(open.at), endedAt: iso(event.at), durationMs, status: 'FINALIZADA', reasonCode: open.code, reasonName: open.name, label: formatStopReason(open.code, open.name) });
      }
      open = {
        at: event.at,
        code: text(event.values.reasonCode ?? event.values.stopReasonCode ?? event.values.stopCode ?? event.values.code),
        name: text(event.values.reasonName ?? event.values.stopReasonName ?? event.values.stopDescription ?? event.values.description),
      };
    } else if (event.type === 'STOP_ENDED') {
      if (!open) {
        invalid = true;
        warnings.push('STOP_ENDED órfão, sem STOP_STARTED correspondente.');
        stops.push({ startedAt: iso(event.at), endedAt: iso(event.at), durationMs: 0, status: 'ORFA', label: '—' });
      } else {
        stops.push({ startedAt: iso(open.at), endedAt: iso(event.at), durationMs: Math.max(0, event.at - open.at), status: 'FINALIZADA', reasonCode: open.code, reasonName: open.name, label: formatStopReason(open.code, open.name) });
        open = null;
      }
    }
  }

  const hasOpenStop = open !== null;
  if (open) {
    if (endedAt !== null) {
      invalid = true;
      warnings.push('Jornada finalizada com parada aberta.');
    }
    stops.push({ startedAt: iso(open.at), endedAt: null, durationMs: Math.max(0, effectiveEnd - open.at), status: 'EM_ANDAMENTO', reasonCode: open.code, reasonName: open.name, label: formatStopReason(open.code, open.name) });
  }

  const windowStart = startedAt ?? effectiveEnd;
  const stoppedMs = Math.min(totalMs, stops.reduce((sum, stop) => {
    if (stop.status === 'ORFA') return sum;
    const start = Math.max(windowStart, instant(stop.startedAt) ?? windowStart);
    const end = Math.min(effectiveEnd, instant(stop.endedAt) ?? effectiveEnd);
    return sum + Math.max(0, end - start);
  }, 0));
  const indeterminateMs = startedAt === null ? totalMs : 0;
  const workingMs = Math.max(0, totalMs - stoppedMs - indeterminateMs);
  return { journeyStartedAt: startedAt === null ? null : iso(startedAt), journeyEndedAt: endedAt === null ? null : iso(endedAt), totalMs, stoppedMs, workingMs, indeterminateMs, stops, hasOpenStop, hasInvalidSequence: invalid, warnings };
}
