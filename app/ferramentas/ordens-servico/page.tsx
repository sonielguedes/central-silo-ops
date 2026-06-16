"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { getCsrfTokenFromDocument } from '@/lib/auth/csrf-client';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import {
  Plus, Loader2, X, Save, Search, RefreshCw,
  ClipboardList, AlertCircle, ChevronRight,
  Eye, Pencil, Ban, CheckSquare, Clock, History
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────
type OSStatus = 'ABERTA' | 'EM_ANDAMENTO' | 'PAUSADA' | 'FINALIZADA' | 'CANCELADA';
type OSType    = 'PREVENTIVA' | 'CORRETIVA' | 'PREDITIVA' | 'INSPECAO';
type OSPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

interface HistoryEntry { timestamp: string; action: string; userId?: string; }
interface OS {
  id: string;
  code: string;
  type: OSType;
  priority: OSPriority;
  status: OSStatus;
  description: string;
  equipmentId?: string;
  operatorId?: string;
  costCenterId?: string;
  operationId?: string;
  observations?: string;
  openedAt?: string;
  plannedAt?: string;
  startedAt?: string;
  closedAt?: string;
  history?: HistoryEntry[];
}

// ── Badge helpers ─────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<OSStatus, string> = {
  ABERTA:       'Aberta',
  EM_ANDAMENTO: 'Em Andamento',
  PAUSADA:      'Pausada',
  FINALIZADA:   'Finalizada',
  CANCELADA:    'Cancelada',
};
const STATUS_COLOR: Record<OSStatus, string> = {
  ABERTA:       'bg-blue-500/15 text-blue-400 border-blue-500/30',
  EM_ANDAMENTO: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  PAUSADA:      'bg-orange-500/15 text-orange-400 border-orange-500/30',
  FINALIZADA:   'bg-green-500/15 text-green-400 border-green-500/30',
  CANCELADA:    'bg-red-500/15 text-red-400 border-red-500/30',
};
const TYPE_LABEL: Record<OSType, string> = {
  PREVENTIVA: 'Preventiva',
  CORRETIVA:  'Corretiva',
  PREDITIVA:  'Preditiva',
  INSPECAO:   'Inspeção',
};
const PRIORITY_COLOR: Record<OSPriority, string> = {
  BAIXA:  'text-gray-400',
  MEDIA:  'text-blue-400',
  ALTA:   'text-orange-400',
  CRITICA:'text-red-400',
};

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

// ── Fetch helpers ─────────────────────────────────────────────────────────────
/** Lê o token CSRF do cookie silo_csrf (httpOnly: false, by design) e retorna como header. */
function csrfHeaders(): Record<string, string> {
  const token = getCsrfTokenFromDocument();
  return token ? { 'x-csrf-token': token } : {};
}

/** Extrai mensagem legível de uma resposta de erro (tenta JSON.error, cai no texto raw). */
async function extractApiError(r: Response): Promise<string> {
  const text = await r.text();
  try { return (JSON.parse(text) as { error?: string }).error ?? text; } catch { return text; }
}

async function apiGet(url: string) {
  const r = await fetch(url, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(await extractApiError(r));
  return r.json();
}
async function apiPost(url: string, body: unknown) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await extractApiError(r));
  return r.json();
}
async function apiPut(url: string, body: unknown) {
  const r = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await extractApiError(r));
  return r.json();
}
async function apiPatch(url: string, body: unknown) {
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...csrfHeaders() },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await extractApiError(r));
  return r.json();
}

// ── Form defaults ─────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  code: '', type: 'CORRETIVA' as OSType, priority: 'MEDIA' as OSPriority,
  status: 'ABERTA' as OSStatus, description: '', equipmentId: '',
  operatorId: '', costCenterId: '', operationId: '',
  observations: '', openedAt: '', plannedAt: '',
};
type FormState = typeof EMPTY_FORM;

// ══════════════════════════════════════════════════════════════════════════════
export default function OrdensServicoPage() {
  const [items, setItems]               = useState<OS[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  // filters
  const [search, setSearch]             = useState('');
  const [filterStatus, setFilterStatus] = useState<OSStatus | ''>('');
  const [filterType, setFilterType]     = useState<OSType | ''>('');

  // drawer
  const [drawerMode, setDrawerMode]     = useState<'create' | 'edit' | 'view' | null>(null);
  const [selected, setSelected]         = useState<OS | null>(null);
  const [form, setForm]                 = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState<string | null>(null);

  // confirm modal
  const [confirmAction, setConfirmAction] = useState<{ label: string; status: OSStatus; os: OS } | null>(null);

  // history panel
  const [historyOs, setHistoryOs]       = useState<OS | null>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterType)   params.set('type',   filterType);
      if (search)       params.set('search', search);
      const data = await apiGet('/api/ordens-servico?' + params.toString());
      setItems(data.items ?? data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [filterStatus, filterType, search]);

  useEffect(() => { load(); }, [load]);

  // ── Open drawer ───────────────────────────────────────────────────────────
  const openCreate = () => {
    setSelected(null);
    setForm({ ...EMPTY_FORM, openedAt: new Date().toISOString().slice(0, 16) });
    setFormError(null);
    setDrawerMode('create');
  };
  const openEdit = (os: OS) => {
    setSelected(os);
    setForm({
      code:         os.code,
      type:         os.type,
      priority:     os.priority,
      status:       os.status,
      description:  os.description,
      equipmentId:  os.equipmentId  ?? '',
      operatorId:   os.operatorId   ?? '',
      costCenterId: os.costCenterId ?? '',
      operationId:  os.operationId  ?? '',
      observations: os.observations ?? '',
      openedAt:     os.openedAt     ? os.openedAt.slice(0, 16)  : '',
      plannedAt:    os.plannedAt    ? os.plannedAt.slice(0, 16) : '',
    });
    setFormError(null);
    setDrawerMode('edit');
  };
  const openView = (os: OS) => { setSelected(os); setDrawerMode('view'); };
  const closeDrawer = () => { setDrawerMode(null); setSelected(null); };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.code.trim() || !form.description.trim()) {
      setFormError('Código e Descrição são obrigatórios.'); return;
    }
    setSaving(true); setFormError(null);
    try {
      const body = {
        ...form,
        openedAt:  form.openedAt  ? new Date(form.openedAt).toISOString()  : undefined,
        plannedAt: form.plannedAt ? new Date(form.plannedAt).toISOString() : undefined,
      };
      if (drawerMode === 'create') await apiPost('/api/ordens-servico', body);
      else if (drawerMode === 'edit' && selected) await apiPut('/api/ordens-servico/' + selected.id, body);
      closeDrawer(); load();
    } catch (e: any) { setFormError(e.message); }
    finally { setSaving(false); }
  };

  // ── Status transition ─────────────────────────────────────────────────────
  const handleTransition = async (os: OS, status: OSStatus, label: string) => {
    setConfirmAction({ label, status, os });
  };
  const confirmTransition = async () => {
    if (!confirmAction) return;
    try {
      await apiPatch('/api/ordens-servico/' + confirmAction.os.id, { status: confirmAction.status });
      setConfirmAction(null); load();
    } catch (e: any) { alert(e.message); setConfirmAction(null); }
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = items.filter(i => {
    const q = search.toLowerCase();
    return (
      (!filterStatus || i.status === filterStatus) &&
      (!filterType   || i.type   === filterType) &&
      (!q || i.code.toLowerCase().includes(q) || i.description.toLowerCase().includes(q))
    );
  });

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader
            title="Ordens de Serviço"
            description="Gestão de ordens de serviço e manutenções da frota"
          >
            <button onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors">
              <Plus size={16} /> Nova OS
            </button>
          </PageHeader>

          {/* ── Filtros ───────────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                placeholder="Buscar por código ou descrição..."
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as OSStatus | '')}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="">Todos os status</option>
              {(Object.keys(STATUS_LABEL) as OSStatus[]).map(s =>
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value as OSType | '')}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500">
              <option value="">Todos os tipos</option>
              {(Object.keys(TYPE_LABEL) as OSType[]).map(t =>
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
            </select>
            <button onClick={load} title="Recarregar"
              className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <RefreshCw size={16} />
            </button>
          </div>

          {/* ── Lista ─────────────────────────────────────────────────────── */}
          {loading ? (
            <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
              <Loader2 size={20} className="animate-spin" /> Carregando ordens de serviço...
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <AlertCircle size={16} /> {error}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
              <ClipboardList size={40} className="opacity-30" />
              <p>Nenhuma ordem de serviço encontrada.</p>
              <button onClick={openCreate} className="text-sm text-blue-400 hover:underline">Criar primeira OS</button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map(os => (
                <OSCard key={os.id} os={os}
                  onView={() => openView(os)}
                  onEdit={() => openEdit(os)}
                  onHistory={() => setHistoryOs(os)}
                  onCancel={() => handleTransition(os, 'CANCELADA', 'Cancelar OS')}
                  onFinalize={() => handleTransition(os, 'FINALIZADA', 'Finalizar OS')} />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* ── Drawer Criar/Editar/Ver ────────────────────────────────────────── */}
      {drawerMode && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50 backdrop-blur-sm" onClick={closeDrawer} />
          <div className="w-full max-w-xl bg-[#0a0f1e] border-l border-white/10 flex flex-col overflow-hidden">
            {/* header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="font-semibold text-white">
                {drawerMode === 'create' ? 'Nova Ordem de Serviço'
                  : drawerMode === 'edit'   ? 'Editar OS — ' + (selected?.code ?? '')
                  :                            'Detalhes — ' + (selected?.code ?? '')}
              </h2>
              <button onClick={closeDrawer} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              {drawerMode === 'view' && selected ? (
                <ViewPanel os={selected} />
              ) : (
                <OSForm form={form} setForm={setForm} readOnly={false} />
              )}
              {formError && (
                <p className="mt-3 text-sm text-red-400 flex items-center gap-2">
                  <AlertCircle size={14} />{formError}
                </p>
              )}
            </div>

            {drawerMode !== 'view' && (
              <div className="p-5 border-t border-white/10 flex justify-end gap-3">
                <button onClick={closeDrawer}
                  className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  {drawerMode === 'create' ? 'Criar OS' : 'Salvar'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Histórico modal ────────────────────────────────────────────────── */}
      {historyOs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setHistoryOs(null)} />
          <div className="relative w-full max-w-md bg-[#0a0f1e] border border-white/10 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="font-semibold flex items-center gap-2"><History size={16} /> Histórico — {historyOs.code}</h3>
              <button onClick={() => setHistoryOs(null)} className="text-gray-500 hover:text-white"><X size={18} /></button>
            </div>
            <div className="max-h-80 overflow-y-auto custom-scrollbar p-4 flex flex-col gap-3">
              {(historyOs.history ?? []).length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Sem histórico registrado.</p>
              ) : [...(historyOs.history ?? [])].reverse().map((h, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">{fmtDate(h.timestamp)}</p>
                    <p className="text-sm text-white">{h.action.replace(/_/g, ' ')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm modal ──────────────────────────────────────────────────── */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
          <div className="relative w-full max-w-sm bg-[#0a0f1e] border border-white/10 rounded-xl p-6 flex flex-col gap-4">
            <h3 className="font-semibold text-white">{confirmAction.label}</h3>
            <p className="text-sm text-gray-400">
              Confirmar <strong className="text-white">{confirmAction.label.toLowerCase()}</strong> da OS{' '}
              <strong className="text-white">{confirmAction.os.code}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-lg border border-white/10 text-gray-400 hover:text-white text-sm">
                Não
              </button>
              <button onClick={confirmTransition}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium text-white',
                  confirmAction.status === 'FINALIZADA' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'
                )}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── OSCard ────────────────────────────────────────────────────────────────────
function OSCard({ os, onView, onEdit, onHistory, onCancel, onFinalize }: {
  os: OS;
  onView: () => void; onEdit: () => void; onHistory: () => void;
  onCancel: () => void; onFinalize: () => void;
}) {
  const canEdit     = os.status !== 'FINALIZADA' && os.status !== 'CANCELADA';
  const canCancel   = os.status !== 'FINALIZADA' && os.status !== 'CANCELADA';
  const canFinalize = os.status === 'EM_ANDAMENTO' || os.status === 'PAUSADA';

  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/8 hover:bg-white/[0.05] hover:border-white/12 transition-all group">
      {/* Status bar */}
      <div className={cn('w-1 self-stretch rounded-full',
        os.status === 'ABERTA'       ? 'bg-blue-500' :
        os.status === 'EM_ANDAMENTO' ? 'bg-yellow-500' :
        os.status === 'PAUSADA'      ? 'bg-orange-500' :
        os.status === 'FINALIZADA'   ? 'bg-green-500' : 'bg-red-500'
      )} />

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="font-mono text-sm font-semibold text-white">{os.code}</span>
          <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', STATUS_COLOR[os.status])}>
            {STATUS_LABEL[os.status]}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400">
            {TYPE_LABEL[os.type]}
          </span>
          <span className={cn('text-xs font-semibold', PRIORITY_COLOR[os.priority])}>
            ● {os.priority}
          </span>
        </div>
        <p className="text-sm text-gray-300 truncate">{os.description}</p>
        <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
          {os.openedAt && <span className="flex items-center gap-1"><Clock size={11} />{fmtDate(os.openedAt)}</span>}
          {os.equipmentId && <span>Frota: {os.equipmentId}</span>}
          {os.costCenterId && <span>CC: {os.costCenterId}</span>}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <ActionBtn icon={<Eye size={14}/>}      title="Ver detalhes"  onClick={onView} />
        <ActionBtn icon={<History size={14}/>}  title="Histórico"    onClick={onHistory} />
        {canEdit     && <ActionBtn icon={<Pencil size={14}/>}      title="Editar"       onClick={onEdit}     color="blue" />}
        {canFinalize && <ActionBtn icon={<CheckSquare size={14}/>} title="Finalizar OS" onClick={onFinalize} color="green" />}
        {canCancel   && <ActionBtn icon={<Ban size={14}/>}         title="Cancelar OS"  onClick={onCancel}   color="red" />}
      </div>
      <button onClick={onView} className="text-gray-600 hover:text-gray-400 transition-colors ml-1">
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function ActionBtn({ icon, title, onClick, color }: {
  icon: React.ReactNode; title: string; onClick: () => void; color?: 'blue' | 'green' | 'red';
}) {
  return (
    <button onClick={onClick} title={title}
      className={cn(
        'p-1.5 rounded-lg transition-colors',
        color === 'blue'  ? 'text-blue-400 hover:bg-blue-500/20' :
        color === 'green' ? 'text-green-400 hover:bg-green-500/20' :
        color === 'red'   ? 'text-red-400 hover:bg-red-500/20' :
        'text-gray-400 hover:bg-white/10'
      )}>
      {icon}
    </button>
  );
}

// ── ViewPanel ─────────────────────────────────────────────────────────────────
function ViewPanel({ os }: { os: OS }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        <span className={cn('text-xs px-2.5 py-1 rounded-full border font-medium', STATUS_COLOR[os.status])}>{STATUS_LABEL[os.status]}</span>
        <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400">{TYPE_LABEL[os.type]}</span>
        <span className={cn('text-xs font-semibold px-2.5 py-1', PRIORITY_COLOR[os.priority])}>● {os.priority}</span>
      </div>

      <section>
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Identificação</h4>
        <div className="grid grid-cols-2 gap-3">
          <Detail label="Código" value={os.code} />
          <Detail label="Status" value={STATUS_LABEL[os.status]} />
          <Detail label="Tipo"   value={TYPE_LABEL[os.type]} />
          <Detail label="Prioridade" value={os.priority} />
        </div>
      </section>

      <section>
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Descrição</h4>
        <p className="text-sm text-gray-300 leading-relaxed">{os.description}</p>
        {os.observations && <p className="mt-2 text-sm text-gray-400 italic">{os.observations}</p>}
      </section>

      <section>
        <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Datas</h4>
        <div className="grid grid-cols-2 gap-3">
          <Detail label="Abertura"   value={fmtDate(os.openedAt)} />
          <Detail label="Planejada"  value={fmtDate(os.plannedAt)} />
          <Detail label="Início"     value={fmtDate(os.startedAt)} />
          <Detail label="Fechamento" value={fmtDate(os.closedAt)} />
        </div>
      </section>

      {(os.equipmentId || os.operatorId || os.costCenterId || os.operationId) && (
        <section>
          <h4 className="text-xs text-gray-500 uppercase tracking-wider mb-3">Vínculos</h4>
          <div className="grid grid-cols-2 gap-3">
            {os.equipmentId  && <Detail label="Equipamento"   value={os.equipmentId} />}
            {os.operatorId   && <Detail label="Operador"      value={os.operatorId} />}
            {os.costCenterId && <Detail label="Centro Custo"  value={os.costCenterId} />}
            {os.operationId  && <Detail label="Operação"      value={os.operationId} />}
          </div>
        </section>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-sm text-white font-medium">{value || '—'}</p>
    </div>
  );
}

// ── OSForm ────────────────────────────────────────────────────────────────────
function OSForm({ form, setForm, readOnly }: {
  form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>>; readOnly: boolean;
}) {
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const inputCls = "w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed";
  const labelCls = "block text-xs text-gray-400 mb-1.5";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Código *</label>
          <input className={inputCls} value={form.code} onChange={set('code')} disabled={readOnly} placeholder="OS-2026-001" />
        </div>
        <div>
          <label className={labelCls}>Tipo *</label>
          <select className={inputCls} value={form.type} onChange={set('type')} disabled={readOnly}>
            <option value="CORRETIVA">Corretiva</option>
            <option value="PREVENTIVA">Preventiva</option>
            <option value="PREDITIVA">Preditiva</option>
            <option value="INSPECAO">Inspeção</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Prioridade *</label>
          <select className={inputCls} value={form.priority} onChange={set('priority')} disabled={readOnly}>
            <option value="BAIXA">Baixa</option>
            <option value="MEDIA">Média</option>
            <option value="ALTA">Alta</option>
            <option value="CRITICA">Crítica</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Status</label>
          <select className={inputCls} value={form.status} onChange={set('status')} disabled={readOnly}>
            <option value="ABERTA">Aberta</option>
            <option value="EM_ANDAMENTO">Em Andamento</option>
            <option value="PAUSADA">Pausada</option>
            <option value="FINALIZADA">Finalizada</option>
            <option value="CANCELADA">Cancelada</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Descrição *</label>
        <textarea className={inputCls + " resize-none"} rows={3} value={form.description} onChange={set('description')} disabled={readOnly} placeholder="Descreva o problema ou serviço..." />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Data de Abertura</label>
          <input type="datetime-local" className={inputCls} value={form.openedAt} onChange={set('openedAt')} disabled={readOnly} />
        </div>
        <div>
          <label className={labelCls}>Data Planejada</label>
          <input type="datetime-local" className={inputCls} value={form.plannedAt} onChange={set('plannedAt')} disabled={readOnly} />
        </div>
      </div>

      <details className="rounded-lg border border-white/8 overflow-hidden">
        <summary className="px-4 py-2 cursor-pointer text-xs text-gray-400 uppercase tracking-wider hover:text-white">Vínculos (opcional)</summary>
        <div className="px-4 pb-4 pt-2 grid grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>ID Equipamento</label>
            <input className={inputCls} value={form.equipmentId} onChange={set('equipmentId')} disabled={readOnly} placeholder="EQ-001" />
          </div>
          <div>
            <label className={labelCls}>ID Operador</label>
            <input className={inputCls} value={form.operatorId} onChange={set('operatorId')} disabled={readOnly} placeholder="OP-001" />
          </div>
          <div>
            <label className={labelCls}>Centro de Custo</label>
            <input className={inputCls} value={form.costCenterId} onChange={set('costCenterId')} disabled={readOnly} placeholder="CC-AGR-01" />
          </div>
          <div>
            <label className={labelCls}>Operação</label>
            <input className={inputCls} value={form.operationId} onChange={set('operationId')} disabled={readOnly} placeholder="OP-AGR-01" />
          </div>
        </div>
      </details>

      <div>
        <label className={labelCls}>Observações</label>
        <textarea className={inputCls + " resize-none"} rows={2} value={form.observations} onChange={set('observations')} disabled={readOnly} placeholder="Observações adicionais..." />
      </div>
    </div>
  );
}
