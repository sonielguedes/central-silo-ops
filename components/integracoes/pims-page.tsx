"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { withAuth } from '@/components/shared/with-auth';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { PageHeader } from '@/components/shared/page-header';
import { cn } from '@/lib/utils';
import type { PimsMapping, PimsMappingStatus, PimsMappingType, PimsValidationResult, PimsValidationTargetDataType } from '@/lib/integrations/pims/pims-mapping-types';
import type { IntegrationConfigPublic } from '@/lib/integrations/integration-config-types';
import type { PimsDispatch } from '@/lib/integrations/pims/pims-dispatch-types';

type TabKey = 'mappings' | 'validate' | 'results' | 'dispatches';

const mappingTypes: PimsMappingType[] = ['OPERATION', 'STOP_REASON', 'COST_CENTER', 'EQUIPMENT', 'OPERATOR', 'IMPLEMENT', 'WORK_ORDER', 'FICHA_FIELD'];
const mappingStatuses: PimsMappingStatus[] = ['ACTIVE', 'INACTIVE', 'PENDING_REVIEW'];
const validationTargets: PimsValidationTargetDataType[] = ['FICHA_OPERADOR', 'JOURNEY', 'STOP_EVENTS', 'FULL_OPERATIONAL_PACKAGE'];

function titleCase(value: string) {
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (s) => s.toUpperCase());
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

export function PimsPage() {
  const [tab, setTab] = useState<TabKey>('mappings');
  const [mappings, setMappings] = useState<PimsMapping[]>([]);
  const [results, setResults] = useState<PimsValidationResult[]>([]);
  const [dispatches, setDispatches] = useState<PimsDispatch[]>([]);
  const [configs, setConfigs] = useState<IntegrationConfigPublic[]>([]);
  const [active, setActive] = useState<PimsValidationResult | null>(null);
  const [editing, setEditing] = useState<PimsMapping | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState({ type: '', status: '', q: '' });
  const [form, setForm] = useState({ type: 'OPERATION', siloCode: '', siloName: '', pimsCode: '', pimsName: '', description: '', status: 'ACTIVE' });
  const [validateForm, setValidateForm] = useState({ targetDataType: 'FICHA_OPERADOR', periodStart: new Date().toISOString().slice(0, 10), periodEnd: new Date().toISOString().slice(0, 10), fleetCode: '', operatorRegistration: '', journeyId: '' });

  const loadData = useCallback(async () => {
    const qs = new URLSearchParams();
    if (query.type) qs.set('type', query.type);
    if (query.status) qs.set('status', query.status);
    if (query.q) qs.set('q', query.q);
    const [mRes, rRes, cRes, dRes] = await Promise.all([
      fetch(`/api/integracoes/pims/mappings?${qs.toString()}`, { credentials: 'include' }),
      fetch('/api/integracoes/pims/validation-results', { credentials: 'include' }),
      fetch('/api/integracoes/configuracoes', { credentials: 'include' }),
      fetch('/api/integracoes/pims/dispatches', { credentials: 'include' }),
    ]);
    const mJson = await mRes.json().catch(() => ({ items: [] }));
    const rJson = await rRes.json().catch(() => ({ items: [] }));
    const cJson = await cRes.json().catch(() => ({ items: [] }));
    const dJson = await dRes.json().catch(() => ({ items: [] }));
    setMappings(mJson.items ?? []);
    setResults(rJson.items ?? []);
    setDispatches(dJson.items ?? []);
    setConfigs(cJson.items ?? []);
  }, [query.type, query.status, query.q]);

  useEffect(() => { loadData().catch(() => void 0); }, [loadData]);

  const stats = useMemo(() => {
    const activeMappings = mappings.filter((m) => m.status === 'ACTIVE').length;
    const pending = mappings.filter((m) => m.status === 'PENDING_REVIEW').length;
    const alerts = results.filter((r) => r.status === 'WARNING').length;
    const activeConfig = configs.find((c) => c.system === 'PIMS' && c.status === 'ACTIVE');
    return { activeMappings, pending, alerts, last: results[0]?.checkedAt ?? null, configId: activeConfig?.id ?? null };
  }, [mappings, results, configs]);

  async function saveMapping() {
    setBusy(true);
    try {
      const method = editing ? 'PUT' : 'POST';
      const url = editing ? `/api/integracoes/pims/mappings/${editing.id}` : '/api/integracoes/pims/mappings';
      await fetch(url, { method, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      setEditing(null);
      setForm({ type: 'OPERATION', siloCode: '', siloName: '', pimsCode: '', pimsName: '', description: '', status: 'ACTIVE' });
      await loadData();
    } finally { setBusy(false); }
  }

  async function inactivate(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/integracoes/pims/mappings/${id}`, { method: 'DELETE', credentials: 'include' });
      await loadData();
    } finally { setBusy(false); }
  }

  async function runValidation() {
    setBusy(true);
    try {
      const res = await fetch('/api/integracoes/pims/validate', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...validateForm, filters: { fleetCode: validateForm.fleetCode || undefined, operatorRegistration: validateForm.operatorRegistration || undefined, journeyId: validateForm.journeyId || undefined } }) });
      const json = await res.json();
      if (json.success) setActive(json as PimsValidationResult);
      await loadData();
      setTab('results');
    } finally { setBusy(false); }
  }

  async function runDispatch() {
    setBusy(true);
    try {
      const activeConfig = configs.find((c) => c.system === 'PIMS' && c.status === 'ACTIVE' && c.environment === 'HOMOLOGACAO');
      const res = await fetch('/api/integracoes/pims/dispatch', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...validateForm,
          configId: activeConfig?.id,
          mockMode: activeConfig?.baseUrl?.startsWith('mock://') ?? false,
          filters: { fleetCode: validateForm.fleetCode || undefined, operatorRegistration: validateForm.operatorRegistration || undefined, journeyId: validateForm.journeyId || undefined },
        }),
      });
      await res.json().catch(() => ({}));
      await loadData();
      setTab('dispatches');
    } finally { setBusy(false); }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#050812] text-white">
      <Sidebar className="hidden shrink-0 lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <PageHeader title="Integração PIMS" description="Mapeamento operacional e pré-validação de dados para PIMS" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Mapeamentos ativos" value={String(stats.activeMappings)} tone="emerald" />
            <Metric label="Pendentes de revisão" value={String(stats.pending)} tone="amber" />
            <Metric label="Validações com alerta" value={String(stats.alerts)} tone="cyan" />
            <Metric label="Última validação" value={stats.last ? new Date(stats.last).toLocaleDateString('pt-BR') : '—'} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Configuração ativa PIMS: {stats.configId ?? 'Nenhuma'}</p>

          <div className="mt-6 flex gap-2">
            {(['mappings','validate','results','dispatches'] as TabKey[]).map((k) => (
              <button key={k} onClick={() => setTab(k)} className={cn('rounded-2xl px-4 py-2 text-xs font-black uppercase tracking-[0.25em]', tab === k ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/30' : 'bg-[#10162a] text-muted-foreground border border-[#2d3647]')}>
                {k === 'mappings' ? 'Mapeamentos' : k === 'validate' ? 'Pré-validação' : k === 'results' ? 'Resultados' : 'Envios'}
              </button>
            ))}
          </div>

          {tab === 'mappings' && (
            <section className="mt-6 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <select value={query.type} onChange={(e) => setQuery((p) => ({ ...p, type: e.target.value }))} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm">
                    <option value="">Todos os tipos</option>{mappingTypes.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                  </select>
                  <select value={query.status} onChange={(e) => setQuery((p) => ({ ...p, status: e.target.value }))} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm">
                    <option value="">Todos os status</option>{mappingStatuses.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
                  </select>
                  <input value={query.q} onChange={(e) => setQuery((p) => ({ ...p, q: e.target.value }))} placeholder="Buscar" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                </div>
                <button onClick={() => { setEditing(null); setForm({ type: 'OPERATION', siloCode: '', siloName: '', pimsCode: '', pimsName: '', description: '', status: 'ACTIVE' }); }} className="rounded-xl bg-cyan-500/20 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-cyan-200">Novo mapeamento</button>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground"><tr><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Código SILO</th><th className="px-4 py-3">Nome SILO</th><th className="px-4 py-3">Código PIMS</th><th className="px-4 py-3">Nome PIMS</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Atualizado em</th><th className="px-4 py-3">Ações</th></tr></thead>
                  <tbody>
                    {mappings.map((m) => <tr key={m.id} className="border-t border-[#2d3647]/50"><td className="px-4 py-3">{titleCase(m.type)}</td><td className="px-4 py-3">{m.siloCode}</td><td className="px-4 py-3">{m.siloName ?? '—'}</td><td className="px-4 py-3">{m.pimsCode}</td><td className="px-4 py-3">{m.pimsName ?? '—'}</td><td className="px-4 py-3">{m.status}</td><td className="px-4 py-3">{fmt(m.updatedAt)}</td><td className="px-4 py-3"><button onClick={() => { setEditing(m); setForm({ type: m.type, siloCode: m.siloCode, siloName: m.siloName ?? '', pimsCode: m.pimsCode, pimsName: m.pimsName ?? '', description: m.description ?? '', status: m.status }); }} className="mr-2 text-cyan-200">Editar</button><button onClick={() => inactivate(m.id)} className="text-amber-200">Inativar</button></td></tr>)}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(['type','siloCode','pimsCode','status'] as const).map((k) => <input key={k} value={(form as Record<string, string>)[k]} onChange={(e) => setForm((p) => ({ ...p, [k]: e.target.value }))} placeholder={k} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />)}
                <input value={form.siloName} onChange={(e) => setForm((p) => ({ ...p, siloName: e.target.value }))} placeholder="Nome SILO" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <input value={form.pimsName} onChange={(e) => setForm((p) => ({ ...p, pimsName: e.target.value }))} placeholder="Nome PIMS" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} placeholder="Descrição" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm md:col-span-2 xl:col-span-3" />
                <button disabled={busy} onClick={saveMapping} className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-[#04111f]">{editing ? 'Salvar' : 'Criar'}</button>
              </div>
            </section>
          )}

          {tab === 'validate' && (
            <section className="mt-6 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                <select value={validateForm.targetDataType} onChange={(e) => setValidateForm((p) => ({ ...p, targetDataType: e.target.value as PimsValidationTargetDataType }))} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm">{validationTargets.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select>
                <input type="date" value={validateForm.periodStart} onChange={(e) => setValidateForm((p) => ({ ...p, periodStart: e.target.value }))} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <input type="date" value={validateForm.periodEnd} onChange={(e) => setValidateForm((p) => ({ ...p, periodEnd: e.target.value }))} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <input value={validateForm.fleetCode} onChange={(e) => setValidateForm((p) => ({ ...p, fleetCode: e.target.value }))} placeholder="Frota" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <input value={validateForm.operatorRegistration} onChange={(e) => setValidateForm((p) => ({ ...p, operatorRegistration: e.target.value }))} placeholder="Operador" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
                <input value={validateForm.journeyId} onChange={(e) => setValidateForm((p) => ({ ...p, journeyId: e.target.value }))} placeholder="Jornada" className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-sm" />
              </div>
              <button disabled={busy} onClick={runValidation} className="mt-4 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-[#03140d]">Validar para PIMS</button>
              <button disabled={busy} onClick={runDispatch} className="mt-4 ml-3 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-black uppercase tracking-[0.25em] text-[#03111f]">Enviar para Homologação</button>
              {active && <div className="mt-4 rounded-2xl border border-[#2d3647] bg-[#050812] p-4"><p className="text-sm font-bold">{active.status}</p><p className="text-xs text-muted-foreground">{active.issues.length} alerta(s)</p></div>}
            </section>
          )}

          {tab === 'results' && (
            <section className="mt-6 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground"><tr><th className="px-4 py-3">Status</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Frota</th><th className="px-4 py-3">Operador</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Problemas</th></tr></thead>
                  <tbody>{results.map((r) => <tr key={r.id} className="border-t border-[#2d3647]/50"><td className="px-4 py-3">{r.status}</td><td className="px-4 py-3">{r.targetDataType}</td><td className="px-4 py-3">{r.fleetCode ?? '—'}</td><td className="px-4 py-3">{r.operatorRegistration ?? '—'}</td><td className="px-4 py-3">{fmt(r.checkedAt)}</td><td className="px-4 py-3">{r.issues.length}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}

          {tab === 'dispatches' && (
            <section className="mt-6 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground"><tr><th className="px-4 py-3">Status</th><th className="px-4 py-3">Período</th><th className="px-4 py-3">Config</th><th className="px-4 py-3">Registros</th><th className="px-4 py-3">Erro</th></tr></thead>
                  <tbody>{dispatches.map((d) => <tr key={d.id} className="border-t border-[#2d3647]/50"><td className="px-4 py-3">{d.status}</td><td className="px-4 py-3">{d.periodStart} → {d.periodEnd}</td><td className="px-4 py-3">{d.configId ?? '—'}</td><td className="px-4 py-3">{d.payloadSummary?.recordCount ?? 0}</td><td className="px-4 py-3">{d.lastErrorMessage ?? '—'}</td></tr>)}</tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

export default withAuth(PimsPage, { module: 'INTEGRACOES' });
