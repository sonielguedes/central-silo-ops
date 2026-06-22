import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { PimsValidationStorage } from '@/lib/integrations/pims/pims-validation-storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (rbac) return rbac;

  const items = PimsValidationStorage.listByTenant(tenant.tenantId);
  return NextResponse.json({ success: true, items, total: items.length });
}
