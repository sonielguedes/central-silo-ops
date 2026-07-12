"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock, Edit3,
  Download, Filter, Loader2,
  RefreshCw, Search, Square, User, X,
  Clipboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';

// ── Types (local mirror of API response) ─────────────────────────────────────
type FichaStatus =
  | 'EM_ANDAMENTO' | 'PENDENTE' | 'INCONSISTENTE'
  | 'VALIDADO'     | 'ATUALIZADO' | 'EXPORTADO' | 'FINALIZADO';

interface CorrectionEntry {
  id: string;
  sheetId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  correctedBy: string;
  correctedAt: string;
}

interface JourneySummary {
  journeyId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  hourmeterStart: number | null;
  hourmeterEnd: number | null;
  totalHourmeter: number | null;
  operatorRegistration: string | null;
  operatorName: string | null;
  operationCode: string | null;
  operationName: string | null;
  implementCode: string | null;
  implementName: string | null;
  workOrderNumber: string | null;
  costCenterName: string | null;
  stops: StopDiaria[];
  hasJourneyEnd: boolean;
}

interface StopDiaria {
  code: string;
  description: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
}

interface FichaDiaria {
  id: string;
  date: string;
  periodStart: string;
  periodEnd: string;
  tenantId: string;
  fleetCode: string;
  equipmentId: string;
  operatorRegistration: string | null;
  operatorName: string | null;
  operationCode: string | null;
  operationName: string | null;
  implementCode: string | null;
  implementName: string | null;
  workOrderNumber: string | null;
  costCenterName: string | null;
  hourmeterStart: number | null;
  hourmeterCurrent: number | null;
  hourmeterEnd: number | null;
  totalHourmeter: number | null;
  durationMinutes: number | null;
  minutesOperating: number | null;
  minutesStopped: number | null;
  minutesUndetermined: number | null;
  pctUndetermined: number | null;
  startedAt: string | null;
  endedAt: string | null;
  journeys: JourneySummary[];
  stops: StopDiaria[];
  trailSummary: { points: number; firstGpsAt: string | null; lastGpsAt: string | null; distanceKm: number };
  status: FichaStatus;
  finalStatus: FichaStatus;
  inconsistencies: string[];
  // Overlay — validação
  validated: boolean;
  validatedBy: string | null;
  validatedAt: string | null;
  // Overlay — exportação
  exported: boolean;
  exportedAt: string | null;
  exportedBy: string | null;
  exportCount: number;
  needsReexport: boolean;
  modifiedAfterExport: boolean;
  // Overlay — correções
  corrections: CorrectionEntry[];
  correctedFields: Record<string, unknown>;
  eventCount: number;
  isDayOpen: boolean;
}

function hasSheetInconsistency(sheet: Pick<FichaDiaria, 'inconsistencies'>): boolean {
  return Array.isArray(sheet.inconsistencies) && sheet.inconsistencies.length > 0;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const NI = '—';
const fv = (v: unknown): string => (v === null || v === undefined || v === '') ? NI : String(v);

const fmtDate = (v: string | null | undefined): string => {
  if (!v) return NI;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? NI
    : t.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const fmtDT = (v: string | null | undefined): string => {
  if (!v) return NI;
  const t = new Date(v);
  return Number.isNaN(t.getTime()) ? NI
    : t.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const fmtMin = (min: number | null | undefined): string => {
  if (min == null) return NI;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h + 'h' + (m > 0 ? String(m).padStart(2, '0') + 'm' : '');
};

const fmtH = (v: number | null | undefined): string => {
  if (v == null) return NI;
  return (Math.round(v * 100) / 100).toFixed(1).replace('.', ',');
};

// ── Status badge ──────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  EM_ANDAMENTO: { label: 'Em Andamento', cls: 'text-cyan-300   bg-cyan-500/10    border-cyan-500/30'    },
  PENDENTE:     { label: 'Pendente',     cls: 'text-amber-300  bg-amber-500/10   border-amber-500/30'   },
  INCONSISTENTE:{ label: 'Inconsistente',cls: 'text-red-300    bg-red-500/10     border-red-500/30'     },
  FINALIZADO:   { label: 'Finalizado',   cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30' },
  VALIDADO:     { label: 'Validado',     cls: 'text-blue-300   bg-blue-500/10    border-blue-500/20'    },
  ATUALIZADO:   { label: 'Atualizado',   cls: 'text-violet-300 bg-violet-500/10  border-violet-500/30'  },
  EXPORTADO:    { label: 'Exportado',    cls: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, cls: 'text-slate-300 bg-slate-500/10 border-slate-500/20' };
  return (
    <span className={cn('px-2 py-0.5 rounded border text-[8px] font-black uppercase whitespace-nowrap', cfg.cls)}>
      {cfg.label}
    </span>
  );
}

// ── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, cls }: { label: string; value: number | string; cls?: string }) {
  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#0a0e27]/60 p-4 min-w-[110px]">
      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1">{label}</p>
      <p className={cn('text-2xl font-black font-mono', cls ?? 'text-white')}>{value}</p>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'warning'; onClose: () => void }) {
  const cls =
    type === 'success' ? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-300' :
    type === 'error'   ? 'border-red-500/40 bg-red-950/90 text-red-300' :
                         'border-amber-500/40 bg-amber-950/90 text-amber-300';
  const icon =
    type === 'success' ? <CheckCircle2 size={14} className="text-emerald-400 shrink-0" /> :
    type === 'error'   ? <AlertTriangle size={14} className="text-red-400 shrink-0" /> :
                         <AlertTriangle size={14} className="text-amber-400 shrink-0" />;
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-[100] flex items-center gap-3 max-w-[420px] rounded-2xl border px-4 py-3 shadow-2xl backdrop-blur-md',
      cls,
    )}>
      {icon}
      <p className="text-[10px] font-bold flex-1">{message}</p>
      <button onClick={onClose} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"><X size={12} /></button>
    </div>
  );
}

// ── Form Field (used by CorrectionModal) ──────────────────────────────────────
function FormField({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-3 py-2 text-[10px] text-white placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50" />
    </div>
  );
}

// ── Correction Modal ──────────────────────────────────────────────────────────
function CorrectionModal({ ficha, onClose, onSave, loading }: {
  ficha: FichaDiaria;
  onClose: () => void;
  onSave: (updates: Record<string, unknown>, oldValues: Record<string, unknown>, reason: string) => Promise<void>;
  loading: boolean;
}) {
  const [operatorName,          setOperatorName]          = useState(ficha.operatorName          ?? '');
  const [operatorRegistration,  setOperatorRegistration]  = useState(ficha.operatorRegistration  ?? '');
  const [workOrderNumber,       setWorkOrderNumber]        = useState(ficha.workOrderNumber       ?? '');
  const [operationCode,         setOperationCode]          = useState(ficha.operationCode         ?? '');
  const [operationName,         setOperationName]          = useState(ficha.operationName         ?? '');
  const [costCenterName,        setCostCenterName]         = useState(ficha.costCenterName        ?? '');
  const [hourmeterStart,        setHourmeterStart]         = useState(ficha.hourmeterStart != null  ? String(ficha.hourmeterStart)  : '');
  const [hourmeterEnd,          setHourmeterEnd]           = useState(ficha.hourmeterEnd   != null  ? String(ficha.hourmeterEnd)    : '');
  const [reason,                setReason]                 = useState('');
  const [reasonError,           setReasonError]            = useState(false);
  const openJourneys = ficha.journeys.filter(j => !j.hasJourneyEnd);
  const [manualJourneyId, setManualJourneyId] = useState(openJourneys[0]?.journeyId ?? '');
  const [manualEndedAt, setManualEndedAt] = useState('');
  const [manualError, setManualError] = useState('');
  const [manualLoading, setManualLoading] = useState(false);

  const handleManualEnd = async () => {
    if (!manualJourneyId || !manualEndedAt || !reason.trim()) { setManualError('Jornada, encerramento e motivo são obrigatórios.'); return; }
    setManualLoading(true); setManualError('');
    try {
      const response = await fetch(`/api/operacional/fichas/${encodeURIComponent(manualJourneyId)}/correcoes/encerrar`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endedAt: new Date(manualEndedAt).toISOString(), hourmeterEnd: hourmeterEnd.trim() || null, reason }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) { setManualError(body.error ?? 'Falha ao encerrar jornada.'); return; }
      onClose(); window.location.reload();
    } finally { setManualLoading(false); }
  };

  const handleSave = async () => {
    if (!reason.trim()) { setReasonError(true); return; }
    setReasonError(false);

    const updates: Record<string, unknown>   = {};
    const oldValues: Record<string, unknown> = {};

    const diff = (field: string, cur: string | null, orig: string | null) => {
      if ((cur ?? '') !== (orig ?? '')) { updates[field] = cur || null; oldValues[field] = orig; }
    };
    diff('operatorName',         operatorName         || null, ficha.operatorName);
    diff('operatorRegistration', operatorRegistration  || null, ficha.operatorRegistration);
    diff('workOrderNumber',      workOrderNumber       || null, ficha.workOrderNumber);
    diff('operationCode',        operationCode         || null, ficha.operationCode);
    diff('operationName',        operationName         || null, ficha.operationName);
    diff('costCenterName',       costCenterName        || null, ficha.costCenterName);

    const hs = hourmeterStart.trim() ? parseFloat(hourmeterStart) : null;
    if (hs !== ficha.hourmeterStart) { updates.hourmeterStart = hs; oldValues.hourmeterStart = ficha.hourmeterStart; }
    const he = hourmeterEnd.trim()   ? parseFloat(hourmeterEnd)   : null;
    if (he !== ficha.hourmeterEnd)   { updates.hourmeterEnd   = he; oldValues.hourmeterEnd   = ficha.hourmeterEnd;   }

    if (Object.keys(updates).length === 0) { onClose(); return; }
    await onSave(updates, oldValues, reason);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-[540px] max-w-full max-h-[92vh] overflow-y-auto bg-[#050812] border border-[#2d3647] rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#2d3647] flex items-center gap-3 sticky top-0 bg-[#050812] z-10">
          <Edit3 size={15} className="text-amber-400 shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-black text-white uppercase tracking-tight">Correção Manual</h3>
            <p className="text-[9px] text-muted-foreground">Frota {ficha.fleetCode} · {ficha.date}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg border border-[#2d3647] text-muted-foreground hover:text-white hover:bg-[#1a1f3a] transition-all">
            <X size={12} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {ficha.exported && (
            <div className="flex items-start gap-2 bg-amber-950/40 border border-amber-500/30 rounded-xl px-4 py-3">
              <AlertTriangle size={12} className="text-amber-400 shrink-0 mt-0.5" />
              <span className="text-[9px] text-amber-300 font-bold">
                Ficha já exportada — a correção gerará status ATUALIZADO e exigirá nova exportação.
              </span>
            </div>
          )}
          {openJourneys.length > 0 && <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-3">
            <p className="text-[9px] font-black uppercase text-amber-300">Encerrar jornada manualmente</p>
            <p className="text-[9px] text-amber-200/80">Esta ação não apaga eventos. Ela registra uma correção administrativa auditável.</p>
            <select value={manualJourneyId} onChange={e => setManualJourneyId(e.target.value)} className="w-full rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-3 py-2 text-[10px] text-white">{openJourneys.map(j => <option key={j.journeyId ?? j.startedAt} value={j.journeyId ?? ''}>{j.journeyId ?? 'Sem ID'} · {j.startedAt ? fmtDT(j.startedAt) : 'Início ausente'}</option>)}</select>
            <input type="datetime-local" value={manualEndedAt} onChange={e => setManualEndedAt(e.target.value)} className="w-full rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-3 py-2 text-[10px] text-white" />
            {manualError && <p className="text-[9px] text-red-400">{manualError}</p>}
            <button onClick={handleManualEnd} disabled={manualLoading} className="rounded-xl bg-amber-700 px-4 py-2 text-[9px] font-black uppercase text-white disabled:opacity-40">{manualLoading ? 'Encerrando...' : 'Encerrar jornada'}</button>
          </div>}

          {/* Identification */}
          <div>
            <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-3">Operador</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Nome do Operador"  value={operatorName}         onChange={setOperatorName}         />
              <FormField label="Matrícula"          value={operatorRegistration}  onChange={setOperatorRegistration}  />
            </div>
          </div>

          {/* Operations */}
          <div>
            <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-3">Operação</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Código Operação"  value={operationCode}   onChange={setOperationCode}   />
              <FormField label="Nome Operação"    value={operationName}   onChange={setOperationName}   />
              <FormField label="O.S. / Ordem Serv."  value={workOrderNumber}  onChange={setWorkOrderNumber}  />
              <FormField label="Centro de Custo"  value={costCenterName}  onChange={setCostCenterName}  />
            </div>
          </div>

          {/* Hourmeter */}
          <div>
            <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-3">Horímetros</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Horímetro Inicial" value={hourmeterStart} onChange={setHourmeterStart} type="number" placeholder="0.0" />
              <FormField label="Horímetro Final"   value={hourmeterEnd}   onChange={setHourmeterEnd}   type="number" placeholder="0.0" />
            </div>
          </div>

          {/* Reason — mandatory */}
          <div>
            <label className={cn(
              'block text-[8px] font-black uppercase tracking-widest mb-1.5',
              reasonError ? 'text-red-400' : 'text-muted-foreground',
            )}>
              Motivo da Correção *
            </label>
            <textarea
              value={reason}
              onChange={e => { setReason(e.target.value); if (e.target.value.trim()) setReasonError(false); }}
              placeholder="Descreva o motivo da correção (obrigatório)..."
              rows={3}
              className={cn(
                'w-full bg-[#1a1f3a] border rounded-xl px-3 py-2 text-[10px] text-white placeholder:text-muted-foreground/30 focus:outline-none resize-none',
                reasonError ? 'border-red-500/60 focus:border-red-400' : 'border-[#2d3647] focus:border-primary/50',
              )}
            />
            {reasonError && <p className="text-[8px] text-red-400 mt-1">Motivo é obrigatório</p>}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#2d3647] flex items-center justify-end gap-3 sticky bottom-0 bg-[#050812]">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[#2d3647] text-muted-foreground hover:text-white hover:bg-[#1a1f3a] text-[9px] font-black uppercase transition-all">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-amber-700 text-white rounded-xl text-[9px] font-black uppercase hover:bg-amber-600 transition-all disabled:opacity-40">
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Edit3 size={12} />}
            Salvar Correção
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
type DrawerTab = 'resumo' | 'jornadas' | 'paradas' | 'validacao' | 'exportacao' | 'historico';
const DRAWER_TABS: { id: DrawerTab; label: string }[] = [
  { id: 'resumo',     label: 'Resumo'     },
  { id: 'jornadas',   label: 'Jornadas'   },
  { id: 'paradas',    label: 'Paradas'    },
  { id: 'validacao',  label: 'Validação'  },
  { id: 'exportacao', label: 'Exportação' },
  { id: 'historico',  label: 'Correções'  },
];

// ── Detail drawer ─────────────────────────────────────────────────────────────
function DetailDrawer({ ficha, onClose, onValidate, onExport, onCreateIntegrationJob, onCorrect, loading }: {
  ficha: FichaDiaria;
  onClose: () => void;
  onValidate: (f: FichaDiaria) => void;
  onExport: (f: FichaDiaria, format?: 'csv' | 'txt') => void;
  onCreateIntegrationJob: (f: FichaDiaria) => void;
  onCorrect: (f: FichaDiaria) => void;
  loading: boolean;
}) {
  const [tab, setTab] = useState<DrawerTab>('resumo');
  const blocking = ficha.inconsistencies.filter(i => !i.includes('(alerta)'));
  const alerts   = ficha.inconsistencies.filter(i =>  i.includes('(alerta)'));
  const fs = ficha.finalStatus ?? ficha.status;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Drawer */}
      <div className="w-[700px] max-w-full h-full bg-[#050812] border-l border-[#2d3647] flex flex-col shadow-2xl">
        {/* Drawer header */}
        <div className="px-6 py-4 border-b border-[#2d3647]/60 flex items-start gap-3 shrink-0">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-black italic uppercase tracking-tighter text-white">
                Frota {ficha.fleetCode}
              </h3>
              <span className="text-[9px] text-muted-foreground">{fmtDate(ficha.date)}</span>
              <StatusBadge status={fs} />
              {ficha.needsReexport && (
                <span className="text-[8px] text-violet-300 bg-violet-500/10 border border-violet-500/30 rounded px-2 py-0.5 font-black uppercase">
                  Re-exportar
                </span>
              )}
              {ficha.corrections?.length > 0 && (
                <span className="text-[8px] text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5 font-black uppercase">
                  {ficha.corrections.length} correção(ões)
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-muted-foreground flex-wrap">
              <span className="text-[10px]"><User size={8} className="inline mr-1" />{fv(ficha.operatorName)}</span>
              <span className="text-[10px]">Mat: {fv(ficha.operatorRegistration)}</span>
              <span className="text-[10px] font-mono text-primary/60">{ficha.eventCount} eventos</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl border border-[#2d3647] text-muted-foreground hover:text-white hover:bg-[#1a1f3a] transition-all shrink-0">
            <X size={14} />
          </button>
        </div>

        {/* Inconsistency banner */}
        {(blocking.length > 0 || alerts.length > 0) && (
          <div className="px-6 py-2 border-b border-[#2d3647]/30 flex flex-wrap gap-1.5 shrink-0">
            {blocking.map(inc => (
              <span key={inc} className="flex items-center gap-1 bg-red-950/50 border border-red-500/30 rounded-lg px-2 py-0.5 text-[7px] font-black text-red-300 uppercase">
                <AlertTriangle size={7} />{inc}
              </span>
            ))}
            {alerts.map(a => (
              <span key={a} className="flex items-center gap-1 bg-amber-950/40 border border-amber-500/20 rounded-lg px-2 py-0.5 text-[7px] font-black text-amber-300 uppercase">
                <AlertTriangle size={7} />{a}
              </span>
            ))}
          </div>
        )}

        {/* EM_ANDAMENTO warning banner */}
        {fs === 'EM_ANDAMENTO' && (
          <div className="px-6 py-2 border-b border-cyan-500/20 bg-cyan-950/10 shrink-0">
            <p className="text-[9px] text-cyan-300 font-bold flex items-center gap-2">
              <AlertTriangle size={10} /> Jornada em andamento — validação e exportação disponíveis somente após encerramento.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 border-b border-[#2d3647]/50 shrink-0">
          <div className="flex gap-0.5 overflow-x-auto">
            {DRAWER_TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn(
                  'px-4 py-2.5 text-[9px] font-black uppercase tracking-widest border-b-2 whitespace-nowrap transition-all',
                  tab === t.id
                    ? 'text-primary border-primary'
                    : 'text-muted-foreground border-transparent hover:text-white/60',
                )}>{t.label}
                {t.id === 'historico' && ficha.corrections?.length > 0 && (
                  <span className="ml-1 text-[7px] bg-amber-500/20 text-amber-300 rounded-full px-1.5 py-0.5">{ficha.corrections.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {tab === 'resumo'     && <ResumoTab    ficha={ficha} />}
          {tab === 'jornadas'   && <JornadasTab  ficha={ficha} />}
          {tab === 'paradas'    && <ParadasTab   ficha={ficha} />}
          {tab === 'validacao'  && <ValidacaoTab ficha={ficha} />}
          {tab === 'exportacao' && <ExportacaoTab ficha={ficha} onExport={onExport} loading={loading} />}
          {tab === 'historico'  && <HistoricoTab ficha={ficha} />}
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-[#2d3647]/50 shrink-0 flex gap-3 flex-wrap">
          <button onClick={() => onCorrect(ficha)} disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 border border-amber-500/30 bg-amber-500/10 text-amber-300 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all disabled:opacity-40">
            <Edit3 size={12} /> Corrigir
          </button>

          {!ficha.validated && blocking.length === 0 && fs !== 'EM_ANDAMENTO' && fs !== 'EXPORTADO' && (
            <button onClick={() => onValidate(ficha)} disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all disabled:opacity-40">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
              Validar Ficha
            </button>
          )}

          {(fs !== 'INCONSISTENTE' && fs !== 'EM_ANDAMENTO') && (
            <>
              <button onClick={() => onExport(ficha, 'csv')} disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-700 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all disabled:opacity-40">
                <Download size={12} /> {ficha.needsReexport ? 'Re-exportar CSV' : 'Exportar CSV'}
              </button>
              <button onClick={() => onExport(ficha, 'txt')} disabled={loading}
                className="flex items-center gap-2 px-4 py-2.5 border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-40">
                <Download size={12} /> TXT
              </button>
            </>
          )}

          {(fs === 'VALIDADO' || fs === 'EXPORTADO') && (
            <button onClick={() => onCreateIntegrationJob(ficha)} disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 border border-violet-500/30 bg-violet-500/10 text-violet-300 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-violet-500/20 transition-all disabled:opacity-40">
              <ArrowRight size={12} /> Gerar job PIMS
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Drawer tab contents ───────────────────────────────────────────────────────
function FieldRow({ label, value, highlight }: { label: string; value: string; highlight?: 'red' | 'amber' }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-[#2d3647]/30 last:border-0">
      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest shrink-0 w-[140px]">{label}</span>
      <span className={cn(
        'text-[10px] font-bold text-right',
        highlight === 'red'   ? 'text-red-400' :
        highlight === 'amber' ? 'text-amber-400' : 'text-white',
      )}>{value}</span>
    </div>
  );
}

function ResumoTab({ ficha }: { ficha: FichaDiaria }) {
  return (
    <div className="space-y-6">
      <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl p-5">
        <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-3">Identificação</p>
        <FieldRow label="Frota"        value={ficha.fleetCode} />
        <FieldRow label="Data"         value={fmtDate(ficha.date)} />
        <FieldRow label="Período"      value={fmtDT(ficha.periodStart) + ' → ' + fmtDT(ficha.periodEnd)} />
        <FieldRow label="Operador"     value={fv(ficha.operatorName)} />
        <FieldRow label="Matrícula"    value={fv(ficha.operatorRegistration)} />
        <FieldRow label="O.S."         value={fv(ficha.workOrderNumber)} />
        <FieldRow label="Operação"     value={fv(ficha.operationName || ficha.operationCode)} />
        <FieldRow label="Centro Custo" value={fv(ficha.costCenterName)} />
        <FieldRow label="Implemento"   value={fv(ficha.implementName || ficha.implementCode)} />
      </div>
      <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl p-5">
        <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-3">Horímetros</p>
        <FieldRow label="H. Inicial"  value={fmtH(ficha.hourmeterStart)} />
        <FieldRow label="H. Atual"    value={fmtH(ficha.hourmeterCurrent)} />
        <FieldRow label="H. Final"    value={fmtH(ficha.hourmeterEnd)}
          highlight={!ficha.hourmeterEnd && !ficha.isDayOpen ? 'amber' : undefined} />
        <FieldRow label="Total Horas" value={fmtH(ficha.totalHourmeter)} />
      </div>
      <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl p-5">
        <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-3">Tempo</p>
        <FieldRow label="Duração"          value={fmtMin(ficha.durationMinutes)} />
        <FieldRow label="Tempo Operando"   value={fmtMin(ficha.minutesOperating)} />
        <FieldRow label="Tempo Parado"     value={fmtMin(ficha.minutesStopped)} />
        <FieldRow label="Indeterminado"    value={fmtMin(ficha.minutesUndetermined)}
          highlight={ficha.pctUndetermined != null && ficha.pctUndetermined > 50 ? 'amber' : undefined} />
        <FieldRow label="% Indeterminado"  value={ficha.pctUndetermined != null ? ficha.pctUndetermined + '%' : NI} />
        {ficha.pctUndetermined === 100 && <p className="mt-3 text-[9px] text-amber-300">Todo o período está indeterminado porque não há eventos suficientes para classificar tempo trabalhado/parado.</p>}
      </div>
    </div>
  );
}

function JornadasTab({ ficha }: { ficha: FichaDiaria }) {
  if (ficha.journeys.length === 0) {
    return <EmptyState icon={<Clipboard size={24} />} msg="Nenhuma jornada registrada no período" />;
  }
  return (
    <div className="space-y-3">
      {ficha.journeys.map((j, i) => (
        <div key={j.journeyId ?? i} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-black text-primary uppercase tracking-widest">Jornada {i + 1}</span>
            <StatusBadge status={j.hasJourneyEnd ? (j.hourmeterEnd ? 'FINALIZADO' : 'INCONSISTENTE') : 'EM_ANDAMENTO'} />
          </div>
          <FieldRow label="ID da jornada"  value={fv(j.journeyId)} />
          <FieldRow label="Início"      value={fmtDT(j.startedAt)} />
          <FieldRow label="Fim"         value={j.hasJourneyEnd ? fmtDT(j.endedAt) : '(Em andamento)'} />
          <FieldRow label="Operador"    value={fv(j.operatorName)} />
          <FieldRow label="H. Inicial"  value={fmtH(j.hourmeterStart)} />
          <FieldRow label="H. Final"    value={fmtH(j.hourmeterEnd)}
            highlight={j.hasJourneyEnd && !j.hourmeterEnd ? 'red' : undefined} />
          <FieldRow label="Total"       value={fmtH(j.totalHourmeter)} />
        </div>
      ))}
    </div>
  );
}

function ParadasTab({ ficha }: { ficha: FichaDiaria }) {
  if (ficha.stops.length === 0) {
    return <EmptyState icon={<Square size={24} />} msg="Nenhuma parada registrada" />;
  }
  return (
    <div className="space-y-2">
      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-3">
        {ficha.stops.length} parada(s)
      </p>
      {ficha.stops.map((s, i) => (
        <div key={i} className="flex items-start gap-3 bg-[#0a0e27]/60 border border-[#2d3647]/60 rounded-xl px-4 py-3">
          <span className="shrink-0 px-2 py-0.5 rounded text-[8px] font-black border text-amber-300 bg-amber-500/10 border-amber-500/30">{s.code}</span>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold text-white">{s.description || NI}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              {fmtDT(s.startedAt)}{s.endedAt ? ' → ' + fmtDT(s.endedAt) : ' (ativa)'}
              {s.durationMinutes != null ? ' · ' + fmtMin(s.durationMinutes) : ''}
            </p>
          </div>
          <StatusBadge status={s.endedAt ? 'FINALIZADO' : 'EM_ANDAMENTO'} />
        </div>
      ))}
    </div>
  );
}

function ValidacaoTab({ ficha }: { ficha: FichaDiaria }) {
  const blocking = ficha.inconsistencies.filter(i => !i.includes('(alerta)'));
  const alerts   = ficha.inconsistencies.filter(i =>  i.includes('(alerta)'));
  return (
    <div className="space-y-4">
      <div className={cn(
        'rounded-2xl border p-5 flex items-start gap-4',
        blocking.length > 0 ? 'border-red-500/30 bg-red-950/10' : 'border-emerald-500/30 bg-emerald-950/10',
      )}>
        {blocking.length > 0
          ? <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
          : <CheckCircle2 size={20} className="text-emerald-400 shrink-0 mt-0.5" />
        }
        <div>
          <p className={cn('text-sm font-black uppercase', blocking.length > 0 ? 'text-red-300' : 'text-emerald-300')}>
            {blocking.length > 0 ? blocking.length + ' Inconsistência(s) Crítica(s)' : 'Sem Inconsistências Críticas'}
          </p>
          {ficha.validated && (
            <p className="text-[10px] text-emerald-400 mt-1">
              Validado por {ficha.validatedBy ?? 'sistema'} em {fmtDT(ficha.validatedAt)}
            </p>
          )}
        </div>
      </div>
      {blocking.length > 0 && (
        <div className="space-y-1">
          <p className="text-[8px] font-black text-red-400 uppercase tracking-widest mb-2">Bloqueantes</p>
          {blocking.map(inc => (
            <div key={inc} className="flex items-center gap-2 bg-red-950/30 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertTriangle size={8} className="text-red-400 shrink-0" />
              <span className="text-[9px] font-bold text-red-300 uppercase">{inc}</span>
            </div>
          ))}
        </div>
      )}
      {alerts.length > 0 && (
        <div className="space-y-1">
          <p className="text-[8px] font-black text-amber-400 uppercase tracking-widest mb-2">Alertas</p>
          {alerts.map(a => (
            <div key={a} className="flex items-center gap-2 bg-amber-950/20 border border-amber-500/15 rounded-lg px-3 py-2">
              <AlertTriangle size={8} className="text-amber-400 shrink-0" />
              <span className="text-[9px] font-bold text-amber-300 uppercase">{a}</span>
            </div>
          ))}
        </div>
      )}
      <div className="rounded-xl border border-[#2d3647] bg-[#0a0e27]/60 p-4">
        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-2">GPS / Rastro</p>
        <FieldRow label="Pontos GPS"  value={String(ficha.trailSummary.points)} />
        <FieldRow label="Distância"   value={ficha.trailSummary.distanceKm + ' km'} />
        <FieldRow label="Eventos"     value={String(ficha.eventCount)} />
        <FieldRow label="Jornadas"    value={String(ficha.journeys.length)} />
      </div>
    </div>
  );
}

function ExportacaoTab({ ficha, onExport, loading }: {
  ficha: FichaDiaria;
  onExport: (f: FichaDiaria, format?: 'csv' | 'txt') => void;
  loading: boolean;
}) {
  const fs = ficha.finalStatus ?? ficha.status;
  const canExport = fs !== 'INCONSISTENTE' && fs !== 'EM_ANDAMENTO';
  return (
    <div className="space-y-5">
      {/* Status panel */}
      <div className={cn(
        'rounded-2xl border p-5',
        fs === 'EXPORTADO'     ? 'border-emerald-500/30 bg-emerald-950/10' :
        fs === 'ATUALIZADO'    ? 'border-violet-500/30  bg-violet-950/10'  :
        fs === 'INCONSISTENTE' ? 'border-red-500/30     bg-red-950/10'     :
        'border-[#2d3647] bg-[#0a0e27]/40',
      )}>
        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-3">Status de Exportação</p>
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={fs} />
          {fs === 'ATUALIZADO'    && <span className="text-[9px] text-violet-300">Ficha alterada após exportação — re-exportar</span>}
          {fs === 'INCONSISTENTE' && <span className="text-[9px] text-red-300">Exportação bloqueada — inconsistências críticas</span>}
          {fs === 'EM_ANDAMENTO'  && <span className="text-[9px] text-cyan-300">Exportação disponível após encerramento da jornada</span>}
          {ficha.needsReexport    && <span className="text-[9px] text-violet-400 font-bold">Re-exportação recomendada</span>}
        </div>
        {ficha.exported && (
          <div className="mt-3 pt-3 border-t border-[#2d3647]/40 text-[9px] text-muted-foreground space-y-1">
            <p>Exportado por <span className="text-white">{ficha.exportedBy ?? 'sistema'}</span></p>
            <p>Em <span className="text-white">{fmtDT(ficha.exportedAt)}</span></p>
            <p>Total de exportações: <span className="text-emerald-400 font-bold">{ficha.exportCount}</span></p>
          </div>
        )}
      </div>

      {/* Ficha summary */}
      <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl p-5">
        <p className="text-[8px] font-black text-primary uppercase tracking-widest mb-3">Resumo da Ficha (47 colunas)</p>
        <FieldRow label="Frota"        value={ficha.fleetCode} />
        <FieldRow label="Data"         value={ficha.date} />
        <FieldRow label="Operador"     value={fv(ficha.operatorName)} />
        <FieldRow label="Matrícula"    value={fv(ficha.operatorRegistration)} />
        <FieldRow label="O.S."         value={fv(ficha.workOrderNumber)} />
        <FieldRow label="Operação"     value={fv(ficha.operationName || ficha.operationCode)} />
        <FieldRow label="H. Inicial"   value={fmtH(ficha.hourmeterStart)} />
        <FieldRow label="H. Final"     value={fmtH(ficha.hourmeterEnd)} />
        <FieldRow label="Total Hrs"    value={fmtH(ficha.totalHourmeter)} />
        <FieldRow label="Pontos GPS"   value={String(ficha.trailSummary.points)} />
        <FieldRow label="Paradas"      value={String(ficha.stops.length)} />
        <FieldRow label="Inconsistências" value={ficha.inconsistencies.length > 0 ? ficha.inconsistencies.join(', ') : 'Nenhuma'} />
      </div>

      {/* Export buttons */}
      {canExport ? (
        <div className="flex gap-3">
          <button onClick={() => onExport(ficha, 'csv')} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-700/20 disabled:opacity-40">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {ficha.needsReexport ? 'Re-exportar CSV' : 'Exportar CSV'}
          </button>
          <button onClick={() => onExport(ficha, 'txt')} disabled={loading}
            className="flex items-center justify-center gap-2 px-5 py-3 border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all disabled:opacity-40">
            <Download size={14} /> TXT
          </button>
        </div>
      ) : (
        <div className="w-full flex items-center justify-center gap-2 px-5 py-3 border border-[#2d3647] rounded-2xl text-[10px] font-black uppercase text-muted-foreground cursor-not-allowed opacity-50">
          <Download size={14} /> Exportação bloqueada
        </div>
      )}
    </div>
  );
}

function HistoricoTab({ ficha }: { ficha: FichaDiaria }) {
  if (!ficha.corrections || ficha.corrections.length === 0) {
    return <EmptyState icon={<Clock size={24} />} msg="Nenhuma correção manual registrada." />;
  }
  const sorted = [...ficha.corrections].reverse();
  return (
    <div className="space-y-3">
      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-3">
        {ficha.corrections.length} correção(ões) registrada(s)
      </p>
      {sorted.map(c => (
        <div key={c.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[8px] font-black text-amber-300 uppercase bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5">
              {c.field}
            </span>
            <span className="text-[8px] text-muted-foreground">{fmtDT(c.correctedAt)}</span>
          </div>
          <div className="flex items-center gap-2 text-[9px] mb-2">
            <span className="text-red-400 line-through">{String(c.oldValue ?? NI)}</span>
            <span className="text-muted-foreground">→</span>
            <span className="text-emerald-400 font-bold">{String(c.newValue ?? NI)}</span>
          </div>
          <p className="text-[9px] text-white/70 italic">&ldquo;{c.reason}&rdquo;</p>
          <p className="text-[8px] text-muted-foreground mt-1.5">por {c.correctedBy}</p>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, msg }: { icon: React.ReactNode; msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
      <div className="text-primary/30">{icon}</div>
      <p className="text-[10px] font-bold uppercase text-center">{msg}</p>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
function FichaOperadorPage() {
  const today = new Date().toISOString().slice(0, 10);

  const [date,             setDate]             = useState(today);
  const [fichas,           setFichas]           = useState<FichaDiaria[]>([]);
  const [loading,          setLoading]          = useState(false);
  const [actionLoad,       setActionLoad]       = useState(false);
  const [error,            setError]            = useState<string | null>(null);
  const [selected,         setSelected]         = useState<Set<string>>(new Set());
  const [detail,           setDetail]           = useState<FichaDiaria | null>(null);
  const [filtersOpen,      setFiltersOpen]      = useState(false);
  const [correctionTarget, setCorrectionTarget] = useState<FichaDiaria | null>(null);
  const [toast,            setToast]            = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Filters
  const [fFleet,    setFFleet]    = useState('');
  const [fOperator, setFOperator] = useState('');
  const [fStatus,   setFStatus]   = useState('');
  const [fOnlyInc,  setFOnlyInc]  = useState(false);
  const [fOnlyPend, setFOnlyPend] = useState(false);
  const [fOnlyExp,  setFOnlyExp]  = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const fetchFichas = useCallback(async (d: string) => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch('/api/ficha-operador?date=' + d, { cache: 'no-store' });
      const data = res.ok ? await res.json() : [];
      setFichas(Array.isArray(data) ? data : []);
      setSelected(new Set());
    } catch {
      setError('Falha ao carregar fichas');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFichas(date); }, [date, fetchFichas]);

  // Filtered list
  const filtered = useMemo(() => {
    return fichas.filter(f => {
      const fs = (f.finalStatus ?? f.status) as string;
      if (fFleet    && !f.fleetCode.toLowerCase().includes(fFleet.toLowerCase())) return false;
      if (fOperator && !(f.operatorName ?? '').toLowerCase().includes(fOperator.toLowerCase())
                    && !(f.operatorRegistration ?? '').includes(fOperator)) return false;
      if (fStatus   && fs !== fStatus) return false;
      if (fOnlyInc  && fs !== 'INCONSISTENTE') return false;
      if (fOnlyPend && fs !== 'PENDENTE') return false;
      if (fOnlyExp  && fs !== 'EXPORTADO') return false;
      return true;
    });
  }, [fichas, fFleet, fOperator, fStatus, fOnlyInc, fOnlyPend, fOnlyExp]);

  // KPIs
  const kpis = useMemo(() => {
    const count  = (s: string) => fichas.filter(f => (f.finalStatus ?? f.status) === s).length;
    return {
      total:          fichas.length,
      emAndamento:    count('EM_ANDAMENTO'),
      pendentes:      count('PENDENTE'),
      inconsistentes: fichas.filter(hasSheetInconsistency).length,
      validados:      count('VALIDADO'),
      exportados:     count('EXPORTADO'),
      atualizados:    count('ATUALIZADO'),
    };
  }, [fichas]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(f => f.id)));
  };

  const handleValidate = useCallback(async (ficha: FichaDiaria) => {
    setActionLoad(true);
    try {
      const res = await fetch('/api/ficha-operador', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate', fleetCode: ficha.fleetCode, date: ficha.date, actor: 'usuario' }),
      });
      const data = await res.json() as Record<string, unknown>;
      if (res.status === 422) {
        if (data.warning === 'EM_ANDAMENTO') {
          showToast('Jornada em andamento — aguarde o encerramento para validar.', 'warning');
        } else if (Array.isArray(data.blocking)) {
          showToast('Inconsistências críticas impedem validação: ' + (data.blocking as string[]).slice(0, 3).join(', '), 'error');
        } else {
          showToast(String(data.message ?? data.error ?? 'Validação bloqueada'), 'error');
        }
        return;
      }
      if (!res.ok) { showToast('Erro ao validar ficha', 'error'); return; }
      showToast('Ficha validada com sucesso!', 'success');
      await fetchFichas(date);
      if (detail?.id === ficha.id) setDetail(null);
    } finally {
      setActionLoad(false);
    }
  }, [date, fetchFichas, detail, showToast]);

  const downloadExport = useCallback(async (
    payload: { date: string; format: 'csv' | 'txt'; sheetIds: string[]; markAsExported: boolean; fleetCode?: string | null },
  ) => {
    setActionLoad(true);
    try {
      const res = await fetch('/api/ficha-operador/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.status === 422) {
        const data = await res.json() as Record<string, unknown>;
        const blocked = Array.isArray(data.blocked) ? data.blocked as { reasons?: string[] }[] : [];
        const reasons = [
          ...(Array.isArray(data.blockingReasons) ? data.blockingReasons as string[] : []),
          ...blocked.flatMap(b => Array.isArray(b.reasons) ? b.reasons : []),
        ];
        showToast(reasons.length > 0 ? reasons.join(' | ') : String(data.error ?? 'Exportação bloqueada'), 'error');
        return false;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        showToast(String(data.error ?? 'Erro ao exportar ficha'), 'error');
        return false;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = res.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1] ?? 'ficha-operador.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      await fetchFichas(date);
      showToast('Ficha exportada com sucesso!', 'success');
      return true;
    } finally {
      setActionLoad(false);
    }
  }, [date, fetchFichas, showToast]);

  const handleExport = useCallback((ficha: FichaDiaria, format: 'csv' | 'txt' = 'csv') => {
    const fs = (ficha.finalStatus ?? ficha.status) as string;
    if (fs === 'INCONSISTENTE') {
      showToast('Exportação bloqueada: inconsistências críticas.', 'error');
      return;
    }
    if (fs === 'EM_ANDAMENTO') {
      showToast('Ficha ainda em andamento. Aguarde o fechamento da jornada ou do dia operacional.', 'warning');
      return;
    }
    const markAsExported = fs !== 'EXPORTADO' || ficha.needsReexport;
    void downloadExport({
      date: ficha.date,
      format,
      sheetIds: [ficha.id],
      markAsExported,
      fleetCode: ficha.fleetCode,
    });
  }, [downloadExport, showToast]);

  const handleCreateIntegrationJob = useCallback(async (ficha: FichaDiaria) => {
    const fs = (ficha.finalStatus ?? ficha.status) as string;
    if (fs !== 'VALIDADO' && fs !== 'EXPORTADO') {
      showToast('Job bloqueado: somente fichas VALIDADO ou EXPORTADO podem integrar.', 'warning');
      return;
    }

    setActionLoad(true);
    try {
      const res = await fetch('/api/integrations/export-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fleetCode: ficha.fleetCode,
          date: ficha.date,
          targetSystem: 'PIMS',
          targetAdapter: 'PIMS_FILE',
          createdBy: 'usuario',
        }),
      });
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        showToast(String(data.error ?? 'Falha ao gerar job de integração'), 'error');
        return;
      }
      showToast(String(data.duplicated ? 'Job duplicado reaproveitado.' : 'Job de integração gerado com sucesso!'), 'success');
    } finally {
      setActionLoad(false);
    }
  }, [showToast]);

  const handleCorrect = useCallback(async (
    ficha: FichaDiaria,
    updates: Record<string, unknown>,
    oldValues: Record<string, unknown>,
    reason: string,
  ) => {
    setActionLoad(true);
    try {
      const res = await fetch('/api/ficha-operador', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'correct',
          fleetCode: ficha.fleetCode,
          date: ficha.date,
          actor: 'usuario',
          updates, oldValues, reason,
        }),
      });
      if (!res.ok) {
        const data = await res.json() as Record<string, unknown>;
        showToast(String(data.error ?? 'Erro ao salvar correção'), 'error');
        return;
      }
      showToast('Correção salva com sucesso!', 'success');
      setCorrectionTarget(null);
      await fetchFichas(date);
      if (detail?.fleetCode === ficha.fleetCode && detail?.date === ficha.date) setDetail(null);
    } finally {
      setActionLoad(false);
    }
  }, [date, fetchFichas, detail, showToast]);

  const handleExportSelected = (format: 'csv' | 'txt' = 'csv') => {
    const selectedFichas = filtered.filter(f => selected.has(f.id));
    if (selectedFichas.length === 0) {
      showToast('Selecione ao menos uma ficha para exportar.', 'warning');
      return;
    }
    void downloadExport({
      date,
      format,
      sheetIds: selectedFichas.map(f => f.id),
      markAsExported: selectedFichas.some(f => (f.finalStatus ?? f.status) !== 'EXPORTADO' || f.needsReexport),
    });
  };

  const handleValidateSelected = async () => {
    const selectedFichas = filtered.filter(f => selected.has(f.id));
    for (const f of selectedFichas) await handleValidate(f);
  };

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

          {/* ── Top bar ──────────────────────────────────────────────────────── */}
          <div className="px-6 py-3 border-b border-[#2d3647]/50 flex items-center gap-3 flex-wrap shrink-0 bg-[#050812]/80">
            <div className="flex items-center gap-2">
              <Clipboard size={14} className="text-primary" />
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">Ficha do Operador</span>
            </div>

            {/* Date picker */}
            <div className="flex items-center gap-2">
              <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Data</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-3 py-1.5 text-[10px] text-white focus:outline-none focus:border-primary/50"
              />
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button onClick={() => setFiltersOpen(v => !v)}
                className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[9px] font-black uppercase transition-all',
                  filtersOpen ? 'bg-primary/10 border-primary/40 text-primary' : 'border-[#2d3647] text-muted-foreground hover:text-white hover:bg-[#1a1f3a]')}>
                <Filter size={11} />{filtersOpen ? 'Ocultar' : 'Filtros'}
              </button>
              {selected.size > 0 && (
                <>
                  <button onClick={handleValidateSelected} disabled={actionLoad}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-700 text-white text-[9px] font-black uppercase hover:bg-blue-600 transition-all disabled:opacity-40">
                    <CheckCircle2 size={11} /> Validar ({selected.size})
                  </button>
                  <button onClick={() => handleExportSelected('csv')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 text-white text-[9px] font-black uppercase hover:bg-emerald-600 transition-all">
                    <Download size={11} /> CSV ({selected.size})
                  </button>
                  <button onClick={() => handleExportSelected('txt')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-[9px] font-black uppercase hover:bg-emerald-500/20 transition-all">
                    <Download size={11} /> TXT ({selected.size})
                  </button>
                </>
              )}
              <button onClick={() => fetchFichas(date)} disabled={loading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#2d3647] text-muted-foreground hover:text-white hover:bg-[#1a1f3a] transition-all text-[9px] font-black uppercase disabled:opacity-40">
                <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Atualizar
              </button>
            </div>
          </div>

          {/* ── Filters panel ────────────────────────────────────────────────── */}
          {filtersOpen && (
            <div className="px-6 py-3 border-b border-[#2d3647]/30 bg-[#0a0e27]/40 flex flex-wrap gap-3 items-end shrink-0">
              <FilterInput label="Frota"    value={fFleet}    onChange={setFFleet}    placeholder="2026..." />
              <FilterInput label="Operador" value={fOperator} onChange={setFOperator} placeholder="Nome ou mat..." />
              <div className="flex flex-col gap-1">
                <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Status</label>
                <select value={fStatus} onChange={e => setFStatus(e.target.value)}
                  className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-3 py-1.5 text-[10px] text-white focus:outline-none w-[140px]">
                  <option value="">Todos</option>
                  {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-4 pb-0.5">
                <CheckboxFilter label="Só inconsistentes" checked={fOnlyInc}  onChange={setFOnlyInc} />
                <CheckboxFilter label="Só pendentes"      checked={fOnlyPend} onChange={setFOnlyPend} />
                <CheckboxFilter label="Só exportados"     checked={fOnlyExp}  onChange={setFOnlyExp} />
              </div>
              <button onClick={() => { setFFleet(''); setFOperator(''); setFStatus(''); setFOnlyInc(false); setFOnlyPend(false); setFOnlyExp(false); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[#2d3647] text-muted-foreground hover:text-white text-[9px] font-black uppercase transition-all">
                <X size={10} /> Limpar
              </button>
            </div>
          )}

          {/* ── KPI cards ────────────────────────────────────────────────────── */}
          <div className="px-6 py-3 border-b border-[#2d3647]/30 flex gap-3 overflow-x-auto shrink-0">
            <KpiCard label="Total"        value={kpis.total} />
            <KpiCard label="Em Andamento" value={kpis.emAndamento}    cls="text-cyan-400" />
            <KpiCard label="Pendentes"    value={kpis.pendentes}      cls="text-amber-400" />
            <KpiCard label="Inconsis."    value={kpis.inconsistentes} cls="text-red-400" />
            <KpiCard label="Validados"    value={kpis.validados}      cls="text-blue-400" />
            <KpiCard label="Exportados"   value={kpis.exportados}     cls="text-emerald-400" />
            <KpiCard label="Atualizados"  value={kpis.atualizados}    cls="text-violet-400" />
          </div>

          {/* ── Table ────────────────────────────────────────────────────────── */}
          <div className="flex-1 overflow-auto custom-scrollbar">
            {error && (
              <div className="m-6 flex items-center gap-3 bg-red-950/40 border border-red-500/30 rounded-2xl px-5 py-3">
                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                <span className="text-[11px] font-bold text-red-300">{error}</span>
              </div>
            )}
            {loading && fichas.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 size={32} className="animate-spin text-primary" />
                <p className="text-[10px] font-bold uppercase text-muted-foreground">Carregando fichas...</p>
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-muted-foreground">
                <Clipboard size={40} className="text-primary/20" />
                <div className="text-center">
                  <p className="text-[11px] font-black uppercase text-white/40 tracking-widest">Sem fichas para {date}</p>
                  <p className="text-[9px] text-muted-foreground/50 mt-1">Nenhum evento recebido das frotas nesta data</p>
                </div>
              </div>
            )}
            {filtered.length > 0 && (
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#050812]/95 border-b border-[#2d3647]">
                    <Th>
                      <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                        onChange={toggleAll}
                        className="rounded border-[#2d3647] bg-[#1a1f3a] accent-primary" />
                    </Th>
                    <Th>Data</Th>
                    <Th>Frota</Th>
                    <Th>Operador</Th>
                    <Th>Matrícula</Th>
                    <Th>O.S.</Th>
                    <Th>Operação</Th>
                    <Th>C. Custo</Th>
                    <Th>Implemento</Th>
                    <Th>H. Inicial</Th>
                    <Th>H. Atual</Th>
                    <Th>H. Final</Th>
                    <Th>Total Hrs</Th>
                    <Th>T. Parado</Th>
                    <Th>Indeterm.</Th>
                    <Th>% Indet.</Th>
                    <Th>Status</Th>
                    <Th>Inconsistência</Th>
                    <Th>Ações</Th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(f => {
                    const fs = (f.finalStatus ?? f.status) as string;
                    const isSelected = selected.has(f.id);
                    const blocking = f.inconsistencies.filter(i => !i.includes('(alerta)'));
                    return (
                      <tr key={f.id}
                        className={cn(
                          'border-b border-[#2d3647]/30 transition-colors hover:bg-[#1a1f3a]/30',
                          isSelected && 'bg-primary/5',
                        )}
                      >
                        <Td>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(f.id)}
                            className="rounded border-[#2d3647] bg-[#1a1f3a] accent-primary" />
                        </Td>
                        <Td>{fmtDate(f.date)}</Td>
                        <Td><span className="font-black italic text-white">{f.fleetCode}</span></Td>
                        <Td>{fv(f.operatorName)}</Td>
                        <Td>{fv(f.operatorRegistration)}</Td>
                        <Td>{fv(f.workOrderNumber)}</Td>
                        <Td>{fv(f.operationName || f.operationCode)}</Td>
                        <Td>{fv(f.costCenterName)}</Td>
                        <Td>{fv(f.implementName || f.implementCode)}</Td>
                        <Td cls="font-mono text-primary">{fmtH(f.hourmeterStart)}</Td>
                        <Td cls="font-mono">{fmtH(f.hourmeterCurrent)}</Td>
                        <Td cls="font-mono">{fmtH(f.hourmeterEnd)}</Td>
                        <Td cls="font-mono text-emerald-400">{fmtH(f.totalHourmeter)}</Td>
                        <Td>{fmtMin(f.minutesStopped)}</Td>
                        <Td cls={f.pctUndetermined != null && f.pctUndetermined > 50 ? 'text-amber-400' : ''}>{fmtMin(f.minutesUndetermined)}</Td>
                        <Td cls={f.pctUndetermined != null && f.pctUndetermined > 50 ? 'text-amber-400 font-bold' : ''}>{f.pctUndetermined != null ? f.pctUndetermined + '%' : NI}</Td>
                        <Td>
                          <div className="flex items-center gap-1 flex-col">
                            <StatusBadge status={fs} />
                            {f.needsReexport && <span className="text-[7px] text-violet-400 font-bold">re-exportar</span>}
                          </div>
                        </Td>
                        <Td>
                          {blocking.length > 0 ? (
                            <span className="flex items-center gap-1 text-[8px] font-bold text-red-400 uppercase">
                              <AlertTriangle size={8} className="shrink-0" />
                              {blocking[0].replace(' (alerta)', '')}
                              {blocking.length > 1 && <span className="text-red-500">+{blocking.length - 1}</span>}
                            </span>
                          ) : (
                            <span className="text-[8px] text-emerald-500 font-bold">OK</span>
                          )}
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1">
                            <button onClick={() => setDetail(f)}
                              className="px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[8px] font-black uppercase hover:bg-primary/20 transition-all whitespace-nowrap">
                              Detalhes
                            </button>
                            <button onClick={() => setCorrectionTarget(f)}
                              className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[8px] font-black uppercase hover:bg-amber-500/20 transition-all whitespace-nowrap">
                              <Edit3 size={9} />
                            </button>
                            <button onClick={() => handleExport(f)}
                              className="p-1 rounded-lg border border-[#2d3647] text-muted-foreground hover:text-white hover:bg-[#1a1f3a] transition-all">
                              <Download size={10} />
                            </button>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Detail Drawer */}
      {detail && (
        <DetailDrawer
          ficha={detail}
          onClose={() => setDetail(null)}
          onValidate={handleValidate}
          onExport={handleExport}
          onCreateIntegrationJob={handleCreateIntegrationJob}
          onCorrect={(f) => { setDetail(null); setCorrectionTarget(f); }}
          loading={actionLoad}
        />
      )}

      {/* Correction Modal */}
      {correctionTarget && (
        <CorrectionModal
          ficha={correctionTarget}
          onClose={() => setCorrectionTarget(null)}
          onSave={(updates, oldValues, reason) =>
            handleCorrect(correctionTarget, updates, oldValues, reason)
          }
          loading={actionLoad}
        />
      )}

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}

// ── Table helpers ─────────────────────────────────────────────────────────────
function Th({ children, cls }: { children: React.ReactNode; cls?: string }) {
  return (
    <th className={cn('px-3 py-2.5 text-[7px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap', cls)}>
      {children}
    </th>
  );
}

function Td({ children, cls }: { children: React.ReactNode; cls?: string }) {
  return (
    <td className={cn('px-3 py-2.5 text-[9px] text-white/80 whitespace-nowrap', cls)}>
      {children}
    </td>
  );
}

function FilterInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{label}</label>
      <div className="relative">
        <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
          className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl py-1.5 pl-7 pr-3 text-[10px] text-white placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/50 w-[140px]" />
      </div>
    </div>
  );
}

function CheckboxFilter({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="rounded border-[#2d3647] bg-[#1a1f3a] accent-primary" />
      <span className="text-[9px] font-bold text-muted-foreground uppercase">{label}</span>
    </label>
  );
}

export default withAuth(FichaOperadorPage, { module: 'FICHA_OPERADOR' });
