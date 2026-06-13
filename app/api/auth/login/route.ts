import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { AuthStore } from '@/lib/auth/auth-store';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { generateCsrfToken, issueCsrfCookie } from '@/lib/auth/csrf';
import { ServerStorage } from '@/lib/server-storage';
import { validateCompanyAccess } from '@/lib/subscription/subscription-validator';
import { migrateCompanySubscription } from '@/lib/subscription/subscription-migrator';

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, RATE_LIMITS.login);
  if (rl) return rl;

  // ── 1. Parse body — parse error is not a credential error ────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'corpo da requisicao invalido' }, { status: 400 });
  }

  // ── 2. Validate credentials — only these cases yield 401 ─────────────────
  const identifier = String(body.email ?? body.username ?? '').trim();
  const password   = String(body.password ?? '');

  if (!identifier || !password) {
    return NextResponse.json({ error: 'usuario ou senha invalidos' }, { status: 401 });
  }

  const user = AuthStore.findUserByIdentifier(identifier);
  if (!user || user.status !== 'ATIVO') {
    return NextResponse.json({ error: 'usuario ou senha invalidos' }, { status: 401 });
  }

  const ok = await AuthStore.verifyPassword(user, password);
  if (!ok) {
    return NextResponse.json({ error: 'usuario ou senha invalidos' }, { status: 401 });
  }

  // ── 3. Validação de assinatura da empresa (TENANT scope) ─────────────────
  // PLATFORM scope (SUPER_ADMIN_SILO) sempre entra — recebe aviso mas não é bloqueado.
  let subscriptionWarning: string | undefined;
  if (user.scope === 'TENANT' && user.tenantId) {
    const rawCompany =
      ServerStorage.getCompanyByTenantId(user.tenantId) ??
      ServerStorage.getCompanies().find((c) => c.id === user.tenantId);

    if (rawCompany) {
      const { company } = migrateCompanySubscription(rawCompany);
      const access = validateCompanyAccess(company, user.role);

      if (!access.allowed) {
        // Bloqueia login para usuários comuns de empresa expirada/suspensa/cancelada
        auditFromRequest(req, user.tenantId, {
          userId: user.id,
          action: 'LOGIN_BLOCKED_SUBSCRIPTION',
          entity: 'auth',
          entityId: user.id,
          metadata: { subscriptionStatus: access.status, role: user.role },
        });
        return NextResponse.json(
          { error: access.message, code: access.code },
          { status: 403 },
        );      }

      if (access.status === 'EXPIRANDO') {
        subscriptionWarning = access.message;
      }
    }
  }

  // ── 4. Create session — I/O failure surfaces as 500, not 401 ─────────────
  let session: Awaited<ReturnType<typeof AuthStore.createSession>>;
  try {
    session = await AuthStore.createSession(user);
  } catch (error) {
    console.error('[auth/login] createSession failed', error);
    return NextResponse.json({ error: 'falha ao criar sessao' }, { status: 500 });
  }

  // ── 5. Build response with httpOnly session cookie + CSRF cookie ──────────
  const response = NextResponse.json({
    user:    AuthStore.toPublicUser(user),
    session: session.payload,
    ...(subscriptionWarning ? { subscriptionWarning } : {}),
  });

  response.cookies.set(AuthStore.cookieName, session.cookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    path:     '/',
    maxAge:   8 * 60 * 60,
  });
  issueCsrfCookie(response, generateCsrfToken());

  // ── 6. Audit — failure must never block a successful login ────────────────
  try {
    auditFromRequest(req, user.tenantId || user.defaultTenantId, {
      userId:   user.id,
      action:   'LOGIN',
      entity:   'auth',
      entityId: user.id,
      metadata: { scope: user.scope, role: user.role },
    });
  } catch (error) {
    console.warn('[auth/login] audit failed', error);
  }

  return response;
}

