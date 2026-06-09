import { NextRequest, NextResponse } from 'next/server';
import { auditFromRequest } from '@/lib/audit/audit-log';
import {
  Action,
  Module,
  SystemRole,
  hasPermission,
  isRoleAtLeast,
} from '@/lib/auth/rbac-shared';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: SystemRole;
  tenantId: string;
  accessGroupId?: string;
}

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

const VALID_ROLES: SystemRole[] = ['SUPER_ADMIN', 'ADMIN_EMPRESA', 'GESTOR', 'COA', 'CONSULTA', 'AUDITOR'];

export function resolveSessionUser(req: NextRequest): SessionUser | null {
  const rawRole = req.headers.get('x-silo-user-role')?.trim().toUpperCase();
  const userId = req.headers.get('x-silo-user-id')?.trim();
  const userName = req.headers.get('x-silo-user-name')?.trim() || 'unknown';
  const userEmail = req.headers.get('x-silo-user-email')?.trim() || '';
  const tenantId = req.headers.get('x-silo-tenant')?.trim() || '';

  if (!rawRole) return null;
  if (!VALID_ROLES.includes(rawRole as SystemRole)) return null;

  return {
    id: userId || 'anonymous',
    name: userName,
    email: userEmail,
    role: rawRole as SystemRole,
    tenantId,
  };
}

function deny(req: NextRequest, tenantId: string, reason: string, metadata: Record<string, unknown>) {
  auditFromRequest(req, tenantId, {
    action: 'PERMISSION_DENIED',
    entity: 'rbac',
    entityId: req.nextUrl.pathname,
    metadata: {
      ...metadata,
      ip: getClientIp(req),
    },
  });

  return NextResponse.json({ error: reason }, { status: 403 });
}

export function requirePermission(
  req: NextRequest,
  module: Module,
  action: Action,
  tenantId: string,
  options?: { strict?: boolean },
): NextResponse | null {
  const user = resolveSessionUser(req);

  if (!user) {
    if (options?.strict) {
      return NextResponse.json(
        { error: 'Sessao nao identificada. Faca login novamente.' },
        { status: 401 },
      );
    }
    return null;
  }

  if (hasPermission(user.role, module, action)) return null;

  console.warn('[rbac] permission denied', {
    userId: user.id,
    role: user.role,
    module,
    action,
    path: req.nextUrl.pathname,
    ip: getClientIp(req),
  });

  return deny(req, tenantId, `Permissao insuficiente: ${module}/${action}`, {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    module,
    action,
  });
}

export function requireRole(
  req: NextRequest,
  minimumRole: SystemRole,
  tenantId: string,
  options?: { strict?: boolean },
): NextResponse | null {
  const user = resolveSessionUser(req);

  if (!user) {
    if (options?.strict) {
      return NextResponse.json(
        { error: 'Sessao nao identificada. Faca login novamente.' },
        { status: 401 },
      );
    }
    return null;
  }

  if (isRoleAtLeast(user.role, minimumRole)) return null;

  console.warn('[rbac] role denied', {
    userId: user.id,
    role: user.role,
    minimumRole,
    path: req.nextUrl.pathname,
    ip: getClientIp(req),
  });

  return deny(req, tenantId, `Permissao insuficiente: requer ${minimumRole}`, {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    role: user.role,
    minimumRole,
  });
}
