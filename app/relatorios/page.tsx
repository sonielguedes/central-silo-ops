"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { withAuth } from '@/components/shared/with-auth';
import { cn } from '@/lib/utils';
import type { DashboardSummary } from '@/app/api/dashboard/summary/route';
import type { FuelingRecord } from '@/lib/fueling-storage';
import {
  ArrowUpRight,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  Database,
  BookText,
  Fuel,
  Layers3,
  MapPinned,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  SplitSquareHorizontal,
  Gauge,
  Route,
  Clock3,
  AlertTriangle,
  Radar,
  Activity,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ReportStatus = 'Disponível' | 'Em preparação' | 'Requer dados';

type ReportCard = {
  title: string;
  description: string;
  fields: string[];
  href: string;
  status: ReportStatus;
  icon: LucideIcon;
  accent: string;
  badge: string;
  actionLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

type FilterChip = {
  label: string;
  value: string;
  icon: LucideIcon;
};

const REPORT_CARDS: ReportCard[] = [
  {
    title: 'Operacional por Frota',
    description: 'Leitura executiva da frota com status, risco e produtividade operacional.',
    fields: ['frota', 'equipamento', 'operador atual', 'jornada', 'última sincronização'],
    href: '/operacoes',
    status: 'Disponível',
    icon: Gauge,
    accent: 'from-sky-500/20',
    badge: 'Operação',
    actionLabel: 'Abrir relatório',
  },
  {
    title: 'Jornadas',
    description: 'Visão consolidada de inícios, fins, duração e inconsistências de jornada.',
    fields: ['operador', 'frota', 'início/fim', 'horímetro/km', 'status'],
    href: '/combustivel/jornadas',
    status: 'Disponível',
    icon: Route,
    accent: 'from-emerald-500/20',
    badge: 'Jornadas',
    actionLabel: 'Abrir relatório',
  },
  {
    title: 'Paradas',
    description: 'Motivos, duração e impacto operacional das paradas do dia.',
    fields: ['motivo', 'frota', 'operador', 'duração', 'justificativa'],
    href: '/paradas',
    status: 'Disponível',
    icon: AlertTriangle,
    accent: 'from-amber-500/20',
    badge: 'Paradas',
    actionLabel: 'Abrir relatório',
  },
  {
    title: 'Combustível',
    description: 'Abastecimentos com litros, comboio/bomba, produto e origem do evento.',
    fields: ['frota abastecida', 'comboio/bomba', 'produto', 'litros', 'origem APK'],
    href: '/combustivel',
    secondaryHref: '/combustivel/relatorios',
    secondaryLabel: 'Auditoria de combustível',
    status: 'Disponível',
    icon: Fuel,
    accent: 'from-orange-500/20',
    badge: 'Combustível',
    actionLabel: 'Ver módulo',
  },
  {
    title: 'Auditoria',
    description: 'Inconsistências, jornadas abertas, duplicidades e pendências operacionais.',
    fields: ['eventos inconsistentes', 'jornadas sem fechamento', 'offlineId', 'pendências', 'divergências'],
    href: '/relatorios/auditoria',
    status: 'Disponível',
    icon: ShieldAlert,
    accent: 'from-red-500/20',
    badge: 'Auditoria',
    actionLabel: 'Abrir relatório',
  },
  {
    title: 'Sincronização / Offline',
    description: 'Saúde da sincronização, erros, pendências e última comunicação.',
    fields: ['pendentes', 'enviados', 'erros', 'último sync', 'origem APK/Web'],
    href: '/sincronizacao',
    status: 'Disponível',
    icon: RefreshCw,
    accent: 'from-violet-500/20',
    badge: 'Sincronização',
    actionLabel: 'Abrir relatório',
  },
];

const FILTERS: FilterChip[] = [
  { label: 'Período', value: 'Últimos 7 dias', icon: CalendarRange },
  { label: 'Frente', value: 'Todas', icon: SplitSquareHorizontal },
  { label: 'Frota', value: 'Todas as frotas', icon: Layers3 },
  { label: 'Operador', value: 'Todos', icon: BookText },
  { label: 'Status', value: 'Todos', icon: SlidersHorizontal },
];

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatRelativeTime(value?: string | null): string {
  if (!value) return 'Aguardando dados';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Aguardando dados';
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function isFuelingInconsistent(record: FuelingRecord): boolean {
  const liters = Number(record.dieselLiters);
  const hasHourmeter = record.hourmeter != null && Number.isFinite(record.hourmeter) && record.hourmeter >= 0;
  const hasOdometer = record.odometer != null && Number.isFinite(record.odometer) && record.odometer >= 0;

  return !Number.isFinite(liters) || liters <= 0 || (!hasHourmeter && !hasOdometer);
}

function statusClass(status: ReportStatus): string {
  if (status === 'Disponível') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  if (status === 'Em preparação') return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  return 'border-slate-500/20 bg-slate-500/10 text-slate-300';
}

function StatusBadge({ status }: { status: ReportStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]', statusClass(status))}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}

function FilterPill({ filter }: { filter: FilterChip }) {
  const Icon = filter.icon;
  return (
    <button className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-left transition-all hover:border-sky-400/30 hover:bg-white/[0.05]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/8 bg-[#0d1426] text-sky-300">
        <Icon size={15} />
      </span>
      <div className="min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.22em] text-slate-500">{filter.label}</p>
        <p className="truncate text-sm font-bold text-white">{filter.value}</p>
      </div>
    </button>
  );
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  icon: LucideIcon;
}) {
  return (
    <div className="rounded-[28px] border border-white/8 bg-[#0a1020]/90 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-white">{value}</p>
          <p className="mt-2 text-[11px] text-slate-400">{sub}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-sky-300">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function ReportCardView({ card }: { card: ReportCard }) {
  const Icon = card.icon;

  return (
    <div className="group relative overflow-hidden rounded-[30px] border border-white/8 bg-[#08101f]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] transition-all hover:-translate-y-0.5 hover:border-white/14">
      <div className={cn('pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b opacity-90', card.accent, 'to-transparent')} />
      <div className="relative flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-white">
              <Icon size={20} className="text-sky-300" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[9px] font-black uppercase tracking-[0.24em] text-slate-500">{card.badge}</p>
                <StatusBadge status={card.status} />
              </div>
              <h3 className="mt-2 text-lg font-black tracking-tight text-white">{card.title}</h3>
            </div>
          </div>
          <ArrowUpRight className="shrink-0 text-slate-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" size={18} />
        </div>

        <p className="max-w-xl text-sm leading-6 text-slate-300">{card.description}</p>

        <div className="flex flex-wrap gap-2">
          {card.fields.map((field) => (
            <span key={field} className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-slate-300">
              {field}
            </span>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-2">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            <CheckCircle2 size={12} className="text-emerald-300" />
            {card.actionLabel}
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-400">
              {card.secondaryHref ? 'Inclui acesso ao relatório de auditoria de combustível' : 'Acesso direto ao módulo'}
            </span>
            <Link href={card.href} className="inline-flex items-center gap-1 text-sm font-bold text-white">
              Abrir
              <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
          {card.secondaryHref && (
            <Link
              href={card.secondaryHref}
              className="inline-flex items-center gap-2 self-start rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-300 transition-all hover:border-sky-400/30 hover:text-white"
            >
              {card.secondaryLabel}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ReportsPage() {
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [fuelings, setFuelings] = useState<FuelingRecord[]>([]);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [summaryRes, fuelingRes] = await Promise.allSettled([
          fetch('/api/dashboard/summary', { cache: 'no-store', credentials: 'include' }),
          fetch('/api/abastecimentos', { cache: 'no-store', credentials: 'include' }),
        ]);

        if (!mounted) return;

        if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
          const summary = (await summaryRes.value.json()) as DashboardSummary;
          setDashboardSummary(summary);
        }

        if (fuelingRes.status === 'fulfilled' && fuelingRes.value.ok) {
          const payload = (await fuelingRes.value.json()) as { records?: FuelingRecord[] };
          setFuelings(payload.records ?? []);
        }
      } finally {
        if (mounted) {
          setLoadedAt(new Date().toISOString());
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const syncedEvents = dashboardSummary?.syncSummary.totalEventsToday ?? 0;
    const fuelingCount = fuelings.length;
    const inconsistencies = fuelings.filter(isFuelingInconsistent).length;
    const lastUpdate = dashboardSummary?.syncSummary.lastEventAt ?? dashboardSummary?.generatedAt ?? loadedAt;
    const availableReports = REPORT_CARDS.filter((card) => card.status === 'Disponível').length;

    return {
      availableReports,
      syncedEvents,
      fuelingCount,
      inconsistencies,
      lastUpdate,
    };
  }, [dashboardSummary, fuelings, loadedAt]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#050812] text-white">
      <Sidebar className="hidden shrink-0 lg:flex" />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6 lg:px-6">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
            <section className="rounded-[32px] border border-white/8 bg-[#07101f]/90 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.28)] backdrop-blur-xl lg:p-8">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                    <Sparkles size={10} className="text-emerald-300" />
                    Painel comercial
                  </div>
                  <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">Relatórios</h1>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                    Visão consolidada da operação, combustível, jornadas, paradas e auditoria para apresentação executiva e piloto pago.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    href="/combustivel/relatorios"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-300 transition-all hover:border-sky-400/30 hover:text-white"
                  >
                    <Fuel size={14} />
                    Auditoria de combustível
                  </Link>
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-[#0d1426] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-300 transition-all hover:border-white/14 hover:text-white"
                    aria-disabled
                  >
                    <Database size={14} />
                    Exportação futura
                  </button>
                </div>
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <KpiCard
                label="Relatórios disponíveis"
                value={formatNumber(metrics.availableReports)}
                sub="Páginas principais prontas para apresentação"
                icon={Layers3}
              />
              <KpiCard
                label="Eventos sincronizados"
                value={formatNumber(metrics.syncedEvents)}
                sub="Base operacional do tenant carregada hoje"
                icon={Activity}
              />
              <KpiCard
                label="Abastecimentos registrados"
                value={formatNumber(metrics.fuelingCount)}
                sub="Eventos FUEL_SUPPLY persistidos na Central"
                icon={Fuel}
              />
              <KpiCard
                label="Inconsistências operacionais"
                value={formatNumber(metrics.inconsistencies)}
                sub="Eventos com dados incompletos ou divergentes"
                icon={ShieldAlert}
              />
              <KpiCard
                label="Última atualização"
                value={loading ? '...' : formatRelativeTime(metrics.lastUpdate)}
                sub="Fonte consolidada do painel"
                icon={Clock3}
              />
            </section>

            <section className="rounded-[28px] border border-white/8 bg-[#07101f]/90 p-5 shadow-[0_24px_100px_rgba(0,0,0,0.24)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Filtros visuais</p>
                  <h2 className="mt-1 text-lg font-black tracking-tight text-white">Preparado para segmentar por contexto operacional</h2>
                </div>
                <div className="text-[11px] text-slate-400">UI pronta para filtros reais em próxima etapa</div>
              </div>
              <div className="mt-5 grid gap-3 xl:grid-cols-5">
                {FILTERS.map((filter) => (
                  <FilterPill key={filter.label} filter={filter} />
                ))}
              </div>
            </section>

            <section className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Relatórios principais</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-white">Catálogo executivo</h2>
              </div>
              <Link
                href="/mapa-operacional"
                className="hidden items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-slate-300 transition-all hover:border-sky-400/30 hover:text-white md:inline-flex"
              >
                <MapPinned size={14} />
                Mapa operacional
              </Link>
            </section>

            <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {REPORT_CARDS.map((card) => (
                <ReportCardView key={card.title} card={card} />
              ))}
            </section>

            <section className="grid gap-4 lg:grid-cols-3">
              <Link href="/operacoes" className="rounded-[28px] border border-white/8 bg-[#08101f]/90 p-5 transition-all hover:-translate-y-0.5 hover:border-white/14">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-sky-300">
                    <Radar size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">Operações</p>
                    <p className="text-xs text-slate-400">Jornadas, estados e rastreio</p>
                  </div>
                </div>
              </Link>
              <Link href="/sincronizacao" className="rounded-[28px] border border-white/8 bg-[#08101f]/90 p-5 transition-all hover:-translate-y-0.5 hover:border-white/14">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-violet-300">
                    <RefreshCw size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">Sincronização</p>
                    <p className="text-xs text-slate-400">Offline, erro e pendências</p>
                  </div>
                </div>
              </Link>
              <Link href="/combustivel" className="rounded-[28px] border border-white/8 bg-[#08101f]/90 p-5 transition-all hover:-translate-y-0.5 hover:border-white/14">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.04] text-orange-300">
                    <Fuel size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">Combustível</p>
                    <p className="text-xs text-slate-400">Acesso ao painel operacional</p>
                  </div>
                </div>
              </Link>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

export default withAuth(ReportsPage, { module: 'RELATORIOS' });
