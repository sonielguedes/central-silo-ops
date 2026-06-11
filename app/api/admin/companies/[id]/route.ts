import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { requireCsrf } from '@/lib/auth/csrf';
import { requirePermission } from '@/lib/auth/rbac-server';
import { normalizeCompanyPortPayload } from '@/lib/company-form';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { Company } from '@/lib/types';

/**
 * Strip ALL secret token fields from a company record for API responses.
 * Returns only tokenPreview — never the raw token.
 */
function sanitizeForListing(company: Company): Omit<Company, 'companyToken' | 'mobileToken' | 'apiToken' | 'token'> & { tokenPreview: string } {
  const { companyToken, mobileToken, apiToken, token, ...safe } = company as Company & Record<string, unknown>;
  void mobileToken; void apiToken; void token;
  const raw = companyToken as string | undefined;
  const tokenPreview = raw ? `${raw.slice(0, 6)}••••${raw.slice(-4)}` : 'sem token';
  return { ...safe, tokenPreview } as unknown as ReturnType<typeof sanitizeForListing>;
}

// ── PATCH /api/admin/companies/[id] ─────────────────────────────────────────
// Edit mutable fields only. Token, createdAt, and tenantId are immutable.

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  // 1. Session
  const user = resolveSessionFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Sessao nao identificada. Faca login novamente.' },
      { status: 401 },
    );
  }

  // 2. CSRF
  const csrfError = requireCsrf(req);
  if (csrfError) return csrfError;

  // 3. RBAC
  const rbacError = requirePermission(req, 'administracao', 'editar', user.tenantId ?? 'global');
  if (rbacError) return rbacError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  // 4. Load existing record
  const current = ServerStorage.getCompanies().find((c) => c.id === id);
  if (!current) {
    return NextResponse.json({ error: 'Empresa nao encontrada.' }, { status: 404 });
  }

  // 5. Scope guard: TENANT users can only edit their own company
  if (user.scope === 'TENANT') {
    const tid = user.tenantId ?? user.activeTenantId;
    if (current.tenantId !== tid && current.id !== tid) {
      return NextResponse.json({ error: 'Sem permissao para editar esta empresa.' }, { status: 403 });
    }
  }

  // 6. Normalize ports (may be in portaApi/portaMqtt form from the form)
  const normalized = normalizeCompanyPortPayload(body as object);
  const apiPort = normalized.apiPort ?? current.apiPort;
  const mqttPort = normalized.mqttPort ?? current.mqttPort;

  if (apiPort && (apiPort < 1 || apiPort > 65535)) {
    return NextResponse.json({ error: 'Porta API invalida (1-65535).' }, { status: 400 });
  }
  if (mqttPort && (mqttPort < 1 || mqttPort > 65535)) {
    return NextResponse.json({ error: 'Porta MQTT invalida (1-65535).' }, { status: 400 });
  }

  // 7. Uniqueness checks against other companies
  const others = ServerStorage.getCompanies().filter((c) => c.id !== id && c.entityStatus !== 'ARQUIVADO');

  if (body.code) {
    const codeStr = String(body.code).toUpperCase();
    if (others.some((c) => c.code.toUpperCase() === codeStr)) {
      return NextResponse.json({ error: `Codigo "${codeStr}" ja esta em uso.` }, { status: 409 });
    }
  }
  if (body.cnpj) {
    const cnpjDigits = String(body.cnpj).replace(/[^\d]/g, '');
    if (others.some((c) => c.cnpj?.replace(/[^\d]/g, '') === cnpjDigits)) {
      return NextResponse.json({ error: 'CNPJ ja cadastrado para outra empresa.' }, { status: 409 });
    }
  }
  if (body.domain) {
    const domainStr = String(body.domain).toLowerCase().trim();
    if (others.some((c) => c.domain?.toLowerCase().trim() === domainStr)) {
      return NextResponse.json({ error: `Dominio "${domainStr}" ja esta em uso.` }, { status: 409 });
    }
  }
  if (apiPort && others.some((c) => Number(c.apiPort) === apiPort)) {
    return NextResponse.json({ error: `Porta API ${apiPort} ja esta em uso.` }, { status: 409 });
  }
  if (mqttPort && others.some((c) => Number(c.mqttPort) === mqttPort)) {
    return NextResponse.json({ error: `Porta MQTT ${mqttPort} ja esta em uso.` }, { status: 409 });
  }

  const timestamp = new Date().toISOString();

  // 8. Build update — immutable fields (tenantId, createdAt, companyToken and aliases) are never overwritten
  const historyEntry = {
    timestamp,
    user: user.email ?? user.id,
    action: 'COMPANY_UPDATE',
    changes: Object.fromEntries(
      Object.keys(body)
        .filter((k) => !['companyToken', 'mobileToken', 'apiToken', 'token', 'tenantId', 'createdAt', 'id'].includes(k))
        .map((k) => [k, { old: (current as any)[k], new: (body as any)[k] }])
    ),
  };

  const updated: Company = {
    ...current,
    // Selectively apply only mutable fields from the body
    tradingName: body.tradingName ? String(body.tradingName) : current.tradingName,
    corporateName: body.corporateName ? String(body.corporateName) : current.corporateName,
    cnpj: body.cnpj ? String(body.cnpj) : current.cnpj,
    domain: body.domain !== undefined ? (body.domain ? String(body.domain).toLowerCase().trim() : undefined) : current.domain,
    code: body.code ? String(body.code).toUpperCase() : current.code,
    plan: body.plan ? (String(body.plan) as Company['plan']) : current.plan,
    status: body.status ? (String(body.status) as Company['status']) : current.status,
    apiPort: apiPort ?? current.apiPort,
    mqttPort: mqttPort ?? current.mqttPort,
    apiBaseUrl: apiPort
      ? (normalized.apiBaseUrl ?? `https://api.siloops.com.br:${apiPort}`)
      : current.apiBaseUrl,
    mqttUrl: mqttPort
      ? (normalized.mqttUrl ?? `mqtt.siloops.com.br:${mqttPort}`)
      : current.mqttUrl,
    // Immutable — never change
    id: current.id,
    tenantId: current.tenantId,
    createdAt: current.createdAt,
    createdBy: current.createdBy,
    companyToken: current.companyToken,
    mobileToken: current.mobileToken,
    apiToken: current.apiToken,
    token: current.token,
    // Increment version + append history
    version: (current.version ?? 1) + 1,
    history: [...(current.history ?? []), historyEntry],
    updatedAt: timestamp,
    updatedBy: user.email ?? user.id,
  };

  try {
    const saved = ServerStorage.upsertCompany(updated);
    auditFromRequest(req, saved.tenantId, {
      action: 'COMPANY_UPDATE',
      entity: 'company',
      entityId: saved.id,
      before: { code: current.code, status: current.status, apiPort: current.apiPort },
      after: { code: saved.code, status: saved.status, apiPort: saved.apiPort },
    });
    console.info('[api/admin/companies/[id]] PATCH company updated', {
      id: saved.id,
      code: saved.code,
      version: saved.version,
      by: user.email,
    });
    return NextResponse.json({ company: sanitizeForListing(saved) });
  } catch (error) {
    console.error('[api/admin/companies/[id]] PATCH failed', error);
    return NextResponse.json({ error: 'Erro interno ao atualizar empresa.' }, { status: 500 });
  }
}
