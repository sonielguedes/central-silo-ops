"use client";

import React from 'react';
import { AlertTriangle, Clock3, Database, Settings2, ShieldCheck, Sparkles } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { cn } from '@/lib/utils';

interface IntegracoesPageShellProps {
  title: string;
  subtitle: string;
  integrationName: string;
}

function MetricCard({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone?: 'default' | 'emerald' | 'amber' | 'cyan';
}) {
  const toneClass = {
    default: 'border-[#2d3647] bg-[#0a0e27]/70 text-white',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200',
    amber: 'border-amber-500/20 bg-amber-500/5 text-amber-200',
    cyan: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-200',
  }[tone];

  return (
    <div className={cn('rounded-3xl border p-5 shadow-2xl shadow-black/20', toneClass)}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
        <span className="text-primary/80">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function PlaceholderRow({ name, status, detail }: { name: string; status: string; detail: string }) {
  return (
    <tr className="border-b border-[#2d3647]/50 last:border-0">
      <td className="px-4 py-3 font-bold text-white">{name}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{status}</td>
      <td className="px-4 py-3 text-sm text-muted-foreground">{detail}</td>
      <td className="px-4 py-3">
        <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-amber-200">
          Em preparação
        </span>
      </td>
    </tr>
  );
}

export function IntegracoesPageShell({ title, subtitle, integrationName }: IntegracoesPageShellProps) {
  const rows = [
    { name: `${integrationName} - sincronização inicial`, status: 'Fila local', detail: 'Aguardando habilitação' },
    { name: `${integrationName} - mapeamento`, status: 'Regras base', detail: 'Somente leitura' },
    { name: `${integrationName} - exportação`, status: 'Prévia', detail: 'Sem endpoint ativo' },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-[#050812] text-white">
      <Sidebar className="hidden shrink-0 lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <PageHeader
            title={title}
            description={subtitle}
          >
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-2 rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white opacity-70"
            >
              <Settings2 size={14} />
              Configurar
            </button>
          </PageHeader>

          <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/5 px-5 py-4">
            <div className="flex items-start gap-3">
              <Sparkles size={18} className="mt-0.5 text-cyan-300" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-cyan-200">Integração em preparação</p>
                <p className="mt-1 text-[11px] leading-relaxed text-cyan-100/80">
                  A base visual já está pronta. A execução real entra depois, sem misturar dados entre empresas.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={<Database size={18} />} label="Status" value="Estrutura pronta" tone="cyan" />
            <MetricCard icon={<Clock3 size={18} />} label="Fila" value="Aguardando" tone="amber" />
            <MetricCard icon={<ShieldCheck size={18} />} label="Acesso" value="Tenant isolado" tone="emerald" />
            <MetricCard icon={<AlertTriangle size={18} />} label="Observações" value="Sem execução real" />
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70">
            <div className="border-b border-[#2d3647] px-5 py-4">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
                {integrationName} - tabela placeholder
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                  <tr className="border-b border-[#2d3647]">
                    <th className="px-4 py-3">Evento</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Detalhe</th>
                    <th className="px-4 py-3">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <PlaceholderRow key={row.name} {...row} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
