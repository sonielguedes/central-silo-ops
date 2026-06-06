import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

export async function POST(req: NextRequest) {
  try {
    const companyToken = (req.headers.get('x-company-token') || undefined)?.trim();
    if (!companyToken) return NextResponse.json({ error: 'X-Company-Token is required' }, { status: 401 });

    const company = ServerStorage.getCompanyByToken(companyToken);
    if (!company || company.status === 'INATIVO') return NextResponse.json({ error: 'Token invalido' }, { status: 403 });

    const tenantId = company.tenantId;
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
