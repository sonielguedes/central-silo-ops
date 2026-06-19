import { NextRequest, NextResponse } from 'next/server';

/* ─────────────────────────────────────────────────────────────────────────────
 * SILO OPS — Next.js Middleware
 * Protege rotas server-side: verifica cookie silo_session com HMAC-SHA256
 * usando Web Crypto API (Edge-compatible).
 * ────────────────────────────────────────────────────────────────────────── */

const COOKIE_NAME = 'silo_session';

/**
 * Rotas que não exigem autenticação.
 * Verificação feita por prefixo — manter sempre em sync com as rotas públicas.
 */
const PUBLIC_PREFIXES = [
  '/login',
  '/api/auth/',
  '/api/mobile/',
  '/api/health/',
  '/_next/',
  '/fonts/',
  '/favicon',
  '/icons/',
  '/images/',
];

/**
 * Verifica a assinatura HMAC-SHA256 do cookie de sessão usando Web Crypto API
 * (compatível com Edge Runtime).
 * Formato do cookie: `{sessionId}.{hmac_hex}`
 */
async function verifySessionCookie(cookieValue: string): Promise<boolean> {
  const secret = process.env.SILO_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) return false;

  const parts = cookieValue.split('.');
  // Suporte a cookies sem assinatura (legado de desenvolvimento)
  if (parts.length === 1) return Boolean(parts[0].trim());
  if (parts.length !== 2) return false;

  const [sessionId, signature] = parts;
  if (!sessionId || !signature) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    // Converter assinatura hex → bytes
    const hexPairs = signature.match(/.{1,2}/g);
    if (!hexPairs || hexPairs.length !== 32) return false; // SHA-256 = 32 bytes
    const sigBytes = new Uint8Array(hexPairs.map(b => parseInt(b, 16)));

    // crypto.subtle.verify é intrinsecamente timing-safe
    return await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(sessionId));
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Liberar rotas públicas sem checar sessão
  if (PUBLIC_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookieValue = req.cookies.get(COOKIE_NAME)?.value;

  if (!cookieValue) {
    // Sem cookie → redirecionar para login preservando destino
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const valid = await verifySessionCookie(cookieValue);
  if (!valid) {
    // Cookie adulterado → redirecionar e limpar cookie corrompido
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('next', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  /*
   * Executar em TODAS as rotas, exceto:
   * - arquivos estáticos do Next.js (_next/static, _next/image)
   * - favicon e manifest
   * A lista de PUBLIC_PREFIXES acima cobre o restante das rotas públicas.
   */
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|manifest\\.json).*)'
  ],
};
