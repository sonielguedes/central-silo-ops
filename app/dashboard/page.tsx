"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { OperationalMap } from '@/components/dashboard/operational-map';
import { SyncPanel } from '@/components/dashboard/sync-panel';
import {
  Truck,
  Play,
  AlertCircle,
  PauseCircle,
  Factory,
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  Loader2,
  Activity,
  ArrowUpRight,
  Sparkles,
  Map as MapIcon,
} from 'lucide-react';
import { withAuth } from '@/components/shared/with-auth';
import type { DashboardSummary, ActiveFleetItem, RecentAlert } from '@/app/api/dashboard/summary/route';

const REFRESH_INTERVAL_MS = 30_000;

function fmtH(h: number): string {
  const hrs = Math.floor(h);
  const min = Math.round((h - hrs) * 60);
  return min > 0 ? `${hrs}h ${min}min` : `${hrs}h`;
}

function relTime(ts: string | null | undefined): string {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60_000) return 'agora';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  return `${Math.floor(diff / 3_600_000)}h`;
}

function severityColor(s: string): string {
  if (s === 'CRITICAL') return 'text-red-300 border-red-500/25 bg-red-500/8';
  if (s === 'WARNING') return 'text-amber-300 border-amber-500/25 bg-amber-500/8';
  return 'text-sky-300 border-sky-500/25 bg-sky-500/8';
}

function statusColor(s: string): string {
  if (s === 'TRABALHANDO') return 'bg-emerald-400';
  if (s === 'DESLOCANDO') return 'bg-amber-400';
  if (s === 'PARADA') return 'bg-orange-400';
  if (s === 'ALERTA') return 'bg-rose-400';
  if (s === 'OFFLINE') return 'bg-slate-500';
  return 'bg-slate-600';
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    TRABALHANDO: 'Trabalhando',
    DESLOCANDO: 'Deslocando',
    PARADA: 'Parada',
    ALERTA: 'Alerta',
    OFFLINE: 'Offline',
  };
  return map[s] ?? s;
}

type KpiColor = 'emerald' | 'red' | 'amber' | 'blue' | 'slate';

function KPIChip({
  title,
  value,
  suffix,
  color,
  icon: Icon,
  sub,
}: {
  title: string;
  value: string;
  suffix?: string;
  color: KpiColor;
  icon: React.ElementType;
  sub?: string;
}) {
  const colorMap: Record<KpiColor, { ring: string; text: string; bg: string; accent: string }> = {
    emerald: { ring: 'ring-emerald-500/15', text: 'text-emerald-300', bg: 'bg-emerald-500/10', accent: 'from-emerald-500/15' },
    red: { ring: 'ring-red-500/15', text: 'text-red-300', bg: 'bg-red-500/10', accent: 'from-red-500/15' },
    amber: { ring: 'ring-amber-500/15', text: 'text-amber-300', bg: 'bg-amber-500/10', accent: 'from-amber-500/15' },
    blue: { ring: 'ring-sky-500/15', text: 'text-sky-300', bg: 'bg-sky-500/10', accent: 'from-sky-500/15' },
    slate: { ring: 'ring-slate-500/15', text: 'text-slate-300', bg: 'bg-slate-500/10', accent: 'from-slate-500/15' },
  };
  const c = colorMap[color];

  return (
    <div className={`relative overflow-hidden rounded-3xl border border-white/6 bg-[#0a1020]/90 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.22)] ring-1 ${c.ring}`}>
      <div className={`absolute inset-x-0 top-0 h-24 bg-gradient-to-b ${c.accent} to-transparent opacity-70`} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400">{title}</p>
          <div className="mt-2 flex items-end gap-1.5">
            <span className={`text-3xl font-black leading-none tracking-tight ${c.text}`}>{value}</span>
            {suffix && <span className="mb-0.5 text-sm text-slate-400">{suffix}</span>}
          </div>
          {sub && <p className="mt-2 text-[10px] text-slate-400">{sub}</p>}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/8 ${c.bg} text-white/90`}>
          <Icon size={18} className={c.text} />
        </div>
      </div>
    </div>
  );
}

function SectionShell({
  eyebrow,
  title,
  description,
  action,
  children,
  className = '',
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-[28px] border border-white/6 bg-[#07101f]/90 shadow-[0_28px_100px_rgba(0,0,0,0.28)] backdrop-blur-xl ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-white/6 px-5 py-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{eyebrow}</p>
          <h3 className="mt-1 text-sm font-black uppercase tracking-[0.18em] text-white">{title}</h3>
          {description && <p className="mt-1 text-[11px] text-slate-400">{description}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function ProductivityBar({ series }: { series: number[] }) {
  const max = Math.max(...series, 0.01);
  const now = new Date().getHours();
  return (
    <SectionShell
      eyebrow="Eficiência"
      title="Produtividade por Hora"
      description="Visão executiva do desempenho operacional de hoje."
      className="h-full"
    >
      <div className="flex h-[220px] items-end gap-1.5">
        {series.map((v, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <div
              className="w-full rounded-t-md transition-all"
              style={{
                height: `${Math.max(6, Math.round((v / max) * 100))}%`,
                background: i === now ? 'linear-gradient(180deg, rgba(16,185,129,0.95), rgba(16,185,129,0.45))' : 'linear-gradient(180deg, rgba(16,185,129,0.35), rgba(16,185,129,0.08))',
              }}
            />
            {i % 6 === 0 && <span className="text-[8px] text-slate-500">{i}h</span>}
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function RecentAlertsPanel({ alerts }: { alerts: RecentAlert[] }) {
  return (
    <SectionShell
      eyebrow="Ocorrências"
      title="Alertas Recentes"
      description="Eventos críticos e avisos operacionais mais recentes."
      className="h-full"
    >
      {alerts.length === 0 ? (
        <p className="pt-10 text-center text-xs text-slate-400">Sem alertas recentes</p>
      ) : (
        <div className="space-y-2.5 overflow-y-auto pr-1 custom-scrollbar">
          {alerts.map(a => (
            <div key={a.id} className={`rounded-2xl border px-3 py-3 ${severityColor(a.severity)}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-bold text-white/90">{a.title}</span>
                <span className="shrink-0 text-[9px] text-slate-400">{relTime(a.timestamp)}</span>
              </div>
              <p className="mt-1 truncate text-[10px] text-slate-300/80">{a.description}</p>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function ActiveFleetPanel({ fleet }: { fleet: ActiveFleetItem[] }) {
  return (
    <SectionShell
      eyebrow="Operação"
      title={`Frota Ativa (${fleet.length})`}
      description="Unidades online com status operacional em tempo real."
      className="h-full"
    >
      {fleet.length === 0 ? (
        <div className="flex h-full items-center justify-center py-10">
          <p className="text-xs text-slate-400">Nenhuma máquina online</p>
        </div>
      ) : (
        <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar">
          {fleet.map(m => (
            <div
              key={m.equipmentId}
              className="flex items-start gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-3 transition-colors hover:border-white/12 hover:bg-white/[0.05]"
            >
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${statusColor(m.status)} shadow-[0_0_14px_rgba(255,255,255,0.12)]`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-black text-white">{m.fleetCode}</span>
                  <span className="shrink-0 rounded-full border border-white/8 bg-black/20 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-slate-300">
                    {statusLabel(m.status)}
                  </span>
                </div>
                <p className="mt-1 truncate text-[11px] text-slate-300">
                  {m.status === 'PARADO'
                    ? ((m.stopReasonName || m.stopDescription || m.stopReasonCode || m.stopCode)
                        ? [
                            m.stopReasonCode || m.stopCode,
                            m.stopReasonName || m.stopDescription || m.stopReason,
                          ].filter(Boolean).join(' — ')
                        : 'Parado')
                    : (m.operationName || m.operationCode || statusLabel(m.status))}
                </p>
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={10} />
                    {relTime(m.lastHeartbeatAt || m.lastGpsAt)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionShell>
  );
}

function FleetStatusBar({ counts }: { counts: DashboardSummary['fleetStatusCounts'] }) {
  const total = counts.total;
  if (total === 0) return null;
  const segments: { key: keyof typeof counts; color: string; label: string }[] = [
    { key: 'TRABALHANDO', color: 'bg-emerald-400', label: 'Trabalhando' },
    { key: 'DESLOCANDO', color: 'bg-amber-400', label: 'Deslocando' },
    { key: 'PARADA', color: 'bg-orange-400', label: 'Parada' },
    { key: 'ALERTA', color: 'bg-rose-400', label: 'Alerta' },
    { key: 'OFFLINE', color: 'bg-slate-500', label: 'Offline' },
  ];

  return (
    <SectionShell
      eyebrow="Saúde da frota"
      title="Status da Frota"
      description="Distribuição real do tenant por estado operacional."
      action={<span className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">{total} unidades</span>}
    >
      <div className="rounded-full bg-white/5 p-1">
        <div className="flex h-3 overflow-hidden rounded-full">
          {segments.map(seg => {
            const v = counts[seg.key];
            if (!v) return null;
            return <div key={seg.key} className={seg.color} style={{ width: `${(v / total) * 100}%` }} title={`${seg.label}: ${v}`} />;
          })}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 xl:grid-cols-5">
        {segments.map(seg => (
          <div key={seg.key} className="flex items-center justify-between gap-2 rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${seg.color} shadow-[0_0_10px_rgba(255,255,255,0.08)]`} />
              <span className="truncate text-[10px] font-medium text-slate-300">{seg.label}</span>
            </div>
            <span className="text-xs font-black text-white">{counts[seg.key]}</span>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/summary', {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DashboardSummary = await res.json();
      setData(json);
      setError(null);
      setLastFetch(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    const interval = setInterval(fetchSummary, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchSummary]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#040814] font-sans text-white selection:bg-primary/30">
      <Sidebar className="hidden shrink-0 lg:flex" />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="pointer-events-none absolute right-0 top-0 -z-10 h-[520px] w-[520px] rounded-full bg-sky-500/5 blur-[160px]" />
        <div className="pointer-events-none absolute bottom-0 left-0 -z-10 h-[320px] w-[320px] rounded-full bg-emerald-500/5 blur-[110px]" />
        <Header />

        <main className="flex-1 overflow-y-auto custom-scrollbar px-5 py-6 lg:px-6">
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-300">
                <Sparkles size={10} className="text-emerald-300" />
                Dashboard executivo
              </div>
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Painel Operacional do Tenant
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">
                  Leitura rápida de frota, produtividade, alertas e monitoramento georreferenciado em tempo real.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {lastFetch && (
                <div className="rounded-2xl border border-white/8 bg-white/[0.04] px-3 py-2 text-[10px] font-medium text-slate-300">
                  <div className="flex items-center gap-2">
                    <Clock size={10} className="text-sky-300" />
                    <span className="uppercase tracking-[0.18em] text-slate-500">Atualizado</span>
                    <span className="font-black text-white">há {relTime(lastFetch.toISOString())}</span>
                  </div>
                </div>
              )}
              <button
                onClick={fetchSummary}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/8 bg-[#0b1222] px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300 transition-all hover:border-sky-400/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>
          </div>

          {loading && !data && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="animate-spin text-primary" size={32} />
            </div>
          )}

          {error && !data && (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <AlertCircle className="mx-auto mb-2 text-red-400" size={24} />
              <p className="text-sm font-bold text-red-300">{error}</p>
              <button
                onClick={fetchSummary}
                className="mt-3 text-[11px] underline text-slate-400 hover:text-white"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <KPIChip
                  title="Máquinas Online"
                  value={data.onlineCount.toString()}
                  suffix={`de ${data.totalFleet}`}
                  color="emerald"
                  icon={data.onlineCount > 0 ? Wifi : WifiOff}
                  sub={`${data.fleetStatusCounts.OFFLINE} offline`}
                />
                <KPIChip
                  title="Operações Ativas"
                  value={data.activeOperations.toString()}
                  color="emerald"
                  icon={Play}
                  sub={`${data.fleetStatusCounts.TRABALHANDO} trabalhando`}
                />
                <KPIChip
                  title="Alertas Críticos"
                  value={data.criticalAlerts.toString()}
                  color={data.criticalAlerts > 0 ? 'red' : 'slate'}
                  icon={AlertCircle}
                  sub="Eventos com prioridade operacional"
                />
                <KPIChip
                  title="Paradas em Aberto"
                  value={data.openStops.toString()}
                  color={data.openStops > 0 ? 'amber' : 'slate'}
                  icon={PauseCircle}
                  sub="Pendências sem encerramento"
                />
                <KPIChip
                  title="Horas Operacionais"
                  value={fmtH(data.productionToday)}
                  color="blue"
                  icon={Factory}
                  sub={`${data.syncSummary.totalEventsToday} eventos hoje`}
                />
              </section>

              {data.totalFleet > 0 && <FleetStatusBar counts={data.fleetStatusCounts} />}

              <section className="grid grid-cols-12 gap-6">
                <div className="col-span-12 xl:col-span-8">
                  <SectionShell
                    eyebrow="Georreferenciamento"
                    title="Monitoramento Georreferenciado"
                    description="Mapa operacional ao vivo com leitura visual de status e cobertura do tenant."
                    action={
                      <div className="flex items-center gap-2">
                        <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300 sm:inline-flex">
                          <Activity size={11} />
                          Ao vivo
                        </span>
                        <button className="inline-flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-300 transition-all hover:border-sky-400/30 hover:text-white">
                          <MapIcon size={12} />
                          Camadas
                        </button>
                        <button className="inline-flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/[0.04] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-300 transition-all hover:border-sky-400/30 hover:text-white">
                          <ArrowUpRight size={12} />
                          Expandir
                        </button>
                      </div>
                    }
                    className="overflow-hidden"
                  >
                    <div className="h-[420px] overflow-hidden rounded-[24px] border border-white/6 bg-[#050812] xl:h-[440px]">
                      <OperationalMap totalFleet={data.totalFleet} counts={data.fleetStatusCounts} />
                    </div>
                  </SectionShell>
                </div>

                <div className="col-span-12 min-h-[420px] xl:col-span-4">
                  <ActiveFleetPanel fleet={data.activeFleet} />
                </div>
              </section>

              <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="h-[360px]">
                  <RecentAlertsPanel alerts={data.recentAlerts} />
                </div>
                <div className="h-[360px]">
                  <ProductivityBar series={data.productivitySeries} />
                </div>
                <div className="h-[360px]">
                  <SyncPanel />
                </div>
              </section>

              {data.totalFleet === 0 && (
                <div className="rounded-3xl border border-white/6 bg-white/[0.03] p-10 text-center">
                  <Truck className="mx-auto mb-3 text-slate-400" size={32} />
                  <p className="text-sm text-slate-400">Nenhum equipamento cadastrado ainda.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default withAuth(DashboardPage);
