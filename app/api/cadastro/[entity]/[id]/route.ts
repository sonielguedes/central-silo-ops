import { NextRequest, NextResponse } from 'next/server';
import { CadastroStorage, ALLOWED_ENTITIES } from '@/lib/cadastro-storage';
import { blockWriteInDemo, requireTenant } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { requirePermission } from '@/lib/auth/rbac-server';
import { equipmentTypeSchema } from '@/lib/validations/master-schemas';
import { resolveIconType } from '@/lib/equipment-icon-types';
import { AuthStore, roleFromAccessGroupId } from '@/lib/auth/auth-store';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { requireCsrf } from '@/lib/auth/csrf';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { entity: string; id: string } }
) {
  const { entity, id } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }
  if (entity === 'users') {
    const session = resolveSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Sessao nao identificada. Faca login novamente.' }, { status: 401 });
    const user = AuthStore.getUserById(id);
    if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.scope !== 'PLATFORM' && user.tenantId !== session.tenantId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(AuthStore.toPublicUser(user));
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
  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  const { entity, id } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }
  if (entity === 'users') {
    const session = resolveSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Sessao nao identificada. Faca login novamente.' }, { status: 401 });
    const rbac = requirePermission(req, 'administracao', 'editar', session.tenantId || session.defaultTenantId);
    if (rbac) return rbac;

    const before = AuthStore.getUserById(id);
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.scope !== 'PLATFORM' && before.tenantId !== session.tenantId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    try {
      const body = await req.json();
      const input = body as Record<string, unknown>;
      const password = String(input.password || input.tempPassword || '');
      const tenantId = session.scope === 'PLATFORM'
        ? (input.tenantId === null ? null : String(input.tenantId || '').trim() || null)
        : session.tenantId;
      const desiredScope = session.scope === 'PLATFORM'
        ? ((String(input.scope ?? before.scope ?? '').toUpperCase() as 'PLATFORM' | 'TENANT') || (tenantId ? 'TENANT' : 'PLATFORM'))
        : 'TENANT';
      const inferredRole = roleFromAccessGroupId(String(input.accessGroupId ?? before.accessGroupId));
      if (session.scope !== 'PLATFORM' && input.tenantId && String(input.tenantId) !== session.tenantId) {
        return NextResponse.json({ error: 'tenantId divergente da sessao' }, { status: 403 });
      }
      if (session.scope !== 'PLATFORM' && (desiredScope === 'PLATFORM' || inferredRole === 'SUPER_ADMIN_SILO')) {
        return NextResponse.json({ error: 'Permissao insuficiente' }, { status: 403 });
      }
      const candidate = String(input.email ?? before.email).trim().toLowerCase();
      const candidateUsername = String(input.username ?? before.username).trim().toLowerCase();
      const duplicate = AuthStore.listUsers().find(
        (user) => user.id !== id && (user.email.toLowerCase() === candidate || user.username.toLowerCase() === candidateUsername),
      );
      if (duplicate) {
        return NextResponse.json({ error: 'Usuario ou e-mail ja cadastrado' }, { status: 409 });
      }

      const updated = await AuthStore.upsertUser({
        ...before,
        id,
        name: String(input.name ?? before.name).trim(),
        username: String(input.username ?? before.username).trim(),
        email: String(input.email ?? before.email).trim().toLowerCase(),
        accessGroupId: String(input.accessGroupId ?? before.accessGroupId).trim(),
        status: (String(input.status ?? before.status).toUpperCase() as 'ATIVO' | 'INATIVO'),
        tenantId,
        defaultTenantId: String(input.defaultTenantId ?? before.defaultTenantId ?? tenantId ?? session.defaultTenantId).trim() || session.defaultTenantId,
        scope: desiredScope,
        role: (String(input.role || inferredRole) as any),
        mustChangePassword: Boolean(input.mustChangePassword ?? input.requirePasswordChange ?? before.mustChangePassword),
      });

      if (password) {
        await AuthStore.updatePassword(updated.id, password, Boolean(input.mustChangePassword ?? input.requirePasswordChange ?? before.mustChangePassword));
      }

      auditFromRequest(req, session.tenantId || session.defaultTenantId, {
        action: 'USER_UPDATE',
        entity: 'user',
        entityId: id,
        before: AuthStore.toPublicUser(before),
        after: AuthStore.toPublicUser(AuthStore.getUserById(id)!),
      });

      return NextResponse.json(AuthStore.toPublicUser(AuthStore.getUserById(id)!));
    } catch (err) {
      console.error('[auth/users] update error', err);
      return NextResponse.json({ error: 'Bad request' }, { status: 400 });
    }
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
        return NextResponse.json({ error: 'Codigo ja cadastrado' }, { status: 409 });
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
  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  const { entity, id } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }
  if (entity === 'users') {
    const session = resolveSessionFromRequest(req);
    if (!session) return NextResponse.json({ error: 'Sessao nao identificada. Faca login novamente.' }, { status: 401 });
    const rbac = requirePermission(req, 'administracao', 'arquivar', session.tenantId || session.defaultTenantId);
    if (rbac) return rbac;

    const before = AuthStore.getUserById(id);
    if (!before) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (session.scope !== 'PLATFORM' && before.tenantId !== session.tenantId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const ok = AuthStore.archiveUser(id);
    if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    auditFromRequest(req, session.tenantId || session.defaultTenantId, {
      action: 'USER_ARCHIVE',
      entity: 'user',
      entityId: id,
      before: AuthStore.toPublicUser(before),
    });
    return NextResponse.json({ success: true });
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
