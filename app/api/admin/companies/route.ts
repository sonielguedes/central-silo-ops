import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { maskToken } from '@/lib/auth/api-guard';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/rbac-shared';
import { Company } from '@/lib/types';

function maskCompany(company: Company): Omit<Company, 'companyToken'> & { companyToken: string } {
  return {
    ...company,
    companyToken: maskToken(company.companyToken),
  };
}

export async function GET(req: NextRequest) {
  // 1. Require authenticated session
  const user = resolveSessionFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Sessao nao identificada. Faca login novamente.' },
      { status: 401 },
    );
  }

  // 2. RBAC: must have 'administracao'/'visualizar'
  if (!hasPermission(user.role, 'administracao', 'visualizar')) {
    return NextResponse.json(
      { error: 'Permissao insuficiente: administracao/visualizar' },
      { status: 403 },
    );
  }

  try {
    const all = ServerStorage.getCompanies();

    let companies: Company[];
    if (user.scope === 'PLATFORM') {
      // PLATFORM admins see every company
      companies = all;
    } else {
      // TENANT users see only their own company
      const tenantId = user.tenantId ?? user.activeTenantId;
      companies = all.filter(
        (c) => c.tenantId === tenantId || c.id === tenantId,
      );
    }

    // Never expose full tokens
    const masked = companies.map(maskCompany);

    return NextResponse.json({ companies: masked });
  } catch (error) {
    console.error('[api/admin/companies] GET failed', error);
    return NextResponse.json({ error: 'Erro interno ao carregar empresas.' }, { status: 500 });
  }
}
