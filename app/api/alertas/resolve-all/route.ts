import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { resolveAllAlerts } from '@/lib/alertas-builder';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const tenantId = ServerStorage.resolveTenantId(req.headers);
    const count = resolveAllAlerts(tenantId);

    console.info(`[alertas] resolve-all count=${count}`);
    return NextResponse.json({ resolved: count });
  } catch (error) {
    console.error('[alertas/resolve-all] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
