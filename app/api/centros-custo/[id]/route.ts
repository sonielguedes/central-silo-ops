/**
 * PUT    /api/centros-custo/[id]  — atualizar centro de custo
 * DELETE /api/centros-custo/[id]  — arquivar centro de custo
 */

import { NextRequest, NextResponse } from 'next/server';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { blockWriteInDemo, requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { requireCsrf } from '@/lib/auth/csrf';
import { auditFromRequest } from '@/lib/audit/audit-log';

export const dynamic = 'force-dynamic';

const ENTITY = 'centros-custo';

type Item = Record<string, unknown>;

// ── PUT ───────────────────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const demoBlock = blockWriteInDemo(req);
  if (demoBlock) return demoBlock;

  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const rbac = requirePermission(req, 'cadastros', 'editar', tenantId);
  if (rbac) return rbac;

  const { id } = params;
  const before = CadastroStorage.getById(tenantId, ENTITY, id) as Item | undefined;
  if (!before) {
    return NextResponse.json({ error: 'Centro de custo nao encontrado.' }, { status: 404 });
  }

  const body = (await req.json()) as Item;

  // Unicidade de código se o código estiver sendo alterado
  if (body.code !== undefined) {
    const normalizedCode = String(body.code).trim().toUpperCase();
    if (normalizedCode !== String(before.code ?? '').trim().toUpperCase()) {
      const all = CadastroStorage.getAll(tenantId, ENTITY) as Item[];
      const dup = all.find(
        (i) => i.id !== id && String(i.code ?? '').trim().toUpperCase() === normalizedCode
      );
      if (dup) {
        return NextResponse.json(
          { error: `Codigo ${normalizedCode} ja esta em uso neste tenant.` },
          { status: 409 }
        );
      }
    }
  }

  const payload: Item = {
    ...before,
    ...(body.code        !== undefined ? { code:        String(body.code).trim().toUpperCase() } : {}),
    ...(body.name        !== undefined ? { name:        String(body.name).trim() }               : {}),
    ...(body.description !== undefined ? { description: String(body.description).trim() }        : {}),
    ...(body.status      !== undefined ? { status:      body.status }                            : {}),
  };

  const updated = CadastroStorage.update(tenantId, ENTITY, id, payload as Record<string, unknown>);
  if (!updated) {
    return NextResponse.json({ error: 'Centro de custo nao encontrado.' }, { status: 404 });
  }

  auditFromRequest(req, tenantId, {
    action:   'UPDATE_CENTRO_CUSTO',
    entity:   ENTITY,
    entityId: id,
    before:   before as Record<string, unknown>,
    after:    updated as Record<string, unknown>,
  });

  return NextResponse.json(updated);
}

// ── DELETE (archive) ──────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const demoBlock = blockWriteInDemo(req);
  if (demoBlock) return demoBlock;

  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const rbac = requirePermission(req, 'cadastros', 'arquivar', tenantId);
  if (rbac) return rbac;

  const { id } = params;
  const before = CadastroStorage.getById(tenantId, ENTITY, id) as Item | undefined;

  const ok = CadastroStorage.archive(tenantId, ENTITY, id);
  if (!ok) {
    return NextResponse.json({ error: 'Centro de custo nao encontrado.' }, { status: 404 });
  }

  auditFromRequest(req, tenantId, {
    action:   'ARCHIVE_CENTRO_CUSTO',
    entity:   ENTITY,
    entityId: id,
    before:   before as Record<string, unknown>,
  });

  return NextResponse.json({ ok: true });
}
