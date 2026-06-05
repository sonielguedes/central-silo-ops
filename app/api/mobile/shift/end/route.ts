import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { equipmentId, mobileToken, endTimestamp, offlineId } = body;

    const equipment = ServerStorage.getEquipmentById(equipmentId);
    if (!equipment) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    if (equipment.mobileToken !== mobileToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    ServerStorage.updateEquipment(equipmentId, {
      activeShiftId: undefined,
      currentOperatorId: undefined,
      status: 'parada'
    });

    ServerStorage.saveEvent({
      offlineId: offlineId || `end-${Date.now()}`,
      equipmentId,
      type: 'SHIFT_END',
      timestamp: endTimestamp || new Date().toISOString(),
      payload: { }
    });

    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
