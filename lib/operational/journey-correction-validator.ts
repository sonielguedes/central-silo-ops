export type ManualJourneyEndInput = { startedAt: unknown; endedAt: unknown; hourmeterStart?: unknown; hourmeterEnd?: unknown; reason?: unknown };
export function validateManualJourneyEnd(input: ManualJourneyEndInput): { ok: true; endedAt: string; hourmeterEnd: number | null; reason: string } | { ok: false; error: string } {
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (!reason) return { ok: false, error: 'Informe o motivo da correção.' };
  const start = new Date(input.startedAt as string).getTime();
  const end = new Date(input.endedAt as string).getTime();
  if (!Number.isFinite(end)) return { ok: false, error: 'Informe uma data/hora de encerramento válida.' };
  if (!Number.isFinite(start)) return { ok: false, error: 'Início da jornada inválido.' };
  if (end < start) return { ok: false, error: 'Informe uma data/hora de encerramento válida.' };
  const parse = (v: unknown) => v == null || v === '' ? null : Number(String(v).replace(',', '.'));
  const hs = parse(input.hourmeterStart); const he = parse(input.hourmeterEnd);
  if (he !== null && (!Number.isFinite(he) || he < 0)) return { ok: false, error: 'Horímetro final inválido.' };
  if (hs !== null && he !== null && he < hs) return { ok: false, error: 'Horímetro final não pode ser menor que o inicial.' };
  return { ok: true, endedAt: new Date(end).toISOString(), hourmeterEnd: he, reason };
}
