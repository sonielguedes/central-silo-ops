import { NextRequest, NextResponse } from 'next/server';
import { AuthStore } from '@/lib/auth/auth-store';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { clearCsrfCookie, requireCsrf } from '@/lib/auth/csrf';

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  const sessionCookie = req.cookies.get(AuthStore.cookieName)?.value;
  AuthStore.revokeSession(sessionCookie);

  const response = NextResponse.json({
    success: true,
    ok: true,
    message: 'Sessao encerrada com sucesso.',
  });
  response.cookies.set(AuthStore.cookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  clearCsrfCookie(response);

  auditFromRequest(req, 'global', {
    action: 'LOGOUT',
    entity: 'auth',
    entityId: 'session',
  });

  return response;
}
