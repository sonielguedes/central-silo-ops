import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { buildOperatorSheet } from '@/lib/operator-sheet-builder';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { journeyId: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const denied = requirePermission(req, 'operadores', 'visualizar', tenant.tenantId);
  if (denied) return denied;

  const fleetCode = new URL(req.url).searchParams.get('fleetCode')?.trim();
  if (!fleetCode) return NextResponse.json({ error: 'fleetCode is required' }, { status: 400 });

  const result = buildOperatorSheet({
    tenantId: tenant.tenantId,
    fleetCode,
    journeyId: params.journeyId === 'atual' ? null : decodeURIComponent(params.journeyId),
  });
  return result.ok
    ? NextResponse.json(result.ficha)
    : NextResponse.json({ error: result.error }, { status: result.status });
}
