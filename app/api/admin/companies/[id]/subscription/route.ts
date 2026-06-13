/**
 * PATCH /api/admin/companies/[id]/subscription
 *
 * Gerencia o plano de serviço de uma empresa: renovar, suspender, reativar, cancelar.
 * Requer SUPER_ADMIN_SILO ou ADMIN_EMPRESA (apenas para visualização do próprio tenant).
 *
 * Body esperado:
 *   { action: "RENOVAR" | "SUSPENDER" | "REATIVAR" | "CANCELAR" | "ATUALIZAR_CONTRATO",
 *     trialDays?: 15 | 30,
 *     billingCycle?: "MENSAL" | "TRIMESTRAL" | "ANUAL",
 *     contractEndsAt?: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { requireCsrf } from '@/lib/auth/csrf';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { buildRenewalFields } from '@/lib/subscription/subscription-validator';
import { migrateCompanySubscription } from '@/lib/subscription/subscription-migrator';
import type { Company, SubscriptionStatus } from '@/lib/types';

type SubscriptionAction =
  | 'RENOVAR'
  | 'SUSPENDER'
  | 'REATIVAR'
  | 'CANCELAR'
  | 'ATUALIZAR_CONTRATO';

function sanitize(company: Company) {
  const { companyToken, mobileToken, apiToken, token, ...safe } =
    company as Company & Record<string, unknown>;
  void companyToken; void mobileToken; void apiToken; void token;
  return safe;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  // ── Autenticação ──────────────────────────────────────────────────────────
  const user = resolveSessionFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Sessao nao identificada. Faca login novamente.' },
      { status: 401 },
    );
  }

  // ── CSRF ──────────────────────────────────────────────────────────────────
  const csrfError = requireCsrf(req);
  if (csrfError) return csrfError;

  // ── Autorização ───────────────────────────────────────────────────────────
  // Apenas SUPER_ADMIN_SILO pode suspender/cancelar/reativar empresas de qualquer tenant.
  // ADMIN_EMPRESA pode somente renovar o próprio contrato.
  const isSuperAdmin = user.role === 'SUPER_ADMIN_SILO';
  if (!isSuperAdmin && user.role !== 'ADMIN_EMPRESA') {
    return NextResponse.json(
      { error: 'Permissao insuficiente para gerenciar assinatura.' },
      { status: 403 },
    );
  }

  // ── Carregar empresa ──────────────────────────────────────────────────────
  const current = ServerStorage.getCompanies().find((c) => c.id === id);
  if (!current) {
    return NextResponse.json({ error: 'Empresa nao encontrada.' }, { status: 404 });
  }

  // ADMIN_EMPRESA: só acessa o próprio tenant
  if (!isSuperAdmin) {
    const tid = user.tenantId ?? user.activeTenantId;
    if (current.tenantId !== tid && current.id !== tid) {
      return NextResponse.json(
        { error: 'Sem permissao para gerenciar assinatura desta empresa.' },
        { status: 403 },
      );
    }
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Payload invalido.' }, { status: 400 });
  }

  const action = body.action as SubscriptionAction | undefined;
  if (!action) {
    return NextResponse.json({ error: 'Campo action obrigatorio.' }, { status: 400 });
  }

  // ── Garantir campos de assinatura (migração lazy) ─────────────────────────
  const { company: base } = migrateCompanySubscription(current);

  const timestamp = new Date().toISOString();
  let patch: Partial<Company> = {};
  let auditAction = '';

  switch (action) {
    // ── RENOVAR ─────────────────────────────────────────────────────────────
    case 'RENOVAR': {
      const trialDays = body.trialDays as 15 | 30 | undefined;
      const billingCycle = body.billingCycle as Company['billingCycle'] | undefined;
      const contractEndsAt = body.contractEndsAt as string | undefined;

      if (base.plan === 'PILOTO' && trialDays && trialDays !== 15 && trialDays !== 30) {
        return NextResponse.json(
          { error: 'trialDays deve ser 15 ou 30.' },
          { status: 400 },
        );
      }

      patch = buildRenewalFields(base, { trialDays, billingCycle, contractEndsAt });
      auditAction = 'SUBSCRIPTION_RENEWED';
      break;
    }

    // ── SUSPENDER ───────────────────────────────────────────────────────────
    case 'SUSPENDER': {
      if (!isSuperAdmin) {
        return NextResponse.json(
          { error: 'Apenas SUPER_ADMIN_SILO pode suspender empresas.' },
          { status: 403 },
        );
      }
      patch = { subscriptionStatus: 'SUSPENSO' as SubscriptionStatus };
      auditAction = 'SUBSCRIPTION_SUSPENDED';
      break;
    }

    // ── REATIVAR ─────────────────────────────────────────────────────────────
    case 'REATIVAR': {
      if (!isSuperAdmin) {
        return NextResponse.json(
          { error: 'Apenas SUPER_ADMIN_SILO pode reativar empresas.' },
          { status: 403 },
        );
      }
      patch = { subscriptionStatus: 'ATIVO' as SubscriptionStatus };
      auditAction = 'SUBSCRIPTION_REACTIVATED';
      break;
    }

    // ── CANCELAR ─────────────────────────────────────────────────────────────
    case 'CANCELAR': {
      if (!isSuperAdmin) {
        return NextResponse.json(
          { error: 'Apenas SUPER_ADMIN_SILO pode cancelar empresas.' },
          { status: 403 },
        );
      }
      patch = { subscriptionStatus: 'CANCELADO' as SubscriptionStatus };
      auditAction = 'SUBSCRIPTION_CANCELLED';
      break;
    }

    // ── ATUALIZAR_CONTRATO (ENTERPRISE) ──────────────────────────────────────
    case 'ATUALIZAR_CONTRATO': {
      if (base.plan !== 'ENTERPRISE') {
        return NextResponse.json(
          { error: 'ATUALIZAR_CONTRATO e valido apenas para plano ENTERPRISE.' },
          { status: 400 },
        );
      }
      const contractEndsAt = body.contractEndsAt as string | undefined;
      const contractStartedAt = body.contractStartedAt as string | undefined;
      patch = {
        subscriptionStatus: 'ATIVO' as SubscriptionStatus,
        ...(contractStartedAt ? { contractStartedAt } : {}),
        ...(contractEndsAt ? { contractEndsAt } : {}),
      };
      auditAction = 'CONTRACT_UPDATED';
      break;
    }

    default:
      return NextResponse.json({ error: `Acao desconhecida: ${action}` }, { status: 400 });
  }

  // ── Persistir ─────────────────────────────────────────────────────────────
  const updated: Company = {
    ...base,
    ...patch,
    version: (base.version ?? 1) + 1,
    updatedAt: timestamp,
    updatedBy: user.email ?? user.id,
    history: [
      ...(base.history ?? []),
      {
        timestamp,
        user: user.email ?? user.id,
        action: auditAction,
        changes: Object.fromEntries(
          Object.keys(patch).map((k) => [
            k,
            { old: (base as unknown as Record<string, unknown>)[k], new: (patch as unknown as Record<string, unknown>)[k] },
          ]),
        ),
      },
    ],
  };

  try {
    const saved = ServerStorage.upsertCompany(updated);

    auditFromRequest(req, saved.tenantId, {
      action: auditAction,
      entity: 'company',
      entityId: saved.id,
      before: {
        subscriptionStatus: current.subscriptionStatus,
        trialEndsAt: current.trialEndsAt,
        subscriptionEndsAt: current.subscriptionEndsAt,
        contractEndsAt: current.contractEndsAt,
      },
      after: {
        subscriptionStatus: saved.subscriptionStatus,
        trialEndsAt: saved.trialEndsAt,
        subscriptionEndsAt: saved.subscriptionEndsAt,
        contractEndsAt: saved.contractEndsAt,
      },
      userId: user.id,
      metadata: { action, by: user.email, plan: saved.plan },
    });

    return NextResponse.json({ company: sanitize(saved) });
  } catch (err) {
    console.error('[subscription/route] PATCH failed', err);
    return NextResponse.json({ error: 'Erro interno ao atualizar assinatura.' }, { status: 500 });
  }
}

// ── GET — retorna status atual de assinatura ──────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const user = resolveSessionFromRequest(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Sessao nao identificada.' },
      { status: 401 },
    );
  }

  const current = ServerStorage.getCompanies().find((c) => c.id === params.id);
  if (!current) {
    return NextResponse.json({ error: 'Empresa nao encontrada.' }, { status: 404 });
  }

  if (user.scope === 'TENANT') {
    const tid = user.tenantId ?? user.activeTenantId;
    if (current.tenantId !== tid && current.id !== tid) {
      return NextResponse.json({ error: 'Sem permissao.' }, { status: 403 });
    }
  }

  const { company } = migrateCompanySubscription(current);
  const { validateCompanyAccess } = await import('@/lib/subscription/subscription-validator');
  const access = validateCompanyAccess(company, user.role);

  return NextResponse.json({
    plan: company.plan,
    subscriptionStatus: access.status,
    daysRemaining: access.daysRemaining,
    message: access.message,
    trialDays: company.trialDays,
    trialStartedAt: company.trialStartedAt,
    trialEndsAt: company.trialEndsAt,
    billingCycle: company.billingCycle,
    subscriptionStartedAt: company.subscriptionStartedAt,
    subscriptionEndsAt: company.subscriptionEndsAt,
    contractStartedAt: company.contractStartedAt,
    contractEndsAt: company.contractEndsAt,
    lastRenewedAt: company.lastRenewedAt,
  });
}
