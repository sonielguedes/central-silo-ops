"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { OperationalMap } from '@/components/dashboard/operational-map';
import { SyncPanel } from '@/components/dashboard/sync-panel';
import {
  Truck, Play, AlertCircle, PauseCircle, Factory,
  Wifi, WifiOff, RefreshCw, Clock, Loader2,
} from 'lucide-react';
import { withAuth } from '@/components/shared/with-auth';
import type { DashboardSummary, ActiveFleetItem, RecentAlert } from '@/app/api/dashboard/summary/route';

const REFRESH_INTERVAL_MS = 30_000;
const TENANT_ID =
  process.env.NEXT_PUBLIC_SILO_TENANT_ID ||
  process.env.NEXT_PUBLIC_TENANT_ID ||
  'silo-ops-001';

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
  if (s === 'CRITICAL') return 'text-red-400 border-red-500/30 bg-red-500/5';
  if (s === 'WARNING')  return 'text-amber-400 border-amber-500/30 bg-amber-500/5';
  return 'text-blue-400 border-blue-500/30 bg-blue-500/5';
}

function statusColor(s: string): string {
  if (s === 'OPERANDO')   return 'bg-emerald-500';
  if (s === 'ONLINE')     return 'bg-blue-400';
  if (s === 'PARADO')     return 'bg-amber-400';
  if (s === 'FINALIZADO') return 'bg-slate-400';
  return 'bg-slate-600';
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    OPERANDO: 'Operando', ONLINE: 'Online', PARADO: 'Parado',
    FINALIZADO: 'Finalizado', OFFLINE: 'Offline',
  };
  return map[s] ?? s;
}

type KpiColor = 'emerald' | 'red' | 'amber' | 'blue' | 'slate';

function KPICard({
  title, value, suffix, color, icon: Icon, sub,
}: {
  title: string; value: string; suffix?: string;
  color: KpiColor; icon: React.ElementType; sub?: string;
}) {
  const colorMap: Record<KpiColor, { border: string; text: string; bg: string }> = {
    emerald: { border: 'border-emerald-500/20', text: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    red:     { border: 'border-red-500/20',     text: 'text-red-400',     bg: 'bg-red-500/10' },
    amber:   { border: 'border-amber-500/20',   text: 'text-amber-400',   bg: 'bg-amber-500/10' },
    blue:    { border: 'border-blue-500/20',    text: 'text-blue-400',    bg: 'bg-blue-500/10' },
    slate:   { border: 'border-slate-500/20',   text: 'text-slate-400',   bg: 'bg-slate-500/10' },
  };
  const c = colorMap[color];
  return (
    <div className={`rounded-2xl border ${c.border} bg-[#0d1227] p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</span>
        <div className={`w-8 h-8 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon size={16} className={c.text} />
        </div>
      </div>
      <div className="flex items-end gap-1">
        <span className={`text-3xl font-black ${c.text} leading-none`}>{value}</span>
        {suffix && <span className="text-sm text-muted-foreground mb-0.5">{suffix}</span>}
      </div>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function ProductivityBar({ series }: { series: number[] }) {
  const max = Math.max(...series, 0.01);
  const now = new Date().getHours();
  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#0d1227] p-5 h-full flex flex-col">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
        Produtividade por Hora (Hoje)
      </h3>
      <div className="flex items-end gap-0.5 flex-1">
        {series.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-sm transition-all"
              style={{
                height: `${Math.round((v / max) * 100)}%`,
                minHeight: v > 0 ? 4 : 1,
                background: i === now ? 'rgb(16,185,129)' : 'rgba(16,185,129,0.25)',
              }}
            />
            {i % 6 === 0 && (
              <span className="text-[8px] text-muted-foreground">{i}h</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentAlertsPanel({ alerts }: { alerts: RecentAlert[] }) {
  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#0d1227] p-5 h-full flex flex-col">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
        Alertas Recentes
      </h3>
      {alerts.length === 0 ? (
        <p className="text-muted-foreground text-xs text-center mt-6">Sem alertas</p>
      ) : (
        <div className="space-y-2 overflow-y-auto flex-1 custom-scrollbar">
          {alerts.map(a => (
            <div key={a.id} className={`rounded-xl border px-3 py-2 ${severityColor(a.severity)}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold truncate">{a.title}</span>
                <span className="text-[9px] shrink-0">{relTime(a.timestamp)}</span>
              </div>
              <p className="text-[10px] opacity-70 truncate mt-0.5">{a.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActiveFleetPanel({ fleet }: { fleet: ActiveFleetItem[] }) {
  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#0d1227] p-5 flex flex-col h-full">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-4">
        Frota Ativa ({fleet.length})
      </h3>
      {fleet.length === 0 ? (
        <p className="text-muted-foreground text-xs text-center mt-6">Nenhuma máquina online</p>
      ) : (
        <div className="overflow-y-auto flex-1 custom-scrollbar space-y-1">
          {fleet.map(m => (
            <div
              key={m.equipmentId}
              className="flex items-center gap-3 rounded-xl border border-[#2d3647] px-3 py-2 hover:border-primary/30 transition-colors"
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${statusColor(m.status)}`} />
              <span className="text-xs font-bold text-white w-16 shrink-0">{m.fleetCode}</span>
              <span className="text-[10px] text-muted-foreground flex-1 truncate">
                {m.status === 'PARADO'
                  ? (m.stopDescription || m.stopCode || 'Parado')
                  : (m.operationName || m.operationCode || statusLabel(m.status))}
              </span>
              <span className="text-[9px] text-muted-foreground shrink-0">
                {relTime(m.lastHeartbeatAt || m.lastGpsAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FleetStatusBar({ counts }: { counts: DashboardSummary['fleetStatusCounts'] }) {
  const total = Object.values(counts).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  const segments: { key: keyof typeof counts; color: string; label: string }[] = [
    { key: 'OPERANDO',   color: 'bg-emerald-500', label: 'Operando' },
    { key: 'ONLINE',     color: 'bg-blue-400',    label: 'Online' },
    { key: 'PARADO',     color: 'bg-amber-400',   label: 'Parado' },
    { key: 'FINALIZADO', color: 'bg-slate-400',   label: 'Finalizado' },
    { key: 'OFFLINE',    color: 'bg-slate-600',   label: 'Offline' },
  ];
  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#0d1227] px-5 py-4">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-3">
        Status da Frota
      </h3>
      <div className="flex rounded-full overflow-hidden h-3 mb-3">
        {segments.map(seg => {
          const v = counts[seg.key];
          if (!v) return null;
          return (
            <div
              key={seg.key}
              className={seg.color}
              style={{ width: `${(v / total) * 100}%` }}
              title={`${seg.label}: ${v}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        {segments.map(seg => (
          <div key={seg.key} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${seg.color}`} />
            <span className="text-[10px] text-muted-foreground">{seg.label}</span>
            <span className="text-[10px] font-black text-white">{counts[seg.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DashboardPage() {
  const [data, setData]           = useState<DashboardSummary | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/summary', {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', 'X-Silo-Tenant': TENANT_ID },
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
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans selection:bg-primary/30">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[150px] -z-10 rounded-full" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/5 blur-[100px] -z-10 rounded-full" />
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">

          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
              Dashboard Operacional
            </h2>
            <div className="flex items-center gap-3">
              {lastFetch && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock size={10} /> Atualizado {relTime(lastFetch.toISOString())}
                </span>
              )}
              <button
                onClick={fetchSummary}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#2d3647] hover:border-primary/30 text-[10px] font-bold text-muted-foreground hover:text-white transition-all disabled:opacity-40"
              >
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
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
            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
              <AlertCircle className="text-red-400 mx-auto mb-2" size={24} />
              <p className="text-sm text-red-400 font-bold">{error}</p>
              <button
                onClick={fetchSummary}
                className="mt-3 text-[11px] underline text-muted-foreground hover:text-white"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {data && (
            <>
              <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <KPICard
                  title="Máquinas Online"
                  value={data.onlineCount.toString()}
                  suffix={`de ${data.totalFleet}`}
                  color="emerald"
                  icon={data.onlineCount > 0 ? Wifi : WifiOff}
                  sub={`${data.fleetStatusCounts.OFFLINE} offline`}
                />
                <KPICard
                  title="Operações Ativas"
                  value={data.activeOperations.toString()}
                  color="emerald"
                  icon={Play}
                  sub={`${data.fleetStatusCounts.OPERANDO} operando`}
                />
                <KPICard
                  title="Alertas Críticos"
                  value={data.criticalAlerts.toString()}
                  color={data.criticalAlerts > 0 ? 'red' : 'emerald'}
                  icon={AlertCircle}
                />
                <KPICard
                  title="Paradas em Aberto"
                  value={data.openStops.toString()}
                  color={data.openStops > 0 ? 'amber' : 'emerald'}
                  icon={PauseCircle}
                />
                <KPICard
                  title="Horas Operacionais Hoje"
                  value={fmtH(data.productionToday)}
                  color="blue"
                  icon={Factory}
                  sub={`${data.syncSummary.totalEventsToday} eventos`}
                />
              </section>

              {data.totalFleet > 0 && <FleetStatusBar counts={data.fleetStatusCounts} />}

              <section className="grid grid-cols-12 gap-6">
                <div className="col-span-12 xl:col-span-8">
                  <OperationalMap />
                </div>
                <div className="col-span-12 xl:col-span-4 min-h-[450px]">
                  <ActiveFleetPanel fleet={data.activeFleet} />
                </div>
              </section>

              <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="h-[340px]">
                  <RecentAlertsPanel alerts={data.recentAlerts} />
                </div>
                <div className="h-[340px]">
                  <ProductivityBar series={data.productivitySeries} />
                </div>
                <div className="h-[340px]">
                  <SyncPanel />
                </div>
              </section>

              {data.totalFleet === 0 && (
                <div className="rounded-2xl border border-[#2d3647] bg-[#0d1227] p-10 text-center">
                  <Truck className="text-muted-foreground mx-auto mb-3" size={32} />
                  <p className="text-sm text-muted-foreground">Nenhum equipamento cadastrado ainda.</p>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
export default withAuth(DashboardPage);
