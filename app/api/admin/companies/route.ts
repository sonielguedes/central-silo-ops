import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { maskToken } from '@/lib/auth/api-guard';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { hasPermission } from '@/lib/auth/rbac-shared';
import { requireCsrf } from '@/lib/auth/csrf';
import { requirePermission } from '@/lib/auth/rbac-server';
import { normalizeCompanyPortPayload } from '@/lib/company-form';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { AuthStore } from '@/lib/auth/auth-store';
import { Company } from '@/lib/types';

// -- helpers ------------------------------------------------------------------

function generateToken(): string {
  return `CTK-${randomBytes(24).toString('hex').toUpperCase()}`;
}

function uniqueToken(): string {
  const existing = new Set(ServerStorage.getCompanies().map((c) => c.companyToken));
  let token = generateToken();
  while (existing.has(token)) token = generateToken();
  return token;
}

function sanitizeTenantId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function isValidTenantId(id: string): boolean {
  if (!id || id.length < 2 || id.length > 63) return false;
  if (id.includes('..') || id.includes('/') || id.includes('\\')) return false;
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(id);
}

function sanitizeForListing(company: Company): Omit<Company, 'companyToken' | 'mobileToken' | 'apiToken' | 'token'> & { tokenPreview: string } {
  const { companyToken, mobileToken, apiToken, token, ...safe } = company as Company & Record<string, unknown>;
  void mobileToken; void apiToken; void token;
  const raw = companyToken as string | undefined;
  const tokenPreview = raw
    ? `${raw.slice(0, 6)}••••${raw.slice(-4)}`
    : 'sem token';
  return { ...safe, tokenPreview } as unknown as ReturnType<typeof sanitizeForListing>;
}

// -- GET /api/admin/companies -------------------------------------------------

export async function GET(req: NextRequest) {
  const user = resolveSessionFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Sessao nao identificada. Faca login novamente.' },
      { status: 401 },
    );
  }

  if (!hasPermission(user.role, 'administracao', 'visualizar')) {
    return NextResponse.json(
      { error: 'Permissao insuficiente: administracao/visualizar' },
      { status: 403 },
    );
  }

  try {
    const all = ServerStorage.getCompanies();
    const companies =
      user.scope === 'PLATFORM'
        ? all
        : all.filter((c) => {
            const tid = user.tenantId ?? user.activeTenantId;
            return c.tenantId === tid || c.id === tid;
          });

    return NextResponse.json({ companies: companies.map(sanitizeForListing) });
  } catch (error) {
    console.error('[api/admin/companies] GET failed', error);
    return NextResponse.json({ error: 'Erro interno ao carregar empresas.' }, { status: 500 });
  }
}

// -- POST /api/admin/companies ------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Session
  const user = resolveSessionFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Sessao nao identificada. Faca login novamente.' },
      { status: 401 },
    );
  }

  // 2. PLATFORM scope only
  if (user.scope !== 'PLATFORM') {
    return NextResponse.json(
      { error: 'Apenas administradores de plataforma podem criar empresas.' },
      { status: 403 },
    );
  }

  // 3. CSRF
  const csrfError = requireCsrf(req);
  if (csrfError) return csrfError;

  // 4. RBAC
  const rbacError = requirePermission(req, 'administracao', 'criar', 'global');
  if (rbacError) return rbacError;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  // 5. Required fields
  const { code, tradingName, corporateName, cnpj, plan, status, domain, adminName, adminEmail } =
    body as Record<string, unknown>;

  if (!code || !tradingName || !corporateName || !cnpj) {
    return NextResponse.json(
      { error: 'Campos obrigatorios ausentes: code, tradingName, corporateName, cnpj.' },
      { status: 400 },
    );
  }

  // 5a. Admin user — mandatory
  if (!adminName || typeof adminName !== 'string' || adminName.trim().length < 2) {
    return NextResponse.json(
      { error: 'adminName obrigatorio (minimo 2 caracteres).' },
      { status: 400 },
    );
  }
  if (!adminEmail || typeof adminEmail !== 'string') {
    return NextResponse.json({ error: 'adminEmail obrigatorio.' }, { status: 400 });
  }
  const adminEmailStr = adminEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmailStr)) {
    return NextResponse.json({ error: 'adminEmail invalido.' }, { status: 400 });
  }

  // 6. Ports
  const normalized = normalizeCompanyPortPayload(body as object);
  const apiPort = normalized.apiPort;
  const mqttPort = normalized.mqttPort;
  if (!apiPort || apiPort < 1 || apiPort > 65535) {
    return NextResponse.json({ error: 'Porta API invalida ou ausente (1-65535).' }, { status: 400 });
  }
  if (!mqttPort || mqttPort < 1 || mqttPort > 65535) {
    return NextResponse.json({ error: 'Porta MQTT invalida ou ausente (1-65535).' }, { status: 400 });
  }

  // 7. Uniqueness — companies
  const existing = ServerStorage.getCompanies().filter((c) => c.entityStatus !== 'ARQUIVADO');
  const codeStr = String(code).toUpperCase();
  const cnpjStr = String(cnpj).replace(/[^\d]/g, '');
  const domainStr = domain ? String(domain).toLowerCase().trim() : undefined;

  if (existing.some((c) => c.code.toUpperCase() === codeStr)) {
    return NextResponse.json({ error: `Codigo "${codeStr}" ja esta em uso.` }, { status: 409 });
  }
  if (existing.some((c) => c.cnpj?.replace(/[^\d]/g, '') === cnpjStr)) {
    return NextResponse.json({ error: 'CNPJ ja cadastrado para outra empresa.' }, { status: 409 });
  }
  if (domainStr && existing.some((c) => c.domain?.toLowerCase().trim() === domainStr)) {
    return NextResponse.json({ error: `Dominio "${domainStr}" ja esta em uso.` }, { status: 409 });
  }
  if (existing.some((c) => Number(c.apiPort) === apiPort)) {
    return NextResponse.json({ error: `Porta API ${apiPort} ja esta em uso.` }, { status: 409 });
  }
  if (existing.some((c) => Number(c.mqttPort) === mqttPort)) {
    return NextResponse.json({ error: `Porta MQTT ${mqttPort} ja esta em uso.` }, { status: 409 });
  }

  // 7a. Uniqueness — admin email
  const allUsers = AuthStore.listUsers();
  if (allUsers.some((u) => u.email.toLowerCase() === adminEmailStr)) {
    return NextResponse.json(
      { error: `Email "${adminEmailStr}" ja esta em uso por outro usuario.` },
      { status: 409 },
    );
  }

  // 8. Generate IDs server-side
  const companyToken = uniqueToken();
  const rawCode = codeStr.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const generatedId = `company-${rawCode}-${Date.now()}`;
  const rawTenantId = sanitizeTenantId(`${rawCode}-${Date.now()}`);
  const tenantId = isValidTenantId(rawTenantId) ? rawTenantId : generatedId;
  const timestamp = new Date().toISOString();

  const companyPayload: Company = {
    ...(body as Partial<Company>),
    id: generatedId,
    code: codeStr,
    tradingName: String(tradingName),
    corporateName: String(corporateName),
    cnpj: String(cnpj),
    domain: domainStr,
    tenantId,
    apiPort,
    mqttPort,
    apiBaseUrl: normalized.apiBaseUrl ?? `https://api.siloops.com.br:${apiPort}`,
    mqttUrl: normalized.mqttUrl ?? `mqtt.siloops.com.br:${mqttPort}`,
    companyToken,
    mobileToken: companyToken,
    apiToken: companyToken,
    token: companyToken,
    plan: String(plan ?? 'PILOTO') as Company['plan'],
    status: String(status ?? 'ATIVO') as Company['status'],
    entityStatus: 'ATIVO',
    version: 1,
    history: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    createdBy: user.email ?? user.id,
    updatedBy: user.email ?? user.id,
  };

  // 9. Atomic write (3 steps — each rolls back prior steps on failure)

  // Step A: persist company record
  let saved: Company;
  try {
    saved = ServerStorage.upsertCompany(companyPayload);
  } catch (storageError) {
    console.error('[api/admin/companies] POST storage write failed', storageError);
    return NextResponse.json({ error: 'Falha ao persistir empresa. Tente novamente.' }, { status: 500 });
  }

  const rollbackCompany = () => {
    try {
      ServerStorage.removeCompany(saved.id);
      ServerStorage.deleteTenantDir(tenantId);
    } catch (e) {
      console.error('[api/admin/companies] POST rollback(company) failed', e);
    }
  };

  // Step B: provision tenant directory
  try {
    ServerStorage.getCompanyByTenantId(tenantId);
  } catch (dirError) {
    console.error('[api/admin/companies] POST tenant dir provisioning failed', dirError);
    rollbackCompany();
    return NextResponse.json({ error: 'Falha ao provisionar diretorio do tenant.' }, { status: 500 });
  }

  // Step C: create ADMIN_EMPRESA user
  const tempPassword = randomBytes(8).toString('hex');
  const adminNameStr = adminName.trim();
  let createdAdminId: string | undefined;

  try {
    const newUser = await AuthStore.upsertUser({
      name: adminNameStr,
      email: adminEmailStr,
      username: adminEmailStr,
      tenantId,
      defaultTenantId: tenantId,
      scope: 'TENANT',
      role: 'ADMIN_EMPRESA',
      accessGroupId: 'role-admin-empresa',
      status: 'ATIVO',
      mustChangePassword: true,
    });
    createdAdminId = newUser.id;
    await AuthStore.updatePassword(newUser.id, tempPassword, true);
  } catch (userError) {
    console.error('[api/admin/companies] POST user creation failed', userError);
    if (createdAdminId) AuthStore.removeUser(createdAdminId);
    rollbackCompany();
    return NextResponse.json(
      { error: 'Falha ao criar usuario administrador da empresa.' },
      { status: 500 },
    );
  }

  // 10. Audit
  auditFromRequest(req, tenantId, {
    action: 'COMPANY_CREATE',
    entity: 'company',
    entityId: saved.id,
    after: { code: saved.code, tenantId: saved.tenantId, apiPort: saved.apiPort, adminEmail: adminEmailStr },
  });

  console.info('[api/admin/companies] POST company created', {
    id: saved.id,
    tenantId: saved.tenantId,
    code: saved.code,
    apiPort: saved.apiPort,
    companyToken: maskToken(saved.companyToken),
    adminEmail: adminEmailStr,
    by: user.email,
  });

  // 11. Return 201
  return NextResponse.json(
    {
      company: sanitizeForListing(saved),
      provisioningToken: saved.companyToken,
      adminUser: { id: createdAdminId!, name: adminNameStr, email: adminEmailStr },
      tempPassword,
    },
    { status: 201 },
  );
}
