import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { requireMobileAuth } from '@/lib/auth/api-guard';
import { checkRateLimit } from '@/lib/security/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, { maxRequests: 120, windowMs: 60000, prefix: 'mobile-loc' });
    if (rl) return rl;

    const auth = requireMobileAuth(req);
    if (!auth.ok) return auth.response;

    const { tenantId, companyToken } = auth;
    const body = await req.json();
    const { equipmentId, mobileToken, latitude, longitude, speed } = body;

    const validation = ServerStorage.validateMobileEquipment(
      ServerStorage.getEquipmentById(equipmentId, tenantId),
      mobileToken,
      tenantId,
      companyToken
    );
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: validation.status });

    ServerStorage.updateEquipment(equipmentId, {
      lastLocation: { latitude, longitude },
      lastSignal: 'Agora'
    }, tenantId);

    ServerStorage.updateLiveState(tenantId, equipmentId, validation.equipment.code, {
      latitude,
      longitude,
      speed,
      lastGpsAt: new Date().toISOString()
    });

    // Also save as an event
    ServerStorage.saveEvent({
      offlineId: `loc-${Date.now()}-${Math.random()}`,
      equipmentId,
      type: 'LOCATION',
      timestamp: new Date().toISOString(),
      payload: { latitude, longitude, speed }
    }, tenantId);

    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
