import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

export async function GET(req: NextRequest) {
  const fleetCode = req.nextUrl.searchParams.get('fleetCode');

  if (!fleetCode) {
    return NextResponse.json({ error: 'fleetCode is required' }, { status: 400 });
  }

  const equipment = ServerStorage.getEquipmentByFleetCode(fleetCode);

  if (!equipment) {
    return NextResponse.json({ error: 'Frota não cadastrada.' }, { status: 404 });
  }

  if (equipment.entityStatus !== 'ATIVO') {
    return NextResponse.json({ error: 'Frota inativa.' }, { status: 403 });
  }

  if (!equipment.mobileEnabled) {
    return NextResponse.json({ error: 'Acesso mobile desabilitado para esta frota.' }, { status: 403 });
  }

  return NextResponse.json({
    id: equipment.id,
    code: equipment.code,
    name: `${equipment.brand} ${equipment.code}`,
    active: equipment.entityStatus === 'ATIVO',
    mobileEnabled: equipment.mobileEnabled,
    mobileToken: equipment.mobileToken,
    tenantId: equipment.tenantId
  });
}
