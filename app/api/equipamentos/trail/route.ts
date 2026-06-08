import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { requireTenant } from '@/lib/auth/api-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;
    const { tenantId } = tenant;

    const { searchParams } = new URL(req.url);
    const fleetCode = searchParams.get('fleetCode')?.trim();
    const journeyId = searchParams.get('journeyId')?.trim();

    if (!fleetCode) {
      return NextResponse.json({ error: 'fleetCode is required' }, { status: 400 });
    }

    if (journeyId) {
      const points = ServerStorage.getTrail(tenantId, journeyId);
      return NextResponse.json({ fleetCode, journeyId, points });
    }

    const liveFleet = ServerStorage.getLiveFleet(tenantId);
    const machine = liveFleet.find(m => m.fleetCode === fleetCode);

    if (!machine || !machine.journeyId) {
      return NextResponse.json({ fleetCode, journeyId: null, points: [] });
    }

    const points = ServerStorage.getTrail(tenantId, machine.journeyId);
    return NextResponse.json({ fleetCode, journeyId: machine.journeyId, points });
  } catch (error) {
    console.error('[trail-api] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
