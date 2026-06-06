import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = ServerStorage.resolveTenantId(req.headers);
    const liveFleet = ServerStorage.getLiveFleet(tenantId);

    console.info(`[map-status] returned count=${liveFleet.length}`);

    return NextResponse.json(liveFleet);
  } catch (error) {
    console.error('[api/equipamentos/status] failed to fetch live state', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
