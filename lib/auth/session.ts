import { NextRequest } from 'next/server';
import { AuthStore, AuthScope, AuthRole } from './auth-store';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: AuthRole;
  scope: AuthScope;
  tenantId: string | null;
  activeTenantId: string | null;
  defaultTenantId: string;
  accessGroupId: string;
  expiresAt: string;
  mustChangePassword: boolean;
}

export function resolveSessionFromRequest(req: NextRequest): SessionUser | null {
  const cookie = req.cookies.get(AuthStore.cookieName)?.value;
  const session = AuthStore.resolveSession(cookie);
  if (session) {
    return {
      id: session.userId,
      name: session.name,
      email: session.email,
      role: session.role,
      scope: session.scope,
      tenantId: session.tenantId,
      activeTenantId: session.activeTenantId,
      defaultTenantId: session.defaultTenantId,
      accessGroupId: session.accessGroupId,
      expiresAt: session.expiresAt,
      mustChangePassword: session.mustChangePassword,
    };
  }

  if (process.env.NODE_ENV !== 'production' && process.env.SILO_ALLOW_HEADER_SESSION === 'true') {
    const headerUserId = req.headers.get('x-silo-user-id')?.trim();
    if (!headerUserId) return null;
    const user = AuthStore.getUserById(headerUserId);
    if (!user || user.status !== 'ATIVO') return null;
    const headerTenant = req.headers.get('X-Silo-Tenant')?.trim() || req.headers.get('x-silo-tenant')?.trim() || null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      scope: user.scope,
      tenantId: user.tenantId,
      activeTenantId: user.scope === 'TENANT' ? user.tenantId : headerTenant,
      defaultTenantId: user.defaultTenantId,
      accessGroupId: user.accessGroupId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      mustChangePassword: user.mustChangePassword,
    };
  }
  return null;
}

export function getSessionUser(req: NextRequest): SessionUser | null {
  return resolveSessionFromRequest(req);
}
