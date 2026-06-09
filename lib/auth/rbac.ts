/**
 * rbac.ts — Role-Based Access Control for SILO OPS Central.
 *
 * Defines 6 system roles with fixed permission matrices.
 * Each role maps to a set of allowed (module, action) pairs.
 * API routes use requirePermission() to enforce access.
 * Frontend uses hasPermission() and filterMenuByRole() for UI gating.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auditFromRequest } from '@/lib/audit/audit-log';

// ── Role Hierarchy ─────────────────────────────────────────────────────────

export type SystemRole =
  | 'SUPER_ADMIN'
  | 'ADMIN_EMPRESA'
  | 'GESTOR'
  | 'COA'
  | 'CONSULTA'
  | 'AUDITOR';

/** Numeric level for hierarchy comparisons (higher = more privileged) */
const ROLE_LEVEL: Record<SystemRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN_EMPRESA: 80,
  GESTOR: 60,
  COA: 40,
  CONSULTA: 20,
  AUDITOR: 30,
};

export function getRoleLevel(role: SystemRole): number {
  return ROLE_LEVEL[role] || 0;
}

export function isRoleAtLeast(userRole: SystemRole, minimumRole: SystemRole): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(minimumRole);
}

// ── Modules & Actions ──────────────────────────────────────────────────────

export type Module =
  | 'dashboard'
  | 'mapa'
  | 'operacoes'
  | 'equipamentos'
  | 'operadores'
  | 'alertas'
  | 'relatorios'
  | 'cadastros'
  | 'administracao'
  | 'audit-log'
  | 'configuracoes'
  | 'sincronizacao';

export type Action =
  | 'visualizar'
  | 'criar'
  | 'editar'
  | 'arquivar'
  | 'exportar'
  | 'aprovar'
  | 'administrar'
  | 'reconhecer';  // alert-specific

export interface Permission {
  module: Module;
  actions: Action[];
}

// ── Permission Matrix ──────────────────────────────────────────────────────

const ALL_READ: Action[] = ['visualizar'];
const READ_EXPORT: Action[] = ['visualizar', 'exportar'];
const CRUD: Action[] = ['visualizar', 'criar', 'editar', 'arquivar'];
const CRUD_EXPORT: Action[] = ['visualizar', 'criar', 'editar', 'arquivar', 'exportar'];
const FULL: Action[] = ['visualizar', 'criar', 'editar', 'arquivar', 'exportar', 'aprovar', 'administrar'];

const ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  SUPER_ADMIN: [
    { module: 'dashboard', actions: FULL },
    { module: 'mapa', actions: FULL },
    { module: 'operacoes', actions: FULL },
    { module: 'equipamentos', actions: FULL },
    { module: 'operadores', actions: FULL },
    { module: 'alertas', actions: [...FULL, 'reconhecer'] },
    { module: 'relatorios', actions: FULL },
    { module: 'cadastros', actions: FULL },
    { module: 'administracao', actions: FULL },
    { module: 'audit-log', actions: FULL },
    { module: 'configuracoes', actions: FULL },
    { module: 'sincronizacao', actions: FULL },
  ],

  ADMIN_EMPRESA: [
    { module: 'dashboard', actions: READ_EXPORT },
    { module: 'mapa', actions: ALL_READ },
    { module: 'operacoes', actions: READ_EXPORT },
    { module: 'equipamentos', actions: CRUD_EXPORT },
    { module: 'operadores', actions: CRUD_EXPORT },
    { module: 'alertas', actions: ['visualizar', 'reconhecer', 'exportar'] },
    { module: 'relatorios', actions: READ_EXPORT },
    { module: 'cadastros', actions: CRUD_EXPORT },
    { module: 'administracao', actions: ['visualizar', 'criar', 'editar'] },
    { module: 'audit-log', actions: ALL_READ },
    { module: 'configuracoes', actions: CRUD },
    { module: 'sincronizacao', actions: ALL_READ },
  ],

  GESTOR: [
    { module: 'dashboard', actions: READ_EXPORT },
    { module: 'mapa', actions: ALL_READ },
    { module: 'operacoes', actions: READ_EXPORT },
    { module: 'equipamentos', actions: READ_EXPORT },
    { module: 'operadores', actions: READ_EXPORT },
    { module: 'alertas', actions: ['visualizar', 'reconhecer', 'exportar'] },
    { module: 'relatorios', actions: READ_EXPORT },
    { module: 'cadastros', actions: ALL_READ },
    { module: 'sincronizacao', actions: ALL_READ },
  ],

  COA: [
    { module: 'dashboard', actions: ALL_READ },
    { module: 'mapa', actions: ALL_READ },
    { module: 'operacoes', actions: ALL_READ },
    { module: 'equipamentos', actions: ALL_READ },
    { module: 'alertas', actions: ['visualizar', 'reconhecer'] },
    { module: 'sincronizacao', actions: ALL_READ },
  ],

  CONSULTA: [
    { module: 'dashboard', actions: ALL_READ },
    { module: 'mapa', actions: ALL_READ },
    { module: 'operacoes', actions: ALL_READ },
    { module: 'equipamentos', actions: ALL_READ },
    { module: 'operadores', actions: ALL_READ },
    { module: 'alertas', actions: ALL_READ },
    { module: 'relatorios', actions: READ_EXPORT },
  ],

  AUDITOR: [
    { module: 'dashboard', actions: ALL_READ },
    { module: 'relatorios', actions: READ_EXPORT },
    { module: 'audit-log', actions: READ_EXPORT },
    { module: 'alertas', actions: ALL_READ },
  ],
};

// ── Query Functions ────────────────────────────────────────────────────────

export function getPermissions(role: SystemRole): Permission[] {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role: SystemRole, module: Module, action: Action): boolean {
  if (role === 'SUPER_ADMIN') return true;
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return false;
  const modPerm = perms.find(p => p.module === module);
  if (!modPerm) return false;
  return modPerm.actions.includes(action);
}

export function canAccessModule(role: SystemRole, module: Module): boolean {
  return hasPermission(role, module, 'visualizar');
}

export function canWrite(role: SystemRole, module: Module): boolean {
  return hasPermission(role, module, 'criar') || hasPermission(role, module, 'editar');
}

// ── API Guard ──────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: SystemRole;
  tenantId: string;
  accessGroupId?: string;
}

/**
 * Resolve session user from request.
 * Checks x-silo-user-role and x-silo-user-id headers (set by auth middleware/proxy).
 * In production, these should come from a verified JWT — not raw headers.
 * For pilot, we trust headers from the internal network.
 */
export function resolveSessionUser(req: NextRequest): SessionUser | null {
  const role = req.headers.get('x-silo-user-role')?.trim().toUpperCase() as SystemRole | undefined;
  const userId = req.headers.get('x-silo-user-id')?.trim();
  const userName = req.headers.get('x-silo-user-name')?.trim() || 'unknown';
  const userEmail = req.headers.get('x-silo-user-email')?.trim() || '';
  const tenantId = req.headers.get('x-silo-tenant')?.trim() || '';

  if (!role || !ROLE_LEVEL[role]) return null;

  return {
    id: userId || 'anonymous',
    name: userName,
    email: userEmail,
    role,
    tenantId,
  };
}

/**
 * Require specific permission on an API route.
 * Returns null if allowed, or a 403 NextResponse if denied.
 * Also logs denial in audit-log.
 *
 * If no session user is found in headers, falls back to allowing the request
 * (backward compat with pilot where web auth is cookie-based client-side).
 * Set strict=true to reject requests without session headers.
 */
export function requirePermission(
  req: NextRequest,
  module: Module,
  action: Action,
  tenantId: string,
  options?: { strict?: boolean },
): NextResponse | null {
  const user = resolveSessionUser(req);

  // No session headers — backward compat for pilot
  if (!user) {
    if (options?.strict) {
      return NextResponse.json(
        { error: 'Sessao nao identificada. Faca login novamente.' },
        { status: 401 },
      );
    }
    return null; // Allow (pilot mode — no server-side user auth yet)
  }

  if (hasPermission(user.role, module, action)) {
    return null; // Allowed
  }

  // Denied — log it
  console.warn('[rbac] permission denied', {
    userId: user.id,
    role: user.role,
    module,
    action,
    path: req.nextUrl.pathname,
  });

  auditFromRequest(req, tenantId, {
    action: 'PERMISSION_DENIED',
    entity: module,
    entityId: action,
    metadata: {
      userId: user.id,
      userName: user.name,
      role: user.role,
      path: req.nextUrl.pathname,
    },
  });

  return NextResponse.json(
    { error: 'Permissao insuficiente: ' + module + '/' + action + ' requer papel superior a ' + user.role },
    { status: 403 },
  );
}

// ── Route → Module Mapping ─────────────────────────────────────────────────

const ROUTE_MODULE_MAP: Array<{ pattern: RegExp; module: Module }> = [
  { pattern: /^\/api\/dashboard/, module: 'dashboard' },
  { pattern: /^\/api\/equipamentos/, module: 'equipamentos' },
  { pattern: /^\/api\/ficha-operador/, module: 'operadores' },
  { pattern: /^\/api\/alertas/, module: 'alertas' },
  { pattern: /^\/api\/relatorios/, module: 'relatorios' },
  { pattern: /^\/api\/cadastro/, module: 'cadastros' },
  { pattern: /^\/api\/admin/, module: 'administracao' },
  { pattern: /^\/api\/mobile/, module: 'operacoes' },
];

export function moduleFromPath(pathname: string): Module | null {
  for (const entry of ROUTE_MODULE_MAP) {
    if (entry.pattern.test(pathname)) return entry.module;
  }
  return null;
}

// ── Sidebar Filtering ──────────────────────────────────────────────────────

/** Map sidebar href patterns to required module for visibility */
const SIDEBAR_MODULE_MAP: Record<string, Module> = {
  '/dashboard': 'dashboard',
  '/mapa-operacional': 'mapa',
  '/monitoramento': 'dashboard',
  '/frota': 'equipamentos',
  '/operadores': 'operadores',
  '/fazendas-talhoes': 'cadastros',
  '/paradas': 'cadastros',
  '/operacional': 'operacoes',
  '/operacoes': 'operacoes',
  '/abastecimentos': 'operacoes',
  '/sincronizacao': 'sincronizacao',
  '/alertas': 'alertas',
  '/ferramentas': 'operacoes',
  '/administracao': 'administracao',
  '/relatorios': 'relatorios',
  '/configuracoes': 'configuracoes',
};

/**
 * Check if a sidebar href should be visible for the given role.
 */
export function canAccessRoute(role: SystemRole, href: string): boolean {
  if (role === 'SUPER_ADMIN') return true;

  // Find the most specific match
  const sortedPrefixes = Object.keys(SIDEBAR_MODULE_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of sortedPrefixes) {
    if (href === prefix || href.startsWith(prefix + '/')) {
      return canAccessModule(role, SIDEBAR_MODULE_MAP[prefix]);
    }
  }

  // Unknown route — allow by default (catch-all pages)
  return true;
}

// ── Seed Data ──────────────────────────────────────────────────────────────

export const SYSTEM_ROLES: Array<{
  id: string;
  role: SystemRole;
  name: string;
  description: string;
}> = [
  { id: 'role-super-admin', role: 'SUPER_ADMIN', name: 'Super Administrador', description: 'Acesso total a todas as empresas e configuracoes globais' },
  { id: 'role-admin-empresa', role: 'ADMIN_EMPRESA', name: 'Admin Empresa', description: 'Gestao completa da propria empresa: cadastros, configuracoes, usuarios' },
  { id: 'role-gestor', role: 'GESTOR', name: 'Gestor', description: 'Dashboard, relatorios, alertas, operacoes. Sem configuracoes de sistema' },
  { id: 'role-coa', role: 'COA', name: 'Centro de Operacoes', description: 'Visualizacao em tempo real, mapa, alertas. Sem escrita em cadastros' },
  { id: 'role-consulta', role: 'CONSULTA', name: 'Consulta', description: 'Somente leitura em dashboard e relatorios' },
  { id: 'role-auditor', role: 'AUDITOR', name: 'Auditor', description: 'Acesso ao audit-log e relatorios de auditoria. Sem escrita' },
];
