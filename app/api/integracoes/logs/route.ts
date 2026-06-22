import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { IntegrationLogStorage } from '@/lib/integrations/integration-log-storage';
import type { IntegrationLogLevel, IntegrationSystem } from '@/lib/integrations/integration-job-types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (rbac) return rbac;

  const sp = req.nextUrl.searchParams;
  const items = IntegrationLogStorage.listByTenant(tenant.tenantId, {
    jobId: sp.get('jobId')?.trim() || undefined,
    configId: sp.get('configId')?.trim() || undefined,
    system: (sp.get('system')?.trim().toUpperCase() || undefined) as IntegrationSystem | undefined,
    level: (sp.get('level')?.trim().toUpperCase() || undefined) as IntegrationLogLevel | undefined,
    event: sp.get('event')?.trim() || undefined,
    from: sp.get('from')?.trim() || undefined,
    to: sp.get('to')?.trim() || undefined,
    q: sp.get('q')?.trim() || undefined,
  });

  return NextResponse.json({ success: true, items, total: items.length });
}
