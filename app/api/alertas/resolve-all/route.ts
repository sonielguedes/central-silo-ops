import { NextRequest, NextResponse } from 'next/server';
import { resolveAllAlerts } from '@/lib/alertas-builder';
import { blockWriteInDemo, requireTenant } from '@/lib/auth/api-guard';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { hasPermission } from '@/lib/auth/rbac-shared';
import { requireCsrf } from '@/lib/auth/csrf';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const demoBlock = blockWriteInDemo(req);
    if (demoBlock) return demoBlock;
    const csrf = requireCsrf(req);
    if (csrf) return csrf;

    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;
    const { tenantId } = tenant;

    const session = resolveSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Sessao nao identificada. Faca login novamente.' }, { status: 401 });
    }

    const canResolveAlerts = hasPermission(session.role, 'alertas', 'editar');
    const canAdminister = hasPermission(session.role, 'administracao', 'editar');
    if (!canResolveAlerts && !canAdminister) {
      auditFromRequest(req, tenantId, {
        action: 'PERMISSION_DENIED',
        entity: 'alert',
        entityId: '*',
        metadata: {
          userId: session.id,
          userName: session.name,
          role: session.role,
          required: ['alertas:editar', 'administracao:editar'],
        },
      });
      return NextResponse.json({ error: 'Permissao insuficiente.' }, { status: 403 });
    }

    const count = resolveAllAlerts(tenantId);
    auditFromRequest(req, tenantId, { action: 'ALERT_RESOLVE_ALL', entity: 'alert', entityId: '*', metadata: { count } });
    return NextResponse.json({ resolved: count });
  } catch (error) {
    console.error('[alertas/resolve-all] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
