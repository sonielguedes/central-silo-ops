"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, AccessGroup, Company } from '@/lib/types';
import { UserService, AccessGroupService, CompanyService, BaseService, AuditService } from '@/services/master.service';
import { SystemRole, hasPermission, canAccessModule, canAccessRoute, Module, Action } from '@/lib/auth/rbac';

interface AuthContextType {
  user: User | null;
  userRole: SystemRole;
  accessGroup: AccessGroup | null;
  tenant: Company | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  checkPermission: (module: string, action: string) => boolean;
  canAccess: (module: Module) => boolean;
  canRoute: (href: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Map accessGroupId to SystemRole */
function resolveRole(accessGroupId: string | undefined): SystemRole {
  if (!accessGroupId) return 'CONSULTA';
  const map: Record<string, SystemRole> = {
    'role-super-admin': 'SUPER_ADMIN',
    'ag-admin': 'SUPER_ADMIN',
    'role-admin-empresa': 'ADMIN_EMPRESA',
    'ag-admin-empresa': 'ADMIN_EMPRESA',
    'role-gestor': 'GESTOR',
    'ag-gestor': 'GESTOR',
    'role-coa': 'COA',
    'ag-coa': 'COA',
    'role-consulta': 'CONSULTA',
    'ag-consulta': 'CONSULTA',
    'role-auditor': 'AUDITOR',
    'ag-auditor': 'AUDITOR',
  };
  return map[accessGroupId] || 'CONSULTA';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessGroup, setAccessGroup] = useState<AccessGroup | null>(null);
  const [tenant, setTenant] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<SystemRole>('CONSULTA');

  useEffect(() => {
    const savedUser = localStorage.getItem('silo_auth_user');
    if (savedUser) {
      try {
        loadSession(JSON.parse(savedUser));
      } catch {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSession = async (userData: User) => {
    try {
      setIsLoading(true);
      BaseService.setContext(userData.name, userData.tenantId);

      const group = await AccessGroupService.getById(userData.accessGroupId);
      const companies = await CompanyService.getAllGlobal();
      const currentTenant = companies.find(c => c.id === userData.tenantId) || null;

      const role = resolveRole(userData.accessGroupId);
      setUser(userData);
      setUserRole(role);
      setAccessGroup(group || null);
      setTenant(currentTenant);
    } catch (error) {
      console.error('Failed to load session', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password?: string) => {
    setIsLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const allUsers = await UserService.getAll(true);
      const foundUser = allUsers.find(u => u.email.toLowerCase() === normalizedEmail);

      if (!foundUser) throw new Error('Usuario nao encontrado');
      if (foundUser.status === 'BLOQUEADO') throw new Error('Usuario bloqueado');

      if (foundUser.password && foundUser.password !== password) {
        throw new Error('Senha invalida');
      }

      await AuditService.create({
        userId: foundUser.id,
        userName: foundUser.name,
        module: 'AUTH',
        action: 'LOGIN',
        timestamp: new Date().toISOString(),
        ip: '127.0.0.1',
        origin: 'WEB'
      });

      localStorage.setItem('silo_auth_user', JSON.stringify(foundUser));
      await loadSession(foundUser);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('silo_auth_user');
    setUser(null);
    setUserRole('CONSULTA');
    setAccessGroup(null);
    setTenant(null);
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
