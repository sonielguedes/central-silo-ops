import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { retryPimsDispatch } from '@/lib/integrations/pims/pims-dispatch-service';

export const dynamic = 'force-dynamic';

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...(extra ?? {}) }, { status });
}

function actor(req: NextRequest): string | undefined {
  const session = resolveSessionFromRequest(req);
  return session?.name || session?.email || session?.id;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const perm = requirePermission(req, 'integracoes', 'editar', tenant.tenantId);
  if (perm) return perm;

  const result = await retryPimsDispatch(tenant.tenantId, params.id, actor(req));
  if (!result) return fail(404, 'Dispatch nao encontrado ou nao pode ser reprocessado');
  if (!result.success) return NextResponse.json(result, { status: 400 });
  return NextResponse.json({ ...result, item: result.dispatch });
}
