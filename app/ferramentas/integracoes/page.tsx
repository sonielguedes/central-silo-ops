"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Loader2,
  RefreshCw,
  Search,
  X,
  FileJson2,
  Ban,
  TimerReset,
} from 'lucide-react';

type JobStatus = 'PENDING' | 'PROCESSING' | 'EXPORTED' | 'ACKNOWLEDGED' | 'FAILED' | 'CANCELLED' | 'REPROCESS_REQUIRED';

type IntegrationJob = {
  id: string;
  tenantId: string;
  sourceModule: string;
  sourceType: string;
  sourceId: string;
  targetSystem: string;
  targetAdapter: string;
  operationType: string;
  payload: Record<string, unknown>;
  payloadHash: string;
  status: JobStatus;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt: string | null;
  exportedAt: string | null;
  acknowledgedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  fileName?: string | null;
  externalId?: string | null;
  protocol?: string | null;
};

type JobsResponse = { items: IntegrationJob[]; total: number };

const STATUS_LABEL: Record<JobStatus, string> = {
  PENDING: 'Pendente',
  PROCESSING: 'Processando',
  EXPORTED: 'Exportado',
  ACKNOWLEDGED: 'Confirmado',
  FAILED: 'Falhou',
  CANCELLED: 'Cancelado',
  REPROCESS_REQUIRED: 'Reprocessar',
};

const STATUS_CLASS: Record<JobStatus, string> = {
  PENDING: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  PROCESSING: 'text-cyan-300 bg-cyan-500/10 border-cyan-500/20',
  EXPORTED: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  ACKNOWLEDGED: 'text-blue-300 bg-blue-500/10 border-blue-500/20',
  FAILED: 'text-red-300 bg-red-500/10 border-red-500/20',
  CANCELLED: 'text-slate-300 bg-slate-500/10 border-slate-500/20',
  REPROCESS_REQUIRED: 'text-violet-300 bg-violet-500/10 border-violet-500/20',
};

function fmtDT(value: string | null | undefined): string {
  if (!value) return '—';
  const dt = new Date(value);
  return Number.isNaN(dt.getTime())
    ? '—'
    : dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#0a0e27]/60 p-4">
      <p className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status: JobStatus }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-black uppercase', STATUS_CLASS[status])}>
      {status === 'EXPORTED' ? <CheckCircle2 size={10} /> : status === 'FAILED' ? <AlertCircle size={10} /> : <FileJson2 size={10} />}
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function IntegracoesPage() {
  const [jobs, setJobs] = useState<IntegrationJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [targetSystem, setTargetSystem] = useState('');
  const [fleet, setFleet] = useState('');
  const [selected, setSelected] = useState<IntegrationJob | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set('status', status);
      if (targetSystem) sp.set('targetSystem', targetSystem);
      const res = await fetch('/api/integrations/export-jobs?' + sp.toString(), { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as JobsResponse;
      setJobs(Array.isArray(data.items) ? data.items : []);
    } finally {
      setLoading(false);
    }
  }, [status, targetSystem]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      if (fleet && !String(job.sourceId).toLowerCase().includes(fleet.toLowerCase())) return false;
      if (!query) return true;
      const hay = [
        job.id,
        job.sourceId,
        job.sourceModule,
        job.targetSystem,
        job.targetAdapter,
        job.status,
        job.errorMessage ?? '',
      ].join(' ').toLowerCase();
      return hay.includes(query.toLowerCase());
    });
  }, [jobs, query, fleet]);

  const metrics = useMemo(() => {
    const count = (s: JobStatus) => jobs.filter((j) => j.status === s).length;
    return {
      total: jobs.length,
      exported: count('EXPORTED'),
      pending: count('PENDING') + count('PROCESSING') + count('REPROCESS_REQUIRED'),
      failed: count('FAILED'),
    };
  }, [jobs]);

  const runAction = async (job: IntegrationJob, action: 'retry' | 'cancel' | 'download') => {
    setActionLoading(`${job.id}:${action}`);
    try {
      if (action === 'download') {
        window.location.href = `/api/integrations/export-jobs/${job.id}/download`;
        return;
      }
      const res = await fetch(`/api/integrations/export-jobs/${job.id}/${action}`, { method: 'POST' });
      if (!res.ok) return;
      await load();
      if (selected?.id === job.id) {
        const fresh = jobs.find((item) => item.id === job.id);
        setSelected(fresh ?? null);
      }
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#050812] text-white">
      <Sidebar className="hidden shrink-0 lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <PageHeader
            title="Integrações"
            description="Base de jobs local para PIMS/TOTVS. Sem gambiarra, sem endpoint real."
          >
            <button onClick={() => void load()} className="flex items-center gap-2 rounded-xl border border-[#2d3647] px-4 py-2 text-[10px] font-black uppercase text-white hover:bg-[#1a1f3a]">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
            </button>
          </PageHeader>

          <div className="grid gap-4 md:grid-cols-4">
            <Metric label="Jobs" value={metrics.total} />
            <Metric label="Exportados" value={metrics.exported} />
            <Metric label="Pendentes" value={metrics.pending} />
            <Metric label="Falhas" value={metrics.failed} />
          </div>

          <div className="mt-6 grid gap-3 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/60 p-4 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por job, frota, adapter, status..." className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] py-2 pl-10 pr-3 text-sm outline-none focus:border-primary/50" />
            </div>
            <input value={fleet} onChange={(e) => setFleet(e.target.value)} placeholder="Filtrar por frota" className="rounded-2xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm outline-none focus:border-primary/50" />
            <div className="grid grid-cols-2 gap-3">
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-2xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm outline-none focus:border-primary/50">
                <option value="">Todos status</option>
                {Object.keys(STATUS_LABEL).map((s) => <option key={s} value={s}>{STATUS_LABEL[s as JobStatus]}</option>)}
              </select>
              <select value={targetSystem} onChange={(e) => setTargetSystem(e.target.value)} className="rounded-2xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm outline-none focus:border-primary/50">
                <option value="">Todos destinos</option>
                <option value="PIMS">PIMS</option>
                <option value="TOTVS">TOTVS</option>
              </select>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-[#2d3647] bg-[#0a0e27]/60">
            <div className="border-b border-[#2d3647] px-4 py-3 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              Jobs sincronizados
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  <tr className="border-b border-[#2d3647]">
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Fonte</th>
                    <th className="px-4 py-3">Destino</th>
                    <th className="px-4 py-3">Payload</th>
                    <th className="px-4 py-3">Tentativas</th>
                    <th className="px-4 py-3">Criado</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td className="px-4 py-8" colSpan={7}><Loader2 className="animate-spin text-primary" size={18} /></td></tr>
                  )}
                  {!loading && filtered.map((job) => (
                    <tr key={job.id} className="border-b border-[#2d3647]/50 last:border-0">
                      <td className="px-4 py-3"><StatusPill status={job.status} /></td>
                      <td className="px-4 py-3">
                        <div className="font-black text-white">{job.sourceModule}</div>
                        <div className="text-[10px] text-muted-foreground">{job.sourceId}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-black text-white">{job.targetSystem}</div>
                        <div className="text-[10px] text-muted-foreground">{job.targetAdapter}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{job.payloadHash.slice(0, 12)}...</td>
                      <td className="px-4 py-3 text-[10px] text-muted-foreground">{job.attemptCount}/{job.maxAttempts}</td>
                      <td className="px-4 py-3 text-[10px] text-muted-foreground">{fmtDT(job.createdAt)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => setSelected(job)} className="rounded-lg border border-[#2d3647] px-3 py-1.5 text-[9px] font-black uppercase hover:bg-[#1a1f3a]">Detalhes</button>
                          <button onClick={() => void runAction(job, 'retry')} disabled={!['FAILED', 'REPROCESS_REQUIRED'].includes(job.status) || actionLoading === `${job.id}:retry`} className="rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[9px] font-black uppercase text-violet-300 disabled:opacity-40">
                            {actionLoading === `${job.id}:retry` ? <Loader2 size={12} className="animate-spin" /> : <TimerReset size={12} />} Reprocessar
                          </button>
                          <button onClick={() => void runAction(job, 'cancel')} disabled={job.status === 'EXPORTED' || job.status === 'CANCELLED' || actionLoading === `${job.id}:cancel`} className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-[9px] font-black uppercase text-red-300 disabled:opacity-40">
                            <Ban size={12} /> Cancelar
                          </button>
                          <button onClick={() => void runAction(job, 'download')} disabled={!job.fileName} className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-[9px] font-black uppercase text-emerald-300 disabled:opacity-40">
                            <Download size={12} /> Baixar
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

      {selected && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative flex h-full w-full max-w-xl flex-col border-l border-[#2d3647] bg-[#050812] p-6">
            <div className="flex items-center justify-between border-b border-[#2d3647] pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Detalhe do Job</p>
                <h2 className="mt-1 text-xl font-black text-white">{selected.id}</h2>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-xl border border-[#2d3647] p-2 text-muted-foreground hover:bg-[#1a1f3a]"><X size={16} /></button>
            </div>
            <div className="mt-6 space-y-4 overflow-y-auto">
              <div className="rounded-2xl border border-[#2d3647] bg-[#0a0e27]/60 p-4">
                <div className="flex items-center justify-between"><span className="text-[9px] font-black uppercase text-muted-foreground">Status</span><StatusPill status={selected.status} /></div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <Info label="Fonte" value={selected.sourceModule} />
                  <Info label="Destino" value={selected.targetSystem} />
                  <Info label="Adapter" value={selected.targetAdapter} />
                  <Info label="Operação" value={selected.operationType} />
                  <Info label="Criado" value={fmtDT(selected.createdAt)} />
                  <Info label="Atualizado" value={fmtDT(selected.updatedAt)} />
                </div>
              </div>
              <div className="rounded-2xl border border-[#2d3647] bg-[#0a0e27]/60 p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-muted-foreground">Payload</p>
                <pre className="mt-3 max-h-80 overflow-auto rounded-2xl bg-[#050812] p-4 text-[11px] text-slate-300">{JSON.stringify(selected.payload, null, 2)}</pre>
              </div>
              {selected.errorMessage && (
                <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-300">
                  {selected.errorMessage}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <button onClick={() => void runAction(selected, 'retry')} className="rounded-xl bg-violet-700 px-4 py-2 text-[10px] font-black uppercase text-white">Reprocessar</button>
                <button onClick={() => void runAction(selected, 'cancel')} className="rounded-xl border border-red-500/30 px-4 py-2 text-[10px] font-black uppercase text-red-300">Cancelar</button>
                <button onClick={() => void runAction(selected, 'download')} className="rounded-xl border border-emerald-500/30 px-4 py-2 text-[10px] font-black uppercase text-emerald-300">Baixar arquivo gerado</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#2d3647] bg-[#050812] p-3">
      <p className="text-[8px] font-black uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}
