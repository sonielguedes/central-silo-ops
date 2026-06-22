import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { IntegrationLogStorage } from '@/lib/integrations/integration-log-storage';
import { TotvsMappingStorage } from '@/lib/integrations/totvs/totvs-mapping-storage';
import type { TotvsMappingStatus, TotvsMappingType } from '@/lib/integrations/totvs/totvs-mapping-types';

export const dynamic = 'force-dynamic';

const TYPES = new Set<TotvsMappingType>(['COST_CENTER', 'WORK_ORDER', 'EQUIPMENT', 'FUEL_TRUCK', 'PRODUCT', 'FUEL_PUMP', 'OPERATOR', 'IMPLEMENT']);
const STATUSES = new Set<TotvsMappingStatus>(['ACTIVE', 'INACTIVE', 'PENDING_REVIEW']);

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
  const type = str(body.type)?.toUpperCase() as TotvsMappingType | undefined;
  const status = str(body.status)?.toUpperCase() as TotvsMappingStatus | undefined;
  if (type && !TYPES.has(type)) throw new Error('type invalido');
  if (status && !STATUSES.has(status)) throw new Error('status invalido');
  return {
    type,
    status,
    siloCode: str(body.siloCode),
    siloName: str(body.siloName),
    totvsCode: str(body.totvsCode),
    totvsName: str(body.totvsName),
    description: str(body.description),
  };
}

async function readId(ctx: { params: { id: string } | Promise<{ id: string }> }) {
  return (await Promise.resolve(ctx.params)).id;
}

export async function GET(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (rbac) return rbac;
  const id = await readId(ctx);
  const item = TotvsMappingStorage.getById(tenant.tenantId, id);
  if (!item) return fail(404, 'Registro nao encontrado');
  return NextResponse.json({ success: true, item });
}

export async function PUT(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'editar', tenant.tenantId);
  if (rbac) return rbac;
  const id = await readId(ctx);
  try {
    const body = readBody(await req.json());
    const updated = TotvsMappingStorage.update(tenant.tenantId, id, { ...body, updatedBy: actor(req) });
    if (!updated) return fail(404, 'Registro nao encontrado');
    IntegrationLogStorage.create({
      tenantId: tenant.tenantId,
      system: 'TOTVS',
      level: 'INFO',
      event: 'TOTVS_MAPPING_UPDATED',
      message: 'Mapeamento TOTVS atualizado.',
      metadata: { id, type: updated.type, siloCode: updated.siloCode, totvsCode: updated.totvsCode, status: updated.status },
      createdBy: actor(req),
    });
    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return fail(400, message);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'arquivar', tenant.tenantId);
  if (rbac) return rbac;
  const id = await readId(ctx);
  const archived = TotvsMappingStorage.archive(tenant.tenantId, id, actor(req));
  if (!archived) return fail(404, 'Registro nao encontrado');
  IntegrationLogStorage.create({
    tenantId: tenant.tenantId,
    system: 'TOTVS',
    level: 'WARN',
    event: 'TOTVS_MAPPING_INACTIVATED',
    message: 'Mapeamento TOTVS inativado.',
    metadata: { id, type: archived.type, siloCode: archived.siloCode, totvsCode: archived.totvsCode, status: archived.status },
    createdBy: actor(req),
  });
  return NextResponse.json({ success: true, item: archived });
}
