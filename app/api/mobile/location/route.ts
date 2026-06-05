import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { equipmentId, mobileToken, latitude, longitude, speed } = body;

    const equipment = ServerStorage.getEquipmentById(equipmentId);
    if (!equipment) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    if (equipment.mobileToken !== mobileToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    ServerStorage.updateEquipment(equipmentId, {
      lastLocation: { latitude, longitude },
      lastSignal: 'Agora'
    });

    // Also save as an event
    ServerStorage.saveEvent({
      offlineId: `loc-${Date.now()}-${Math.random()}`,
      equipmentId,
      type: 'LOCATION',
      timestamp: new Date().toISOString(),
      payload: { latitude, longitude, speed }
    });

    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
