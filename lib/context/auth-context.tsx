"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AccessGroup, Company } from '@/lib/types';
import { UserService, AccessGroupService, CompanyService, BaseService, AuditService } from '@/services/master.service';

interface AuthContextType {
  user: User | null;
  accessGroup: AccessGroup | null;
  tenant: Company | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
  checkPermission: (module: string, action: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessGroup, setAccessGroup] = useState<AccessGroup | null>(null);
  const [tenant, setTenant] = useState<Company | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Attempt to restore session from localStorage
    const savedUser = localStorage.getItem('silo_auth_user');
    if (savedUser) {
      loadSession(JSON.parse(savedUser));
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadSession = async (userData: User) => {
    try {
      setIsLoading(true);

      // Crucial: Set global context for services
      BaseService.setContext(userData.name, userData.tenantId);

      const group = await AccessGroupService.getById(userData.accessGroupId);

      const companies = await CompanyService.getAllGlobal();
      const currentTenant = companies.find(c => c.id === userData.tenantId) || null;

      setUser(userData);
      setAccessGroup(group || null);
      setTenant(currentTenant);
    } catch (error) {
      console.error('Failed to load session', error);
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string) => {
    setIsLoading(true);
    try {
      // Mock login: find user by email across all tenants for this demo
      const allUsers = await UserService.getAll(true);
      const foundUser = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

      if (!foundUser) throw new Error('Usuário não encontrado');
      if (foundUser.status === 'BLOQUEADO') throw new Error('Usuário bloqueado');

      // Audit Login
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
    setAccessGroup(null);
    setTenant(null);
    setIsLoading(false);
  };

  const checkPermission = (module: string, action: string) => {
    if (!accessGroup) return false;
    // Admin always has permission
    if (accessGroup.id === 'ag-admin') return true;

    const permission = accessGroup.permissions.find(p => p.module === module);
    return permission?.actions.includes(action as any) || false;
  };

  return (
    <AuthContext.Provider value={{
      user,
      accessGroup,
      tenant,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      checkPermission
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
