import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { PimsDispatchStorage } from '@/lib/integrations/pims/pims-dispatch-storage';
import type { PimsDispatchStatus } from '@/lib/integrations/pims/pims-dispatch-types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const perm = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (perm) return perm;

  const sp = req.nextUrl.searchParams;
  const items = PimsDispatchStorage.listByTenant(tenant.tenantId, {
    status: (sp.get('status')?.trim().toUpperCase() || undefined) as PimsDispatchStatus | undefined,
    q: sp.get('q')?.trim() || undefined,
    from: sp.get('from')?.trim() || undefined,
    to: sp.get('to')?.trim() || undefined,
  });

  return NextResponse.json({ success: true, items, total: items.length });
}
