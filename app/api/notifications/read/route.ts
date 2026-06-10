import { NextRequest, NextResponse } from 'next/server';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { markAlertsRead } from '@/lib/alertas-builder';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { resolveCurrentTenantId } from '@/lib/auth/current-tenant';
import { requireCsrf } from '@/lib/auth/csrf';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  const session = resolveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Sessao nao identificada. Faca login novamente.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as { ids?: string[]; all?: boolean };
  const tenantId = resolveCurrentTenantId(session);
  const ids = body.all ? undefined : Array.isArray(body.ids) ? body.ids : undefined;
  const result = markAlertsRead(tenantId, ids);

  auditFromRequest(req, tenantId, {
    userId: session.id,
    action: 'NOTIFICATION_READ',
    entity: 'notification',
    entityId: ids?.[0] || 'all',
    metadata: { count: result.read },
  });

  return NextResponse.json({
    read: result.read,
    unreadCount: result.alerts.filter((alert) => alert.status !== 'RESOLVIDO' && !alert.readAt).length,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
