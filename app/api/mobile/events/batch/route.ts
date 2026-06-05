import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { header, events } = body;

    if (!header || !header.machineId) {
      return NextResponse.json({ error: 'Invalid batch format' }, { status: 400 });
    }

    const equipment = ServerStorage.getEquipmentById(header.machineId);
    if (!equipment) {
      return NextResponse.json({ error: 'Equipamento não encontrado' }, { status: 404 });
    }

    // Validation: Check if mobile is enabled for this equipment
    // Usually we would also check a token in the header for each batch
    // but the spec says "Validar mobileToken". Let's assume it might be in the payload of events
    // or as a generic validation for the equipment.

    const results = events.map((event: any) => {
      // Validate mobileToken for each event as per requirement
      if (event.data?.mobileToken !== equipment.mobileToken) {
        return { offlineId: event.uuid, status: 'REJECTED', reason: 'Token inválido' };
      }

      const status = ServerStorage.saveEvent({
        offlineId: event.uuid,
        equipmentId: equipment.id,
        type: event.type,
        timestamp: new Date(event.timestamp).toISOString(),
        payload: event.data
      });

      return { offlineId: event.uuid, status };
    });

    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
