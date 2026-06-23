"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { withAuth } from '@/components/shared/with-auth';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { PageHeader } from '@/components/shared/page-header';
import { cn } from '@/lib/utils';
import type { IntegrationJob, IntegrationLog } from '@/lib/integrations/integration-job-types';
import type { TotvsMapping, TotvsMappingStatus, TotvsMappingType, TotvsValidationResult, TotvsValidationTargetDataType } from '@/lib/integrations/totvs';
import { translateMappingTypeLabel, translateStatusLabel, translateValidationTargetLabel } from '@/lib/ui/status-labels';

type TabKey = 'mappings' | 'validate' | 'results' | 'jobs' | 'logs';

const mappingTypes: TotvsMappingType[] = ['COST_CENTER', 'WORK_ORDER', 'EQUIPMENT', 'FUEL_TRUCK', 'PRODUCT', 'FUEL_PUMP', 'OPERATOR', 'IMPLEMENT'];
const mappingStatuses: TotvsMappingStatus[] = ['ACTIVE', 'INACTIVE', 'PENDING_REVIEW'];
const validationTargets: TotvsValidationTargetDataType[] = ['FICHA_OPERADOR', 'FUEL_JOURNEY', 'FUELINGS'];

function titleCase(value: string) {
  return translateValidationTargetLabel(value)
    || translateMappingTypeLabel(value)
    || translateStatusLabel(value)
    || value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase());
}

function fmt(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString('pt-BR');
}

function Metric({ label, value, tone = 'default' }: { label: string; value: string; tone?: 'default' | 'emerald' | 'amber' | 'cyan' }) {
  const styles = {
    default: 'border-[#2d3647] bg-[#0a0e27]/70 text-white',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-200',
    amber: 'border-amber-500/20 bg-amber-500/5 text-amber-200',
    cyan: 'border-cyan-500/20 bg-cyan-500/5 text-cyan-200',
  }[tone];
  return <div className={cn('rounded-3xl border p-5 shadow-2xl shadow-black/20', styles)}><p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">{label}</p><p className="mt-3 text-2xl font-black">{value}</p></div>;
}

export function TotvsPage() {
  const [tab, setTab] = useState<TabKey>('mappings');
  const [mappings, setMappings] = useState<TotvsMapping[]>([]);
  const [results, setResults] = useState<TotvsValidationResult[]>([]);
  const [jobs, setJobs] = useState<IntegrationJob[]>([]);
  const [logs, setLogs] = useState<IntegrationLog[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState({ type: '', status: '', q: '' });
  const [editing, setEditing] = useState<TotvsMapping | null>(null);
  const [form, setForm] = useState({ type: 'COST_CENTER', siloCode: '', siloName: '', totvsCode: '', totvsName: '', description: '', status: 'ACTIVE' });
  const [validateForm, setValidateForm] = useState({ targetDataType: 'FICHA_OPERADOR', periodStart: new Date().toISOString().slice(0, 10), periodEnd: new Date().toISOString().slice(0, 10), fleetCode: '', operatorRegistration: '', journeyId: '' });

  const loadData = useCallback(async () => {
    const qs = new URLSearchParams();
    if (query.type) qs.set('type', query.type);
    if (query.status) qs.set('status', query.status);
    if (query.q) qs.set('q', query.q);
    const [mRes, rRes, jRes, lRes] = await Promise.all([
      fetch(`/api/integracoes/totvs/mappings?${qs.toString()}`, { credentials: 'include' }),
      fetch('/api/integracoes/totvs/validation-results', { credentials: 'include' }),
      fetch('/api/integracoes/jobs?system=TOTVS', { credentials: 'include' }),
      fetch('/api/integracoes/logs?system=TOTVS', { credentials: 'include' }),
    ]);
    const [mJson, rJson, jJson, lJson] = await Promise.all([mRes.json().catch(() => ({})), rRes.json().catch(() => ({})), jRes.json().catch(() => ({})), lRes.json().catch(() => ({}))]);
    setMappings(mJson.items ?? []);
    setResults(rJson.items ?? []);
    setJobs(jJson.items ?? []);
    setLogs(lJson.items ?? []);
  }, [query.type, query.status, query.q]);

  useEffect(() => { loadData().catch(() => void 0); }, [loadData]);

  const stats = useMemo(() => ({
    active: mappings.filter((item) => item.status === 'ACTIVE').length,
    warnings: results.filter((item) => item.status === 'WARNING').length,
    jobs: jobs.length,
    logs: logs.length,
  }), [mappings, results, jobs, logs]);

  async function saveMapping() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(editing ? `/api/integracoes/totvs/mappings/${editing.id}` : '/api/integracoes/totvs/mappings', {
        method: editing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao salvar mapeamento.');
      setEditing(null);
      setForm({ type: 'COST_CENTER', siloCode: '', siloName: '', totvsCode: '', totvsName: '', description: '', status: 'ACTIVE' });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar mapeamento.');
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/integracoes/totvs/mappings/${id}`, { method: 'DELETE', credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha ao inativar.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao inativar.');
    } finally {
      setBusy(false);
    }
  }

  async function runValidation() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/integracoes/totvs/validate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validateForm,
          filters: {
            fleetCode: validateForm.fleetCode || undefined,
            operatorRegistration: validateForm.operatorRegistration || undefined,
            journeyId: validateForm.journeyId || undefined,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Falha na pré-validação.');
      await loadData();
      setTab('results');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha na pré-validação.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#050812] text-white">
      <Sidebar className="hidden shrink-0 lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <PageHeader title="TOTVS" description="Mapeamentos, pré-validação com dados reais, jobs e logs por tenant" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Mapeamentos ativos" value={String(stats.active)} tone="emerald" />
            <Metric label="Validações com alerta" value={String(stats.warnings)} tone="amber" />
            <Metric label="Jobs TOTVS" value={String(stats.jobs)} tone="cyan" />
            <Metric label="Logs TOTVS" value={String(stats.logs)} />
          </div>
          <div className="mt-6 flex gap-2">
            {(['mappings', 'validate', 'results', 'jobs', 'logs'] as TabKey[]).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={cn('rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-[0.25em]', tab === k ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30' : 'bg-[#10162a] text-muted-foreground border border-[#2d3647]')}>
                {k === 'mappings' ? 'Mapeamentos' : k === 'validate' ? 'Pré-validação' : k === 'results' ? 'Resultados' : k === 'jobs' ? 'Jobs' : 'Logs'}
              </button>
            ))}
          </div>

          {error && <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

          {tab === 'mappings' && (
            <section className="mt-6 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5">
              <div className="mb-4 grid gap-3 md:grid-cols-3">
                <input value={query.q} onChange={(e) => setQuery((p) => ({ ...p, q: e.target.value }))} placeholder="Buscar por código ou nome" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <select value={query.type} onChange={(e) => setQuery((p) => ({ ...p, type: e.target.value }))} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm">
                  <option value="">Todos os tipos</option>
                  {mappingTypes.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                </select>
                <select value={query.status} onChange={(e) => setQuery((p) => ({ ...p, status: e.target.value }))} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm">
                  <option value="">Todos os status</option>
                  {mappingStatuses.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                </select>
              </div>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-white">{editing ? 'Editando mapeamento' : 'Novo mapeamento'}</p>
                  <p className="text-xs text-muted-foreground">Somente apresentação e CRUD local. Sem envio externo.</p>
                </div>
                {editing && <button onClick={() => { setEditing(null); setForm({ type: 'COST_CENTER', siloCode: '', siloName: '', totvsCode: '', totvsName: '', description: '', status: 'ACTIVE' }); }} className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">Cancelar edição</button>}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as TotvsMappingType }))} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm">
                  {mappingTypes.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                </select>
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as TotvsMappingStatus }))} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm">
                  {mappingStatuses.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                </select>
                <input value={form.siloCode} onChange={(e) => setForm((p) => ({ ...p, siloCode: e.target.value }))} placeholder="Código SILO" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <input value={form.totvsCode} onChange={(e) => setForm((p) => ({ ...p, totvsCode: e.target.value }))} placeholder="Código TOTVS" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <input value={form.siloName} onChange={(e) => setForm((p) => ({ ...p, siloName: e.target.value }))} placeholder="Nome SILO" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <input value={form.totvsName} onChange={(e) => setForm((p) => ({ ...p, totvsName: e.target.value }))} placeholder="Nome TOTVS" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Descrição" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm md:col-span-2 xl:col-span-3" />
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground"><tr><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">SILO</th><th className="px-4 py-3">TOTVS</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Ações</th></tr></thead>
                  <tbody>
                    {mappings.length === 0 ? <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>Nenhum mapeamento encontrado.</td></tr> : mappings.map((item) => <tr key={item.id} className="border-t border-[#2d3647]/50"><td className="px-4 py-3">{titleCase(item.type)}</td><td className="px-4 py-3">{item.siloCode}</td><td className="px-4 py-3">{item.totvsCode}</td><td className="px-4 py-3">{titleCase(item.status)}</td><td className="px-4 py-3"><button onClick={() => { setEditing(item); setForm({ type: item.type, siloCode: item.siloCode, siloName: item.siloName ?? '', totvsCode: item.totvsCode, totvsName: item.totvsName ?? '', description: item.description ?? '', status: item.status }); }} className="mr-3 text-cyan-200">Editar</button><button onClick={() => archive(item.id)} className="text-amber-200">Inativar</button></td></tr>)}
                  </tbody>
                </table>
              </div>
              <button disabled={busy} onClick={saveMapping} className="mt-4 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-[#04111f]">{editing ? 'Salvar alterações' : 'Criar mapeamento'}</button>
            </section>
          )}

          {tab === 'validate' && (
            <section className="mt-6 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <select value={validateForm.targetDataType} onChange={(e) => setValidateForm((p) => ({ ...p, targetDataType: e.target.value as TotvsValidationTargetDataType }))} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm">{validationTargets.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select>
                <input type="date" value={validateForm.periodStart} onChange={(e) => setValidateForm((p) => ({ ...p, periodStart: e.target.value }))} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <input type="date" value={validateForm.periodEnd} onChange={(e) => setValidateForm((p) => ({ ...p, periodEnd: e.target.value }))} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <input value={validateForm.fleetCode} onChange={(e) => setValidateForm((p) => ({ ...p, fleetCode: e.target.value }))} placeholder="Frota" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <input value={validateForm.operatorRegistration} onChange={(e) => setValidateForm((p) => ({ ...p, operatorRegistration: e.target.value }))} placeholder="Operador" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <input value={validateForm.journeyId} onChange={(e) => setValidateForm((p) => ({ ...p, journeyId: e.target.value }))} placeholder="Jornada" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
              </div>
              <button disabled={busy} onClick={runValidation} className="mt-4 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-[#03140d]">Executar pré-validação</button>
            </section>
          )}

          {tab === 'results' && (
            <section className="mt-6 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground"><tr><th className="px-4 py-3">Status</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Período</th><th className="px-4 py-3">Fontes</th><th className="px-4 py-3">Alertas</th></tr></thead>
                  <tbody>
                    {results.length === 0 ? <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={5}>Nenhum resultado encontrado.</td></tr> : results.map((item) => <tr key={item.id} className="border-t border-[#2d3647]/50"><td className="px-4 py-3">{titleCase(item.status)}</td><td className="px-4 py-3">{titleCase(item.targetDataType)}</td><td className="px-4 py-3">{item.periodStart} → {item.periodEnd}</td><td className="px-4 py-3">{item.sources.join(', ') || '—'}</td><td className="px-4 py-3">{item.issues.length}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'jobs' && (
            <section className="mt-6 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground"><tr><th className="px-4 py-3">Status</th><th className="px-4 py-3">Título</th><th className="px-4 py-3">Criado</th></tr></thead>
                  <tbody>
                    {jobs.length === 0 ? <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={3}>Nenhum job encontrado.</td></tr> : jobs.map((item) => <tr key={item.id} className="border-t border-[#2d3647]/50"><td className="px-4 py-3">{titleCase(item.status)}</td><td className="px-4 py-3">{item.title}</td><td className="px-4 py-3">{fmt(item.createdAt)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'logs' && (
            <section className="mt-6 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground"><tr><th className="px-4 py-3">Nível</th><th className="px-4 py-3">Evento</th><th className="px-4 py-3">Mensagem</th><th className="px-4 py-3">Data</th></tr></thead>
                  <tbody>
                    {logs.length === 0 ? <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={4}>Nenhum log encontrado.</td></tr> : logs.map((item) => <tr key={item.id} className="border-t border-[#2d3647]/50"><td className="px-4 py-3">{item.level}</td><td className="px-4 py-3">{item.event}</td><td className="px-4 py-3">{item.message}</td><td className="px-4 py-3">{fmt(item.createdAt)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default withAuth(TotvsPage, { module: 'INTEGRACOES' });
