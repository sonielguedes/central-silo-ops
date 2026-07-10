import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { buildOperatorSheet } from '@/lib/operator-sheet-builder';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { journeyId: string } }) {
  try {
    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;
    const denied = requirePermission(req, 'operadores', 'visualizar', tenant.tenantId);
    if (denied) return denied;

    const fleetCode = new URL(req.url).searchParams.get('fleetCode')?.trim() || null;
    const journeyId = params.journeyId === 'atual' ? null : decodeURIComponent(params.journeyId);
    if (!journeyId && !fleetCode) return NextResponse.json({ error: 'journeyId ou fleetCode é obrigatório' }, { status: 400 });

    const result = buildOperatorSheet({ tenantId: tenant.tenantId, fleetCode, journeyId });
    return result.ok
      ? NextResponse.json(result.ficha)
      : NextResponse.json({ error: result.error, journeyId, fleetCode }, { status: result.status });
  } catch (error) {
    console.error('[OPERATOR_SHEET_API_ERROR]', { journeyId: params.journeyId, error });
    return NextResponse.json({ error: 'Falha ao carregar ficha operacional', journeyId: params.journeyId }, { status: 500 });
  }
}
