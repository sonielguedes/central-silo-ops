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

  const validation = ServerStorage.validateMobileEquipment(equipment, equipment.mobileToken);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: validation.status });

  return NextResponse.json({
    id: equipment.id,
    code: equipment.code,
    name: `${equipment.brand} ${equipment.code}`,
    active: equipment.entityStatus === 'ATIVO',
    mobileEnabled: equipment.mobileEnabled,
    mobileToken: equipment.mobileToken,
    tenantId: ServerStorage.getTenantId()
  });
}
