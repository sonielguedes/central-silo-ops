"use client";

/**
 * SubscriptionBanner — Exibe avisos de assinatura no topo da aplicação.
 *
 * Deve ser renderizado no layout principal após o login, passando o resultado
 * de validateCompanyAccess() para o componente.
 */

import React from "react";
import { AlertTriangle, XCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubscriptionStatus } from "@/lib/types";

export interface SubscriptionBannerProps {
  status: SubscriptionStatus;
  daysRemaining: number | null;
  message?: string;
  /** Se true, mostra banner de suporte (SUPER_ADMIN_SILO acessando empresa expirada). */
  supportOverride?: boolean;
}

export function SubscriptionBanner({
  status,
  daysRemaining,
  message,
  supportOverride,
}: SubscriptionBannerProps) {
  // Nenhum banner para empresa ATIVA sem override
  if (status === "ATIVO" && !supportOverride) return null;

  if (supportOverride) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm text-purple-300">
        <AlertTriangle size={14} className="shrink-0" />
        <span>{message ?? "Acesso de suporte ativo. Empresa com restrição."}</span>
      </div>
    );
  }

  if (status === "EXPIRANDO") {
    const isCritical = daysRemaining !== null && daysRemaining <= 3;
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm",
          isCritical
            ? "border-red-500/40 bg-red-500/10 text-red-300"
            : "border-yellow-500/40 bg-yellow-500/10 text-yellow-300",
        )}
      >
        <Clock size={14} className="shrink-0" />
        <span>
          {isCritical
            ? `⚠ Atenção: seu acesso vence em ${daysRemaining} dia(s). Regularize para evitar bloqueio.`
            : message ?? `Seu acesso vence em ${daysRemaining} dia(s).`}
        </span>
      </div>
    );
  }

  if (status === "EXPIRADO") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm text-red-300">
        <XCircle size={14} className="shrink-0" />
        <span>Acesso expirado. Entre em contato com o suporte SILO OPS.</span>
      </div>
    );
  }

  if (status === "SUSPENSO") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-sm text-orange-300">
        <XCircle size={14} className="shrink-0" />
        <span>Empresa suspensa. Entre em contato com o suporte SILO OPS.</span>
      </div>
    );
  }

  if (status === "CANCELADO") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/15 px-4 py-2 text-sm text-red-300">
        <XCircle size={14} className="shrink-0" />
        <span>Empresa cancelada. Entre em contato com o suporte SILO OPS.</span>
      </div>
    );
  }

  return null;
}

// ── Painel de assinatura (para tela de empresas) ───────────────────────────

import type { Company } from "@/lib/types";

interface SubscriptionPanelProps {
  company: Company;
  onAction: (
    action: "RENOVAR" | "SUSPENDER" | "REATIVAR" | "CANCELAR" | "ATUALIZAR_CONTRATO",
    opts?: {
      trialDays?: 15 | 30;
      billingCycle?: "MENSAL" | "TRIMESTRAL" | "ANUAL";
      contractEndsAt?: string;
    },
  ) => void;
  loading?: boolean;
  isSuperAdmin?: boolean;
}

function FieldRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null) return null;
  return (
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono text-white">{String(value)}</span>
    </div>
  );
}

function StatusChip({ status }: { status: SubscriptionStatus }) {
  const colors: Record<SubscriptionStatus, string> = {
    ATIVO: "border-green-500/30 bg-green-500/10 text-green-400",
    EXPIRANDO: "border-yellow-500/30 bg-yellow-500/10 text-yellow-400",
    EXPIRADO: "border-red-500/30 bg-red-500/10 text-red-400",
    SUSPENSO: "border-orange-500/30 bg-orange-500/10 text-orange-400",
    CANCELADO: "border-red-500/30 bg-red-500/15 text-red-400",
  };
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        colors[status],
      )}
    >
      {status}
    </span>
  );
}

export function SubscriptionPanel({
  company,
  onAction,
  loading,
  isSuperAdmin,
}: SubscriptionPanelProps) {
  const status = (company.subscriptionStatus ?? "ATIVO") as SubscriptionStatus;
  const isSuspendedOrCancelled = status === "SUSPENSO" || status === "CANCELADO";

  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#0d1117] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Plano de Serviço
        </p>
        <StatusChip status={status} />
      </div>

      <div className="space-y-2">
        <FieldRow label="Plano" value={company.plan} />

        {/* PILOTO */}
        {company.plan === "PILOTO" && (
          <>
            <FieldRow label="Dias de teste" value={company.trialDays ?? 30} />
            <FieldRow
              label="Início do teste"
              value={
                company.trialStartedAt
                  ? new Date(company.trialStartedAt).toLocaleDateString("pt-BR")
                  : "-"
              }
            />
            <FieldRow
              label="Vencimento"
              value={
                company.trialEndsAt
                  ? new Date(company.trialEndsAt).toLocaleDateString("pt-BR")
                  : "-"
              }
            />
          </>
        )}

        {/* PRO */}
        {company.plan === "PRO" && (
          <>
            <FieldRow label="Ciclo" value={company.billingCycle ?? "-"} />
            <FieldRow
              label="Início"
              value={
                company.subscriptionStartedAt
                  ? new Date(company.subscriptionStartedAt).toLocaleDateString("pt-BR")
                  : "-"
              }
            />
            <FieldRow
              label="Vencimento"
              value={
                company.subscriptionEndsAt
                  ? new Date(company.subscriptionEndsAt).toLocaleDateString("pt-BR")
                  : "-"
              }
            />
          </>
        )}

        {/* ENTERPRISE */}
        {company.plan === "ENTERPRISE" && (
          <>
            <FieldRow
              label="Início do contrato"
              value={
                company.contractStartedAt
                  ? new Date(company.contractStartedAt).toLocaleDateString("pt-BR")
                  : "-"
              }
            />
            <FieldRow
              label="Vencimento do contrato"
              value={
                company.contractEndsAt
                  ? new Date(company.contractEndsAt).toLocaleDateString("pt-BR")
                  : "Sem vencimento"
              }
            />
          </>
        )}

        {company.lastRenewedAt && (
          <FieldRow
            label="Última renovação"
            value={new Date(company.lastRenewedAt).toLocaleDateString("pt-BR")}
          />
        )}
      </div>

      {/* Botões de ação */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-[#2d3647]">
        {/* PILOTO — botões de renovação */}
        {company.plan === "PILOTO" && !isSuspendedOrCancelled && (
          <>
            <ActionButton
              label="Renovar +15 dias"
              onClick={() => onAction("RENOVAR", { trialDays: 15 })}
              loading={loading}
              variant="primary"
            />
            <ActionButton
              label="Renovar +30 dias"
              onClick={() => onAction("RENOVAR", { trialDays: 30 })}
              loading={loading}
              variant="primary"
            />
          </>
        )}

        {/* PRO — botões de renovação */}
        {company.plan === "PRO" && !isSuspendedOrCancelled && (
          <>
            <ActionButton
              label="Renovar Mensal"
              onClick={() => onAction("RENOVAR", { billingCycle: "MENSAL" })}
              loading={loading}
              variant="primary"
            />
            <ActionButton
              label="Renovar Trimestral"
              onClick={() => onAction("RENOVAR", { billingCycle: "TRIMESTRAL" })}
              loading={loading}
              variant="primary"
            />
            <ActionButton
              label="Renovar Anual"
              onClick={() => onAction("RENOVAR", { billingCycle: "ANUAL" })}
              loading={loading}
              variant="primary"
            />
          </>
        )}

        {/* ENTERPRISE */}
        {company.plan === "ENTERPRISE" && !isSuspendedOrCancelled && (
          <ActionButton
            label="Atualizar Contrato"
            onClick={() => onAction("ATUALIZAR_CONTRATO")}
            loading={loading}
            variant="primary"
          />
        )}

        {/* Suspender/Reativar — apenas SUPER_ADMIN */}
        {isSuperAdmin && status !== "CANCELADO" && (
          status === "SUSPENSO" ? (
            <ActionButton
              label="Reativar"
              onClick={() => onAction("REATIVAR")}
              loading={loading}
              variant="success"
            />
          ) : (
            <ActionButton
              label="Suspender"
              onClick={() => onAction("SUSPENDER")}
              loading={loading}
              variant="warning"
            />
          )
        )}

        {/* Cancelar — apenas SUPER_ADMIN, não cancelado */}
        {isSuperAdmin && status !== "CANCELADO" && (
          <ActionButton
            label="Cancelar contrato"
            onClick={() => onAction("CANCELAR")}
            loading={loading}
            variant="danger"
          />
        )}
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  loading,
  variant,
}: {
  label: string;
  onClick: () => void;
  loading?: boolean;
  variant: "primary" | "success" | "warning" | "danger";
}) {
  const colors = {
    primary: "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
    success: "border-green-500/30 bg-green-500/10 text-green-400 hover:bg-green-500/20",
    warning: "border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20",
    danger: "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        "rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
        colors[variant],
      )}
    >
      {loading ? "..." : label}
    </button>
  );
}
