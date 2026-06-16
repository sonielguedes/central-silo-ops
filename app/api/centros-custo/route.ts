/**
 * GET  /api/centros-custo  — lista centros de custo do tenant
 * POST /api/centros-custo  — criar centro de custo (valida unicidade de código)
 */

import { NextRequest, NextResponse } from 'next/server';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { blockWriteInDemo, requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { requireCsrf } from '@/lib/auth/csrf';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { resolveSessionFromRequest } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

const ENTITY = 'centros-custo';

type Item = Record<string, unknown>;

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const rbac = requirePermission(req, 'cadastros', 'visualizar', tenantId);
  if (rbac) return rbac;

  const items = CadastroStorage.getAll(tenantId, ENTITY) as Item[];
  return NextResponse.json(items);
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const demoBlock = blockWriteInDemo(req);
  if (demoBlock) return demoBlock;

  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const rbac = requirePermission(req, 'cadastros', 'criar', tenantId);
  if (rbac) return rbac;

  const body = (await req.json()) as Item;

  if (!body.code || String(body.code).trim() === '') {
    return NextResponse.json({ error: 'Codigo e obrigatorio.' }, { status: 400 });
  }
  if (!body.name || String(body.name).trim() === '') {
    return NextResponse.json({ error: 'Nome e obrigatorio.' }, { status: 400 });
  }

  // Unicidade de código no tenant
  const existing = CadastroStorage.getAll(tenantId, ENTITY) as Item[];
  const normalizedCode = String(body.code).trim().toUpperCase();
  const dup = existing.find(
    (i) => String(i.code ?? '').trim().toUpperCase() === normalizedCode
  );
  if (dup) {
    return NextResponse.json(
      { error: `Codigo ${normalizedCode} ja esta em uso neste tenant.` },
      { status: 409 }
    );
  }

  const session = resolveSessionFromRequest(req);
  const userId = session?.id ?? 'unknown';
  const now = new Date().toISOString();

  const newItem: Item = {
    code:         normalizedCode,
    name:         String(body.name).trim(),
    description:  body.description ? String(body.description).trim() : '',
    status:       body.status ?? 'ATIVO',
    id:           crypto.randomUUID(),
    tenantId,
    entityStatus: 'ATIVO',
    createdAt:    now,
    updatedAt:    now,
    createdBy:    userId,
    updatedBy:    userId,
    version:      1,
    history:      [{ timestamp: now, action: 'CRIACAO', userId }],
  };

  CadastroStorage.create(tenantId, ENTITY, newItem as Record<string, unknown>);

  auditFromRequest(req, tenantId, {
    action:   'CREATE_CENTRO_CUSTO',
    entity:   ENTITY,
    entityId: String(newItem.id),
    metadata: { code: newItem.code, name: newItem.name },
  });

  return NextResponse.json(newItem, { status: 201 });
}
