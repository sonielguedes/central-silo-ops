/**
 * session.ts — Server-side session resolution for SILO OPS Central.
 *
 * Resolves the authenticated user from:
 *   1. x-silo-user-* headers (set by reverse proxy or frontend middleware)
 *   2. x-silo-session cookie (JWT — future implementation)
 *
 * For the pilot phase, the frontend sets headers from localStorage.
 * In production, this will be replaced with proper JWT validation.
 */

import { NextRequest } from 'next/server';
import { SystemRole } from './rbac-shared';

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: SystemRole;
  tenantId: string;
  accessGroupId?: string;
}

const VALID_ROLES: SystemRole[] = [
  'SUPER_ADMIN', 'ADMIN_EMPRESA', 'GESTOR', 'COA', 'CONSULTA', 'AUDITOR',
];

/**
 * Resolve the current session user from the request.
 * Returns null if the request has no authenticated headers/session.
 */
export function resolveSessionFromRequest(req: NextRequest): SessionUser | null {
  const role = (req.headers.get('x-silo-user-role') || '').trim().toUpperCase() as SystemRole;
  const userId = (req.headers.get('x-silo-user-id') || '').trim();

  if (!role || !userId || !VALID_ROLES.includes(role)) {
    return null;
  }

  return {
    id: userId,
    name: req.headers.get('x-silo-user-name')?.trim() || 'unknown',
    email: req.headers.get('x-silo-user-email')?.trim() || '',
    role,
    tenantId: req.headers.get('x-silo-tenant')?.trim() || '',
  };
}

export function getSessionUser(req: NextRequest): SessionUser | null {
  return resolveSessionFromRequest(req);
}

/**
 * Default seed users for the pilot.
 * These are created in the cadastro if no users exist.
 */
export const SEED_USERS = [
  {
    id: 'user-super-admin',
    name: 'Administrador SILO OPS',
    username: 'admin',
    email: 'admin@siloops.com.br',
    phone: '',
    jobTitle: 'Super Administrador',
    accessGroupId: 'role-super-admin',
    role: 'SUPER_ADMIN' as SystemRole,
    isADValidated: false,
    password: 'SiloOps@2026',
    requirePasswordChange: false,
    status: 'ATIVO' as const,
  },
  {
    id: 'user-gestor-demo',
    name: 'Gestor Operacional',
    username: 'gestor',
    email: 'gestor@siloops.com.br',
    phone: '',
    jobTitle: 'Gestor de Frotas',
    accessGroupId: 'role-gestor',
    role: 'GESTOR' as SystemRole,
    isADValidated: false,
    password: 'SiloOps@2026',
    requirePasswordChange: false,
    status: 'ATIVO' as const,
  },
  {
    id: 'user-coa-demo',
    name: 'Operador COA',
    username: 'coa',
    email: 'coa@siloops.com.br',
    phone: '',
    jobTitle: 'Centro de Operacoes',
    accessGroupId: 'role-coa',
    role: 'COA' as SystemRole,
    isADValidated: false,
    password: 'SiloOps@2026',
    requirePasswordChange: false,
    status: 'ATIVO' as const,
  },
  {
    id: 'user-consulta-demo',
    name: 'Usuario Consulta',
    username: 'consulta',
    email: 'consulta@siloops.com.br',
    phone: '',
    jobTitle: 'Consulta',
    accessGroupId: 'role-consulta',
    role: 'CONSULTA' as SystemRole,
    isADValidated: false,
    password: 'SiloOps@2026',
    requirePasswordChange: false,
    status: 'ATIVO' as const,
  },
  {
    id: 'user-auditor-demo',
    name: 'Auditor',
    username: 'auditor',
    email: 'auditor@siloops.com.br',
    phone: '',
    jobTitle: 'Auditor',
    accessGroupId: 'role-auditor',
    role: 'AUDITOR' as SystemRole,
    isADValidated: false,
    password: 'SiloOps@2026',
    requirePasswordChange: false,
    status: 'ATIVO' as const,
  },
];
