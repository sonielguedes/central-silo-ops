import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { TotvsDispatchService } from '@/lib/integrations/totvs';
import type { TotvsDispatchDataType } from '@/lib/integrations/totvs';

export const dynamic = 'force-dynamic';

const DATA_TYPES = new Set<TotvsDispatchDataType>(['FICHA_OPERADOR', 'JOURNEY', 'FUEL_JOURNEY', 'FUELINGS', 'STOP_EVENTS', 'FULL_OPERATIONAL_PACKAGE']);

function fail(status: number, error: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, message, ...(extra ?? {}) }, { status });
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
  const dataType = str(body.dataType)?.toUpperCase() as TotvsDispatchDataType | undefined;
  if (!dataType || !DATA_TYPES.has(dataType)) throw new Error('dataType invalido');
  return {
    dataType,
    referenceId: str(body.referenceId),
    journeyId: str(body.journeyId),
    fleetCode: str(body.fleetCode),
    comboioFleetCode: str(body.comboioFleetCode),
    operatorRegistration: str(body.operatorRegistration),
    driverRegistration: str(body.driverRegistration),
    configId: str(body.configId),
    mockMode: body.mockMode === true || body.mockMode === 'true',
    periodStart: str(body.periodStart),
    periodEnd: str(body.periodEnd),
    maxAttempts: body.maxAttempts !== undefined ? Number(body.maxAttempts) : undefined,
  };
}

export async function POST(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const perm = requirePermission(req, 'integracoes', 'criar', tenant.tenantId);
  if (perm) return perm;

  try {
    const body = readBody(await req.json());
    const result = await TotvsDispatchService.send({
      tenantId: tenant.tenantId,
      dataType: body.dataType,
      referenceId: body.referenceId,
      journeyId: body.journeyId,
      fleetCode: body.fleetCode,
      comboioFleetCode: body.comboioFleetCode,
      operatorRegistration: body.operatorRegistration,
      driverRegistration: body.driverRegistration,
      configId: body.configId,
      mockMode: body.mockMode,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      maxAttempts: body.maxAttempts,
      actor: actor(req),
    });
    return NextResponse.json(result, { status: result.success ? 201 : 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return fail(400, 'TOTVS_DISPATCH_INVALID', message);
  }
}
