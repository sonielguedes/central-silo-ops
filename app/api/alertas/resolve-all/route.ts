import { NextRequest, NextResponse } from 'next/server';
import { resolveAllAlerts } from '@/lib/alertas-builder';
import { blockWriteInDemo, requireTenant } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const demoBlock = blockWriteInDemo(req);
    if (demoBlock) return demoBlock;

    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;
    const { tenantId } = tenant;
    const count = resolveAllAlerts(tenantId);

    auditFromRequest(req, tenantId, { action: 'ALERT_RESOLVE_ALL', entity: 'alert', entityId: '*', metadata: { count } });
    return NextResponse.json({ resolved: count });
  } catch (error) {
    console.error('[alertas/resolve-all] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
