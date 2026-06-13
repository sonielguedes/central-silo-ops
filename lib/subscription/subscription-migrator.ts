/**
 * subscription-migrator.ts — Migração segura de empresas sem campos de assinatura.
 *
 * Regras:
 *  - PILOTO  sem trialEndsAt  → trialStartedAt = createdAt, trialDays = 30, trialEndsAt = +30d
 *  - PRO     sem subscriptionEndsAt → billingCycle = MENSAL, subscriptionStartedAt = createdAt, +30d
 *  - ENTERPRISE               → contractStartedAt = createdAt, subscriptionStatus = ATIVO
 *
 * GARANTE:
 *  - Nenhum dado existente é apagado.
 *  - Campos já preenchidos não são sobrescritos.
 *  - Audit log não é tocado.
 *  - Operação idempotente — pode ser chamada múltiplas vezes sem efeito colateral.
 */

import type { Company } from '@/lib/types';

/**
 * Aplica a migração de assinatura a uma única empresa em memória.
 * Retorna a empresa (possivelmente mutada), e um booleano indicando se houve mudança.
 *
 * NÃO persiste — o chamador é responsável por salvar se `changed === true`.
 */
export function migrateCompanySubscription(
  company: Company,
): { company: Company; changed: boolean } {
  // Já tem subscriptionStatus preenchido → já migrado
  if (company.subscriptionStatus) {
    return { company, changed: false };
  }

  const now = new Date().toISOString();
  // Base de tempo: preferir createdAt (histórico real), fallback para agora
  const base = company.createdAt ?? now;

  let patch: Partial<Company> = {};

  if (company.plan === 'PILOTO') {
    // Só migra se não tiver trialEndsAt
    if (!company.trialEndsAt) {
      const startedAt = company.trialStartedAt ?? base;
      const trialDays: 15 | 30 = company.trialDays ?? 30;
      const endsAt = new Date(
        new Date(startedAt).getTime() + trialDays * 24 * 60 * 60 * 1000,
      ).toISOString();

      patch = {
        subscriptionStatus: 'ATIVO',
        trialDays,
        trialStartedAt: startedAt,
        trialEndsAt: endsAt,
      };
    } else {
      // trialEndsAt existe mas subscriptionStatus não — só adiciona o status
      patch = { subscriptionStatus: 'ATIVO' };
    }
  } else if (company.plan === 'PRO') {
    if (!company.subscriptionEndsAt) {
      const startedAt = company.subscriptionStartedAt ?? base;
      const endsAt = new Date(
        new Date(startedAt).getTime() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();

      patch = {
        subscriptionStatus: 'ATIVO',
        billingCycle: company.billingCycle ?? 'MENSAL',
        subscriptionStartedAt: startedAt,
        subscriptionEndsAt: endsAt,
      };
    } else {
      patch = { subscriptionStatus: 'ATIVO' };
    }
  } else {
    // ENTERPRISE
    patch = {
      subscriptionStatus: 'ATIVO',
      contractStartedAt: company.contractStartedAt ?? base,
      // contractEndsAt NÃO é criado — ENTERPRISE sem data = sem expiração automática
    };
  }

  const migrated: Company = { ...company, ...patch };
  return { company: migrated, changed: true };
}

/**
 * Migra uma lista de empresas e retorna apenas as que foram alteradas.
 * Não persiste — o chamador decide o que fazer com o resultado.
 */
export function migrateCompaniesSubscription(
  companies: Company[],
): { migrated: Company[]; changedCount: number } {
  let changedCount = 0;
  const migrated = companies.map((c) => {
    const result = migrateCompanySubscription(c);
    if (result.changed) changedCount++;
    return result.company;
  });
  return { migrated, changedCount };
}
