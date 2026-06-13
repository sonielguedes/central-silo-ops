/**
 * subscription-validator.ts — Validação centralizada de acesso por plano de serviço.
 *
 * Esta é a ÚNICA fonte de verdade para decidir se uma empresa pode operar.
 * Toda API, rota de login, APK e dashboard deve chamar validateCompanyAccess()
 * antes de processar dados operacionais.
 */

import type { Company, SubscriptionStatus, BillingCycle } from '@/lib/types';
import type { AuthRole } from '@/lib/auth/auth-store';

// ── Constantes ───────────────────────────────────────────────────────────────

/** Roles que têm acesso de suporte mesmo com empresa expirada. */
const SUPPORT_ROLES: AuthRole[] = ['SUPER_ADMIN_SILO'];

/** Aviso preventivo quando restam ≤ N dias. */
const WARN_DAYS = 7;

/** Aviso crítico quando restam ≤ N dias. */
const CRITICAL_WARN_DAYS = 3;

// ── Resultado de validação ───────────────────────────────────────────────────

export interface CompanyAccessResult {
  /** true = pode operar (inclusive EXPIRANDO com aviso). */
  allowed: boolean;
  status: SubscriptionStatus;
  daysRemaining: number | null;
  /** Mensagem amigável para exibição na UI ou retorno de API. */
  message: string;
  /** Código de erro para o APK (undefined quando allowed = true). */
  code?: 'COMPANY_EXPIRED' | 'COMPANY_SUSPENDED' | 'COMPANY_CANCELLED' | 'COMPANY_INACTIVE';
  /** true quando acesso é concedido apenas por override de suporte. */
  supportOverride?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Calcula dias restantes e o status derivado da assinatura para qualquer plano. */
export function computeSubscriptionStatus(
  company: Company,
  now = new Date(),
): { status: SubscriptionStatus; daysRemaining: number | null } {
  // Status manual sempre tem precedência sobre cálculo automático
  const manual = company.subscriptionStatus;
  if (manual === 'SUSPENSO' || manual === 'CANCELADO') {
    return { status: manual, daysRemaining: null };
  }

  const plan = company.plan;

  // ── PILOTO ────────────────────────────────────────────────────────────────
  if (plan === 'PILOTO') {
    if (!company.trialEndsAt) {
      // Sem data de vencimento definida → tratar como ATIVO (migração pendente)
      return { status: 'ATIVO', daysRemaining: null };
    }
    const days = Math.ceil(
      (new Date(company.trialEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days < 0) return { status: 'EXPIRADO', daysRemaining: 0 };
    if (days <= WARN_DAYS) return { status: 'EXPIRANDO', daysRemaining: days };
    return { status: 'ATIVO', daysRemaining: days };
  }

  // ── PRO ───────────────────────────────────────────────────────────────────
  if (plan === 'PRO') {
    if (!company.subscriptionEndsAt) {
      return { status: 'ATIVO', daysRemaining: null };
    }
    const days = Math.ceil(
      (new Date(company.subscriptionEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days < 0) return { status: 'EXPIRADO', daysRemaining: 0 };
    if (days <= WARN_DAYS) return { status: 'EXPIRANDO', daysRemaining: days };
    return { status: 'ATIVO', daysRemaining: days };
  }

  // ── ENTERPRISE ────────────────────────────────────────────────────────────
  if (plan === 'ENTERPRISE') {
    if (!company.contractEndsAt) {
      // ENTERPRISE sem data de fim → nunca bloqueia automaticamente
      return { status: 'ATIVO', daysRemaining: null };
    }
    const days = Math.ceil(
      (new Date(company.contractEndsAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (days < 0) {
      // ENTERPRISE vencido → aviso administrativo, mas NÃO bloqueia
      // (depende de controle manual via subscriptionStatus)
      return { status: 'EXPIRANDO', daysRemaining: 0 };
    }
    if (days <= WARN_DAYS) return { status: 'EXPIRANDO', daysRemaining: days };
    return { status: 'ATIVO', daysRemaining: days };
  }

  return { status: 'ATIVO', daysRemaining: null };
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Valida se a empresa está apta a usar o sistema.
 *
 * @param company  Registro completo da empresa.
 * @param userRole Role do usuário que está tentando acessar (opcional).
 *                 SUPER_ADMIN_SILO recebe acesso de suporte mesmo com empresa expirada.
 */
export function validateCompanyAccess(
  company: Company,
  userRole?: AuthRole,
): CompanyAccessResult {
  const isSuperAdmin = userRole != null && SUPPORT_ROLES.includes(userRole);

  // Empresa desativada administrativamente
  if (company.status === 'INATIVO') {
    if (isSuperAdmin) {
      return {
        allowed: true,
        status: 'SUSPENSO',
        daysRemaining: null,
        message: '[SUPORTE] Empresa está inativa, mas você tem acesso de suporte.',
        supportOverride: true,
      };
    }
    return {
      allowed: false,
      status: 'SUSPENSO',
      daysRemaining: null,
      message: 'Empresa inativa. Entre em contato com o suporte SILO OPS.',
      code: 'COMPANY_INACTIVE',
    };
  }

  const { status, daysRemaining } = computeSubscriptionStatus(company);

  // ── CANCELADO ─────────────────────────────────────────────────────────────
  if (status === 'CANCELADO') {
    if (isSuperAdmin) {
      return {
        allowed: true,
        status,
        daysRemaining: null,
        message: '[SUPORTE] Empresa cancelada, mas você tem acesso de suporte.',
        supportOverride: true,
      };
    }
    return {
      allowed: false,
      status,
      daysRemaining: null,
      message: 'Empresa cancelada. Entre em contato com o suporte SILO OPS.',
      code: 'COMPANY_CANCELLED',
    };
  }

  // ── SUSPENSO ──────────────────────────────────────────────────────────────
  if (status === 'SUSPENSO') {
    if (isSuperAdmin) {
      return {
        allowed: true,
        status,
        daysRemaining: null,
        message: '[SUPORTE] Empresa suspensa, mas você tem acesso de suporte.',
        supportOverride: true,
      };
    }
    return {
      allowed: false,
      status,
      daysRemaining: null,
      message: 'Empresa suspensa. Entre em contato com o suporte SILO OPS.',
      code: 'COMPANY_SUSPENDED',
    };
  }

  // ── EXPIRADO ──────────────────────────────────────────────────────────────
  if (status === 'EXPIRADO') {
    if (isSuperAdmin) {
      return {
        allowed: true,
        status,
        daysRemaining: 0,
        message: '[SUPORTE] Empresa expirada, mas você tem acesso de suporte.',
        supportOverride: true,
      };
    }
    return {
      allowed: false,
      status,
      daysRemaining: 0,
      message: 'Empresa com acesso expirado. Entre em contato com o suporte SILO OPS.',
      code: 'COMPANY_EXPIRED',
    };
  }

  // ── EXPIRANDO ─────────────────────────────────────────────────────────────
  if (status === 'EXPIRANDO') {
    const isCritical =
      daysRemaining !== null && daysRemaining <= CRITICAL_WARN_DAYS;

    const message = isCritical
      ? `Atenção: seu acesso vence em ${daysRemaining ?? 0} dia(s). Regularize para evitar bloqueio.`
      : `Seu acesso vence em ${daysRemaining ?? 0} dia(s).`;

    return { allowed: true, status, daysRemaining, message };
  }

  // ── ATIVO ─────────────────────────────────────────────────────────────────
  return {
    allowed: true,
    status: 'ATIVO',
    daysRemaining,
    message: 'Acesso ativo.',
  };
}

// ── Helpers para respostas de API ────────────────────────────────────────────

/** Resposta 403 padronizada para APK quando empresa está expirada. */
export function expiredApiResponse() {
  return {
    success: false,
    code: 'COMPANY_EXPIRED' as const,
    message: 'Empresa com acesso expirado. Entre em contato com o suporte SILO OPS.',
  };
}

/** Resposta 403 padronizada para APK quando empresa está suspensa. */
export function suspendedApiResponse() {
  return {
    success: false,
    code: 'COMPANY_SUSPENDED' as const,
    message: 'Empresa suspensa. Entre em contato com o suporte SILO OPS.',
  };
}

/** Resposta 403 padronizada para APK quando empresa está cancelada. */
export function cancelledApiResponse() {
  return {
    success: false,
    code: 'COMPANY_CANCELLED' as const,
    message: 'Empresa cancelada. Entre em contato com o suporte SILO OPS.',
  };
}

/** Resposta 403 padronizada para APK quando empresa está inativa. */
export function inactiveApiResponse() {
  return {
    success: false,
    code: 'COMPANY_INACTIVE' as const,
    message: 'Empresa inativa. Entre em contato com o suporte SILO OPS.',
  };
}

// ── Inicialização de campos ao criar empresa ─────────────────────────────────

/**
 * Retorna os campos de assinatura iniciais para uma empresa recém-criada.
 * Deve ser mesclado no payload de criação (POST /api/admin/companies).
 */
export function buildInitialSubscriptionFields(
  plan: Company['plan'],
  trialDays: 15 | 30 = 30,
  billingCycle: Company['billingCycle'] = 'MENSAL',
): Partial<Company> {
  const now = new Date();
  const iso = now.toISOString();

  if (plan === 'PILOTO') {
    const endsAt = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString();
    return {
      subscriptionStatus: 'ATIVO',
      trialDays,
      trialStartedAt: iso,
      trialEndsAt: endsAt,
    };
  }

  if (plan === 'PRO') {
    const cycleDays: Record<NonNullable<Company['billingCycle']>, number> = {
      MENSAL: 30,
      TRIMESTRAL: 90,
      ANUAL: 365,
    };
    const days = cycleDays[billingCycle ?? 'MENSAL'];
    const endsAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    return {
      subscriptionStatus: 'ATIVO',
      billingCycle: billingCycle ?? 'MENSAL',
      subscriptionStartedAt: iso,
      subscriptionEndsAt: endsAt,
    };
  }

  // ENTERPRISE
  return {
    subscriptionStatus: 'ATIVO',
    contractStartedAt: iso,
    // contractEndsAt intencionalmente ausente — ENTERPRISE não expira automaticamente
  };
}

// ── Renovação ────────────────────────────────────────────────────────────────

/**
 * Calcula os campos atualizados após renovação.
 * Para PILOTO: adiciona trialDays à data atual (ou ao trialEndsAt se ainda no prazo).
 * Para PRO: adiciona o ciclo a subscriptionEndsAt (ou à data atual se expirado).
 * Para ENTERPRISE: atualiza contractEndsAt se fornecido.
 */
export function buildRenewalFields(
  company: Company,
  options: {
    trialDays?: 15 | 30;
    billingCycle?: BillingCycle;
    contractEndsAt?: string;
  } = {},
): Partial<Company> {
  const now = new Date();
  const iso = now.toISOString();

  if (company.plan === 'PILOTO') {
    const days = options.trialDays ?? company.trialDays ?? 30;
    // Base: data atual OU trialEndsAt (se ainda no futuro) — sempre estende a partir do maior
    const base = company.trialEndsAt && new Date(company.trialEndsAt) > now
      ? new Date(company.trialEndsAt)
      : now;
    const endsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    return {
      subscriptionStatus: 'ATIVO',
      trialDays: days,
      trialEndsAt: endsAt,
      lastRenewedAt: iso,
    };
  }

  if (company.plan === 'PRO') {
    const cycle = options.billingCycle ?? company.billingCycle ?? 'MENSAL';
    const cycleDays: Record<BillingCycle, number> = {
      MENSAL: 30,
      TRIMESTRAL: 90,
      ANUAL: 365,
    };
    const days = cycleDays[cycle];
    const base = company.subscriptionEndsAt && new Date(company.subscriptionEndsAt) > now
      ? new Date(company.subscriptionEndsAt)
      : now;
    const endsAt = new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
    return {
      subscriptionStatus: 'ATIVO',
      billingCycle: cycle,
      subscriptionEndsAt: endsAt,
      lastRenewedAt: iso,
    };
  }

  // ENTERPRISE
  const fields: Partial<Company> = {
    subscriptionStatus: 'ATIVO',
    lastRenewedAt: iso,
  };
  if (options.contractEndsAt) fields.contractEndsAt = options.contractEndsAt;
  return fields;
}

// Re-export para uso no tipo BillingCycle (evitar import circular)
export type { BillingCycle };
