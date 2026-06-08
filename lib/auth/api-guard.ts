/**
 * api-guard.ts — Central API security guard for SILO OPS Central.
 * Provides authentication, tenant resolution, demo safety, and audit logging
 * for all API routes (mobile and web).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { Company } from '@/lib/types';
import { resolveWebTenant } from '@/lib/tenant/tenant-resolver';

// ── Types ───────────────────────────────────────────────────────────────────

export interface MobileAuthResult {
  ok: true;
  tenantId: string;
  company: Company;
  companyToken: string;
}

export interface TenantResult {
  ok: true;
  tenantId: string;
}

export interface GuardError {
  ok: false;
  response: NextResponse;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const IS_DEMO = process.env.NEXT_PUBLIC_APP_ENV === 'demo';

function maskToken(token: string | undefined | null): string {
  if (!token || token.length < 8) return '***';
  return token.slice(0, 4) + '...' + token.slice(-4);
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

// ── requireMobileAuth ───────────────────────────────────────────────────────
// Validates X-Company-Token header, resolves tenant, ensures company is active.
// Use on all /api/mobile/* routes.

export function requireMobileAuth(req: NextRequest): MobileAuthResult | GuardError {
  const companyToken = req.headers.get('x-company-token')?.trim();

  if (!companyToken) {
    console.warn('[api-guard] mobile: missing X-Company-Token', {
      path: req.nextUrl.pathname,
      ip: getClientIp(req),
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'X-Company-Token is required' },
        { status: 401 },
      ),
    };
  }

  const company = ServerStorage.getCompanyByToken(companyToken);

  if (!company || company.status === 'INATIVO') {
    console.warn('[api-guard] mobile: invalid or inactive token', {
      path: req.nextUrl.pathname,
      token: maskToken(companyToken),
      ip: getClientIp(req),
    });
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Token invalido ou instancia inativa' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    tenantId: company.tenantId,
    company,
    companyToken,
  };
}

// ── requireTenant ───────────────────────────────────────────────────────────
// Resolves tenantId from headers for web/internal routes.
// Now uses tenant-resolver (no silent fallback to default tenant).

export function requireTenant(req: NextRequest): TenantResult | GuardError {
  const result = resolveWebTenant(req);
  if (!result.ok) {
    return { ok: false, response: result.response };
  }
  return { ok: true, tenantId: result.tenantId };
}

// ── blockWriteInDemo ────────────────────────────────────────────────────────
// If APP_ENV=demo, blocks POST/PUT/DELETE/PATCH requests.
// Returns null if allowed, or a 403 NextResponse if blocked.

export function blockWriteInDemo(req: NextRequest): NextResponse | null {
  if (!IS_DEMO) return null;

  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;

  console.info('[api-guard] demo: blocked write', {
    method,
    path: req.nextUrl.pathname,
    ip: getClientIp(req),
  });

  return NextResponse.json(
    { error: 'Operacao bloqueada em ambiente de demonstracao' },
    { status: 403 },
  );
}

// ── requireWebAdmin ─────────────────────────────────────────────────────────
// For admin routes. Currently validates tenant + demo check.
// Extend with session/JWT auth when user auth is implemented.

export function requireWebAdmin(req: NextRequest): TenantResult | GuardError {
  const demoBlock = blockWriteInDemo(req);
  if (demoBlock) return { ok: false, response: demoBlock };

  return requireTenant(req);
}

// ── Exports ─────────────────────────────────────────────────────────────────

export { maskToken, getClientIp, IS_DEMO };
