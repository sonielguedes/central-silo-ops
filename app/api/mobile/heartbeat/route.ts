import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { requireMobileAuth } from '@/lib/auth/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, RATE_LIMITS.mobileHeartbeat);
    if (rl) return rl;

    const auth = requireMobileAuth(req);
    if (!auth.ok) return auth.response;

    const { tenantId, companyToken } = auth;
    const body = await req.json();
    const { equipmentId, mobileToken, timestamp, latitude, longitude, speed } = body;

    // Log GPS payload for debugging (remove after confirmed working)
    console.log(`[heartbeat] equip=${equipmentId} tenant=${tenantId} lat=${latitude} lng=${longitude} speed=${speed}`);

    const validation = ServerStorage.validateMobileEquipment(
      ServerStorage.getEquipmentById(equipmentId, tenantId),
      mobileToken,
      tenantId,
      companyToken
    );
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: validation.status });

    const now = timestamp || new Date().toISOString();

    ServerStorage.updateEquipment(equipmentId, {
      lastHeartbeat: now,
      status: 'trabalhando'
    }, tenantId);

    // Build GPS update -- rejeita null, 0,0 e coordenadas fora do range geografico
    const gpsUpdate: Record<string, unknown> = {};
    const lat = typeof latitude  === 'number' && Number.isFinite(latitude)  ? latitude  : undefined;
    const lng = typeof longitude === 'number' && Number.isFinite(longitude) ? longitude : undefined;
    const gpsValid =
      lat !== undefined && lng !== undefined &&
      !(lat === 0 && lng === 0) &&
      lat > -90 && lat < 90 &&
      lng > -180 && lng < 180;

    if (gpsValid) {
      gpsUpdate.latitude  = lat;
      gpsUpdate.longitude = lng;
      gpsUpdate.lastGpsAt = now;
      if (typeof speed === 'number' && Number.isFinite(speed)) {
        gpsUpdate.speed    = speed;
        gpsUpdate.speedKmh = Math.round(speed * 3.6 * 10) / 10;
      }
    } else if (lat !== undefined || lng !== undefined) {
      console.warn(`[heartbeat] GPS rejeitado equip=${equipmentId} lat=${latitude} lng=${longitude}`);
    }

    ServerStorage.updateLiveState(tenantId, equipmentId, validation.equipment.code, {
      status: 'ONLINE',
      lastHeartbeatAt: now,
      ...gpsUpdate,
    } as Parameters<typeof ServerStorage.updateLiveState>[3]);

    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
