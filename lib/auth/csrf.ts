import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const CSRF_COOKIE_NAME = 'silo_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function getCsrfCookie(req: NextRequest): string | null {
  return req.cookies.get(CSRF_COOKIE_NAME)?.value || null;
}

export function getCsrfHeader(req: NextRequest): string | null {
  return req.headers.get(CSRF_HEADER_NAME)?.trim() || null;
}

export function issueCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 8 * 60 * 60,
  });
}

export function clearCsrfCookie(response: NextResponse): void {
  response.cookies.set(CSRF_COOKIE_NAME, '', {
    httpOnly: false,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

export function requireCsrf(req: NextRequest): NextResponse | null {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;

  const cookie = getCsrfCookie(req);
  const header = getCsrfHeader(req);
  if (!cookie || !header || cookie !== header) {
    return NextResponse.json({ error: 'CSRF invalido' }, { status: 403 });
  }
  return null;
}
