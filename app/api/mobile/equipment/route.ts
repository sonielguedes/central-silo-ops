import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { Equipment } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const resolvedTenantId = ServerStorage.resolveTenantId(req.headers);
    const body = await req.json() as Equipment & {
      equipmentId?: string;
      fleetCode?: string;
      name?: string;
      type?: string;
    };
    const tenantId = body.tenantId || resolvedTenantId;
    const equipment = {
      ...body,
      id: body.id || body.equipmentId,
      code: body.code || body.fleetCode,
      typeId: body.typeId || body.type || 'MOBILE',
      brand: body.brand || body.name || body.code || body.fleetCode || 'Equipamento',
      tenantId,
      entityStatus: body.entityStatus || 'ATIVO',
      mobileEnabled: Boolean(body.mobileEnabled),
    } as Equipment;

    if (!equipment.code) {
      return NextResponse.json({ error: 'fleetCode/code is required' }, { status: 400 });
    }

    if (!equipment.id) {
      return NextResponse.json({ error: 'equipmentId is required' }, { status: 400 });
    }

    const saved = ServerStorage.upsertEquipment(equipment, tenantId);
    console.info('[mobile/equipment] equipment synced', {
      tenantId: saved.tenantId,
      equipmentId: saved.id,
      fleetCode: saved.code,
      mobileEnabled: saved.mobileEnabled,
      mobileToken: saved.mobileToken ? `${saved.mobileToken.slice(0, 4)}...${saved.mobileToken.slice(-4)}` : 'missing',
    });

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
