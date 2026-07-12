export type ManualJourneyEndInput = { startedAt: unknown; endedAt: unknown; hourmeterStart?: unknown; hourmeterEnd?: unknown; reason?: unknown };

function localDate(year: number, month: number, day: number, hour: number, minute: number): Date | null {
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    && date.getHours() === hour && date.getMinutes() === minute ? date : null;
}

export function parseCorrectionDateTime(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  const brazilian = /^(\d{2})\/(\d{2})\/(\d{2}|\d{4})[ ,T]+(\d{2}):(\d{2})$/.exec(text);
  if (brazilian) {
    const [, day, month, rawYear, hour, minute] = brazilian;
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    return localDate(year, Number(month), Number(day), Number(hour), Number(minute));
  }
  const local = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(text);
  if (local) {
    const [, year, month, day, hour, minute] = local;
    return localDate(Number(year), Number(month), Number(day), Number(hour), Number(minute));
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function validateManualJourneyEnd(input: ManualJourneyEndInput): { ok: true; endedAt: string; hourmeterEnd: number | null; reason: string } | { ok: false; error: string } {
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) return { ok: false, error: 'Informe o motivo da correção.' };
  const startedAt = parseCorrectionDateTime(input.startedAt);
  const endedAt = parseCorrectionDateTime(input.endedAt);
  if (!endedAt) return { ok: false, error: 'Informe uma data/hora de encerramento válida.' };
  if (!startedAt) return { ok: false, error: 'Início da jornada inválido.' };
  const start = startedAt.getTime();
  const end = endedAt.getTime();
  if (end < start) return { ok: false, error: 'Informe uma data/hora de encerramento válida.' };
  const parse = (v: unknown) => v == null || v === '' ? null : Number(String(v).replace(',', '.'));
  const hs = parse(input.hourmeterStart); const he = parse(input.hourmeterEnd);
  if (he !== null && (!Number.isFinite(he) || he < 0)) return { ok: false, error: 'Horímetro final inválido.' };
  if (hs !== null && he !== null && he < hs) return { ok: false, error: 'Horímetro final não pode ser menor que o inicial.' };
  return { ok: true, endedAt: endedAt.toISOString(), hourmeterEnd: he, reason };
}
