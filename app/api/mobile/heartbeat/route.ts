import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { equipmentId, mobileToken, timestamp } = body;

    const equipment = ServerStorage.getEquipmentById(equipmentId);
    if (!equipment) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    if (equipment.mobileToken !== mobileToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    if (!equipment.mobileEnabled || equipment.entityStatus !== 'ATIVO') {
      return NextResponse.json({ error: 'Disabled' }, { status: 403 });
    }

    ServerStorage.updateEquipment(equipmentId, {
      lastHeartbeat: timestamp || new Date().toISOString(),
      status: 'trabalhando' // Update status based on heartbeat
    });

    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
