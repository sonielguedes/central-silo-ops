import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { TotvsDispatchService } from '@/lib/integrations/totvs';

export const dynamic = 'force-dynamic';

function fail(status: number, error: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, message, ...(extra ?? {}) }, { status });
}

function actor(req: NextRequest): string | undefined {
  const session = resolveSessionFromRequest(req);
  return session?.name || session?.email || session?.id;
}

async function readId(ctx: { params: { id: string } | Promise<{ id: string }> }) {
  return (await Promise.resolve(ctx.params)).id;
}

export async function POST(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const perm = requirePermission(req, 'integracoes', 'editar', tenant.tenantId);
  if (perm) return perm;
  const id = await readId(ctx);

  const item = await TotvsDispatchService.cancel(tenant.tenantId, id, actor(req));
  if (!item) return fail(404, 'NOT_FOUND_OR_NOT_CANCELABLE', 'Dispatch nao encontrado ou nao pode ser cancelado');
  return NextResponse.json({ success: true, item });
}
