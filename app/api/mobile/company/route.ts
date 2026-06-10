import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { Company } from '@/lib/types';
import { blockWriteInDemo, maskToken } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { normalizeCompanyPortPayload } from '@/lib/company-form';
import { requireCsrf } from '@/lib/auth/csrf';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { requirePermission } from '@/lib/auth/rbac-server';

export async function POST(req: NextRequest) {
  try {
    const demoBlock = blockWriteInDemo(req);
    if (demoBlock) return demoBlock;
    const session = resolveSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Sessao nao identificada. Faca login novamente.' }, { status: 401 });
    }
    const csrf = requireCsrf(req);
    if (csrf) return csrf;

    const company = await req.json() as Company;
    const companyTenantId = company.tenantId || company.id;
    if (session.scope === 'TENANT' && session.tenantId && companyTenantId !== session.tenantId) {
      return NextResponse.json({ error: 'Tenant divergente da sessao' }, { status: 403 });
    }
    const rbac = requirePermission(req, 'administracao', 'editar', companyTenantId);
    if (rbac) return rbac;

    const normalized = normalizeCompanyPortPayload(company);
    const { portaApi, portaMqtt, ...companyPayload } = normalized as unknown as Record<string, unknown>;

    if (!company.id || !company.code) {
      return NextResponse.json({ error: 'company id/code is required' }, { status: 400 });
    }

    if (!company.companyToken) {
      return NextResponse.json({ error: 'companyToken is required' }, { status: 400 });
    }

    if (!normalized.apiPort) {
      return NextResponse.json({ error: 'Porta API obrigatoria' }, { status: 400 });
    }

    if (!normalized.mqttPort) {
      return NextResponse.json({ error: 'Porta MQTT obrigatoria' }, { status: 400 });
    }

    const saved = ServerStorage.upsertCompany({
      ...(companyPayload as unknown as Company),
      tenantId: company.tenantId || company.id,
      apiPort: normalized.apiPort,
      mqttPort: normalized.mqttPort,
      status: company.status || 'ATIVO',
      apiBaseUrl: normalized.apiBaseUrl || ('https://api.siloops.com.br:' + normalized.apiPort),
      mqttUrl: normalized.mqttUrl || (company.mqttUrl || ''),
    });

    console.info('[mobile/company] company synced', {
      tenantId: saved.tenantId,
      code: saved.code,
      apiPort: saved.apiPort,
      mqttPort: saved.mqttPort,
      status: saved.status,
      companyToken: maskToken(saved.companyToken),
    });

    auditFromRequest(req, saved.tenantId, {
      action: 'COMPANY_SYNC',
      entity: 'company',
      entityId: saved.id,
      after: { code: saved.code, status: saved.status },
    });

    return NextResponse.json({
      companyId: saved.id,
      tenantId: saved.tenantId,
      apiPort: saved.apiPort,
      companyToken: saved.companyToken,
      status: saved.status,
    });
  } catch (error) {
    console.error('[mobile/company] failed to persist company', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
