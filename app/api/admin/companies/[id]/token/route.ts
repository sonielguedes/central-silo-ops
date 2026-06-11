import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { requireCsrf } from '@/lib/auth/csrf';
import { requirePermission } from '@/lib/auth/rbac-server';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { maskToken } from '@/lib/auth/api-guard';
import { Company } from '@/lib/types';

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
 * POST /api/admin/companies/[id]/token
 *
 * Explicit token rotation endpoint.
 * - Generates a new unique token server-side.
 * - Synchronises all four token aliases (companyToken, mobileToken, apiToken, token).
 * - Returns the FULL token exactly once in the response body.
 * - All subsequent GET /api/admin/companies responses will show only tokenPreview.
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

  // 2. PLATFORM scope only for token rotation
  if (user.scope !== 'PLATFORM') {
    return NextResponse.json(
      { error: 'Apenas administradores de plataforma podem rotacionar tokens.' },
      { status: 403 },
    );
  }

  // 3. CSRF
  const csrfError = requireCsrf(req);
  if (csrfError) return csrfError;

  // 4. RBAC (requires administrar, the highest admin action)
  const rbacError = requirePermission(req, 'administracao', 'administrar', 'global');
  if (rbacError) return rbacError;

  // 5. Load existing record
  const current = ServerStorage.getCompanies().find((c) => c.id === id);
  if (!current) {
    return NextResponse.json({ error: 'Empresa nao encontrada.' }, { status: 404 });
  }

  // 6. Generate new unique token server-side
  const newToken = uniqueToken();
  const timestamp = new Date().toISOString();

  const historyEntry = {
    timestamp,
    user: user.email ?? user.id,
    action: 'TOKEN_REGENERATE',
  };

  const updated: Company = {
    ...current,
    companyToken: newToken,
    mobileToken: newToken,
    apiToken: newToken,
    token: newToken,
    version: (current.version ?? 1) + 1,
    history: [...(current.history ?? []), historyEntry],
    updatedAt: timestamp,
    updatedBy: user.email ?? user.id,
  };

  try {
    const saved = ServerStorage.upsertCompany(updated);

    auditFromRequest(req, saved.tenantId, {
      action: 'TOKEN_REGENERATE',
      entity: 'company',
      entityId: saved.id,
      after: { code: saved.code, tokenPreview: maskToken(saved.companyToken) },
    });

    console.info('[api/admin/companies/[id]/token] token rotated', {
      id: saved.id,
      code: saved.code,
      tokenPreview: maskToken(saved.companyToken),
      by: user.email,
    });

    // Return the full token exactly once — the caller must store it immediately.
    // Subsequent GETs will only return tokenPreview.
    return NextResponse.json({
      companyId: saved.id,
      newToken,
      tokenPreview: `${newToken.slice(0, 6)}••••${newToken.slice(-4)}`,
    });
  } catch (error) {
    console.error('[api/admin/companies/[id]/token] rotation failed', error);
    return NextResponse.json({ error: 'Erro interno ao rotacionar token.' }, { status: 500 });
  }
}
