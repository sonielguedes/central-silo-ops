import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { getFuelJourneyDetails } from '@/lib/fuel-journeys';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { journeyId: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const perm = requirePermission(req, 'combustivel', 'visualizar', tenant.tenantId);
  if (perm) return perm;

  const companyCode = req.nextUrl.searchParams.get('companyCode')?.trim() || undefined;
  const item = getFuelJourneyDetails(tenant.tenantId, params.journeyId, companyCode);
  if (!item) {
    return NextResponse.json({ success: false, error: 'Jornada nao encontrada' }, { status: 404 });
  }
  return NextResponse.json({ success: true, item });
}
