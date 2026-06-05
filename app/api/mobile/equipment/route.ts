import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { Equipment } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const equipment = await req.json() as Equipment;

    if (!equipment.code) {
      return NextResponse.json({ error: 'fleetCode/code is required' }, { status: 400 });
    }

    if (!equipment.id) {
      return NextResponse.json({ error: 'equipmentId is required' }, { status: 400 });
    }

    const saved = ServerStorage.upsertEquipment(equipment);
    return NextResponse.json({
      equipmentId: saved.id,
      fleetCode: saved.code,
      tenantId: saved.tenantId,
      mobileEnabled: saved.mobileEnabled,
      mobileToken: saved.mobileToken,
      status: saved.status,
    });
  } catch (error) {
    console.error('[mobile/equipment] failed to persist equipment', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
