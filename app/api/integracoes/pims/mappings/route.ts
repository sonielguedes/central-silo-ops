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
    siloCode: str(body.siloCode) || '',
    siloName: str(body.siloName),
    pimsCode: str(body.pimsCode) || '',
    pimsName: str(body.pimsName),
    description: str(body.description),
  };
}

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (rbac) return rbac;

  const sp = req.nextUrl.searchParams;
  const items = PimsMappingStorage.listByTenant(tenant.tenantId, {
    type: (str(sp.get('type'))?.toUpperCase() || undefined) as PimsMappingType | undefined,
    status: (str(sp.get('status'))?.toUpperCase() || undefined) as PimsMappingStatus | undefined,
    q: sp.get('q')?.trim() || undefined,
  });

  return NextResponse.json({ success: true, items, total: items.length });
}

export async function POST(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'criar', tenant.tenantId);
  if (rbac) return rbac;

  try {
    const body = readBody(await req.json());
    if (!body.type) return fail(400, 'type obrigatorio');
    if (!body.siloCode) return fail(400, 'siloCode obrigatorio');
    if (!body.pimsCode) return fail(400, 'pimsCode obrigatorio');
    const item = PimsMappingStorage.create({
      tenantId: tenant.tenantId,
      type: body.type,
      siloCode: body.siloCode,
      siloName: body.siloName,
      pimsCode: body.pimsCode,
      pimsName: body.pimsName,
      description: body.description,
      status: body.status ?? 'ACTIVE',
      createdBy: actor(req),
    });

    IntegrationLogStorage.create({
      tenantId: tenant.tenantId,
      system: 'PIMS',
      level: 'INFO',
      event: 'PIMS_MAPPING_CREATED',
      message: 'Mapeamento PIMS criado.',
      metadata: { type: item.type, siloCode: item.siloCode, pimsCode: item.pimsCode, status: item.status },
      createdBy: actor(req),
    });

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return fail(400, message);
  }
}
