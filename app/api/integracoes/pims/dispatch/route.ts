import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { sendPimsDispatch } from '@/lib/integrations/pims/pims-dispatch-service';
import type { PimsValidationTargetDataType } from '@/lib/integrations/pims/pims-mapping-types';

export const dynamic = 'force-dynamic';

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

function readBody(input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Payload invalido');
  const body = input as Record<string, unknown>;
  const targetDataType = str(body.targetDataType)?.toUpperCase() as PimsValidationTargetDataType | undefined;
  if (!targetDataType) throw new Error('targetDataType obrigatorio');
  return {
    targetDataType,
    periodStart: str(body.periodStart),
    periodEnd: str(body.periodEnd),
    referenceId: str(body.referenceId),
    configId: str(body.configId),
    mockMode: body.mockMode === true || body.mockMode === 'true',
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
  const perm = requirePermission(req, 'integracoes', 'criar', tenant.tenantId);
  if (perm) return perm;

  try {
    const body = readBody(await req.json());
    const result = await sendPimsDispatch({
      tenantId: tenant.tenantId,
      targetDataType: body.targetDataType,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      referenceId: body.referenceId,
      filters: body.filters,
      configId: body.configId,
      mockMode: body.mockMode,
      actor: actor(req),
    });
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    return fail(400, error instanceof Error ? error.message : 'Erro interno');
  }
}

