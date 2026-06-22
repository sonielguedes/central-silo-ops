"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Globe, Loader2, Plus, RefreshCw, Search, ShieldCheck, Settings2, Zap } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { cn } from '@/lib/utils';
import { getCsrfTokenFromDocument } from '@/lib/auth/csrf-client';
import type { IntegrationConfigInput, IntegrationConfigPublic } from '@/lib/integrations/integration-config-types';

type FormState = {
  system: IntegrationConfigInput['system'];
  name: string;
  description: string;
  environment: IntegrationConfigInput['environment'];
  baseUrl: string;
  authType: IntegrationConfigInput['authType'];
  apiKey: string;
  bearerToken: string;
  username: string;
  password: string;
  customHeaderName: string;
  customHeaderValue: string;
  timeoutMs: number;
  retryCount: number;
  status: IntegrationConfigInput['status'];
};

const SYSTEM_LABELS: Record<FormState['system'], string> = {
  PIMS: 'PIMS',
  TOTVS: 'TOTVS',
  EXPORTACAO: 'Exportação',
  API_EXTERNA: 'API Externa',
};

const ENV_LABELS: Record<FormState['environment'], string> = {
  HOMOLOGACAO: 'Homologação',
  PRODUCAO: 'Produção',
};

const AUTH_LABELS: Record<FormState['authType'], string> = {
  NONE: 'Sem autentica??o',
  API_KEY: 'Chave de API',
  BEARER_TOKEN: 'Bearer',
  BASIC_AUTH: 'Autentica??o b?sica',
  CUSTOM_HEADER: 'Cabe?alho personalizado',
};

const STATUS_LABELS: Record<FormState['status'], string> = {
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
};

const CONNECTION_LABELS: Record<NonNullable<IntegrationConfigPublic['lastConnectionStatus']>, string> = {
  SUCCESS: 'Conexão OK',
  FAILED: 'Falha',
  NOT_TESTED: 'Não testado',
};

function emptyForm(): FormState {
  return {
    system: 'PIMS',
    name: '',
    description: '',
    environment: 'HOMOLOGACAO',
    baseUrl: '',
    authType: 'NONE',
    apiKey: '',
    bearerToken: '',
    username: '',
    password: '',
    customHeaderName: '',
    customHeaderValue: '',
    timeoutMs: 15000,
    retryCount: 3,
    status: 'INACTIVE',
  };
}

function formatUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === '/' ? '' : url.pathname}`;
  } catch {
    return value;
  }
}

function safeText(value?: string | null) {
  return value && value.trim() ? value : '—';
}

function badgeClass(value: string) {
  const upper = value.toUpperCase();
  if (upper === 'ACTIVE' || upper === 'SUCCESS' || upper === 'PRODUCAO') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  if (upper === 'FAILED' || upper === 'INACTIVE') return 'bg-red-500/10 text-red-300 border-red-500/20';
  if (upper === 'HOMOLOGACAO' || upper === 'NOT_TESTED') return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  return 'bg-slate-500/10 text-slate-300 border-slate-500/20';
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2">
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { as?: 'input' }) {
  return <input {...props} className={cn('w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none focus:border-primary/50', props.className)} />;
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn('w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none focus:border-primary/50', props.className)} />;
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn('w-full rounded-2xl border border-[#2d3647] bg-[#050812] px-4 py-3 text-sm text-white outline-none focus:border-primary/50', props.className)} />;
}

export function ConfiguracoesApiPage() {
  const [items, setItems] = useState<IntegrationConfigPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<IntegrationConfigPublic | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/integracoes/configuracoes', { cache: 'no-store', credentials: 'include' });
      const data = await res.json().catch(() => ({})) as { success?: boolean; items?: IntegrationConfigPublic[]; error?: string };
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar configurações.');
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar configurações.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => [
      item.system,
      item.name,
      item.description ?? '',
      item.environment,
      item.baseUrl,
      item.authType,
      item.status,
    ].join(' ').toLowerCase().includes(term));
  }, [items, query]);

  const metrics = useMemo(() => {
    const active = items.filter((item) => item.status === 'ACTIVE').length;
    const hom = items.filter((item) => item.environment === 'HOMOLOGACAO').length;
    const prod = items.filter((item) => item.environment === 'PRODUCAO').length;
    const failed = items.filter((item) => item.lastConnectionStatus === 'FAILED').length;
    return { total: items.length, active, hom, prod, failed };
  }, [items]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (item: IntegrationConfigPublic) => {
    setEditing(item);
    setForm({
      system: item.system,
      name: item.name,
      description: item.description || '',
      environment: item.environment,
      baseUrl: item.baseUrl,
      authType: item.authType,
      apiKey: '',
      bearerToken: '',
      username: item.username || '',
      password: '',
      customHeaderName: item.customHeaderName || '',
      customHeaderValue: '',
      timeoutMs: item.timeoutMs,
      retryCount: item.retryCount,
      status: item.status,
    });
    setFormError(null);
    setModalOpen(true);
  };

  const validate = () => {
    if (!form.system) return 'Sistema obrigatório.';
    if (!form.name.trim()) return 'Nome obrigatório.';
    if (!form.environment) return 'Ambiente obrigatório.';
    if (!form.baseUrl.trim()) return 'Endpoint obrigatório.';
    try { new URL(form.baseUrl); } catch { return 'Endpoint deve ser uma URL válida.'; }
    if (!form.authType) return 'Tipo de autenticação obrigatório.';
    if (form.timeoutMs < 1000) return 'Timeout mínimo é 1000ms.';
    if (form.retryCount < 0 || form.retryCount > 10) return 'Reprocessar deve ficar entre 0 e 10.';
    if (form.authType === 'API_KEY' && !form.apiKey.trim() && !editing?.hasApiKey) return 'Chave de API obrigatória.';
    if (form.authType === 'BEARER_TOKEN' && !form.bearerToken.trim() && !editing?.hasBearerToken) return 'Bearer Token obrigatório.';
    if (form.authType === 'BASIC_AUTH' && (!form.username.trim() || (!form.password.trim() && !editing?.hasPassword))) return 'Usuário e senha obrigatórios.';
    if (form.authType === 'CUSTOM_HEADER' && (!form.customHeaderName.trim() || (!form.customHeaderValue.trim() && !editing?.hasCustomHeaderValue))) return 'Header e valor obrigatórios.';
    return null;
  };

  const submit = async () => {
    const validationError = validate();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const csrf = getCsrfTokenFromDocument();
      const payload = {
        ...form,
        description: form.description?.trim() || undefined,
        apiKey: form.apiKey.trim() || undefined,
        bearerToken: form.bearerToken.trim() || undefined,
        password: form.password.trim() || undefined,
        customHeaderValue: form.customHeaderValue.trim() || undefined,
      };
      const res = await fetch(editing ? `/api/integracoes/configuracoes/${editing.id}` : '/api/integracoes/configuracoes', {
        method: editing ? 'PUT' : 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({})) as { item?: IntegrationConfigPublic; error?: string };
      if (!res.ok) throw new Error(data.error || 'Falha ao salvar configuração.');
      setModalOpen(false);
      setEditing(null);
      setForm(emptyForm());
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar configuração.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: IntegrationConfigPublic) => {
    setSaving(true);
    try {
      const csrf = getCsrfTokenFromDocument();
      const res = item.status === 'ACTIVE'
        ? await fetch(`/api/integracoes/configuracoes/${item.id}`, { method: 'DELETE', credentials: 'include', headers: { ...(csrf ? { 'x-csrf-token': csrf } : {}) } })
        : await fetch(`/api/integracoes/configuracoes/${item.id}`, {
            method: 'PUT',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json', ...(csrf ? { 'x-csrf-token': csrf } : {}) },
            body: JSON.stringify({ status: 'ACTIVE' }),
          });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Falha ao atualizar status.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar status.');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async (item: IntegrationConfigPublic) => {
    setTestingId(item.id);
    try {
      const csrf = getCsrfTokenFromDocument();
      const res = await fetch(`/api/integracoes/configuracoes/${item.id}/testar-conexao`, {
        method: 'POST',
        credentials: 'include',
        headers: { ...(csrf ? { 'x-csrf-token': csrf } : {}) },
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Falha no teste de conexão.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no teste de conexão.');
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#050812] text-white">
      <Sidebar className="hidden shrink-0 lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <PageHeader
            title="Configurações API"
            description="Endpoints, credenciais e parâmetros base da integração"
          >
            <button type="button" onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-[#0a0e27]">
              <Plus size={14} />
              Nova Configuração
            </button>
          </PageHeader>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Metric label="Total de configurações" value={metrics.total} icon={<Settings2 size={18} />} />
            <Metric label="Ativas" value={metrics.active} icon={<ShieldCheck size={18} />} />
            <Metric label="Homologação" value={metrics.hom} icon={<Globe size={18} />} />
            <Metric label="Produção" value={metrics.prod} icon={<Zap size={18} />} />
            <Metric label="Com falha no último teste" value={metrics.failed} icon={<AlertTriangle size={18} />} />
          </div>

          <div className="mt-6 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-md">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar sistema, nome, endpoint..."
                  className="w-full rounded-2xl border border-[#2d3647] bg-[#050812] py-3 pl-9 pr-4 text-sm text-white outline-none focus:border-primary/50"
                />
              </div>
              <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-4 py-2 text-[10px] font-black uppercase tracking-widest text-white">
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Atualizar
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[9px] uppercase tracking-[0.3em] text-muted-foreground">
                  <tr className="border-b border-[#2d3647]">
                    <th className="px-4 py-3">Sistema</th>
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Ambiente</th>
                    <th className="px-4 py-3">Endpoint</th>
                    <th className="px-4 py-3">Autenticação</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Último teste</th>
                    <th className="px-4 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td className="px-4 py-10" colSpan={8}><Loader2 className="animate-spin text-primary" size={18} /></td></tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        Nenhuma configuração cadastrada.
                      </td>
                    </tr>
                  ) : filtered.map((item) => (
                    <tr key={item.id} className="border-t border-[#2d3647]/60">
                      <td className="px-4 py-4 font-bold text-white">{SYSTEM_LABELS[item.system]}</td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-white">{item.name}</div>
                        {item.description && <div className="text-[10px] text-muted-foreground">{item.description}</div>}
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest', badgeClass(item.environment))}>
                          {ENV_LABELS[item.environment]}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-white/80">{formatUrl(item.baseUrl)}</td>
                      <td className="px-4 py-4 text-xs text-white/80">{AUTH_LABELS[item.authType]}</td>
                      <td className="px-4 py-4">
                        <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest', badgeClass(item.status))}>
                          {STATUS_LABELS[item.status]}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest', badgeClass(item.lastConnectionStatus ?? 'NOT_TESTED'))}>
                          {CONNECTION_LABELS[item.lastConnectionStatus ?? 'NOT_TESTED']}
                        </span>
                        <div className="mt-1 text-[10px] text-muted-foreground">{safeText(item.lastConnectionMessage)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => openEdit(item)} className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-white">
                            Editar
                          </button>
                          <button type="button" onClick={() => void testConnection(item)} disabled={testingId === item.id} className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-cyan-200 disabled:opacity-60">
                            {testingId === item.id ? 'Testando...' : 'Testar conexão'}
                          </button>
                          <button type="button" onClick={() => void toggleStatus(item)} disabled={saving} className={cn('rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-widest', item.status === 'ACTIVE' ? 'border-red-500/20 bg-red-500/10 text-red-200' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200')}>
                            {item.status === 'ACTIVE' ? 'Inativar' : 'Ativar'}
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

      {modalOpen && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setModalOpen(false)} />
          <div className="relative w-full max-w-4xl rounded-3xl border border-[#2d3647] bg-[#0a0e27] p-6 shadow-2xl shadow-black/40">
            <div className="flex items-start justify-between gap-4 border-b border-[#2d3647] pb-4">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tighter text-white">{editing ? 'Editar configuração' : 'Nova configuração'}</h2>
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Tenant isolado, segredo mascarado no GET</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-3 py-2 text-xs font-black uppercase text-white">
                Fechar
              </button>
            </div>

            {formError && (
              <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {formError}
              </div>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Sistema">
                <Select value={form.system} onChange={(e) => setForm((prev) => ({ ...prev, system: e.target.value as FormState['system'] }))}>
                  {Object.keys(SYSTEM_LABELS).map((key) => <option key={key} value={key}>{SYSTEM_LABELS[key as FormState['system']]}</option>)}
                </Select>
              </Field>
              <Field label="Nome">
                <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Ex.: PIMS Homologação" />
              </Field>
              <Field label="Descrição">
                <Textarea rows={2} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Opcional" />
              </Field>
              <Field label="Ambiente">
                <Select value={form.environment} onChange={(e) => setForm((prev) => ({ ...prev, environment: e.target.value as FormState['environment'] }))}>
                  {Object.keys(ENV_LABELS).map((key) => <option key={key} value={key}>{ENV_LABELS[key as FormState['environment']]}</option>)}
                </Select>
              </Field>
              <Field label="Endpoint base">
                <Input value={form.baseUrl} onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))} placeholder="https://api.exemplo.com.br" />
              </Field>
              <Field label="Tipo de autenticação">
                <Select value={form.authType} onChange={(e) => setForm((prev) => ({ ...prev, authType: e.target.value as FormState['authType'] }))}>
                  {Object.keys(AUTH_LABELS).map((key) => <option key={key} value={key}>{AUTH_LABELS[key as FormState['authType']]}</option>)}
                </Select>
              </Field>

              {form.authType === 'API_KEY' && (
                <Field label="Chave de API">
                  <Input value={form.apiKey} onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))} placeholder={editing?.hasApiKey ? 'Mantida se em branco' : 'Chave da API'} />
                </Field>
              )}
              {form.authType === 'BEARER_TOKEN' && (
                <Field label="Bearer Token">
                  <Input value={form.bearerToken} onChange={(e) => setForm((prev) => ({ ...prev, bearerToken: e.target.value }))} placeholder={editing?.hasBearerToken ? 'Mantido se em branco' : 'Token'} />
                </Field>
              )}
              {form.authType === 'BASIC_AUTH' && (
                <>
                  <Field label="Usuário"><Input value={form.username} onChange={(e) => setForm((prev) => ({ ...prev, username: e.target.value }))} /></Field>
                  <Field label="Senha"><Input type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} placeholder={editing?.hasPassword ? 'Mantida se em branco' : ''} /></Field>
                </>
              )}
              {form.authType === 'CUSTOM_HEADER' && (
                <>
                  <Field label="Cabe?alho personalizadoizado"><Input value={form.customHeaderName} onChange={(e) => setForm((prev) => ({ ...prev, customHeaderName: e.target.value }))} placeholder="X-API-KEY" /></Field>
                  <Field label="Valor do header"><Input value={form.customHeaderValue} onChange={(e) => setForm((prev) => ({ ...prev, customHeaderValue: e.target.value }))} placeholder={editing?.hasCustomHeaderValue ? 'Mantido se em branco' : ''} /></Field>
                </>
              )}

              <Field label="Timeout (ms)">
                <Input type="number" min={1000} value={form.timeoutMs} onChange={(e) => setForm((prev) => ({ ...prev, timeoutMs: Number(e.target.value) }))} />
              </Field>
              <Field label="Tentativas">
                <Input type="number" min={0} max={10} value={form.retryCount} onChange={(e) => setForm((prev) => ({ ...prev, retryCount: Number(e.target.value) }))} />
              </Field>
              <Field label="Status">
                <Select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as FormState['status'] }))}>
                  {Object.keys(STATUS_LABELS).map((key) => <option key={key} value={key}>{STATUS_LABELS[key as FormState['status']]}</option>)}
                </Select>
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-4 py-2 text-xs font-black uppercase tracking-widest text-white">
                Cancelar
              </button>
              <button type="button" onClick={() => void submit()} disabled={saving} className="rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-[#0a0e27] disabled:opacity-60">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
