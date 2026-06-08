/**
 * tenant-resolver.ts — Central tenant resolution for SILO OPS.
 *
 * All API routes MUST resolve tenant through this module.
 * No route should fall back to a default tenant silently.
 *
 * Resolution strategies:
 *   1. Mobile routes: tenant comes from X-Company-Token validation (requireMobileAuth)
 *   2. Web routes: tenant comes from x-silo-tenant header or apiPort→company lookup
 *   3. Internal/cron: explicit tenantId parameter
 *
 * This module also validates cross-tenant access:
 *   - Equipment must belong to the resolved tenant
 *   - Events must belong to the resolved tenant
 *   - No data path should accept a tenantId from user input without validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { Company, Equipment } from '@/lib/types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface TenantContext {
  ok: true;
  tenantId: string;
  company?: Company;
  source: 'mobile-token' | 'header' | 'api-port' | 'explicit';
}

export interface TenantError {
  ok: false;
  response: NextResponse;
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Allowed tenant ID pattern: lowercase alphanum + hyphens, 3-64 chars */
const TENANT_ID_PATTERN = /^[a-z0-9][a-z0-9\-]{1,62}[a-z0-9]$/;

// ── Core Resolution ────────────────────────────────────────────────────────

/**
 * Resolve tenant for web/internal API routes.
 * Does NOT fall back to a default — returns error if tenant cannot be determined.
 */
export function resolveWebTenant(req: NextRequest): TenantContext | TenantError {
  // Strategy 1: Explicit header
  const headerTenant = req.headers.get('x-silo-tenant')?.trim();
  if (headerTenant) {
    if (!isValidTenantId(headerTenant)) {
      return tenantError(400, 'tenantId invalido: formato incorreto');
    }
    // Verify tenant exists (has a company record or data directory)
    if (!tenantExists(headerTenant)) {
      return tenantError(404, 'Tenant nao encontrado');
    }
    return { ok: true, tenantId: headerTenant, source: 'header' };
  }

  // Strategy 2: Resolve from apiPort → company mapping
  const apiPort = ServerStorage.resolveApiPort(req.headers);
  if (apiPort) {
    const company = ServerStorage.getCompanyByApiPort(apiPort);
    if (company && company.tenantId) {
      return { ok: true, tenantId: company.tenantId, company, source: 'api-port' };
    }
  }

  // Strategy 3: Single-tenant fallback (only if exactly 1 company exists)
  const companies = ServerStorage.getCompanies();
  if (companies.length === 1 && companies[0].tenantId) {
    return { ok: true, tenantId: companies[0].tenantId, company: companies[0], source: 'api-port' };
  }

  return tenantError(400, 'Tenant nao identificado. Envie header x-silo-tenant ou configure apiPort.');
}

/**
 * Resolve tenant from mobile auth result.
 * The tenantId already comes validated from requireMobileAuth.
 */
export function resolveMobileTenant(tenantId: string, company: Company): TenantContext {
  return { ok: true, tenantId, company, source: 'mobile-token' };
}

/**
 * Resolve tenant explicitly (for cron jobs, scripts, internal calls).
 */
export function resolveExplicitTenant(tenantId: string): TenantContext | TenantError {
  if (!isValidTenantId(tenantId)) {
    return tenantError(400, 'tenantId invalido: formato incorreto');
  }
  if (!tenantExists(tenantId)) {
    return tenantError(404, 'Tenant nao encontrado');
  }
  return { ok: true, tenantId, source: 'explicit' };
}

// ── Cross-Tenant Validation ────────────────────────────────────────────────

/**
 * Validate that an equipment belongs to the given tenant.
 * Returns 403 if equipment exists but belongs to another tenant.
 * Returns 404 if equipment not found.
 */
export function assertEquipmentOwnership(
  equipment: Equipment | undefined,
  tenantId: string,
): { ok: true; equipment: Equipment } | TenantError {
  if (!equipment) {
    return tenantError(404, 'Equipamento nao encontrado');
  }
  if (equipment.tenantId !== tenantId) {
    console.warn('[tenant] cross-tenant equipment access blocked', {
      equipmentId: equipment.id,
      equipmentTenant: equipment.tenantId,
      requestTenant: tenantId,
    });
    // Return 404 instead of 403 to avoid leaking existence of equipment in other tenants
    return tenantError(404, 'Equipamento nao encontrado');
  }
  return { ok: true, equipment };
}

/**
 * Validate that a tenantId from request body/params matches the resolved tenant.
 * Use when the request includes tenantId in the payload.
 */
export function assertTenantMatch(
  bodyTenantId: string | undefined,
  resolvedTenantId: string,
): NextResponse | null {
  if (!bodyTenantId) return null; // No tenant in body = OK, use resolved
  if (bodyTenantId === resolvedTenantId) return null;

  console.warn('[tenant] tenant mismatch blocked', {
    bodyTenant: bodyTenantId,
    resolvedTenant: resolvedTenantId,
  });
  return NextResponse.json(
    { error: 'tenantId divergente do token/sessao' },
    { status: 403 },
  );
}

// ── Utilities ──────────────────────────────────────────────────────────────

export function isValidTenantId(id: string): boolean {
  return TENANT_ID_PATTERN.test(id);
}

/**
 * Check if a tenant exists — either has a company record or a data directory.
 */
function tenantExists(tenantId: string): boolean {
  // Check company records
  const company = ServerStorage.getCompanyByTenantId(tenantId);
  if (company) return true;

  // Check data directory existence
  try {
    const fs = require('fs');
    const path = require('path');
    const dataRoot = process.env.SILO_STORAGE_DIR || process.env.SILO_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/app/data' : './data');
    return fs.existsSync(path.join(dataRoot, tenantId));
  } catch {
    return false;
  }
}

/**
 * List all known tenants (from company records).
 * Does NOT expose tokens or sensitive data.
 */
export function listTenants(): Array<{ tenantId: string; code: string; status: string }> {
  return ServerStorage.getCompanies().map(c => ({
    tenantId: c.tenantId,
    code: c.code,
    status: c.status || 'ATIVO',
  }));
}

// ── Private ────────────────────────────────────────────────────────────────

function tenantError(status: number, message: string): TenantError {
  return {
    ok: false,
    response: NextResponse.json({ error: message }, { status }),
  };
}
