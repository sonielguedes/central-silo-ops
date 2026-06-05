import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

export async function GET(req: NextRequest) {
  const fleetCode = req.nextUrl.searchParams.get('fleetCode');
  const companyToken = req.nextUrl.searchParams.get('companyToken') || req.headers.get('x-company-token') || undefined;
  const tenantId = ServerStorage.resolveTenantId(req.headers);
  const requestedTenantId = req.nextUrl.searchParams.get('tenantId') || req.headers.get('x-tenant-id');

  if (!fleetCode) {
    return NextResponse.json({ error: 'fleetCode is required' }, { status: 400 });
  }

  if (requestedTenantId && requestedTenantId !== tenantId) {
    return NextResponse.json({ error: 'tenantId invalido para esta porta API' }, { status: 403 });
  }

  const companyValidation = ServerStorage.validateMobileCompany(tenantId, companyToken);
  if (!companyValidation.ok) {
    return NextResponse.json({ error: companyValidation.error }, { status: companyValidation.status });
  }

  const equipment = ServerStorage.getEquipmentByFleetCode(fleetCode, tenantId);
  if (!equipment) {
    return NextResponse.json({ error: 'Frota nao cadastrada.' }, { status: 404 });
  }

  const validation = ServerStorage.validateMobileLookupEquipment(equipment, tenantId);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: validation.status });

  return NextResponse.json({
    id: equipment.id,
    code: equipment.code,
    name: `${equipment.brand} ${equipment.code}`,
    active: equipment.entityStatus === 'ATIVO',
    mobileEnabled: equipment.mobileEnabled,
    mobileToken: equipment.mobileToken,
    tenantId
  });
}
