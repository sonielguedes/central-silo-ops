"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { AccessGroup, Company } from '@/lib/types';
import { AccessGroupService, CompanyService, BaseService } from '@/services/master.service';
import { getCsrfTokenFromDocument } from '@/lib/auth/csrf-client';
import {
  SystemRole,
  hasPermission,
  canAccessModule,
  canAccessRoute,
  Module,
  Action,
} from '@/lib/auth/rbac-shared';

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: SystemRole;
  scope: 'PLATFORM' | 'TENANT';
  tenantId: string | null;
  activeTenantId: string | null;
  defaultTenantId: string;
  accessGroupId: string;
  expiresAt: string;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
}

interface AuthContextType {
  user: SessionUser | null;
  userRole: SystemRole;
  accessGroup: AccessGroup | null;
  tenant: Company | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Logs in and returns the session user (incl. mustChangePassword flag). */
  login: (email: string, password?: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  /** Re-fetches /api/auth/me and refreshes in-memory session state. Call after password change. */
  refreshSession: () => Promise<void>;
  checkPermission: (module: string, action: string) => boolean;
  canAccess: (module: Module) => boolean;
  canRoute: (href: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Map accessGroupId to SystemRole */
function resolveRole(accessGroupId: string | undefined): SystemRole {
  if (!accessGroupId) return 'CONSULTA';
  const map: Record<string, SystemRole> = {
    'role-super-admin-silo': 'SUPER_ADMIN_SILO',
    'role-super-admin': 'SUPER_ADMIN',
    'ag-admin': 'SUPER_ADMIN',
    'role-admin-empresa': 'ADMIN_EMPRESA',
    'ag-admin-empresa': 'ADMIN_EMPRESA',
    'role-suporte': 'SUPORTE',
    'ag-suporte': 'SUPORTE',
    'role-gestor': 'GESTOR',
    'ag-gestor': 'GESTOR',
    'role-coa': 'COA',
    'ag-coa': 'COA',
    'role-sala-operacional': 'SALA_OPERACIONAL',
    'ag-sala-operacional': 'SALA_OPERACIONAL',
    'role-consulta': 'CONSULTA',
    'ag-consulta': 'CONSULTA',
    'role-auditor': 'AUDITOR',
    'ag-auditor': 'AUDITOR',
  };
  return map[accessGroupId] || 'CONSULTA';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [accessGroup, setAccessGroup] = useState<AccessGroup | null>(null);
  const [tenant, setTenant] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<SystemRole>('CONSULTA');

  const clearSessionState = useCallback(() => {
    localStorage.removeItem('silo_auth_user');
    sessionStorage.removeItem('silo_auth_user');
    setUser(null);
    setUserRole('CONSULTA');
    setAccessGroup(null);
    setTenant(null);
  }, []);

  useEffect(() => {
    restoreSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSession = async (sessionUser: SessionUser) => {
    try {
      setIsLoading(true);
      BaseService.setContext(
        sessionUser.name,
        sessionUser.activeTenantId || sessionUser.tenantId || sessionUser.defaultTenantId || '',
      );

      setUser(sessionUser);
      setUserRole(sessionUser.role || resolveRole(sessionUser.accessGroupId));

      const group = await AccessGroupService.getById(sessionUser.accessGroupId).catch(() => null);
      const companies = await CompanyService.getAllGlobal().catch(() => []);
      const currentTenant =
        companies.find(c => c.id === sessionUser.activeTenantId) ||
        companies.find(c => c.id === sessionUser.tenantId) ||
        companies.find(c => c.id === sessionUser.defaultTenantId) ||
        null;

      setAccessGroup(group || null);
      setTenant(currentTenant);
    } catch (error) {
      console.error('Failed to load session', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Restore session from /api/auth/me on initial mount.
   * A 401 here is the normal unauthenticated state — not an error.
   * Called only once (empty deps array), so there is no /api/auth/me polling loop.
   */
  const restoreSession = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
      if (res.status === 401) {
        clearSessionState();
        setIsLoading(false);
        return;
      }
      if (!res.ok) {
        setIsLoading(false);
        return;
      }
      const body = await res.json() as { session?: SessionUser; user?: SessionUser };
      const sessionUser = body.session || body.user;
      if (!sessionUser) {
        setIsLoading(false);
        return;
      }
      localStorage.setItem('silo_auth_user', JSON.stringify(sessionUser));
      await loadSession(sessionUser);
    } catch {
      setIsLoading(false);
    }
  };

  /**
   * Re-fetches /api/auth/me and refreshes in-memory session state.
   * Call after a successful password change so mustChangePassword becomes false.
   * Does NOT re-fetch access group / tenant data — only updates the session user.
   */
  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) return;
      const body = await res.json() as { session?: SessionUser; user?: SessionUser };
      const sessionUser = body.session || body.user;
      if (!sessionUser) return;
      localStorage.setItem('silo_auth_user', JSON.stringify(sessionUser));
      setUser(sessionUser);
      setUserRole(sessionUser.role || resolveRole(sessionUser.accessGroupId));
    } catch {
      // Non-critical: next navigation will re-check auth state.
    }
  }, []);

  const login = async (email: string, password?: string): Promise<SessionUser> => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { error?: string }).error || 'usuario ou senha invalidos');
      }

      const sessionUser = (body as { session: SessionUser }).session;
      localStorage.setItem('silo_auth_user', JSON.stringify(sessionUser));
      await loadSession(sessionUser);
      // Return the session so the caller can check mustChangePassword before routing.
      return sessionUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const csrf = getCsrfTokenFromDocument();
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
      },
    }).catch(() => null);
    clearSessionState();
    setIsLoading(false);
  };

  const checkPermission = useCallback((module: string, action: string) => {
    return hasPermission(userRole, module as Module, action as Action);
  }, [userRole]);

  const canAccess = useCallback((module: Module) => {
    return canAccessModule(userRole, module);
  }, [userRole]);

  const canRoute = useCallback((href: string) => {
    return canAccessRoute(userRole, href);
  }, [userRole]);

  return (
    <AuthContext.Provider value={{
      user,
      userRole,
      accessGroup,
      tenant,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      refreshSession,
      checkPermission,
      canAccess,
      canRoute,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
