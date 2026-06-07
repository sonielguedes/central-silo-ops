import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fleetCode = searchParams.get('fleetCode')?.trim();
    const journeyId = searchParams.get('journeyId')?.trim();

    if (!fleetCode) {
      return NextResponse.json({ error: 'fleetCode is required' }, { status: 400 });
    }

    const tenantId = ServerStorage.resolveTenantId(req.headers);

    // If journeyId provided, return that trail directly
    if (journeyId) {
      const points = ServerStorage.getTrail(tenantId, journeyId);
      console.info('[trail-api] returned points=' + points.length + ' journeyId=' + journeyId);
      return NextResponse.json({ fleetCode, journeyId, points });
    }

    // No journeyId: find equipment and use its current journeyId from live-state
    const liveFleet = ServerStorage.getLiveFleet(tenantId);
    const machine   = liveFleet.find(m => m.fleetCode === fleetCode);

    if (!machine || !machine.journeyId) {
      console.info('[trail-api] no active journey for fleetCode=' + fleetCode);
      return NextResponse.json({ fleetCode, journeyId: null, points: [] });
    }

    const points = ServerStorage.getTrail(tenantId, machine.journeyId);
    console.info('[trail-api] returned points=' + points.length + ' journeyId=' + machine.journeyId);
    return NextResponse.json({ fleetCode, journeyId: machine.journeyId, points });
  } catch (error) {
    console.error('[trail-api] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
