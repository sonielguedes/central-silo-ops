import { NextRequest, NextResponse } from 'next/server';
import { CadastroStorage, ALLOWED_ENTITIES } from '@/lib/cadastro-storage';
import { blockWriteInDemo, requireTenant } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { requirePermission } from '@/lib/auth/rbac-server';
import { equipmentTypeSchema } from '@/lib/validations/master-schemas';
import { resolveIconType } from '@/lib/equipment-icon-types';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { entity: string; id: string } }
) {
  const { entity, id } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const rbac = requirePermission(req, 'cadastros', 'visualizar', tenantId);
  if (rbac) return rbac;

  const item = CadastroStorage.getById(tenantId, entity, id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { entity: string; id: string } }
) {
  const demoBlock = blockWriteInDemo(req);
  if (demoBlock) return demoBlock;

  const { entity, id } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const rbac = requirePermission(req, 'cadastros', 'editar', tenantId);
  if (rbac) return rbac;

  try {
    const before = CadastroStorage.getById(tenantId, entity, id);
    const body = await req.json();
    let payload = entity === 'tipos'
      ? normalizeFleetTypePayload(before, body)
      : body;

    if (entity === 'tipos') {
      const parsed = equipmentTypeSchema.safeParse(payload);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || 'Bad request' },
          { status: 400 }
        );
      }
      payload = {
        ...payload,
        ...parsed.data,
        icon: parsed.data.iconType,
      };
      const all = CadastroStorage.getAllRaw(tenantId, entity);
      if (all.some((item) => item.id !== id && String(item.code ?? '').toUpperCase() === parsed.data.code)) {
        return NextResponse.json({ error: 'Código já cadastrado' }, { status: 409 });
      }
    }

    const updated = CadastroStorage.update(tenantId, entity, id, payload);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    auditFromRequest(req, tenantId, { action: 'UPDATE', entity, entityId: id, before: before as Record<string, unknown>, after: updated as Record<string, unknown> });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[storage-api] update error entity=' + entity + ' id=' + id, err);
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

function normalizeFleetTypePayload(before: unknown, body: unknown) {
  const source = { ...(before as Record<string, unknown> ?? {}), ...(body as Record<string, unknown> ?? {}) };
  return {
    ...source,
    code: String(source.code ?? '').trim().toUpperCase(),
    iconType: resolveIconType(String(source.iconType ?? source.icon ?? 'PADRAO_GENERICO')),
    icon: resolveIconType(String(source.iconType ?? source.icon ?? 'PADRAO_GENERICO')),
    mapEnabled: source.mapEnabled ?? true,
    active: source.active ?? true,
  };
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { entity: string; id: string } }
) {
  const demoBlock = blockWriteInDemo(req);
  if (demoBlock) return demoBlock;

  const { entity, id } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const rbac = requirePermission(req, 'cadastros', 'arquivar', tenantId);
  if (rbac) return rbac;

  const before = CadastroStorage.getById(tenantId, entity, id);
  const ok = CadastroStorage.archive(tenantId, entity, id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  auditFromRequest(req, tenantId, { action: 'ARCHIVE', entity, entityId: id, before: before as Record<string, unknown> });
  return NextResponse.json({ success: true });
}
