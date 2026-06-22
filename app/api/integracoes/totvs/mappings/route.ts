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
    siloCode: str(body.siloCode) || '',
    siloName: str(body.siloName),
    totvsCode: str(body.totvsCode) || '',
    totvsName: str(body.totvsName),
    description: str(body.description),
  };
}

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (rbac) return rbac;

  const sp = req.nextUrl.searchParams;
  const items = TotvsMappingStorage.listByTenant(tenant.tenantId, {
    type: (str(sp.get('type'))?.toUpperCase() || undefined) as TotvsMappingType | undefined,
    status: (str(sp.get('status'))?.toUpperCase() || undefined) as TotvsMappingStatus | undefined,
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
    if (!body.totvsCode) return fail(400, 'totvsCode obrigatorio');
    const item = TotvsMappingStorage.create({
      tenantId: tenant.tenantId,
      type: body.type,
      siloCode: body.siloCode,
      siloName: body.siloName,
      totvsCode: body.totvsCode,
      totvsName: body.totvsName,
      description: body.description,
      status: body.status ?? 'ACTIVE',
      createdBy: actor(req),
    });

    IntegrationLogStorage.create({
      tenantId: tenant.tenantId,
      system: 'TOTVS',
      level: 'INFO',
      event: 'TOTVS_MAPPING_CREATED',
      message: 'Mapeamento TOTVS criado.',
      metadata: { type: item.type, siloCode: item.siloCode, totvsCode: item.totvsCode, status: item.status },
      createdBy: actor(req),
    });

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return fail(400, message);
  }
}
