import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { IntegrationLogStorage } from '@/lib/integrations/integration-log-storage';
import { PimsMappingStorage } from '@/lib/integrations/pims/pims-mapping-storage';
import type { PimsMappingStatus, PimsMappingType } from '@/lib/integrations/pims/pims-mapping-types';

export const dynamic = 'force-dynamic';

const TYPES = new Set<PimsMappingType>(['OPERATION', 'STOP_REASON', 'COST_CENTER', 'EQUIPMENT', 'OPERATOR', 'IMPLEMENT', 'WORK_ORDER', 'FICHA_FIELD']);
const STATUSES = new Set<PimsMappingStatus>(['ACTIVE', 'INACTIVE', 'PENDING_REVIEW']);

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
  const type = str(body.type)?.toUpperCase() as PimsMappingType | undefined;
  const status = str(body.status)?.toUpperCase() as PimsMappingStatus | undefined;
  if (type && !TYPES.has(type)) throw new Error('type invalido');
  if (status && !STATUSES.has(status)) throw new Error('status invalido');
  return {
    type,
    status,
    siloCode: str(body.siloCode),
    siloName: str(body.siloName),
    pimsCode: str(body.pimsCode),
    pimsName: str(body.pimsName),
    description: str(body.description),
  };
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'editar', tenant.tenantId);
  if (rbac) return rbac;

  try {
    const { id } = params;
    const body = readBody(await req.json());
    const item = PimsMappingStorage.update(tenant.tenantId, id, { ...body, updatedBy: actor(req) });
    if (!item) return fail(404, 'Mapeamento nao encontrado');
    IntegrationLogStorage.create({
      tenantId: tenant.tenantId,
      system: 'PIMS',
      level: 'INFO',
      event: 'PIMS_MAPPING_UPDATED',
      message: 'Mapeamento PIMS atualizado.',
      metadata: { id: item.id, type: item.type, siloCode: item.siloCode, pimsCode: item.pimsCode, status: item.status },
      createdBy: actor(req),
    });
    return NextResponse.json({ success: true, item });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return fail(400, message);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'arquivar', tenant.tenantId);
  if (rbac) return rbac;

  const { id } = params;
  const item = PimsMappingStorage.inactivate(tenant.tenantId, id);
  if (!item) return fail(404, 'Mapeamento nao encontrado');
  IntegrationLogStorage.create({
    tenantId: tenant.tenantId,
    system: 'PIMS',
    level: 'WARN',
    event: 'PIMS_MAPPING_INACTIVATED',
    message: 'Mapeamento PIMS inativado.',
    metadata: { id: item.id, type: item.type, siloCode: item.siloCode, pimsCode: item.pimsCode, status: item.status },
    createdBy: actor(req),
  });
  return NextResponse.json({ success: true, item });
}
