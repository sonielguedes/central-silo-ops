import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

export async function GET(req: NextRequest) {
  try {
    const tenantId = ServerStorage.resolveTenantId(req.headers);
    const liveFleet = ServerStorage.getLiveFleet(tenantId);

    return NextResponse.json(liveFleet);
  } catch (error) {
    console.error('[api/equipamentos/status] failed to fetch live state', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
