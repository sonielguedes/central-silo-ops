import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { AuthStore } from '@/lib/auth/auth-store';
import { auditFromRequest } from '@/lib/audit/audit-log';

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, RATE_LIMITS.login);
  if (rl) return rl;

  try {
    const body = await req.json().catch(() => ({}));
    const identifier = String((body as Record<string, unknown>).email ?? (body as Record<string, unknown>).username ?? '').trim();
    const password = String((body as Record<string, unknown>).password ?? '');

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

    const session = await AuthStore.createSession(user);
    const response = NextResponse.json({
      user: AuthStore.toPublicUser(user),
      session: session.payload,
    });

    response.cookies.set(AuthStore.cookieName, session.cookie, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 8 * 60 * 60,
    });

    auditFromRequest(req, user.tenantId || user.defaultTenantId, {
      userId: user.id,
      action: 'LOGIN',
      entity: 'auth',
      entityId: user.id,
      metadata: {
        scope: user.scope,
        role: user.role,
      },
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'usuario ou senha invalidos' }, { status: 401 });
  }
}
