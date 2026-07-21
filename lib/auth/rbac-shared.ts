export type SystemRole =
  | 'SUPER_ADMIN_SILO'
  | 'SUPER_ADMIN'
  | 'ADMIN_EMPRESA'
  | 'GESTOR'
  | 'SUPORTE'
  | 'GESTOR_COA'          // alias: GESTOR com visibilidade COA
  | 'COA'
  | 'SUPERVISOR_FRENTE'   // visualiza operações da frente
  | 'OPERADOR_CENTRAL'    // operador via Central web
  | 'MANUTENCAO'          // acesso a equipamentos e ordens de serviço
  | 'CLIENTE_RELATORIOS'  // só relatórios e exportação
  | 'OPERADOR_APK'        // só mobile, sem acesso web
  | 'SALA_OPERACIONAL'    // acesso TV/sala operacional somente leitura
  | 'CONSULTA'
  | 'AUDITOR';

/**
 * Roles que são aliases de outra role canônica.
 * Usado por resolveSessionFromRequest e auth-store para normalizar.
 */
export const ROLE_ALIAS: Partial<Record<SystemRole, SystemRole>> = {
  GESTOR_COA:        'GESTOR',
  SUPERVISOR_FRENTE: 'CONSULTA',
  OPERADOR_CENTRAL:  'COA',
  MANUTENCAO:        'CONSULTA',
  CLIENTE_RELATORIOS:'CONSULTA',
  OPERADOR_APK:      'CONSULTA',
};

/** Resolve alias → role canônica usada na matriz de permissões */
export function canonicalRole(role: SystemRole): SystemRole {
  return ROLE_ALIAS[role] ?? role;
}

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
  | 'sincronizacao'
  | 'combustivel'
  | 'integracoes';

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
  SUPER_ADMIN_SILO:   110,
  SUPER_ADMIN:        100,
  ADMIN_EMPRESA:       80,
  SUPORTE:             75,
  GESTOR:              60,
  GESTOR_COA:          60,  // mesmo nível que GESTOR
  COA:                 40,
  SUPERVISOR_FRENTE:   25,
  OPERADOR_CENTRAL:    40,  // mesmo nível que COA
  MANUTENCAO:          25,
  CLIENTE_RELATORIOS:  15,
  OPERADOR_APK:        10,
  SALA_OPERACIONAL:    18,
  CONSULTA:            20,
  AUDITOR:             30,
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
    { module: 'combustivel', actions: FULL },
    { module: 'integracoes', actions: FULL },
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
    { module: 'combustivel', actions: FULL },
    { module: 'integracoes', actions: FULL },
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
    { module: 'sincronizacao', actions: ['visualizar', 'editar'] },
    { module: 'combustivel', actions: CRUD_EXPORT },
    { module: 'integracoes', actions: CRUD_EXPORT },
  ],
  SUPORTE: [
    { module: 'integracoes', actions: FULL },
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
    { module: 'combustivel', actions: READ_EXPORT },
    { module: 'integracoes', actions: CRUD_EXPORT },
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
  SALA_OPERACIONAL: [
    { module: 'dashboard', actions: ALL_READ },
    { module: 'mapa', actions: ALL_READ },
    { module: 'alertas', actions: ALL_READ },
  ],
  // ── roles aliased via canonicalRole() — entradas dummy para satisfazer o tipo Record ──
  GESTOR_COA:         [],  // → GESTOR (resolvido em canonicalRole)
  SUPERVISOR_FRENTE:  [],  // → CONSULTA
  OPERADOR_CENTRAL:   [],  // → COA
  MANUTENCAO:         [],  // tratado diretamente em hasPermission
  CLIENTE_RELATORIOS: [],  // tratado diretamente em hasPermission
  OPERADOR_APK:       [],  // sem acesso web
};

export function getPermissions(role: SystemRole): Permission[] {
  const canonical = canonicalRole(role);
  return ROLE_PERMISSIONS[canonical] ?? [];
}

export function hasPermission(role: SystemRole, module: Module, action: Action): boolean {
  const canonical = canonicalRole(role);
  if (canonical === 'SUPER_ADMIN' || canonical === 'SUPER_ADMIN_SILO') return true;
  // OPERADOR_APK: sem acesso web nenhum
  if (role === 'OPERADOR_APK') return false;
  // MANUTENCAO: acesso restrito a equipamentos (read + ordens de serviço via operacoes)
  if (role === 'MANUTENCAO') {
    if (module === 'equipamentos' && (action === 'visualizar' || action === 'editar')) return true;
    if (module === 'operacoes'    &&  action === 'visualizar') return true;
    if (module === 'dashboard'   &&  action === 'visualizar') return true;
    return false;
  }
  // CLIENTE_RELATORIOS: só relatórios + exportar
  if (role === 'CLIENTE_RELATORIOS') {
    return module === 'relatorios' && (action === 'visualizar' || action === 'exportar');
  }
  const perms = ROLE_PERMISSIONS[canonical];
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
  ABASTECIMENTOS:       'operacoes',
  COMBUSTIVEL:          'combustivel',
  COMBUSTIVEL_PAINEL:   'combustivel',
  COMBUSTIVEL_ABAST:    'combustivel',
  COMBUSTIVEL_COMBOIOS: 'combustivel',
  COMBUSTIVEL_PRODUTOS: 'combustivel',
  COMBUSTIVEL_COMPRT:   'combustivel',
  COMBUSTIVEL_REL:      'combustivel',
  INTEGRACOES:          'integracoes',
  ALERTAS:              'alertas',
  CHECKLISTS:           'equipamentos',
  CONECTIVIDADE:        'dashboard',
  EMPRESAS:             'administracao',
  EQUIPAMENTOS:         'equipamentos',
  ESTADOS_OPERACIONAIS: 'equipamentos',
  FAZENDAS:             'cadastros',
  FAZENDAS_TALHOES:     'cadastros',
  FICHA_OPERADOR:       'operadores',
  FROTA:                'equipamentos',
  GRUPOS:               'equipamentos',
  HISTORICO_ATIVIDADE:  'operacoes',
  IMPLEMENTOS:          'equipamentos',
  MAPA:                 'mapa',
  MAPA_OPERACIONAL:     'mapa',
  SALA_OPERACIONAL:     'mapa',
  TV:                   'mapa',
  MODELOS:              'equipamentos',
  MODELOS_FROTA:        'equipamentos',
  OPERACOES:            'operacoes',
  OPERACIONAL:          'operacoes',
  OPERADORES:           'operadores',
  ORDENS_SERVICO:       'operacoes',
  PAINEL:               'operacoes',
  CENTROS_CUSTO:        'cadastros',
  PARADAS:              'cadastros',
  PERFIS:               'administracao',
  RELATORIOS:           'relatorios',
  SINCRONIZACAO:        'sincronizacao',
  TIPOS:                'equipamentos',
  TIPOS_FROTA:          'equipamentos',
  USUARIOS:             'administracao',
};

export const ROUTE_MODULE_MAP: Array<{ pattern: RegExp; module: Module }> = [
  { pattern: /^\/dashboard/, module: 'dashboard' },
  { pattern: /^\/tv/, module: 'mapa' },
  { pattern: /^\/mapa-operacional/, module: 'mapa' },
  { pattern: /^\/monitoramento/, module: 'dashboard' },
  { pattern: /^\/frota/, module: 'equipamentos' },
  { pattern: /^\/operadores/, module: 'operadores' },
  { pattern: /^\/fazendas-talhoes/, module: 'cadastros' },
  { pattern: /^\/centros-custo/, module: 'cadastros' },
  { pattern: /^\/paradas/, module: 'cadastros' },
  { pattern: /^\/operacional/, module: 'operacoes' },
  { pattern: /^\/operacoes/, module: 'operacoes' },
  { pattern: /^\/abastecimentos/, module: 'operacoes' },
  { pattern: /^\/combustivel/, module: 'combustivel' },
  { pattern: /^\/integracoes/, module: 'integracoes' },
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

  if (role === 'SALA_OPERACIONAL') {
    return (
      /^\/tv(?:\/|$|\?)/.test(href) ||
      /^\/mapa-operacional(?:\/|$|\?)/.test(href) ||
      /^\/monitoramento\/conectividade(?:\/|$|\?)/.test(href) ||
      /^\/alertas(?:\/|$|\?)/.test(href)
    );
  }

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
  { id: 'role-super-admin-silo',    role: 'SUPER_ADMIN_SILO',    name: 'Super Admin SILO',        description: 'Acesso total à plataforma. Requer tenant ativo para dados operacionais.' },
  { id: 'role-super-admin',         role: 'SUPER_ADMIN',          name: 'Super Administrador',     description: 'Acesso total a todas as empresas e configuracoes globais.' },
  { id: 'role-admin-empresa',       role: 'ADMIN_EMPRESA',        name: 'Admin Empresa',           description: 'Gestao completa da propria empresa: cadastros, configuracoes, usuarios.' },
  { id: 'role-suporte',             role: 'SUPORTE',              name: 'Suporte',                 description: 'Acesso operacional restrito aos módulos de integração e apoio técnico.' },
  { id: 'role-gestor',              role: 'GESTOR',               name: 'Gestor',                  description: 'Dashboard, relatorios, alertas, operacoes. Sem configuracoes de sistema.' },
  { id: 'role-gestor-coa',          role: 'GESTOR_COA',           name: 'Gestor / COA',            description: 'Permissoes de Gestor com visibilidade operacional em tempo real.' },
  { id: 'role-coa',                 role: 'COA',                  name: 'Centro de Operacoes',     description: 'Visualizacao em tempo real, mapa, alertas. Sem escrita em cadastros.' },
  { id: 'role-supervisor-frente',   role: 'SUPERVISOR_FRENTE',    name: 'Supervisor de Frente',    description: 'Visualiza operacoes e equipamentos da frente de trabalho.' },
  { id: 'role-operador-central',    role: 'OPERADOR_CENTRAL',     name: 'Operador Central Web',    description: 'Opera via Central web: mapa e operacoes em tempo real.' },
  { id: 'role-manutencao',          role: 'MANUTENCAO',           name: 'Manutencao',              description: 'Acesso a equipamentos e ordens de servico. Sem cadastros gerais.' },
  { id: 'role-cliente-relatorios',  role: 'CLIENTE_RELATORIOS',   name: 'Cliente (Relatorios)',    description: 'Somente acesso a relatorios e exportacao. Sem dados operacionais.' },
  { id: 'role-operador-apk',        role: 'OPERADOR_APK',         name: 'Operador APK',            description: 'Somente mobile. Sem acesso ao portal web.' },
  { id: 'role-sala-operacional',    role: 'SALA_OPERACIONAL',     name: 'Sala Operacional',        description: 'Acesso somente leitura para TV, mapa operacional e conectividade.' },
  { id: 'role-consulta',            role: 'CONSULTA',             name: 'Consulta',                description: 'Somente leitura em dashboard e relatorios.' },
  { id: 'role-auditor',             role: 'AUDITOR',              name: 'Auditor',                  description: 'Acesso ao audit-log e relatorios de auditoria. Sem escrita.' },
];
