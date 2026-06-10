import { NextRequest, NextResponse } from 'next/server';
import { generateAlerts, getUnreadAlertCount } from '@/lib/alertas-builder';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { resolveCurrentTenantId } from '@/lib/auth/current-tenant';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = resolveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Sessao nao identificada. Faca login novamente.' }, { status: 401 });
  }

  const tenantId = resolveCurrentTenantId(session);
  const alerts = generateAlerts(tenantId)
    .filter((alert) => alert.status !== 'RESOLVIDO')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  return NextResponse.json({
    unreadCount: getUnreadAlertCount(tenantId),
    alerts,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
