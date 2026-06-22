"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Bug, Loader2, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { cn } from '@/lib/utils';
import type { IntegrationLog, IntegrationLogLevel, IntegrationSystem } from '@/lib/integrations/integration-job-types';

type Filters = {
  system: string;
  level: string;
  q: string;
  event: string;
};

const SYSTEM_LABELS: Record<IntegrationSystem, string> = {
  PIMS: 'PIMS',
  TOTVS: 'TOTVS',
  EXPORTACAO: 'Exportação',
  API_EXTERNA: 'API Externa',
};

const LEVEL_LABELS: Record<IntegrationLogLevel, string> = {
  INFO: 'Informação',
  WARN: 'Alerta',
  ERROR: 'Erro',
  DEBUG: 'Debug',
};

function fmtDateTime(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function levelClass(level: IntegrationLogLevel) {
  switch (level) {
    case 'ERROR': return 'border-red-500/20 bg-red-500/10 text-red-200';
    case 'WARN': return 'border-amber-500/20 bg-amber-500/10 text-amber-200';
    case 'DEBUG': return 'border-slate-500/20 bg-slate-500/10 text-slate-200';
    default: return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200';
  }
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-4">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
        <span className="text-primary">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

export function LogsPage() {
  const [items, setItems] = useState<IntegrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ system: '', level: '', q: '', event: '' });
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.system.trim()) params.set('system', filters.system.trim());
    if (filters.level.trim()) params.set('level', filters.level.trim());
    if (filters.q.trim()) params.set('q', filters.q.trim());
    if (filters.event.trim()) params.set('event', filters.event.trim());
    return params.toString();
  }, [filters.system, filters.level, filters.q, filters.event]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/integracoes/logs?${queryString}`, { cache: 'no-store', credentials: 'include', signal });
      const data = await res.json().catch(() => ({})) as { success?: boolean; items?: IntegrationLog[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar logs.');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') setError(err instanceof Error ? err.message : 'Falha ao carregar logs.');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const metrics = useMemo(() => ({
    total: items.length,
    info: items.filter((item) => item.level === 'INFO').length,
    warn: items.filter((item) => item.level === 'WARN').length,
    error: items.filter((item) => item.level === 'ERROR').length,
  }), [items]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#050812] text-white">
      <Sidebar className="hidden shrink-0 lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <PageHeader title="Logs de Integração" description="Registro de eventos, respostas e auditoria operacional" />

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Total de logs" value={metrics.total} icon={<AlertCircle size={18} />} />
            <Metric label="Info" value={metrics.info} icon={<ShieldCheck size={18} />} />
            <Metric label="Alertas" value={metrics.warn} icon={<AlertTriangle size={18} />} />
            <Metric label="Erros" value={metrics.error} icon={<Bug size={18} />} />
          </div>

          <div className="mt-6 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-4">
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="relative lg:col-span-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))} placeholder="Buscar logs..." className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] py-3 pl-9 pr-4 text-sm text-white outline-none focus:border-primary/50" />
              </div>
              <select value={filters.system} onChange={(e) => setFilters((p) => ({ ...p, system: e.target.value }))} className="rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none">
                <option value="">Sistema</option>
                {Object.entries(SYSTEM_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <select value={filters.level} onChange={(e) => setFilters((p) => ({ ...p, level: e.target.value }))} className="rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none">
                <option value="">Nível</option>
                {Object.entries(LEVEL_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <input value={filters.event} onChange={(e) => setFilters((p) => ({ ...p, event: e.target.value }))} placeholder="Evento" className="rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none lg:col-span-2" />
              <button type="button" onClick={() => void load()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>
          </div>

          {error && <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

          <div className="mt-6 overflow-hidden rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                  <tr className="border-b border-[#2d3647]">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Sistema</th>
                    <th className="px-4 py-3">Nível</th>
                    <th className="px-4 py-3">Evento</th>
                    <th className="px-4 py-3">Mensagem</th>
                    <th className="px-4 py-3">Job</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="px-4 py-10" colSpan={6}><Loader2 className="animate-spin text-primary" size={18} /></td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">Nenhum log encontrado.</td></tr>
                  ) : items.map((item) => (
                    <tr key={item.id} className="border-t border-[#2d3647]/60">
                      <td className="px-4 py-4 text-xs text-white/80">{fmtDateTime(item.createdAt)}</td>
                      <td className="px-4 py-4 font-bold text-white">{SYSTEM_LABELS[item.system]}</td>
                      <td className="px-4 py-4">
                        <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest', levelClass(item.level))}>{LEVEL_LABELS[item.level]}</span>
                      </td>
                      <td className="px-4 py-4 text-white/80">{item.event}</td>
                      <td className="px-4 py-4 text-white/80">{item.message}</td>
                      <td className="px-4 py-4 text-white/70">{item.jobId || '—'}</td>
                    </tr>
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
