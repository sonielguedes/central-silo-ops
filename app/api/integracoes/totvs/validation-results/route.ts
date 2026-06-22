import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { TotvsValidationStorage } from '@/lib/integrations/totvs/totvs-validation-storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (rbac) return rbac;

  const sp = req.nextUrl.searchParams;
  const items = TotvsValidationStorage.listByTenant(tenant.tenantId).filter((item) => {
    const status = sp.get('status')?.trim().toUpperCase();
    if (status && item.status !== status) return false;
    const type = sp.get('targetDataType')?.trim().toUpperCase();
    if (type && item.targetDataType !== type) return false;
    return true;
  });

  return NextResponse.json({ success: true, items, total: items.length });
}
