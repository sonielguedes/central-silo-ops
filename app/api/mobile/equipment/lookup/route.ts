import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

const maskToken = (token?: string) => {
  if (!token) return 'missing';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
};

export async function GET(req: NextRequest) {
  const fleetCode = req.nextUrl.searchParams.get('fleetCode');
  const companyToken = (req.nextUrl.searchParams.get('companyToken') || req.headers.get('x-company-token') || undefined)?.trim();
  const apiPort = ServerStorage.resolveApiPort(req.headers);
  const tenantId = ServerStorage.resolveTenantId(req.headers);
  const requestedTenantId = req.nextUrl.searchParams.get('tenantId') || req.headers.get('x-tenant-id');
  const expectedCompany = ServerStorage.getCompanyByTenantId(tenantId);

  console.info('[mobile/equipment/lookup] company validation', {
    apiPort,
    tenantId,
    companyFound: !!expectedCompany,
    expectedCompanyToken: maskToken(expectedCompany?.companyToken),
    receivedCompanyToken: maskToken(companyToken),
  });

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
