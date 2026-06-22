"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, FileText, Loader2, Plus, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { cn } from '@/lib/utils';
import { getCsrfTokenFromDocument } from '@/lib/auth/csrf-client';
import type { ExportDataType, ExportFormat, ExportTargetSystem, IntegrationExport } from '@/lib/integrations/integration-export-types';

type Filters = {
  targetSystem: string;
  dataType: string;
  format: string;
  status: string;
  q: string;
};

type FormState = {
  targetSystem: ExportTargetSystem;
  dataType: ExportDataType;
  format: ExportFormat;
  title: string;
  description: string;
  periodStart: string;
  periodEnd: string;
  fleetCode: string;
  operatorRegistration: string;
  journeyId: string;
  operationCode: string;
  costCenterCode: string;
};

const TARGET_LABELS: Record<ExportTargetSystem, string> = {
  SILO: 'SILO',
  PIMS: 'PIMS',
  TOTVS: 'TOTVS',
  POWER_BI: 'Power BI',
  API_EXTERNA: 'API Externa',
};

const TYPE_LABELS: Record<ExportDataType, string> = {
  FICHA_OPERADOR: 'Ficha Operador',
  JOURNEYS: 'Journeys',
  STOP_EVENTS: 'Stop Events',
  HOURMETERS: 'Horímetros',
  FUELINGS: 'Fuelings',
  EQUIPMENTS: 'Equipamentos',
  OPERATORS: 'Operadores',
  OPERATIONS: 'Operações',
  COST_CENTERS: 'Centros de Custo',
  IMPLEMENTS: 'Implementos',
  FULL_OPERATIONAL_PACKAGE: 'Pacote Operacional',
};

const FORMAT_LABELS: Record<ExportFormat, string> = {
  JSON: 'JSON',
  CSV: 'CSV',
  ZIP: 'ZIP',
};

const STATUS_LABELS: Record<IntegrationExport['status'], string> = {
  PENDING: 'Pendente',
  PROCESSING: 'Processando',
  SUCCESS: 'Concluída',
  FAILED: 'Falhou',
  CANCELED: 'Cancelada',
};

function fmtDateTime(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function fmtDate(value?: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(value));
}

function statusClass(status: IntegrationExport['status']) {
  switch (status) {
    case 'SUCCESS': return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';
    case 'FAILED': return 'border-red-500/20 bg-red-500/10 text-red-200';
    case 'PROCESSING': return 'border-cyan-500/20 bg-cyan-500/10 text-cyan-200';
    case 'CANCELED': return 'border-slate-500/20 bg-slate-500/10 text-slate-200';
    default: return 'border-amber-500/20 bg-amber-500/10 text-amber-200';
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

export function ExportacoesPage() {
  const [items, setItems] = useState<IntegrationExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({ targetSystem: '', dataType: '', format: '', status: '', q: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<IntegrationExport | null>(null);
  const [form, setForm] = useState<FormState>({
    targetSystem: 'SILO',
    dataType: 'FULL_OPERATIONAL_PACKAGE',
    format: 'JSON',
    title: '',
    description: '',
    periodStart: '',
    periodEnd: '',
    fleetCode: '',
    operatorRegistration: '',
    journeyId: '',
    operationCode: '',
    costCenterCode: '',
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.targetSystem.trim()) params.set('targetSystem', filters.targetSystem.trim());
    if (filters.dataType.trim()) params.set('dataType', filters.dataType.trim());
    if (filters.format.trim()) params.set('format', filters.format.trim());
    if (filters.status.trim()) params.set('status', filters.status.trim());
    if (filters.q.trim()) params.set('q', filters.q.trim());
    return params.toString();
  }, [filters.targetSystem, filters.dataType, filters.format, filters.status, filters.q]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/integracoes/exportacoes?${queryString}`, { cache: 'no-store', credentials: 'include', signal });
      const data = await res.json().catch(() => ({})) as { success?: boolean; items?: IntegrationExport[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar exportações.');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      if ((err as DOMException)?.name !== 'AbortError') setError(err instanceof Error ? err.message : 'Falha ao carregar exportações.');
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
    success: items.filter((item) => item.status === 'SUCCESS').length,
    pending: items.filter((item) => item.status === 'PENDING' || item.status === 'PROCESSING').length,
    failed: items.filter((item) => item.status === 'FAILED').length,
    records: items.reduce((sum, item) => sum + (item.recordCount || 0), 0),
  }), [items]);

  const submit = async () => {
    if (!form.title.trim()) {
      setError('Título obrigatório.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const csrf = getCsrfTokenFromDocument();
      const res = await fetch('/api/integracoes/exportacoes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
        body: JSON.stringify({
          ...form,
          description: form.description.trim() || undefined,
          periodStart: form.periodStart || undefined,
          periodEnd: form.periodEnd || undefined,
          filters: {
            fleetCode: form.fleetCode.trim() || undefined,
            operatorRegistration: form.operatorRegistration.trim() || undefined,
            journeyId: form.journeyId.trim() || undefined,
            operationCode: form.operationCode.trim() || undefined,
            costCenterCode: form.costCenterCode.trim() || undefined,
          },
        }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; item?: IntegrationExport };
      if (!res.ok) throw new Error(data.error || 'Falha ao criar exportação.');
      setModalOpen(false);
      await load();
      if (data.item) {
        setSelected(data.item);
        setDetailOpen(true);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar exportação.');
    } finally {
      setSaving(false);
    }
  };

  const mutate = async (url: string) => {
    setSaving(true);
    try {
      const csrf = getCsrfTokenFromDocument();
      const res = await fetch(url, { method: 'POST', credentials: 'include', headers: { ...(csrf ? { 'x-csrf-token': csrf } : {}) } });
      const data = await res.json().catch(() => ({})) as { error?: string; item?: IntegrationExport };
      if (!res.ok) throw new Error(data.error || 'Operação não concluída.');
      await load();
      if (data.item) {
        setSelected(data.item);
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
          <PageHeader title="Exportações" description="Pacotes de dados operacionais gerados para sistemas externos">
            <button type="button" onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#0a0e27]">
              <Plus size={14} />
              Nova Exportação
            </button>
          </PageHeader>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Metric label="Total de exportações" value={metrics.total} icon={<FileText size={18} />} />
            <Metric label="Concluídas" value={metrics.success} icon={<ShieldCheck size={18} />} />
            <Metric label="Pendentes" value={metrics.pending} icon={<RefreshCw size={18} />} />
            <Metric label="Com falha" value={metrics.failed} icon={<AlertTriangle size={18} />} />
            <Metric label="Registros exportados" value={metrics.records} icon={<FileText size={18} />} />
          </div>

          <div className="mt-6 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-4">
            <div className="grid gap-3 lg:grid-cols-5">
              <div className="relative lg:col-span-2">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={filters.q} onChange={(e) => setFilters((p) => ({ ...p, q: e.target.value }))} placeholder="Buscar exportações..." className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] py-3 pl-9 pr-4 text-sm text-white outline-none focus:border-primary/50" />
              </div>
              <select value={filters.targetSystem} onChange={(e) => setFilters((p) => ({ ...p, targetSystem: e.target.value }))} className="rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none">
                <option value="">Destino</option>
                {Object.entries(TARGET_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <select value={filters.dataType} onChange={(e) => setFilters((p) => ({ ...p, dataType: e.target.value }))} className="rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none">
                <option value="">Tipo de dado</option>
                {Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <select value={filters.format} onChange={(e) => setFilters((p) => ({ ...p, format: e.target.value }))} className="rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none">
                <option value="">Formato</option>
                {Object.entries(FORMAT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className="rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none">
                <option value="">Status</option>
                {Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
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
                    <th className="px-4 py-3">Destino</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3">Formato</th>
                    <th className="px-4 py-3">Período</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Registros</th>
                    <th className="px-4 py-3">Arquivo</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="px-4 py-10" colSpan={9}><Loader2 className="animate-spin text-primary" size={18} /></td></tr>
                  ) : items.length === 0 ? (
                    <tr><td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">Nenhuma exportação encontrada.</td></tr>
                  ) : items.map((item) => (
                    <tr key={item.id} className="border-t border-[#2d3647]/60">
                      <td className="px-4 py-4 text-xs text-white/80">{fmtDateTime(item.createdAt)}</td>
                      <td className="px-4 py-4 font-bold text-white">{TARGET_LABELS[item.targetSystem]}</td>
                      <td className="px-4 py-4 text-white/80">{TYPE_LABELS[item.dataType]}</td>
                      <td className="px-4 py-4 text-white/80">{FORMAT_LABELS[item.format]}</td>
                      <td className="px-4 py-4 text-white/80">{fmtDate(item.periodStart)} - {fmtDate(item.periodEnd)}</td>
                      <td className="px-4 py-4">
                        <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest', statusClass(item.status))}>{STATUS_LABELS[item.status]}</span>
                      </td>
                      <td className="px-4 py-4 text-white/80">{item.recordCount ?? 0}</td>
                      <td className="px-4 py-4 text-xs text-white/70">{item.fileName || '—'}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => { setSelected(item); setDetailOpen(true); }} className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white">
                            Ver detalhes
                          </button>
                          <button type="button" disabled={saving || item.status !== 'SUCCESS' || !item.fileName} onClick={() => window.location.assign(`/api/integracoes/exportacoes/${item.id}/download`)} className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-200 disabled:opacity-40">
                            Download
                          </button>
                          <button type="button" disabled={saving || !['PENDING', 'PROCESSING'].includes(item.status)} onClick={() => void mutate(`/api/integracoes/exportacoes/${item.id}/cancel`)} className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-200 disabled:opacity-40">
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
          <div className="relative w-full max-w-4xl rounded-3xl border border-[#2d3647] bg-[#0a0e27] p-6 shadow-2xl shadow-black/40">
            {modalOpen ? (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-[#2d3647] pb-4">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter text-white">Nova Exportação</h2>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Pacote operacional por tenant</p>
                  </div>
                  <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-3 py-2 text-xs font-black uppercase text-white">Fechar</button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Destino</span><select value={form.targetSystem} onChange={(e) => setForm((p) => ({ ...p, targetSystem: e.target.value as ExportTargetSystem }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none">{Object.entries(TARGET_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Tipo de dado</span><select value={form.dataType} onChange={(e) => setForm((p) => ({ ...p, dataType: e.target.value as ExportDataType }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none">{Object.entries(TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Formato</span><select value={form.format} onChange={(e) => setForm((p) => ({ ...p, format: e.target.value as ExportFormat }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none">{Object.entries(FORMAT_LABELS).map(([key, label]) => <option key={key} value={key} disabled={key === 'ZIP'}>{label}{key === 'ZIP' ? ' - será liberado em etapa futura' : ''}</option>)}</select></label>
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Título</span><input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none" /></label>
                  <label className="space-y-2 md:col-span-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Descrição</span><textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={3} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none" /></label>
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Data inicial</span><input type="date" value={form.periodStart} onChange={(e) => setForm((p) => ({ ...p, periodStart: e.target.value }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none" /></label>
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Data final</span><input type="date" value={form.periodEnd} onChange={(e) => setForm((p) => ({ ...p, periodEnd: e.target.value }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none" /></label>
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Frota</span><input value={form.fleetCode} onChange={(e) => setForm((p) => ({ ...p, fleetCode: e.target.value }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none" /></label>
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Operador</span><input value={form.operatorRegistration} onChange={(e) => setForm((p) => ({ ...p, operatorRegistration: e.target.value }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none" /></label>
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Jornada</span><input value={form.journeyId} onChange={(e) => setForm((p) => ({ ...p, journeyId: e.target.value }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none" /></label>
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Operação</span><input value={form.operationCode} onChange={(e) => setForm((p) => ({ ...p, operationCode: e.target.value }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none" /></label>
                  <label className="space-y-2"><span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Centro de custo</span><input value={form.costCenterCode} onChange={(e) => setForm((p) => ({ ...p, costCenterCode: e.target.value }))} className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none" /></label>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-4 py-2 text-xs font-black uppercase tracking-widest text-white">Cancelar</button>
                  <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-[#0a0e27] disabled:opacity-60">{saving ? 'Gerando...' : 'Gerar exportação'}</button>
                </div>
              </>
            ) : selected ? (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-[#2d3647] pb-4">
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tighter text-white">Detalhes da Exportação</h2>
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{selected.id}</p>
                  </div>
                  <button type="button" onClick={() => setDetailOpen(false)} className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-3 py-2 text-xs font-black uppercase text-white">Fechar</button>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 text-sm">
                  <div><span className="text-muted-foreground">Destino</span><div className="font-semibold">{TARGET_LABELS[selected.targetSystem]}</div></div>
                  <div><span className="text-muted-foreground">Tipo</span><div className="font-semibold">{TYPE_LABELS[selected.dataType]}</div></div>
                  <div><span className="text-muted-foreground">Formato</span><div className="font-semibold">{FORMAT_LABELS[selected.format]}</div></div>
                  <div><span className="text-muted-foreground">Status</span><div className="font-semibold">{STATUS_LABELS[selected.status]}</div></div>
                  <div><span className="text-muted-foreground">Período</span><div className="font-semibold">{fmtDate(selected.periodStart)} - {fmtDate(selected.periodEnd)}</div></div>
                  <div><span className="text-muted-foreground">Registros</span><div className="font-semibold">{selected.recordCount ?? 0}</div></div>
                  <div><span className="text-muted-foreground">Arquivo</span><div className="font-semibold">{selected.fileName || '—'}</div></div>
                  <div><span className="text-muted-foreground">Mensagem</span><div className="font-semibold">{selected.errorMessage || '—'}</div></div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
