import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { requireCsrf } from '@/lib/auth/csrf';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { maskToken } from '@/lib/auth/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { Company } from '@/lib/types';
import { getMobileApiBaseUrl } from '@/lib/mobile-config';

/**
 * Endpoint administrativo de "Configuração Mobile" da empresa.
 *
 *  GET  /api/admin/companies/[id]/mobile
 *       Retorna os dados que alimentam o modal "Configuração Mobile":
 *       nome, código, tenantId, apiBaseUrl, mqttHost/porta, protocolo,
 *       token MASCARADO, status mobile e última conexão.
 *       Nunca retorna o token completo (para isso use o endpoint /token?purpose=qr).
 *
 *  POST /api/admin/companies/[id]/mobile  { action: 'enable' | 'disable' }
 *       Liga/desliga o acesso mobile (flag mobileEnabled) preservando o token.
 *
 * Regras:
 *  - SUPER_ADMIN_SILO / SUPER_ADMIN → qualquer empresa.
 *  - ADMIN_EMPRESA → apenas o próprio tenant.
 *  - Demais roles → 403.
 *  - POST exige CSRF e é auditado (MOBILE_ENABLED / MOBILE_DISABLED).
 *  - GET é auditado (MOBILE_CONFIG_VIEWED).
 */

const ALLOWED_ROLES = new Set(['SUPER_ADMIN_SILO', 'SUPER_ADMIN', 'ADMIN_EMPRESA']);

type MobileStatus = 'ATIVO' | 'DESATIVADO' | 'SEM_TOKEN';

function extractMqttHost(mqttUrl?: string): string {
  if (!mqttUrl) return 'mqtt.siloops.com.br';
  const withProto = mqttUrl.includes('://') ? mqttUrl : 'mqtt://' + mqttUrl;
  try {
    return new URL(withProto).hostname;
  } catch {
    return 'mqtt.siloops.com.br';
  }
}

function extractProtocol(apiBaseUrl?: string): 'HTTPS' | 'HTTP' {
  if (!apiBaseUrl) return 'HTTPS';
  return apiBaseUrl.startsWith('https') ? 'HTTPS' : 'HTTP';
}

function resolveMobileStatus(company: Company): MobileStatus {
  if (!company.companyToken) return 'SEM_TOKEN';
  if (company.mobileEnabled === false) return 'DESATIVADO';
  return 'ATIVO';
}

/** Última conexão = heartbeat/GPS mais recente entre os equipamentos do tenant. */
function resolveLastConnection(tenantId: string): string | null {
  try {
    const fleet = ServerStorage.getLiveFleet(tenantId);
    let latest = 0;
    for (const s of fleet) {
      const hb = s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).getTime() : 0;
      const gps = s.lastGpsAt ? new Date(s.lastGpsAt).getTime() : 0;
      latest = Math.max(latest, hb, gps);
    }
    return latest > 0 ? new Date(latest).toISOString() : null;
  } catch {
    return null;
  }
}

function authorize(req: NextRequest, company: Company) {
  const user = resolveSessionFromRequest(req);
  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Sessao nao identificada. Faca login novamente.' },
        { status: 401 },
      ),
    };
  }
  if (!ALLOWED_ROLES.has(user.role)) {
    return {
      error: NextResponse.json(
        { error: 'Permissao insuficiente para configuracao mobile.' },
        { status: 403 },
      ),
    };
  }
  if (user.role === 'ADMIN_EMPRESA') {
    const sessionTenant = user.activeTenantId ?? user.tenantId;
    if (!sessionTenant || sessionTenant !== company.tenantId) {
      return {
        error: NextResponse.json(
          { error: 'Acesso negado: empresa de outro tenant.' },
          { status: 403 },
        ),
      };
    }
  }
  return { user };
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const company = ServerStorage.getCompanies().find((c) => c.id === params.id);
  if (!company) {
    return NextResponse.json({ error: 'Empresa nao encontrada.' }, { status: 404 });
  }

  const auth = authorize(req, company);
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const mobileStatus = resolveMobileStatus(company);
  const lastConnection = resolveLastConnection(company.tenantId);

  auditFromRequest(req, company.tenantId, {
    action: 'MOBILE_CONFIG_VIEWED',
    entity: 'company',
    entityId: company.id,
    metadata: {
      accessedBy: user.email ?? user.id,
      accessedByRole: user.role,
      mobileStatus,
    },
  });

  return NextResponse.json({
    success: true,
    companyId: company.id,
    companyName: company.tradingName || company.corporateName || company.code,
    companyCode: company.code,
    tenantId: company.tenantId,
    apiBaseUrl: getMobileApiBaseUrl(company),
    apiPort: company.apiPort ?? null,
    mqttUrl: company.mqttUrl || '',
    mqttHost: extractMqttHost(company.mqttUrl),
    mqttPort: company.mqttPort ?? null,
    protocol: extractProtocol(company.apiBaseUrl),
    tokenPreview: company.companyToken ? maskToken(company.companyToken) : 'sem token',
    hasToken: Boolean(company.companyToken),
    mobileEnabled: company.mobileEnabled !== false,
    mobileStatus,
    lastConnection,
    companyStatus: company.status,
  });
}

// ── POST (enable / disable) ───────────────────────────────────────────────────

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const rl = checkRateLimit(req, RATE_LIMITS.adminToken);
  if (rl) return rl;

  const company = ServerStorage.getCompanies().find((c) => c.id === params.id);
  if (!company) {
    return NextResponse.json({ error: 'Empresa nao encontrada.' }, { status: 404 });
  }

  const auth = authorize(req, company);
  if ('error' in auth) return auth.error;
  const { user } = auth;

  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  let body: { action?: string };
  try {
    body = (await req.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  const action = body.action;
  if (action !== 'enable' && action !== 'disable') {
    return NextResponse.json(
      { error: "Acao invalida. Use 'enable' ou 'disable'." },
      { status: 400 },
    );
  }

  if (action === 'enable' && !company.companyToken) {
    return NextResponse.json(
      { error: 'Empresa sem token. Gere um token antes de ativar o acesso mobile.' },
      { status: 409 },
    );
  }

  const timestamp = new Date().toISOString();
  const updated: Company = {
    ...company,
    mobileEnabled: action === 'enable',
    version: (company.version ?? 1) + 1,
    history: [
      ...(company.history ?? []),
      { timestamp, user: user.email ?? user.id, action: action === 'enable' ? 'MOBILE_ENABLED' : 'MOBILE_DISABLED' },
    ],
    updatedAt: timestamp,
    updatedBy: user.email ?? user.id,
  };

  try {
    const saved = ServerStorage.upsertCompany(updated);

    auditFromRequest(req, saved.tenantId, {
      action: action === 'enable' ? 'MOBILE_ENABLED' : 'MOBILE_DISABLED',
      entity: 'company',
      entityId: saved.id,
      after: { code: saved.code, mobileEnabled: saved.mobileEnabled },
      metadata: { changedBy: user.email ?? user.id, role: user.role },
    });

    console.info('[admin/companies/[id]/mobile POST] mobile toggled', {
      id: saved.id,
      code: saved.code,
      mobileEnabled: saved.mobileEnabled,
      by: user.email,
    });

    return NextResponse.json({
      success: true,
      companyId: saved.id,
      mobileEnabled: saved.mobileEnabled,
      mobileStatus: resolveMobileStatus(saved),
    });
  } catch (error) {
    console.error('[admin/companies/[id]/mobile POST] toggle failed', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar acesso mobile.' }, { status: 500 });
  }
}
