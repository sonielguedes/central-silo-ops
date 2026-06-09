export type SystemRole =
  | 'SUPER_ADMIN_SILO'
  | 'SUPER_ADMIN'
  | 'ADMIN_EMPRESA'
  | 'GESTOR'
  | 'COA'
  | 'CONSULTA'
  | 'AUDITOR';

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
  | 'reconhecer';

export interface Permission {
  module: Module;
  actions: Action[];
}

const ROLE_LEVEL: Record<SystemRole, number> = {
  SUPER_ADMIN_SILO: 110,
  SUPER_ADMIN: 100,
  ADMIN_EMPRESA: 80,
  GESTOR: 60,
  COA: 40,
  CONSULTA: 20,
  AUDITOR: 30,
};

export function getRoleLevel(role: SystemRole): number {
  return ROLE_LEVEL[role] ?? 0;
}

export function isRoleAtLeast(userRole: SystemRole, minimumRole: SystemRole): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(minimumRole);
}

const ALL_READ: Action[] = ['visualizar'];
const READ_EXPORT: Action[] = ['visualizar', 'exportar'];
const CRUD: Action[] = ['visualizar', 'criar', 'editar', 'arquivar'];
const CRUD_EXPORT: Action[] = ['visualizar', 'criar', 'editar', 'arquivar', 'exportar'];
const FULL: Action[] = ['visualizar', 'criar', 'editar', 'arquivar', 'exportar', 'aprovar', 'administrar'];

export const ROLE_PERMISSIONS: Record<SystemRole, Permission[]> = {
  SUPER_ADMIN_SILO: [
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

export function getPermissions(role: SystemRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: SystemRole, module: Module, action: Action): boolean {
  if (role === 'SUPER_ADMIN' || role === 'SUPER_ADMIN_SILO') return true;
  const perms = ROLE_PERMISSIONS[role];
  const modPerm = perms?.find((p) => p.module === module);
  return !!modPerm && modPerm.actions.includes(action);
}

export function canAccessModule(role: SystemRole, module: Module): boolean {
  return hasPermission(role, module, 'visualizar');
}

export function canWrite(role: SystemRole, module: Module): boolean {
  return hasPermission(role, module, 'criar') || hasPermission(role, module, 'editar');
}

export const MODULE_ALIAS: Record<string, Module> = {
  ABASTECIMENTOS: 'operacoes',
  ALERTAS: 'alertas',
  CHECKLISTS: 'equipamentos',
  CONECTIVIDADE: 'dashboard',
  EMPRESAS: 'administracao',
  EQUIPAMENTOS: 'equipamentos',
  FAZENDAS: 'cadastros',
  FICHA_OPERADOR: 'operadores',
  FROTA: 'equipamentos',
  GRUPOS: 'equipamentos',
  IMPLEMENTOS: 'equipamentos',
  MAPA: 'mapa',
  MODELOS: 'equipamentos',
  OPERACOES: 'operacoes',
  OPERACIONAL: 'operacoes',
  OPERADORES: 'operadores',
  PAINEL: 'operacoes',
  PARADAS: 'cadastros',
  PERFIS: 'administracao',
  RELATORIOS: 'relatorios',
  SINCRONIZACAO: 'sincronizacao',
  TIPOS: 'equipamentos',
  USUARIOS: 'administracao',
};

export const ROUTE_MODULE_MAP: Array<{ pattern: RegExp; module: Module }> = [
  { pattern: /^\/dashboard/, module: 'dashboard' },
  { pattern: /^\/mapa-operacional/, module: 'mapa' },
  { pattern: /^\/monitoramento/, module: 'dashboard' },
  { pattern: /^\/frota/, module: 'equipamentos' },
  { pattern: /^\/operadores/, module: 'operadores' },
  { pattern: /^\/fazendas-talhoes/, module: 'cadastros' },
  { pattern: /^\/paradas/, module: 'cadastros' },
  { pattern: /^\/operacional/, module: 'operacoes' },
  { pattern: /^\/operacoes/, module: 'operacoes' },
  { pattern: /^\/abastecimentos/, module: 'operacoes' },
  { pattern: /^\/sincronizacao/, module: 'sincronizacao' },
  { pattern: /^\/alertas/, module: 'alertas' },
  { pattern: /^\/ferramentas/, module: 'operacoes' },
  { pattern: /^\/administracao/, module: 'administracao' },
  { pattern: /^\/relatorios/, module: 'relatorios' },
  { pattern: /^\/configuracoes/, module: 'configuracoes' },
];

export function moduleFromPath(pathname: string): Module | null {
  for (const entry of ROUTE_MODULE_MAP) {
    if (entry.pattern.test(pathname)) return entry.module;
  }
  return null;
}

export function canAccessRoute(role: SystemRole, href: string): boolean {
  if (role === 'SUPER_ADMIN' || role === 'SUPER_ADMIN_SILO') return true;

  for (const entry of ROUTE_MODULE_MAP) {
    if (entry.pattern.test(href)) {
      return canAccessModule(role, entry.module);
    }
  }

  return true;
}

export const SYSTEM_ROLES: Array<{
  id: string;
  role: SystemRole;
  name: string;
  description: string;
}> = [
  { id: 'role-super-admin-silo', role: 'SUPER_ADMIN_SILO', name: 'Super Administrador SILO', description: 'Acesso total à plataforma SILO OPS' },
  { id: 'role-super-admin', role: 'SUPER_ADMIN', name: 'Super Administrador', description: 'Acesso total a todas as empresas e configuracoes globais' },
  { id: 'role-admin-empresa', role: 'ADMIN_EMPRESA', name: 'Admin Empresa', description: 'Gestao completa da propria empresa: cadastros, configuracoes, usuarios' },
  { id: 'role-gestor', role: 'GESTOR', name: 'Gestor', description: 'Dashboard, relatorios, alertas, operacoes. Sem configuracoes de sistema' },
  { id: 'role-coa', role: 'COA', name: 'Centro de Operacoes', description: 'Visualizacao em tempo real, mapa, alertas. Sem escrita em cadastros' },
  { id: 'role-consulta', role: 'CONSULTA', name: 'Consulta', description: 'Somente leitura em dashboard e relatorios' },
  { id: 'role-auditor', role: 'AUDITOR', name: 'Auditor', description: 'Acesso ao audit-log e relatorios de auditoria. Sem escrita' },
];
