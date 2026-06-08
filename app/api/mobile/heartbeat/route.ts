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
    const { equipmentId, mobileToken, timestamp } = body;

    const validation = ServerStorage.validateMobileEquipment(
      ServerStorage.getEquipmentById(equipmentId, tenantId),
      mobileToken,
      tenantId,
      companyToken
    );
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: validation.status });

    ServerStorage.updateEquipment(equipmentId, {
      lastHeartbeat: timestamp || new Date().toISOString(),
      status: 'trabalhando'
    }, tenantId);

    ServerStorage.updateLiveState(tenantId, equipmentId, validation.equipment.code, {
      status: 'ONLINE',
      lastHeartbeatAt: timestamp || new Date().toISOString()
    });

    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
