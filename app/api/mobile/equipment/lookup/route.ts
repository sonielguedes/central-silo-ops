import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

const maskToken = (token?: string) => {
  if (!token) return 'missing';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
};

export async function GET(req: NextRequest) {
  const fleetCode = req.nextUrl.searchParams.get('fleetCode');
  const companyToken = (req.headers.get('x-company-token') || req.nextUrl.searchParams.get('companyToken') || undefined)?.trim();

  if (!companyToken) {
    return NextResponse.json({ error: 'X-Company-Token is required' }, { status: 401 });
  }

  const company = ServerStorage.getCompanyByToken(companyToken);

  if (!company || company.status === 'INATIVO') {
    console.warn('[mobile/equipment/lookup] invalid or inactive token', {
      receivedCompanyToken: maskToken(companyToken),
    });
    return NextResponse.json({ error: 'Token invalido ou instancia inativa' }, { status: 403 });
  }

  const lookupTenantId = company.tenantId;

  if (!fleetCode) {
    return NextResponse.json({ error: 'fleetCode is required' }, { status: 400 });
  }

  const equipment = ServerStorage.getEquipmentByFleetCode(fleetCode, lookupTenantId);

  console.info('[mobile/equipment/lookup] equipment validation', {
    companyId: company.id,
    companyTenantId: company.tenantId,
    lookupTenantId,
    fleetCode,
    mobileEnabled: equipment?.mobileEnabled,
    status: equipment?.status,
    receivedCompanyToken: maskToken(companyToken),
  });

  if (!equipment) {
    return NextResponse.json({ error: 'Frota nao cadastrada.' }, { status: 404 });
  }

  const validation = ServerStorage.validateMobileLookupEquipment(equipment, lookupTenantId);
  if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: validation.status });

  return NextResponse.json({
    id: equipment.id,
    code: equipment.code,
    name: `${equipment.brand} ${equipment.code}`,
    active: equipment.entityStatus === 'ATIVO',
    mobileEnabled: equipment.mobileEnabled,
    mobileToken: equipment.mobileToken,
    tenantId: lookupTenantId
  });
}
