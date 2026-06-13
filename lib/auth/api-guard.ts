/**
 * api-guard.ts — Central API security guard for SILO OPS Central.
 * Provides authentication, tenant resolution, demo safety, and audit logging
 * for all API routes (mobile and web).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { Company } from '@/lib/types';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import {
  validateCompanyAccess,
  expiredApiResponse,
  suspendedApiResponse,
  cancelledApiResponse,
  inactiveApiResponse,
} from '@/lib/subscription/subscription-validator';
import { migrateCompanySubscription } from '@/lib/subscription/subscription-migrator';

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

export function maskToken(token: string | undefined | null): string {
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

  const rawCompany = ServerStorage.getCompanyByToken(companyToken);

  if (!rawCompany) {
    console.warn('[api-guard] mobile: invalid token', {
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

  // Migração lazy de campos de assinatura (sem gravar — read-only aqui)
  const { company } = migrateCompanySubscription(rawCompany);

  // ── Validação de assinatura ──────────────────────────────────────────────
  // APK não tem role — bloqueia se empresa não tiver acesso ativo
  const access = validateCompanyAccess(company);
  if (!access.allowed) {
    console.warn('[api-guard] mobile: subscription blocked', {
      path: req.nextUrl.pathname,
      token: maskToken(companyToken),
      tenantId: company.tenantId,
      subscriptionStatus: access.status,
      ip: getClientIp(req),
    });

    let body: object;
    if (access.code === 'COMPANY_EXPIRED') body = expiredApiResponse();
    else if (access.code === 'COMPANY_SUSPENDED') body = suspendedApiResponse();
    else if (access.code === 'COMPANY_CANCELLED') body = cancelledApiResponse();
    else body = inactiveApiResponse();

    return {
      ok: false,
      response: NextResponse.json(body, { status: 403 }),
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
// Resolves tenantId exclusively from the session cookie.
// For TENANT-scope users: rejects any request that supplies an x-tenant-id
// header (or x-silo-tenant) that does not match the session tenant, preventing
// cross-tenant injection attacks.
// PLATFORM-scope users (SUPER_ADMIN_SILO) must activate a tenant via
// session.activeTenantId; a bare x-tenant-id header is never trusted.

export function requireTenant(req: NextRequest): TenantResult | GuardError {
  const session = resolveSessionFromRequest(req);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Sessao nao identificada. Faca login novamente.' }, { status: 401 }),
    };
  }

  if (session.scope === 'TENANT') {
    const sessionTenantId = session.activeTenantId || session.tenantId;
    if (!sessionTenantId) {
      return {
        ok: false,
        response: NextResponse.json({ error: 'Tenant nao identificado.' }, { status: 400 }),
      };
    }

    // Reject cross-tenant header injection attempts.
    // TENANT-scope users may never operate on a tenant other than their own,
    // regardless of what x-tenant-id or x-silo-tenant headers they send.
    const requestedTenant =
      req.headers.get('x-tenant-id')?.trim() ||
      req.headers.get('x-silo-tenant')?.trim() ||
      req.nextUrl.searchParams.get('companyId')?.trim();

    if (requestedTenant && requestedTenant !== sessionTenantId) {
      console.warn('[api-guard] cross-tenant injection rejected', {
        sessionTenantId,
        requestedTenant,
        userId: session.id,
        role: session.role,
        path: req.nextUrl.pathname,
        ip: getClientIp(req),
      });
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'Acesso a tenant nao autorizado.' },
          { status: 403 },
        ),
      };
    }

    return { ok: true, tenantId: sessionTenantId };
  }

  // PLATFORM scope (SUPER_ADMIN_SILO)
  // activeTenantId is set after explicit tenant selection / support-mode activation.
  // Headers are never trusted — tenant comes only from session.
  if (session.scope === 'PLATFORM') {
    if (session.activeTenantId) {
      return { ok: true, tenantId: session.activeTenantId };
    }

    const method = req.method.toUpperCase();
    const isReadOnly = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';

    if (isReadOnly && session.defaultTenantId) {
      // Read-only access: fall back to defaultTenantId so the UI dashboard
      // loads after login without requiring explicit tenant selection.
      return { ok: true, tenantId: session.defaultTenantId };
    }

    // Writes without an active tenant are always blocked.
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Selecione um tenant ativo para operacoes de escrita.' },
        { status: 403 },
      ),
    };
  }

  return {
    ok: false,
    response: NextResponse.json({ error: 'Tenant nao identificado.' }, { status: 400 }),
  };
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

export function requireWebAdmin(req: NextRequest): TenantResult | GuardError {
  const demoBlock = blockWriteInDemo(req);
  if (demoBlock) return { ok: false, response: demoBlock };

  return requireTenant(req);
}

// ── Exports ─────────────────────────────────────────────────────────────────

export { getClientIp, IS_DEMO };
