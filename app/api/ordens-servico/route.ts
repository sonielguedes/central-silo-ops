/**
 * GET  /api/ordens-servico        — lista com filtros
 * POST /api/ordens-servico        — criar OS
 */

import { NextRequest, NextResponse } from 'next/server';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { blockWriteInDemo, requireTenant } from '@/lib/auth/api-guard';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { requirePermission } from '@/lib/auth/rbac-server';
import { requireCsrf } from '@/lib/auth/csrf';

export const dynamic = 'force-dynamic';

const ENTITY = 'ordens-servico';

type Item = Record<string, unknown>;

// ── GET — listagem com filtros ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const rbac = requirePermission(req, 'cadastros', 'visualizar', tenantId);
  if (rbac) return rbac;

  const sp = req.nextUrl.searchParams;
  const filterStatus      = sp.get('status')?.trim();
  const filterEquipmentId = sp.get('equipmentId')?.trim();
  const filterOperatorId  = sp.get('operatorId')?.trim();
  const filterFarmId      = sp.get('farmId')?.trim();
  const filterFieldId     = sp.get('fieldId')?.trim();
  const filterOperationId = sp.get('operationId')?.trim();
  const filterCostCenterId = sp.get('costCenterId')?.trim();
  const search            = sp.get('search')?.trim().toLowerCase();
  const page              = Math.max(1, parseInt(sp.get('page') ?? '1'));
  const pageSize          = Math.min(100, Math.max(1, parseInt(sp.get('pageSize') ?? '50')));

  let items = CadastroStorage.getAll(tenantId, ENTITY) as Item[];

  // Filtros
  if (filterStatus)       items = items.filter(i => i.status === filterStatus);
  if (filterEquipmentId)  items = items.filter(i => i.equipmentId === filterEquipmentId);
  if (filterOperatorId)   items = items.filter(i => i.operatorId  === filterOperatorId);
  if (filterFarmId)       items = items.filter(i => i.farmId      === filterFarmId);
  if (filterFieldId)      items = items.filter(i => i.fieldId     === filterFieldId);
  if (filterOperationId)  items = items.filter(i => i.operationId === filterOperationId);
  if (filterCostCenterId) items = items.filter(i => i.costCenterId === filterCostCenterId);
  if (search) {
    items = items.filter(i =>
      String(i.code        ?? '').toLowerCase().includes(search) ||
      String(i.description ?? '').toLowerCase().includes(search)
    );
  }

  // Ordenar: abertas primeiro, depois por openedAt desc
  const STATUS_ORDER: Record<string, number> = {
    ABERTA: 0, EM_ANDAMENTO: 1, PAUSADA: 2, FINALIZADA: 3, CANCELADA: 4,
  };
  items.sort((a, b) => {
    const sa = STATUS_ORDER[String(a.status ?? '')] ?? 9;
    const sb = STATUS_ORDER[String(b.status ?? '')] ?? 9;
    if (sa !== sb) return sa - sb;
    return String(b.openedAt ?? '').localeCompare(String(a.openedAt ?? ''));
  });

  const total  = items.length;
  const start  = (page - 1) * pageSize;
  const paged  = items.slice(start, start + pageSize);

  return NextResponse.json({ items: paged, total, page, pageSize });
}

// ── POST — criar OS ────────────────────────────────────────────────────────

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

  // Validações obrigatórias
  if (!body.code)        return NextResponse.json({ error: 'Código é obrigatório' }, { status: 400 });
  if (!body.description) return NextResponse.json({ error: 'Descrição é obrigatória' }, { status: 400 });
  if (!body.equipmentId) return NextResponse.json({ error: 'Equipamento é obrigatório' }, { status: 400 });

  // Verificar código único no tenant
  const existing = CadastroStorage.getAll(tenantId, ENTITY) as Item[];
  const dup = existing.find(i =>
    String(i.code ?? '').trim().toLowerCase() === String(body.code).trim().toLowerCase() &&
    i.deletedAt == null
  );
  if (dup) return NextResponse.json({ error: `Código ${body.code} já está em uso` }, { status: 409 });

  const session = resolveSessionFromRequest(req);
  const userId  = session?.id ?? 'unknown';
  const now = new Date().toISOString();

  // Allowlist de campos aceitos — evita injeção de campos internos via body
  const ALLOWED_FIELDS = [
    'code','type','priority','status','description',
    'equipmentId','operatorId','farmId','fieldId',
    'costCenterId','operationId','implementId','activityId',
    'shift','openedAt','plannedAt','observations',
  ] as const;
  const safeBody: Item = {};
  for (const k of ALLOWED_FIELDS) {
    if (body[k] !== undefined) safeBody[k] = body[k];
  }

  const newItem: Item = {
    ...safeBody,
    id:           crypto.randomUUID(),
    tenantId,
    status:       safeBody.status ?? 'ABERTA',
    openedAt:     safeBody.openedAt ?? now,
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
    action: 'CREATE_OS',
    entity: ENTITY,
    entityId: String(newItem.id),
    metadata: { code: body.code, equipmentId: body.equipmentId, status: newItem.status },
  });

  return NextResponse.json(newItem, { status: 201 });
}
