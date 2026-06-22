import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { IntegrationJobStorage } from '@/lib/integrations/integration-job-storage';

export const dynamic = 'force-dynamic';

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...(extra ?? {}) }, { status });
}

function getActor(req: NextRequest): string | undefined {
  const session = resolveSessionFromRequest(req);
  return session?.name || session?.email || session?.id;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'editar', tenant.tenantId);
  if (rbac) return rbac;

  const current = IntegrationJobStorage.getById(tenant.tenantId, params.id);
  if (!current) return fail(404, 'Job nao encontrado');

  const item = IntegrationJobStorage.cancel(tenant.tenantId, params.id, getActor(req));
  if (!item) return fail(400, 'Cancelamento permitido apenas para jobs PENDING ou RETRYING');
  return NextResponse.json({ success: true, item });
}

