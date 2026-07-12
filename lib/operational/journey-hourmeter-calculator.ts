export type JourneyHourmeterInput = {
  status?: string | null;
  hourmeterStart?: number | string | null;
  hourmeterCurrent?: number | string | null;
  hourmeterEnd?: number | string | null;
  maxReasonableDailyHours?: number;
};

export type JourneyHourmeterResult = {
  start: number | null;
  current: number | null;
  end: number | null;
  total: number | null;
  displayStart: string;
  displayCurrent: string;
  displayEnd: string;
  displayTotal: string;
  warnings: string[];
  isCurrentCompatible: boolean;
  isEndCompatible: boolean;
};

const ACTIVE = new Set(['EM_ANDAMENTO', 'OPERANDO', 'PARADO', 'ONLINE', 'AGUARDANDO_PARADA', 'PARADA_APONTADA']);

function parse(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const raw = value.trim();
  const normalized = raw.includes(',') && raw.includes('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

const round = (value: number): number => Math.round(value * 100) / 100;
const display = (value: number | null): string => value === null ? '—' : value.toFixed(1).replace('.', ',');

export function calculateJourneyHourmeter(input: JourneyHourmeterInput): JourneyHourmeterResult {
  const status = String(input.status ?? '').trim().toUpperCase();
  const isActive = ACTIVE.has(status) || !status;
  const limit = input.maxReasonableDailyHours ?? 24;
  const start = parse(input.hourmeterStart);
  const current = parse(input.hourmeterCurrent);
  const rawEnd = parse(input.hourmeterEnd);
  const end = isActive ? null : rawEnd;
  const warnings: string[] = [];
  if (start === null) warnings.push('HORIMETRO_INICIAL_AUSENTE');

  let isCurrentCompatible = true;
  if (start !== null && current !== null && (current < start || current - start > limit)) {
    isCurrentCompatible = false;
    warnings.push('HORIMETRO_ATUAL_INCOMPATIVEL');
  }

  let isEndCompatible = true;
  if (!isActive && end === null) {
    isEndCompatible = false;
    warnings.push('HORIMETRO_FINAL_AUSENTE');
  } else if (start !== null && end !== null && end < start) {
    isEndCompatible = false;
    warnings.push('HORIMETRO_FINAL_MENOR_QUE_INICIAL');
  } else if (start !== null && end !== null && end - start > limit) {
    isEndCompatible = false;
    warnings.push('HORIMETRO_TOTAL_INCOMPATIVEL');
  }

  const reference = isActive ? current : end;
  const compatible = isActive ? isCurrentCompatible : isEndCompatible;
  const total = start !== null && reference !== null && compatible ? round(reference - start) : null;
  return { start, current, end, total, displayStart: display(start), displayCurrent: display(current), displayEnd: display(end), displayTotal: display(total), warnings, isCurrentCompatible, isEndCompatible };
}
