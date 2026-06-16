/**
 * GET    /api/ordens-servico/[id]  — detalhe
 * PUT    /api/ordens-servico/[id]  — editar
 * PATCH  /api/ordens-servico/[id]  — mudar status (cancelar / finalizar / pausar)
 * DELETE /api/ordens-servico/[id]  — arquivar (soft-delete)
 */

import { NextRequest, NextResponse } from 'next/server';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { blockWriteInDemo, requireTenant } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { requirePermission } from '@/lib/auth/rbac-server';
import { requireCsrf } from '@/lib/auth/csrf';

export const dynamic = 'force-dynamic';

const ENTITY = 'ordens-servico';

type Item = Record<string, unknown>;

// Transições de status permitidas
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  ABERTA:       ['EM_ANDAMENTO', 'CANCELADA'],
  EM_ANDAMENTO: ['PAUSADA', 'FINALIZADA', 'CANCELADA'],
  PAUSADA:      ['EM_ANDAMENTO', 'CANCELADA'],
  FINALIZADA:   [],                      // estado terminal
  CANCELADA:    [],                      // estado terminal
};

// ── GET ────────────────────────────────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const rbac = requirePermission(req, 'cadastros', 'visualizar', tenantId);
  if (rbac) return rbac;

  const item = CadastroStorage.getById(tenantId, ENTITY, params.id);
  if (!item) return NextResponse.json({ error: 'OS não encontrada' }, { status: 404 });
  return NextResponse.json(item);
}

// ── PUT — editar ───────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
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

  const current = CadastroStorage.getById(tenantId, ENTITY, params.id) as Item | null;
  if (!current) return NextResponse.json({ error: 'OS não encontrada' }, { status: 404 });
  if (['FINALIZADA', 'CANCELADA'].includes(String(current.status))) {
    return NextResponse.json({ error: 'OS finalizada ou cancelada não pode ser editada' }, { status: 409 });
  }

  const body = (await req.json()) as Item;
  // Proteger campos imutáveis
  const { id: _id, tenantId: _t, createdAt: _c, history: _h, ...editable } = body;

  const updated = CadastroStorage.update(tenantId, ENTITY, params.id, editable);
  if (!updated) return NextResponse.json({ error: 'Falha ao atualizar' }, { status: 500 });

  auditFromRequest(req, tenantId, {
    action: 'UPDATE_OS',
    entity: ENTITY,
    entityId: params.id,
    metadata: { before: current, after: updated },
  });

  return NextResponse.json(updated);
}

// ── PATCH — mudança de status ──────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const demoBlock = blockWriteInDemo(req);
  if (demoBlock) return demoBlock;
  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  // Finalizar requer permissão "aprovar"; cancelar requer "editar"
  const body = (await req.json()) as { status: string; reason?: string; closedAt?: string };
  const newStatus = body.status;

  const permAction = newStatus === 'FINALIZADA' ? 'aprovar' : 'editar';
  const rbac = requirePermission(req, 'cadastros', permAction, tenantId);
  if (rbac) return rbac;

  const current = CadastroStorage.getById(tenantId, ENTITY, params.id) as Item | null;
  if (!current) return NextResponse.json({ error: 'OS não encontrada' }, { status: 404 });

  const currentStatus = String(current.status ?? '');
  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Transição inválida: ${currentStatus} → ${newStatus}` },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const patch: Item = { status: newStatus };

  if (newStatus === 'FINALIZADA') {
    patch.closedAt  = body.closedAt ?? now;
    patch.startedAt = patch.startedAt ?? current.startedAt;
  }
  if (newStatus === 'CANCELADA') {
    patch.closedAt  = now;
    if (body.reason) patch.observations = body.reason;
  }
  if (newStatus === 'PAUSADA')      patch.pausedAt  = now;
  if (newStatus === 'EM_ANDAMENTO') patch.startedAt = current.startedAt ?? now;

  const updated = CadastroStorage.update(tenantId, ENTITY, params.id, patch);
  if (!updated) return NextResponse.json({ error: 'Falha ao atualizar' }, { status: 500 });

  auditFromRequest(req, tenantId, {
    action: `OS_STATUS_${newStatus}`,
    entity: ENTITY,
    entityId: params.id,
    metadata: { from: currentStatus, to: newStatus, reason: body.reason },
  });

  return NextResponse.json(updated);
}

// ── DELETE — arquivar ──────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
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

  const current = CadastroStorage.getById(tenantId, ENTITY, params.id) as Item | null;
  if (!current) return NextResponse.json({ error: 'OS não encontrada' }, { status: 404 });
  if (current.status === 'EM_ANDAMENTO') {
    return NextResponse.json({ error: 'Não é possível arquivar OS em andamento' }, { status: 409 });
  }

  const ok = CadastroStorage.archive(tenantId, ENTITY, params.id);
  if (!ok) return NextResponse.json({ error: 'Falha ao arquivar' }, { status: 500 });

  auditFromRequest(req, tenantId, {
    action: 'ARCHIVE_OS',
    entity: ENTITY,
    entityId: params.id,
    metadata: { code: current.code },
  });

  return NextResponse.json({ success: true });
}
