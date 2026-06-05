import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { equipmentId, mobileToken, operatorId, startTimestamp, offlineId } = body;

    const equipment = ServerStorage.getEquipmentById(equipmentId);
    if (!equipment) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    if (equipment.mobileToken !== mobileToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const shiftId = `shift-${Date.now()}`;
    ServerStorage.updateEquipment(equipmentId, {
      activeShiftId: shiftId,
      currentOperatorId: operatorId,
      status: 'trabalhando'
    });

    ServerStorage.saveEvent({
      offlineId: offlineId || `start-${Date.now()}`,
      equipmentId,
      type: 'SHIFT_START',
      timestamp: startTimestamp || new Date().toISOString(),
      payload: { operatorId, shiftId }
    });

    return NextResponse.json({ status: 'OK', shiftId });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
