import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { IntegrationJobStorage } from '@/lib/integrations/integration-job-storage';
import { IntegrationLogStorage } from '@/lib/integrations/integration-log-storage';
import { TotvsValidationStorage } from '@/lib/integrations/totvs/totvs-validation-storage';
import { validateTotvsPreValidation } from '@/lib/integrations/totvs/totvs-validation-engine';
import type { TotvsValidationInput, TotvsValidationTargetDataType } from '@/lib/integrations/totvs/totvs-mapping-types';

export const dynamic = 'force-dynamic';

const TARGETS = new Set<TotvsValidationTargetDataType>(['FICHA_OPERADOR', 'FUEL_JOURNEY', 'FUELINGS']);

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

function readBody(input: unknown): TotvsValidationInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Payload invalido');
  const body = input as Record<string, unknown>;
  const targetDataType = str(body.targetDataType)?.toUpperCase() as TotvsValidationTargetDataType | undefined;
  if (!targetDataType || !TARGETS.has(targetDataType)) throw new Error('targetDataType invalido');
  return {
    tenantId: '',
    targetDataType,
    periodStart: str(body.periodStart),
    periodEnd: str(body.periodEnd),
    referenceId: str(body.referenceId),
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
      system: 'TOTVS',
      level: 'INFO',
      event: 'TOTVS_VALIDATION_STARTED',
      message: 'Pré-validação TOTVS iniciada.',
      metadata: { targetDataType: body.targetDataType, periodStart: body.periodStart, periodEnd: body.periodEnd, filters: body.filters, referenceId: body.referenceId },
      createdBy,
    });

    const job = IntegrationJobStorage.create({
      tenantId: tenant.tenantId,
      system: 'TOTVS',
      type: 'MANUAL',
      title: 'Pré-validação TOTVS',
      description: 'Pré-validação local com dados reais para TOTVS.',
      payload: { targetDataType: body.targetDataType, periodStart: body.periodStart, periodEnd: body.periodEnd, filters: body.filters, referenceId: body.referenceId },
      source: 'MANUAL',
      createdBy,
    });

    const result = validateTotvsPreValidation({ ...body, tenantId: tenant.tenantId, checkedBy: createdBy });
    const persisted = TotvsValidationStorage.create(result);

    IntegrationJobStorage.update(tenant.tenantId, job.id, {
      status: 'SUCCESS',
      result: { validationStatus: persisted.status, validationResultId: persisted.id, issueCount: persisted.issues.length },
      finishedAt: new Date().toISOString(),
    });

    IntegrationLogStorage.create({
      tenantId: tenant.tenantId,
      jobId: job.id,
      system: 'TOTVS',
      level: persisted.status === 'SUCCESS' ? 'INFO' : 'WARN',
      event: persisted.status === 'SUCCESS' ? 'TOTVS_VALIDATION_SUCCESS' : 'TOTVS_VALIDATION_WARNING',
      message: persisted.status === 'SUCCESS' ? 'Pré-validação TOTVS concluída sem pendências.' : 'Pré-validação TOTVS concluída com alertas.',
      metadata: { validationResultId: persisted.id, issueCount: persisted.issues.length, targetDataType: persisted.targetDataType },
      createdBy,
    });

    return NextResponse.json({ success: true, ...persisted, id: persisted.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    IntegrationLogStorage.create({
      tenantId: tenant.ok ? tenant.tenantId : 'unknown',
      system: 'TOTVS',
      level: 'ERROR',
      event: 'TOTVS_VALIDATION_FAILED',
      message,
      createdBy: actor(req),
    });
    return fail(400, message);
  }
}
