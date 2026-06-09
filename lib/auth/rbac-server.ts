import { NextRequest, NextResponse } from 'next/server';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import {
  Action,
  Module,
  SystemRole,
  hasPermission,
  isRoleAtLeast,
} from '@/lib/auth/rbac-shared';

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
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
  const user = resolveSessionFromRequest(req);

  if (!user) {
    if (options?.strict === false && process.env.NODE_ENV !== 'production') return null;
    return NextResponse.json(
      { error: 'Sessao nao identificada. Faca login novamente.' },
      { status: 401 },
    );
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
  const user = resolveSessionFromRequest(req);

  if (!user) {
    if (options?.strict === false && process.env.NODE_ENV !== 'production') return null;
    return NextResponse.json(
      { error: 'Sessao nao identificada. Faca login novamente.' },
      { status: 401 },
    );
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
