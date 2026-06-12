import { NextRequest, NextResponse } from 'next/server';
import { CadastroStorage, ALLOWED_ENTITIES } from '@/lib/cadastro-storage';
import { blockWriteInDemo, requireTenant } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { requirePermission } from '@/lib/auth/rbac-server';
import { AuthStore } from '@/lib/auth/auth-store';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { requireCsrf } from '@/lib/auth/csrf';

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

/* ── GET ─────────────────────────────────────────────────────────────────── */
export async function GET(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  const { entity } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) return badEntity(entity);

  if (isAuthUsersEntity(entity)) {
    const session = resolveSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Sessao nao identificada. Faca login novamente.' },
        { status: 401 }
      );
    }
    const rbac = requirePermission(
      req, 'administracao', 'visualizar',
      session.tenantId || session.defaultTenantId
    );
    if (rbac) return rbac;

    const users = AuthStore.listUsers()
      .filter(u => session.scope === 'PLATFORM' || u.tenantId === session.tenantId)
      .map(u => AuthStore.toPublicUser(u));
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

/* ── POST ────────────────────────────────────────────────────────────────── */
export async function POST(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  const demoBlock = blockWriteInDemo(req);
  if (demoBlock) return demoBlock;

  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  const { entity } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) return badEntity(entity);

  /* ── users entity: uses AuthStore, not CadastroStorage ───────────────── */
  if (isAuthUsersEntity(entity)) {
    const session = resolveSessionFromRequest(req);
    if (!session) {
      return NextResponse.json(
        { error: 'Sessao nao identificada. Faca login novamente.' },
        { status: 401 }
      );
    }
    const rbac = requirePermission(
      req, 'administracao', 'criar',
      session.tenantId || session.defaultTenantId
    );
    if (rbac) return rbac;

    try {
      const body = await req.json() as Record<string, unknown>;
      const password = typeof body.password === 'string' ? body.password : undefined;

      // TENANT isolation: ADMIN_EMPRESA can only create users in own tenant
      if (
        session.scope === 'TENANT' &&
        body.tenantId !== undefined &&
        body.tenantId !== session.tenantId
      ) {
        return NextResponse.json(
          { error: 'Nao autorizado a criar usuarios em outro tenant.' },
          { status: 403 }
        );
      }

      const user = await AuthStore.upsertUser({
        name:             String(body.name ?? ''),
        email:            String(body.email ?? ''),
        username:         String(body.username ?? ''),
        accessGroupId:    String(body.accessGroupId ?? ''),
        status:           (body.status as 'ATIVO' | 'INATIVO') ?? 'ATIVO',
        tenantId:         (body.tenantId as string | null) ?? session.tenantId,
        defaultTenantId:  (body.defaultTenantId as string) ?? session.tenantId ?? session.defaultTenantId,
        scope:            (body.scope as 'PLATFORM' | 'TENANT') ?? 'TENANT',
        mustChangePassword: Boolean(body.mustChangePassword ?? false),
      });
      // Hash password via AuthStore so bcrypt is applied correctly.
      // Passing raw string as passwordHash would cause bcrypt.compare to always fail.
      if (password) {
        await AuthStore.updatePassword(user.id, password, Boolean(body.mustChangePassword ?? false));
      }

      auditFromRequest(req, session.tenantId || session.defaultTenantId, {
        action: 'CREATE_USER',
        entity: 'users',
        entityId: user.id,
        metadata: { createdBy: session.id, targetEmail: user.email },
      });

      return NextResponse.json(AuthStore.toPublicUser(user), { status: 201 });
    } catch (err) {
      console.error('[cadastro/users] create error', err);
      return NextResponse.json({ error: 'Erro ao criar usuario' }, { status: 400 });
    }
  }

  /* ── generic entities ────────────────────────────────────────────────── */
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const rbac = requirePermission(req, 'cadastros', 'criar', tenantId);
  if (rbac) return rbac;

  let body: Record<string, unknown>;
  try {
    body = await req.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Payload invalido. Envie um JSON valido.' }, { status: 422 });
  }

  // ── Entity-specific payload validation ──────────────────────────────────
  // equipamentos identify by `code`; all other generic entities use `name`.
  // tenantId from body/header is intentionally ignored — the session value is canonical.
  const existing = CadastroStorage.getAll(tenantId, entity) as Array<Record<string, unknown>>;

  if (entity === 'equipamentos') {
    const codeValue = body.code;
    if (!codeValue || String(codeValue).trim() === '') {
      return NextResponse.json(
        { error: 'Campo obrigatorio ausente: code.' },
        { status: 422 }
      );
    }
    // 409 — duplicate code within same tenant (same code in different tenants is allowed)
    const normalizedCode = String(codeValue).trim().toLowerCase();
    if (existing.some(item => String(item.code ?? '').trim().toLowerCase() === normalizedCode)) {
      return NextResponse.json(
        { error: 'Equipamento com esse codigo ja existe neste tenant.' },
        { status: 409 }
      );
    }
  } else {
    // 422 — required field validation for name-based entities
    const nameValue = body.name ?? body.model ?? body.nome;
    if (!nameValue || String(nameValue).trim() === '') {
      return NextResponse.json(
        { error: 'Campo obrigatorio ausente: name.' },
        { status: 422 }
      );
    }
    // 409 — duplicate name within same tenant
    const normalizedNew = String(nameValue).trim().toLowerCase();
    const isDuplicate = existing.some(
      item => String(item.name ?? item.model ?? item.nome ?? '').trim().toLowerCase() === normalizedNew
    );
    if (isDuplicate) {
      return NextResponse.json(
        { error: 'Registro com esse nome ja existe neste tenant.' },
        { status: 409 }
      );
    }
  }

  try {
    // body.tenantId (if sent) is overwritten by CadastroStorage.create with the
    // session-resolved tenantId — clients can never inject a foreign tenant.
    const item = CadastroStorage.create(tenantId, entity, body);
    auditFromRequest(req, tenantId, {
      action: 'CREATE',
      entity,
      entityId: (item as Record<string, string>).id,
    });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('[storage-api] create error entity=' + entity, err);
    return NextResponse.json({ error: 'Erro interno ao criar registro.' }, { status: 500 });
  }
}
