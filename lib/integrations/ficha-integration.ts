import { buildDailySheet, calculateTotalHours, type FichaDiaria } from '@/lib/daily-sheet-builder';
import {
  FichaStore,
  deriveFichaStatus,
  getEffectiveBlockingInconsistencies,
  type FichaOverlay,
} from '@/lib/ficha-store';
import {
  buildFichaIntegrationPayload,
  buildPayloadHash,
  normalizeIntegrationPayload,
} from '@/lib/integrations/payloads/operator-sheet-payload';
import type {
  IntegrationOperationType,
  IntegrationSourceModule,
  IntegrationTargetSystem,
} from '@/lib/integrations/integration-types';

const ALLOWED_SOURCE_STATUSES = new Set(['VALIDADO', 'EXPORTADO']);

function normalizeComparable(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();
}

function mergeFichaWithOverlay(ficha: FichaDiaria, overlay: FichaOverlay | null): FichaDiaria {
  const merged = { ...ficha } as Record<string, unknown> & FichaDiaria;

  if (overlay?.correctedFields) {
    for (const [field, value] of Object.entries(overlay.correctedFields)) {
      merged[field] = value;
    }
  }

  merged.totalHourmeter = calculateTotalHours(
    merged.hourmeterStart as number | null | undefined,
    merged.hourmeterEnd as number | null | undefined,
  );

  const costCenter = String(merged.costCenterName ?? '').trim().toUpperCase();
  if (costCenter) {
    const operationValues = new Set<string>();
    for (const j of merged.journeys ?? []) {
      if (j.operationCode) operationValues.add(normalizeComparable(j.operationCode));
      if (j.operationName) operationValues.add(normalizeComparable(j.operationName));
    }
    if (
      normalizeComparable(merged.operationCode) === costCenter ||
      normalizeComparable(merged.operationName) === costCenter ||
      operationValues.has(costCenter)
    ) {
      merged.costCenterName = null;
    }
  }

  return merged as FichaDiaria;
}

export interface FichaIntegrationBuildResult {
  ok: boolean;
  error?: string;
  status?: number;
  sourceModule?: IntegrationSourceModule;
  sourceType?: string;
  sourceId?: string;
  targetSystem?: IntegrationTargetSystem;
  targetAdapter?: string;
  operationType?: IntegrationOperationType;
  ficha?: FichaDiaria;
  overlay?: FichaOverlay | null;
  finalStatus?: string;
  blockingReasons?: string[];
  payload?: Record<string, unknown>;
  payloadHash?: string;
}

export function buildFichaIntegrationJobInput(params: {
  tenantId: string;
  fleetCode: string;
  date: string;
  targetSystem?: IntegrationTargetSystem;
  targetAdapter?: string;
  operationType?: IntegrationOperationType;
}): FichaIntegrationBuildResult {
  const { tenantId, fleetCode, date } = params;
  const result = buildDailySheet({ tenantId, fleetCode, date });
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.error };
  }

  const overlay = FichaStore.get(tenantId, fleetCode, date);
  const ficha = mergeFichaWithOverlay(result.ficha, overlay);
  const blockingReasons = getEffectiveBlockingInconsistencies(ficha.inconsistencies, overlay);
  const finalStatus = deriveFichaStatus({
    computedStatus: ficha.status,
    overlay,
    isDayOpen: ficha.isDayOpen,
    hasBlockingInconsistency: blockingReasons.length > 0,
  });

  if (!ALLOWED_SOURCE_STATUSES.has(finalStatus)) {
    return {
      ok: false,
      status: 422,
      error: finalStatus === 'EM_ANDAMENTO'
        ? 'Ficha em andamento nao pode gerar job de integracao.'
        : finalStatus === 'INCONSISTENTE'
          ? 'Ficha inconsistente nao pode gerar job de integracao.'
          : 'Somente fichas VALIDADO ou EXPORTADO podem gerar job de integracao.',
      blockingReasons,
      ficha,
      overlay,
      finalStatus,
    };
  }

  if (blockingReasons.length > 0) {
    return {
      ok: false,
      status: 422,
      error: 'Ficha possui inconsistencias criticas.',
      blockingReasons,
      ficha,
      overlay,
      finalStatus,
    };
  }

  const payload = normalizeIntegrationPayload(
    buildFichaIntegrationPayload({
      ...ficha,
      statusFicha: finalStatus,
      centroCusto: ficha.costCenterName,
      costCenterName: ficha.costCenterName,
      validatedBy: overlay?.validatedBy ?? null,
      validatedAt: overlay?.validatedAt ?? null,
      exportedAt: overlay?.exportedAt ?? null,
    }),
  );
  const payloadHash = buildPayloadHash(payload);

  return {
    ok: true,
    sourceModule: 'FICHA_OPERADOR',
    sourceType: 'FICHA_OPERADOR',
    sourceId: `${tenantId}|${fleetCode}|${date}`,
    targetSystem: params.targetSystem ?? 'PIMS',
    targetAdapter: params.targetAdapter ?? 'PIMS_FILE',
    operationType: params.operationType ?? 'CREATE',
    ficha,
    overlay,
    finalStatus,
    payload,
    payloadHash,
  };
}

export function canRetryIntegrationJob(status: string): boolean {
  return status === 'FAILED' || status === 'REPROCESS_REQUIRED';
}
