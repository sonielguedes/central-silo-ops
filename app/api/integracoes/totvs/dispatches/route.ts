import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { TotvsDispatchService } from '@/lib/integrations/totvs';
import type { TotvsDispatchDataType, TotvsDispatchStatus } from '@/lib/integrations/totvs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const perm = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (perm) return perm;

  const sp = req.nextUrl.searchParams;
  const items = TotvsDispatchService.list(tenant.tenantId, {
    status: (sp.get('status')?.trim().toUpperCase() || undefined) as TotvsDispatchStatus | undefined,
    dataType: (sp.get('dataType')?.trim().toUpperCase() || undefined) as TotvsDispatchDataType | undefined,
    fleetCode: sp.get('fleetCode')?.trim() || undefined,
    comboioFleetCode: sp.get('comboioFleetCode')?.trim() || undefined,
    operatorRegistration: sp.get('operatorRegistration')?.trim() || undefined,
    driverRegistration: sp.get('driverRegistration')?.trim() || undefined,
    from: sp.get('from')?.trim() || undefined,
    to: sp.get('to')?.trim() || undefined,
    q: sp.get('q')?.trim() || undefined,
  });

  return NextResponse.json({ success: true, items, total: items.length });
}
