import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { requireMobileAuth } from '@/lib/auth/api-guard';

export async function GET(req: NextRequest) {
  const auth = requireMobileAuth(req);
  if (!auth.ok) return auth.response;

  const { tenantId } = auth;
  const fleetCode = req.nextUrl.searchParams.get('fleetCode');

  if (!fleetCode) {
    return NextResponse.json({ error: 'fleetCode is required' }, { status: 400 });
  }

  const equipment = ServerStorage.getEquipmentByFleetCode(fleetCode, tenantId);

  console.info('[mobile/equipment/lookup] equipment validation', {
    tenantId,
    fleetCode,
    mobileEnabled: equipment?.mobileEnabled,
    status: equipment?.status,
  });

  if (!equipment) {
    return NextResponse.json({ error: 'Frota nao cadastrada.' }, { status: 404 });
  }

  const validation = ServerStorage.validateMobileLookupEquipment(equipment, tenantId);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: validation.status });

  return NextResponse.json({
    id: equipment.id,
    code: equipment.code,
    name: equipment.brand + ' ' + equipment.code,
    active: equipment.entityStatus === 'ATIVO',
    mobileEnabled: equipment.mobileEnabled,
    mobileToken: equipment.mobileToken,
    tenantId,
  });
}
