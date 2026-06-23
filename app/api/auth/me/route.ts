import { NextRequest, NextResponse } from 'next/server';
import { AuthStore } from '@/lib/auth/auth-store';
import { generateCsrfToken, issueCsrfCookie } from '@/lib/auth/csrf';

export async function GET(req: NextRequest) {
  const session = AuthStore.resolveSession(req.cookies.get(AuthStore.cookieName)?.value);
  if (!session) {
    return NextResponse.json({ authenticated: false, user: null, session: null }, { status: 401 });
  }
  const response = NextResponse.json({ authenticated: true, user: session, session });
  if (!req.cookies.get('silo_csrf')?.value) {
    issueCsrfCookie(response, generateCsrfToken());
  }
  return response;
}
