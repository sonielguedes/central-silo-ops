import { NextRequest, NextResponse } from 'next/server';
import { AuthStore } from '@/lib/auth/auth-store';
import { auditFromRequest } from '@/lib/audit/audit-log';

export async function POST(req: NextRequest) {
  const sessionCookie = req.cookies.get(AuthStore.cookieName)?.value;
  AuthStore.revokeSession(sessionCookie);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AuthStore.cookieName, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  auditFromRequest(req, 'global', {
    action: 'LOGOUT',
    entity: 'auth',
    entityId: 'session',
  });

  return response;
}
