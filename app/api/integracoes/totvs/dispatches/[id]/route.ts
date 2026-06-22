import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { TotvsDispatchService } from '@/lib/integrations/totvs';

export const dynamic = 'force-dynamic';

function fail(status: number, error: string, message: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, message, ...(extra ?? {}) }, { status });
}

async function readId(ctx: { params: { id: string } | Promise<{ id: string }> }) {
  return (await Promise.resolve(ctx.params)).id;
}

export async function GET(req: NextRequest, ctx: { params: { id: string } | Promise<{ id: string }> }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const perm = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (perm) return perm;

  const id = await readId(ctx);
  const item = TotvsDispatchService.getById(tenant.tenantId, id);
  if (!item) return fail(404, 'NOT_FOUND', 'Dispatch nao encontrado');
  return NextResponse.json({ success: true, item });
}
