"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, Clock3, Loader2, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { cn } from '@/lib/utils';
import { getCsrfTokenFromDocument } from '@/lib/auth/csrf-client';
import type { IntegrationJob, IntegrationJobSource, IntegrationJobStatus, IntegrationJobType, IntegrationSystem } from '@/lib/integrations/integration-job-types';

type Filters = {
  system: string;
  status: string;
  type: string;
  q: string;
};

type FormState = {
  system: IntegrationSystem;
  type: IntegrationJobType;
  title: string;
  description: string;
  maxAttempts: number;
  source: IntegrationJobSource;
};

const SYSTEM_LABELS: Record<IntegrationSystem, string> = {
  PIMS: 'PIMS',
  TOTVS: 'TOTVS',
  EXPORTACAO: 'Exportação',
  API_EXTERNA: 'API Externa',
};

const TYPE_LABELS: Record<IntegrationJobType, string> = {
  EXPORT_FICHA_OPERADOR: 'Ficha Operador',
  EXPORT_JOURNEY: 'Journey',
  EXPORT_STOP_EVENTS: 'Stop Events',
  EXPORT_FUELINGS: 'Fuelings',
  SYNC_MASTER_DATA: 'Sync Master',
  TEST_CONNECTION: 'Teste Conexão',
  SEND_PIMS_HOMOLOGATION: 'PIMS Homologação',
  SEND_TOTVS_HOMOLOGATION: 'TOTVS Homologação',
  MANUAL: 'Manual',
};

const STATUS_LABELS: Record<IntegrationJobStatus, string> = {
  PENDING: 'Pendente',
  RUNNING: 'Executando',
  SUCCESS: 'Concluído',
  FAILED: 'Falhou',
  CANCELED: 'Cancelado',
  RETRYING: 'Reprocessando',
};

const SOURCE_LABELS: Record<IntegrationJobSource, string> = {
  MANUAL: 'Manual',
  SYSTEM: 'Sistema',
  API: 'API',
};

function fmtDateTime(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function statusClass(status: IntegrationJobStatus) {
  switch (status) {
    case 'SUCCESS': return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';
    case 'FAILED': return 'border-red-500/20 bg-red-500/10 text-red-200';
    case 'RUNNING': return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200';
    case 'RETRYING': return 'border-amber-500/20 bg-amber-500/10 text-amber-200';
    case 'CANCELED': return 'border-slate-500/20 bg-slate-500/10 text-slate-200';
    default: return 'border-violet-500/20 bg-violet-500/10 text-violet-200';
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

export function JobsPage() {
  const [items, setItems] = useState<IntegrationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ system: '', status: '', type: '', q: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<IntegrationJob | null>(null);
  const [form, setForm] = useState<FormState>({
    system: 'PIMS',
    type: 'EXPORT_FICHA_OPERADOR',
    title: '',
    description: '',
    maxAttempts: 3,
    source: 'MANUAL',
  });
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.system.trim()) params.set('system', filters.system.trim());
    if (filters.status.trim()) params.set('status', filters.status.trim());
    if (filters.type.trim()) params.set('type', filters.type.trim());
    if (filters.q.trim()) params.set('q', filters.q.trim());
    return params.toString();
  }, [filters.system, filters.status, filters.type, filters.q]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/integracoes/jobs?${queryString}`, { cache: 'no-store', credentials: 'include', signal });
      const data = await res.json().catch(() => ({})) as { success?: boolean; items?: IntegrationJob[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar jobs.');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') setError(err instanceof Error ? err.message : 'Falha ao carregar jobs.');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const metrics = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((item) => item.status === 'PENDING').length,
      running: items.filter((item) => item.status === 'RUNNING' || item.status === 'RETRYING').length,
      failed: items.filter((item) => item.status === 'FAILED').length,
      success: items.filter((item) => item.status === 'SUCCESS').length,
    };
  }, [items]);

  const submit = async () => {
    if (!form.title.trim()) {
      setError('Título obrigatório.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const csrf = getCsrfTokenFromDocument();
      const res = await fetch('/api/integracoes/jobs', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        body: JSON.stringify({
          ...form,
          description: form.description.trim() || undefined,
          maxAttempts: form.maxAttempts,
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; item?: IntegrationJob };
      if (!res.ok) throw new Error(data.error || 'Falha ao criar job.');
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar job.');
    } finally {
      setSaving(false);
    }
  };

  const mutate = async (url: string) => {
    setSaving(true);
    try {
      const csrf = getCsrfTokenFromDocument();
      const res = await fetch(url, { method: 'POST', credentials: 'include', headers: { ...(csrf ? { 'x-csrf-token': csrf } : {}) } });
      const data = await res.json().catch(() => ({})) as { error?: string; item?: IntegrationJob };
      if (!res.ok) throw new Error(data.error || 'Operação não concluída.');
      await load();
      const item = data.item as IntegrationJob | undefined;
      if (item) {
        setSelected(item);
        setDetailOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operação não concluída.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#050812] text-white">
      <Sidebar className="hidden shrink-0 lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <PageHeader title="Jobs de Integração" description="Visão operacional dos jobs, filas e reprocessamentos">
            <button type="button" onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#0a0e27]">
              <Plus size={14} />
              Novo Job
            </button>
          </PageHeader>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Metric label="Total de jobs" value={metrics.total} icon={<ArrowLeftRight size={18} />} />
            <Metric label="Pendentes" value={metrics.pending} icon={<Clock3 size={18} />} />
            <Metric label="Em execução" value={metrics.running} icon={<RefreshCw size={18} />} />
            <Metric label="Com falha" value={metrics.failed} icon={<AlertTriangle size={18} />} />
            <Metric label="Concluídos" value={metrics.success} icon={<ShieldCheck size={18} />} />
          </div>

          <div className="mt-6 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-4">
            <div className="grid gap-3 lg:grid-cols-4">
              <div className="relative lg:col-span-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))} placeholder="Buscar jobs..." className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] py-3 pl-9 pr-4 text-sm text-white outline-none focus:border-primary/50" />
              </div>
              <select value={filters.system} onChange={(e) => setFilters((p) => ({ ...p, system: e.target.value }))} className="rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none">
                <option value="">Sistema</option>
                {Object.entries(SYSTEM_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className="rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none">
                <option value="">Status</option>
                {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <select value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))} className="rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none lg:col-span-2">
                <option value="">Tipo</option>
                {Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
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
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Título</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Tentativas</th>
                    <th className="px-4 py-3">Último erro</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="px-4 py-10" colSpan={8}><Loader2 className="animate-spin text-primary" size={18} /></td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">Nenhum job encontrado.</td></tr>
                  ) : items.map((item) => (
                    <tr key={item.id} className="border-t border-[#2d3647]/60">
                      <td className="px-4 py-4 text-xs text-white/80">{fmtDateTime(item.createdAt)}</td>
                      <td className="px-4 py-4 font-bold text-white">{SYSTEM_LABELS[item.system]}</td>
                      <td className="px-4 py-4 text-white/80">{TYPE_LABELS[item.type]}</td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">{item.title}</div>
                        <div className="text-[10px] text-muted-foreground">{SOURCE_LABELS[item.source]}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest', statusClass(item.status))}>{STATUS_LABELS[item.status]}</span>
                      </td>
                      <td className="px-4 py-4 text-white/80">{item.attempts}/{item.maxAttempts}</td>
                      <td className="px-4 py-4 text-xs text-white/70">{item.lastErrorMessage || '—'}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => { setSelected(item); setDetailOpen(true); }} className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white">
                            Ver detalhes
                          </button>
                          <button type="button" disabled={saving || !['FAILED', 'CANCELED'].includes(item.status)} onClick={() => void mutate(`/api/integracoes/jobs/${item.id}/retry`)} className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-amber-200 disabled:opacity-40">
                            Retry
                          </button>
                          <button type="button" disabled={saving || !['PENDING', 'RETRYING'].includes(item.status)} onClick={() => void mutate(`/api/integracoes/jobs/${item.id}/cancel`)} className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-200 disabled:opacity-40">
                            Cancelar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {(modalOpen || detailOpen) && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { setModalOpen(false); setDetailOpen(false); }} />
          <div className="relative w-full max-w-3xl rounded-3xl border border-[#2d3647] bg-[#0a0e27] p-6 shadow-2xl shadow-black/40">
            {modalOpen ? (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-[#2d3647] pb-4">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter text-white">Novo Job</h2>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Tenant resolvido pela sessão web</p>
                  </div>
                  <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-3 py-2 text-xs font-black uppercase text-white">Fechar</button>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Sistema</span><select value={form.system} onChange={(e) => setForm((p) => ({ ...p, system: e.target.value as IntegrationSystem }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none"><option value="PIMS">PIMS</option><option value="TOTVS">TOTVS</option><option value="EXPORTACAO">Exportação</option><option value="API_EXTERNA">API Externa</option></select></label>
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Tipo</span><select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as IntegrationJobType }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none">{Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                  <label className="space-y-2 md:col-span-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Título</span><input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none" placeholder="Exportação manual..." /></label>
                  <label className="space-y-2 md:col-span-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Descrição</span><textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none" /></label>
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Tentativas máximas</span><input type="number" min={1} max={10} value={form.maxAttempts} onChange={(e) => setForm((p) => ({ ...p, maxAttempts: Number(e.target.value) }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none" /></label>
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Origem</span><select value={form.source} onChange={(e) => setForm((p) => ({ ...p, source: e.target.value as IntegrationJobSource }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none"><option value="MANUAL">Manual</option><option value="SYSTEM">Sistema</option><option value="API">API</option></select></label>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-4 py-2 text-xs font-black uppercase tracking-widest text-white">Cancelar</button>
                  <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-[#0a0e27] disabled:opacity-60">{saving ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </>
            ) : selected ? (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-[#2d3647] pb-4">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter text-white">Detalhes do Job</h2>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{selected.id}</p>
                  </div>
                  <button type="button" onClick={() => setDetailOpen(false)} className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-3 py-2 text-xs font-black uppercase text-white">Fechar</button>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 text-sm">
                  <div><span className="text-muted-foreground">Sistema</span><div className="font-semibold">{SYSTEM_LABELS[selected.system]}</div></div>
                  <div><span className="text-muted-foreground">Status</span><div className="font-semibold">{STATUS_LABELS[selected.status]}</div></div>
                  <div><span className="text-muted-foreground">Tipo</span><div className="font-semibold">{TYPE_LABELS[selected.type]}</div></div>
                  <div><span className="text-muted-foreground">Fonte</span><div className="font-semibold">{SOURCE_LABELS[selected.source]}</div></div>
                  <div><span className="text-muted-foreground">Criado em</span><div className="font-semibold">{fmtDateTime(selected.createdAt)}</div></div>
                  <div><span className="text-muted-foreground">Atualizado em</span><div className="font-semibold">{fmtDateTime(selected.updatedAt)}</div></div>
                  <div className="md:col-span-2"><span className="text-muted-foreground">Título</span><div className="font-semibold">{selected.title}</div></div>
                  <div className="md:col-span-2"><span className="text-muted-foreground">Último erro</span><div className="font-semibold">{selected.lastErrorMessage || '—'}</div></div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
