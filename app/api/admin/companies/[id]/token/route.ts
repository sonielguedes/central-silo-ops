import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { requireCsrf } from '@/lib/auth/csrf';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { maskToken } from '@/lib/auth/api-guard';
import { Company } from '@/lib/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateToken(): string {
  return `CTK-${randomBytes(24).toString('hex').toUpperCase()}`;
}

function uniqueToken(): string {
  const existing = new Set(ServerStorage.getCompanies().map((c) => c.companyToken));
  let token = generateToken();
  while (existing.has(token)) token = generateToken();
  return token;
}

/**
 * Roles that are allowed to retrieve the full company token.
 * CONSULTA, GESTOR_COA, OPERADOR_APK and any other non-admin roles are blocked.
 */
const ALLOWED_ROLES = new Set(['SUPER_ADMIN_SILO', 'SUPER_ADMIN', 'ADMIN_EMPRESA']);

// ── GET /api/admin/companies/[id]/token ──────────────────────────────────────
/**
 * Returns the EXISTING full company token — never generates a new one.
 *
 * Rules:
 *  - SUPER_ADMIN_SILO / SUPER_ADMIN → can access any company.
 *  - ADMIN_EMPRESA → only for their own tenant (tenantId must match session).
 *  - CONSULTA, GESTOR_COA, OPERADOR_APK and others → 403.
 *  - Registers COMPANY_TOKEN_VIEWED in the audit log.
 *  - Never prints the full token in server logs — always maskToken.
 *
 * Query param:
 *  - purpose=reveal | copy  (default: reveal) — stored in the audit trail.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  const purpose = req.nextUrl.searchParams.get('purpose') ?? 'reveal';

  // 1. Session
  const user = resolveSessionFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Sessao nao identificada. Faca login novamente.' },
      { status: 401 },
    );
  }

  // 2. RBAC — role-level gate
  if (!ALLOWED_ROLES.has(user.role)) {
    return NextResponse.json(
      { error: 'Permissao insuficiente para visualizar token completo.' },
      { status: 403 },
    );
  }

  // 3. Locate company
  const company = ServerStorage.getCompanies().find((c) => c.id === id);
  if (!company) {
    return NextResponse.json({ error: 'Empresa nao encontrada.' }, { status: 404 });
  }

  // 4. ADMIN_EMPRESA cross-tenant guard
  //    They may only read the token for their own tenant.
  if (user.role === 'ADMIN_EMPRESA') {
    const sessionTenant = user.activeTenantId ?? user.tenantId;
    if (!sessionTenant || sessionTenant !== company.tenantId) {
      return NextResponse.json(
        { error: 'Acesso negado: token de outro tenant.' },
        { status: 403 },
      );
    }
  }

  // 5. Token must exist — never auto-generate here
  const companyToken = company.companyToken;
  if (!companyToken) {
    return NextResponse.json(
      { error: 'Empresa sem token configurado. Use "Gerar token" primeiro.' },
      { status: 404 },
    );
  }

  // 6. Audit — never log the full token
  auditFromRequest(req, company.tenantId, {
    action: 'COMPANY_TOKEN_VIEWED',
    entity: 'company',
    entityId: company.id,
    metadata: {
      purpose,
      tokenPreview: maskToken(companyToken),
      accessedBy: user.email ?? user.id,
      accessedByRole: user.role,
    },
  });

  console.info('[api/admin/companies/[id]/token GET] token accessed', {
    companyId: company.id,
    tenantId: company.tenantId,
    code: company.code,
    tokenPreview: maskToken(companyToken),
    purpose,
    by: user.email,
    role: user.role,
  });

  return NextResponse.json({
    success: true,
    companyId: company.id,
    tenantId: company.tenantId,
    companyToken,
    maskedToken: maskToken(companyToken),
  });
}

// ── POST /api/admin/companies/[id]/token ─────────────────────────────────────
/**
 * Explicit token rotation endpoint — the ONLY action that creates a new token.
 * - Generates a new unique token server-side.
 * - Synchronises all four token aliases (companyToken, mobileToken, apiToken, token).
 * - Returns the FULL new token exactly once in the response body.
 * - PLATFORM scope (SUPER_ADMIN_SILO / SUPER_ADMIN) only.
 * - Requires CSRF.
 * - Registers COMPANY_TOKEN_ROTATED in the audit log.
 */
export async function POST(
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

  // 2. Only PLATFORM admins may rotate tokens
  if (user.scope !== 'PLATFORM') {
    return NextResponse.json(
      { error: 'Apenas administradores de plataforma podem rotacionar tokens.' },
      { status: 403 },
    );
  }

  if (!ALLOWED_ROLES.has(user.role)) {
    return NextResponse.json(
      { error: 'Permissao insuficiente para rotacionar token.' },
      { status: 403 },
    );
  }

  // 3. CSRF
  const csrfError = requireCsrf(req);
  if (csrfError) return csrfError;

  // 4. Load existing record
  const current = ServerStorage.getCompanies().find((c) => c.id === id);
  if (!current) {
    return NextResponse.json({ error: 'Empresa nao encontrada.' }, { status: 404 });
  }

  // 5. Generate new unique token server-side
  const newToken = uniqueToken();
  const timestamp = new Date().toISOString();

  const historyEntry = {
    timestamp,
    user: user.email ?? user.id,
    action: 'COMPANY_TOKEN_ROTATED',
  };

  const updated: Company = {
    ...current,
    companyToken: newToken,
    mobileToken:  newToken,
    apiToken:     newToken,
    token:        newToken,
    version:      (current.version ?? 1) + 1,
    history:      [...(current.history ?? []), historyEntry],
    updatedAt:    timestamp,
    updatedBy:    user.email ?? user.id,
  };

  try {
    const saved = ServerStorage.upsertCompany(updated);

    auditFromRequest(req, saved.tenantId, {
      action: 'COMPANY_TOKEN_ROTATED',
      entity: 'company',
      entityId: saved.id,
      after: {
        code: saved.code,
        tokenPreview: maskToken(saved.companyToken),
      },
    });

    console.info('[api/admin/companies/[id]/token POST] token rotated', {
      id: saved.id,
      code: saved.code,
      tokenPreview: maskToken(saved.companyToken),
      by: user.email,
    });

    return NextResponse.json({
      companyId: saved.id,
      newToken,
      tokenPreview: maskToken(saved.companyToken),
    });
  } catch (error) {
    console.error('[api/admin/companies/[id]/token POST] rotation failed', error);
    return NextResponse.json({ error: 'Erro interno ao rotacionar token.' }, { status: 500 });
  }
}
