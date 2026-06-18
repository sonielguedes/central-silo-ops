import { createHash } from 'crypto';

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeDecimal(value: unknown): number | null | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.includes(',') && trimmed.includes('.')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed.replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeValue(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.map(normalizeValue).filter(item => item !== undefined);
  }
  if (isPlainObject(value)) {
    const result: PlainObject = {};
    for (const [key, nested] of Object.entries(value)) {
      const normalized = normalizeValue(nested);
      if (normalized !== undefined) result[key] = normalized;
    }
    return result;
  }
  return value;
}

export function normalizeIntegrationPayload<T>(input: T): T {
  return normalizeValue(input) as T;
}

export function buildFichaIntegrationPayload(input: PlainObject): PlainObject {
  const payload = normalizeIntegrationPayload({
    tenantId: input.tenantId,
    sheetId: input.sheetId,
    dataOperacional: input.dataOperacional ?? input.date,
    frota: input.frota ?? input.fleetCode,
    operador: input.operador ?? input.operatorName,
    matricula: input.matricula ?? input.operatorRegistration,
    os: input.os ?? input.workOrderNumber,
    operacaoCodigo: input.operacaoCodigo ?? input.operationCode,
    operacaoDescricao: input.operacaoDescricao ?? input.operationName,
    centroCusto: input.centroCusto ?? input.costCenterName,
    implementoCodigo: input.implementoCodigo ?? input.implementCode,
    implementoDescricao: input.implementoDescricao ?? input.implementName,
    horimetroInicial: normalizeDecimal(input.horimetroInicial ?? input.hourmeterStart),
    horimetroFinal: normalizeDecimal(input.horimetroFinal ?? input.hourmeterEnd),
    totalHoras: normalizeDecimal(input.totalHoras ?? input.totalHourmeter),
    horasProdutivas: normalizeDecimal(input.horasProdutivas ?? input.minutesOperating),
    horasParadas: normalizeDecimal(input.horasParadas ?? input.minutesStopped),
    horasIndeterminadas: normalizeDecimal(input.horasIndeterminadas ?? input.minutesUndetermined),
    percentualIndeterminado: normalizeDecimal(input.percentualIndeterminado ?? input.pctUndetermined),
    statusFicha: input.statusFicha ?? input.status,
    validadoPor: input.validadoPor ?? input.validatedBy,
    validadoEm: input.validadoEm ?? input.validatedAt,
    exportadoEm: input.exportadoEm ?? input.exportedAt,
    inconsistencias: input.inconsistencias ?? [],
  });

  return payload;
}

export function buildPayloadHash(payload: PlainObject): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
