import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { resolveCurrentTenantId } from '@/lib/auth/current-tenant';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = resolveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Sessao nao identificada. Faca login novamente.' }, { status: 401 });
  }

  if (session.role !== 'SUPER_ADMIN_SILO' && session.role !== 'ADMIN_EMPRESA') {
    return NextResponse.json({ error: 'Permissao insuficiente.' }, { status: 403 });
  }

  const tenantId = resolveCurrentTenantId(session);
  const company = ServerStorage.getCompanyByTenantId(tenantId) || ServerStorage.getCompanies().find((item) => item.id === tenantId) || null;

  if (!company) {
    return NextResponse.json({ error: 'Empresa nao encontrada.' }, { status: 404 });
  }

  return NextResponse.json({
    company: {
      id: company.id,
      tenantId: company.tenantId,
      code: company.code,
      tradingName: company.tradingName,
      corporateName: company.corporateName,
      plan: company.plan,
      status: company.status,
      apiPort: company.apiPort,
      mqttPort: company.mqttPort,
      apiBaseUrl: company.apiBaseUrl,
      mqttUrl: company.mqttUrl,
      domain: company.domain,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      entityStatus: company.entityStatus,
    },
  }, { headers: { 'Cache-Control': 'no-store' } });
}
