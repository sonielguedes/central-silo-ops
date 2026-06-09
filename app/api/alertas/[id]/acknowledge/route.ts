import { NextRequest, NextResponse } from 'next/server';
import { acknowledgeAlert } from '@/lib/alertas-builder';
import { blockWriteInDemo, requireTenant } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { requirePermission } from '@/lib/auth/rbac-server';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const demoBlock = blockWriteInDemo(req);
    if (demoBlock) return demoBlock;

    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;
    const { tenantId } = tenant;

    const rbac = requirePermission(req, 'alertas', 'editar', tenantId);
    if (rbac) return rbac;

    const alertId = params.id;
    if (!alertId) {
      return NextResponse.json({ error: 'ID do alerta obrigatorio' }, { status: 400 });
    }

    const alert = acknowledgeAlert(tenantId, alertId);
    if (!alert) {
      return NextResponse.json({ error: 'Alerta nao encontrado ou ja resolvido' }, { status: 404 });
    }

    auditFromRequest(req, tenantId, { action: 'ALERT_ACKNOWLEDGE', entity: 'alert', entityId: alertId });
    return NextResponse.json({ alert });
  } catch (error) {
    console.error('[alertas/acknowledge] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
