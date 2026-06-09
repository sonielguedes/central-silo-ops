import { NextRequest } from 'next/server';
import { AuthStore, AuthScope, AuthRole } from './auth-store';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  scope: AuthScope;
  tenantId: string | null;
  defaultTenantId: string;
  accessGroupId: string;
  expiresAt: string;
  mustChangePassword: boolean;
}

export function resolveSessionFromRequest(req: NextRequest): SessionUser | null {
  const cookie = req.cookies.get(AuthStore.cookieName)?.value;
  const session = AuthStore.resolveSession(cookie);
  if (!session) return null;
  return {
    id: session.userId,
    name: session.name,
    email: session.email,
    role: session.role,
    scope: session.scope,
    tenantId: session.tenantId,
    defaultTenantId: session.defaultTenantId,
    accessGroupId: session.accessGroupId,
    expiresAt: session.expiresAt,
    mustChangePassword: session.mustChangePassword,
  };
}

export function getSessionUser(req: NextRequest): SessionUser | null {
  return resolveSessionFromRequest(req);
}
