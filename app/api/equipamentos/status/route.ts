import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { requireTenant } from '@/lib/auth/api-guard';
import type { EquipmentLiveState } from '@/lib/types';

export const dynamic = 'force-dynamic';

/**
 * Normalizes a liveFleet item to guarantee:
 * - speedKmh: calculated from speed (m/s) when not sent by APK
 * - horimetro: canonical alias for hourmeterCurrent for the Operational Map
 * - rpm: passed through directly (when available via CAN/APK)
 * - Invalid GPS (0,0 or out of range) is discarded before reaching the map
 */
function normalizeForMap(s: EquipmentLiveState) {
  // Calculate speedKmh if APK sent speed in m/s and did not send speedKmh
  const speedKmh = s.speedKmh ?? (s.speed != null ? Math.round(s.speed * 3.6 * 10) / 10 : undefined);

  // Ensure invalid coordinates do not reach the map
  const hasValidGps =
    s.latitude  != null && s.longitude != null &&
    !(s.latitude === 0 && s.longitude === 0) &&
    s.latitude  > -90  && s.latitude  < 90 &&
    s.longitude > -180 && s.longitude < 180;

  return {
    ...s,
    // Extra fields for the Operational Map
    equipmentCode: s.fleetCode,
    speedKmh,
    horimetro: s.hourmeterCurrent,
    rpm:       s.rpm,
    // GPS: clear if invalid so the map shows the alert instead of pinning at 0,0
    latitude:  hasValidGps ? s.latitude  : undefined,
    longitude: hasValidGps ? s.longitude : undefined,
  };
}

export async function GET(req: NextRequest) {
  try {
    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;

    const liveFleet = ServerStorage.getLiveFleet(tenant.tenantId);
    return NextResponse.json(liveFleet.map(normalizeForMap));
  } catch (error) {
    console.error('[api/equipamentos/status] failed to fetch live state', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
