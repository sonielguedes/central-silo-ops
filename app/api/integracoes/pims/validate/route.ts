import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { IntegrationJobStorage } from '@/lib/integrations/integration-job-storage';
import { IntegrationLogStorage } from '@/lib/integrations/integration-log-storage';
import { PimsValidationStorage } from '@/lib/integrations/pims/pims-validation-storage';
import { validatePimsOperationalData } from '@/lib/integrations/pims/pims-validation-engine';
import type { PimsValidationInput, PimsValidationTargetDataType } from '@/lib/integrations/pims/pims-mapping-types';

export const dynamic = 'force-dynamic';

const TARGETS = new Set<PimsValidationTargetDataType>(['FICHA_OPERADOR', 'JOURNEY', 'STOP_EVENTS', 'FULL_OPERATIONAL_PACKAGE']);

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...(extra ?? {}) }, { status });
}

function actor(req: NextRequest): string | undefined {
  const session = resolveSessionFromRequest(req);
  return session?.name || session?.email || session?.id;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readBody(input: unknown): PimsValidationInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Payload invalido');
  const body = input as Record<string, unknown>;
  const targetDataType = str(body.targetDataType)?.toUpperCase() as PimsValidationTargetDataType | undefined;
  if (!targetDataType || !TARGETS.has(targetDataType)) throw new Error('targetDataType invalido');
  return {
    tenantId: '',
    targetDataType,
    referenceId: str(body.referenceId),
    periodStart: str(body.periodStart),
    periodEnd: str(body.periodEnd),
    filters: body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters)
      ? {
          fleetCode: str((body.filters as Record<string, unknown>).fleetCode),
          operatorRegistration: str((body.filters as Record<string, unknown>).operatorRegistration),
          journeyId: str((body.filters as Record<string, unknown>).journeyId),
        }
      : undefined,
  };
}

export async function POST(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'criar', tenant.tenantId);
  if (rbac) return rbac;

  try {
    const body = readBody(await req.json());
    const createdBy = actor(req);
    IntegrationLogStorage.create({
      tenantId: tenant.tenantId,
      system: 'PIMS',
      level: 'INFO',
      event: 'PIMS_VALIDATION_STARTED',
      message: 'Pré-validação PIMS iniciada.',
      metadata: { targetDataType: body.targetDataType, referenceId: body.referenceId, periodStart: body.periodStart, periodEnd: body.periodEnd, filters: body.filters },
      createdBy,
    });

    const job = IntegrationJobStorage.create({
      tenantId: tenant.tenantId,
      system: 'PIMS',
      type: 'MANUAL',
      title: 'Validação de mapeamento PIMS',
      description: 'Pré-validação operacional local para envio futuro ao PIMS.',
      payload: { targetDataType: body.targetDataType, referenceId: body.referenceId, periodStart: body.periodStart, periodEnd: body.periodEnd, filters: body.filters },
      source: 'MANUAL',
      createdBy,
    });

    const result = validatePimsOperationalData({ ...body, tenantId: tenant.tenantId, checkedBy: createdBy });
    const persisted = PimsValidationStorage.create(result);
    const status = persisted.status;

    IntegrationJobStorage.update(tenant.tenantId, job.id, {
      status: status === 'FAILED' ? 'FAILED' : 'SUCCESS',
      result: { validationStatus: status, validationResultId: persisted.id, issueCount: persisted.issues.length },
      finishedAt: new Date().toISOString(),
    });

    IntegrationLogStorage.create({
      tenantId: tenant.tenantId,
      jobId: job.id,
      system: 'PIMS',
      level: status === 'SUCCESS' ? 'INFO' : status === 'WARNING' ? 'WARN' : 'ERROR',
      event: status === 'SUCCESS' ? 'PIMS_VALIDATION_SUCCESS' : status === 'WARNING' ? 'PIMS_VALIDATION_WARNING' : 'PIMS_VALIDATION_FAILED',
      message: status === 'SUCCESS'
        ? 'Pré-validação PIMS concluída sem pendências.'
        : status === 'WARNING'
          ? 'Pré-validação PIMS concluída com alertas.'
          : 'Pré-validação PIMS falhou.',
      metadata: { validationResultId: persisted.id, issueCount: persisted.issues.length, targetDataType: persisted.targetDataType },
      createdBy,
    });

    return NextResponse.json({ success: true, ...persisted, id: persisted.id }, { status: 201 });
  } catch (error) {
    const tenantFallback = requireTenant(req);
    IntegrationLogStorage.create({
      tenantId: tenantFallback.ok ? tenantFallback.tenantId : 'unknown',
      system: 'PIMS',
      level: 'ERROR',
      event: 'PIMS_VALIDATION_FAILED',
      message: error instanceof Error ? error.message : 'Erro interno',
      createdBy: actor(req),
    });
    const message = error instanceof Error ? error.message : 'Erro interno';
    return fail(400, message);
  }
}
