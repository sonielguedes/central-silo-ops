import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { Company } from '@/lib/types';
import { blockWriteInDemo, maskToken } from '@/lib/auth/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { requirePermission } from '@/lib/auth/rbac-server';
import { normalizeCompanyPortPayload } from '@/lib/company-form';
import { requireCsrf } from '@/lib/auth/csrf';

const generateCompanyToken = () => `CTK-${randomBytes(18).toString('hex').toUpperCase()}`;

const getUniqueCompanyToken = () => {
  const companies = ServerStorage.getCompanies();
  let token = generateCompanyToken();
  while (companies.some(company => company.companyToken === token)) {
    token = generateCompanyToken();
  }
  return token;
};

export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, RATE_LIMITS.adminToken);
    if (rl) return rl;

    const demoBlock = blockWriteInDemo(req);
    if (demoBlock) return demoBlock;
    const csrf = requireCsrf(req);
    if (csrf) return csrf;

    const rbac = requirePermission(req, 'administracao', 'administrar', 'global');
    if (rbac) return rbac;
    const body = await req.json() as { company?: Company; regenerate?: boolean };
    const company = body.company;

    if (!company?.id || !company.code) {
      return NextResponse.json({ error: 'company id/code is required' }, { status: 400 });
    }

    const normalized = normalizeCompanyPortPayload(company);
    const { portaApi, portaMqtt, ...companyPayload } = normalized as unknown as Record<string, unknown>;
    const apiPort = normalized.apiPort;
    const mqttPort = normalized.mqttPort;

    if (!apiPort) {
      return NextResponse.json({ error: 'Porta API obrigatoria' }, { status: 400 });
    }

    if (!mqttPort) {
      return NextResponse.json({ error: 'Porta MQTT obrigatoria' }, { status: 400 });
    }

    const companyToken = body.regenerate || !company.companyToken
      ? getUniqueCompanyToken()
      : company.companyToken;

    const saved = ServerStorage.upsertCompany({
      ...(companyPayload as unknown as Company),
      tenantId: company.tenantId || company.id,
      apiPort,
      mqttPort,
      status: company.status || 'ATIVO',
      companyToken,
      apiBaseUrl: normalized.apiBaseUrl || `https://api.siloops.com.br:${apiPort}`,
      mqttUrl: normalized.mqttUrl || `mqtt.siloops.com.br:${mqttPort}`,
    });

    const persisted = ServerStorage.getCompanyByTenantId(saved.tenantId) || ServerStorage.getCompanyByApiPort(apiPort) || saved;

    console.info('[admin/companies/token] company token persisted', {
      id: persisted.id,
      tenantId: persisted.tenantId,
      code: persisted.code,
      apiPort: persisted.apiPort,
      mqttPort: persisted.mqttPort,
      status: persisted.status,
      companyToken: maskToken(persisted.companyToken),
    });

    auditFromRequest(req, persisted.tenantId, {
      action: body.regenerate ? 'TOKEN_REGENERATE' : 'TOKEN_CREATE',
      entity: 'company',
      entityId: persisted.id,
      after: { code: persisted.code, status: persisted.status },
    });

    return NextResponse.json({ company: persisted });
  } catch (error) {
    console.error('[admin/companies/token] failed to persist company token', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
