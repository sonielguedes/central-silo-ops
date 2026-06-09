import { NextRequest, NextResponse } from 'next/server';
import { CadastroStorage, ALLOWED_ENTITIES } from '@/lib/cadastro-storage';
import { blockWriteInDemo, requireTenant } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { requirePermission } from '@/lib/auth/rbac-server';
import { equipmentTypeSchema } from '@/lib/validations/master-schemas';
import { resolveIconType } from '@/lib/equipment-icon-types';

export const dynamic = 'force-dynamic';

function badEntity(entity: string) {
  return NextResponse.json(
    { error: 'Entity not found: ' + entity + '. Allowed: ' + ALLOWED_ENTITIES.join(', ') },
    { status: 404 }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  const { entity } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) return badEntity(entity);

  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const rbac = requirePermission(req, 'cadastros', 'visualizar', tenantId);
  if (rbac) return rbac;

  const data = CadastroStorage.getAll(tenantId, entity);
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  const demoBlock = blockWriteInDemo(req);
  if (demoBlock) return demoBlock;

  const { entity } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) return badEntity(entity);

  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const rbac = requirePermission(req, 'cadastros', 'criar', tenantId);
  if (rbac) return rbac;

  try {
    const body = await req.json();
    let payload = entity === 'tipos'
      ? normalizeFleetTypePayload(body)
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
      if (all.some((item) => String(item.code ?? '').toUpperCase() === parsed.data.code)) {
        return NextResponse.json({ error: 'Código já cadastrado' }, { status: 409 });
      }
    }

    const item = CadastroStorage.create(tenantId, entity, payload);
    auditFromRequest(req, tenantId, { action: 'CREATE', entity, entityId: (item as Record<string, string>).id });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('[storage-api] create error entity=' + entity, err);
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

function normalizeFleetTypePayload(body: unknown) {
  const source = (body ?? {}) as Record<string, unknown>;
  return {
    ...source,
    code: String(source.code ?? '').trim().toUpperCase(),
    iconType: resolveIconType(String(source.iconType ?? source.icon ?? 'PADRAO_GENERICO')),
    icon: resolveIconType(String(source.iconType ?? source.icon ?? 'PADRAO_GENERICO')),
    mapEnabled: source.mapEnabled ?? true,
    active: source.active ?? true,
  };
}
