import { NextRequest, NextResponse } from 'next/server';
import { CadastroStorage, ALLOWED_ENTITIES } from '@/lib/cadastro-storage';
import { blockWriteInDemo, requireTenant } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { requirePermission } from '@/lib/auth/rbac-server';
import { equipmentTypeSchema } from '@/lib/validations/master-schemas';
import { resolveIconType } from '@/lib/equipment-icon-types';
import { AuthStore, roleFromAccessGroupId } from '@/lib/auth/auth-store';
import { resolveSessionFromRequest } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

function badEntity(entity: string) {
  return NextResponse.json(
    { error: 'Entity not found: ' + entity + '. Allowed: ' + ALLOWED_ENTITIES.join(', ') },
    { status: 404 }
  );
}

function isAuthUsersEntity(entity: string) {
  return entity === 'users';
}

export async function GET(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  const { entity } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) return badEntity(entity);

  if (isAuthUsersEntity(entity)) {
    const session = resolveSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Sessao nao identificada. Faca login novamente.' }, { status: 401 });
    const rbac = requirePermission(req, 'administracao', 'visualizar', session.tenantId || session.defaultTenantId);
    if (rbac) return rbac;

    const users = AuthStore.listUsers()
      .filter((user) => session.scope === 'PLATFORM' || user.tenantId === session.tenantId)
      .map((user) => AuthStore.toPublicUser(user));
    return NextResponse.json(users);
  }

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

  if (isAuthUsersEntity(entity)) {
    const session = resolveSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Sessao nao identificada. Faca login novamente.' }, { status: 401 });
    const rbac = requirePermission(req, 'administracao', 'criar', session.tenantId || session.defaultTenantId);
    if (rbac) return rbac;

    try {
      const body = await req.json();
      const input = body as Record<string, unknown>;
      const desiredTenantId = input.tenantId === null ? null : String(input.tenantId || '').trim() || null;
      const scope = session.scope === 'PLATFORM'
        ? ((String(input.scope || '').trim().toUpperCase() as 'PLATFORM' | 'TENANT') || (desiredTenantId ? 'TENANT' : 'PLATFORM'))
        : 'TENANT';
      const inferredRole = roleFromAccessGroupId(String(input.accessGroupId || '').trim());
      const tenantId = session.scope === 'PLATFORM'
        ? desiredTenantId
        : session.tenantId;

      if (session.scope !== 'PLATFORM' && desiredTenantId && desiredTenantId !== session.tenantId) {
        return NextResponse.json({ error: 'tenantId divergente da sessao' }, { status: 403 });
      }
      if (session.scope !== 'PLATFORM' && (scope === 'PLATFORM' || inferredRole === 'SUPER_ADMIN_SILO')) {
        return NextResponse.json({ error: 'Permissao insuficiente' }, { status: 403 });
      }

      const password = String(input.password || input.tempPassword || '');
      if (!password) {
        return NextResponse.json({ error: 'Senha inicial obrigatoria' }, { status: 400 });
      }
      const existing = AuthStore.findUserByIdentifier(String(input.email || input.username || ''));
      if (existing) {
        return NextResponse.json({ error: 'Usuario ou e-mail ja cadastrado' }, { status: 409 });
      }
      const user = await AuthStore.upsertUser({
        id: String(input.id || ''),
        name: String(input.name || '').trim(),
        username: String(input.username || '').trim(),
        email: String(input.email || '').trim().toLowerCase(),
        accessGroupId: String(input.accessGroupId || '').trim(),
        status: (String(input.status || 'ATIVO').toUpperCase() as 'ATIVO' | 'INATIVO'),
        tenantId,
        defaultTenantId: String(input.defaultTenantId || tenantId || session.defaultTenantId || '').trim() || session.defaultTenantId,
        scope,
        role: (String(input.role || inferredRole) as any),
        mustChangePassword: Boolean(input.mustChangePassword ?? input.requirePasswordChange),
        passwordHash: '',
      });

      await AuthStore.updatePassword(user.id, password, Boolean(input.mustChangePassword ?? input.requirePasswordChange));

      auditFromRequest(req, session.tenantId || session.defaultTenantId, {
        action: 'USER_CREATE',
        entity: 'user',
        entityId: user.id,
        metadata: { scope: user.scope, tenantId: user.tenantId, accessGroupId: user.accessGroupId },
      });
      return NextResponse.json(AuthStore.toPublicUser(AuthStore.getUserById(user.id)!), { status: 201 });
    } catch (err) {
      console.error('[auth/users] create error', err);
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
  }

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
