"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import {
  Activity, AlertTriangle, CheckCircle2, ChevronRight,
  Clock, Download, FileText, Hash, Loader2, MapPin,
  RefreshCw, Route, Search, Tractor, User, WifiOff,
  XCircle, Play, Square,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';
import type { EquipmentLiveState } from '@/lib/types';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type FichaStatus = 'PENDENTE' | 'EXPORTADO' | 'INCONSISTENTE';
type TabId = 'geral' | 'operacional' | 'paradas' | 'rastro' | 'exportacao';

interface StopEntry {
  code: string;
  description: string;
  startedAt: string;
  endedAt?: string;
}

interface FichaOperador {
  journeyId: string | null;
  fleetCode: string;
  equipmentId: string;
  operatorRegistration: string | null;
  operatorName: string | null;
  operationCode: string | null;
  operationName: string | null;
  implementCode: string | null;
  implementName: string | null;
  hourmeterStart: number | null;
  hourmeterEnd: number | null;
  totalHourmeter: number | null;
  startedAt: string | null;
  endedAt: string | null;
  stops: StopEntry[];
  trailSummary: {
    points: number;
    firstGpsAt: string | null;
    lastGpsAt: string | null;
    distanceKm: number;
  };
  status: FichaStatus;
  inconsistencies: string[];
}

type FleetRow = EquipmentLiveState;

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const NI = 'â€”';
const fv = (v: unknown): string =>
  v === null || v === undefined || v === '' ? NI : String(v);

const fmtDT = (v: string | null | undefined): string => {
  if (!v) return NI;
  const t = new Date(v);
  return Number.isNaN(t.getTime())
    ? NI
    : t.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit',
      });
};

const fmtTime = (v: string | null | undefined): string => {
  if (!v) return NI;
  const t = new Date(v);
  return Number.isNaN(t.getTime())
    ? NI
    : t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const gpsAgeStr = (ts: string | null | undefined): string => {
  if (!ts) return 'Sem sinal';
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1)  return 'Agora';
  if (mins < 60) return mins + 'min';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h + 'h' + (m > 0 ? m + 'm' : '');
};

const STATUS_COLOR: Record<string, string> = {
  ONLINE:      'bg-emerald-500',
  OFFLINE:     'bg-slate-500',
  PARADO:      'bg-amber-500',
  FINALIZADO:  'bg-blue-500',
  DESLOCAMENTO:'bg-cyan-500',
};

const FICHA_BADGE: Record<FichaStatus, string> = {
  PENDENTE:      'text-amber-300 bg-amber-500/10 border-amber-500/30',
  INCONSISTENTE: 'text-red-300  bg-red-500/10  border-red-500/30',
  EXPORTADO:     'text-blue-300 bg-blue-500/10 border-blue-500/30',
};

function deriveFleetFichaStatus(r: FleetRow): FichaStatus {
  const hasOp = !!(r.operatorName || r.operatorRegistration || (r as unknown as Record<string,unknown>).currentOperator);
  const hasH  = (r.hourmeterStart ?? 0) > 0;
  if (!hasOp || !hasH) return 'INCONSISTENTE';
  if (r.status === 'OFFLINE' || r.status === 'FINALIZADO') return 'EXPORTADO';
  return 'PENDENTE';
}

// â”€â”€ TABS config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'geral',       label: 'Geral',       icon: <User      size={12} /> },
  { id: 'operacional', label: 'Operacional', icon: <Activity  size={12} /> },
  { id: 'paradas',     label: 'Paradas',     icon: <Square    size={12} /> },
  { id: 'rastro',      label: 'Rastro',      icon: <Route     size={12} /> },
  { id: 'exportacao',  label: 'ExportaÃ§Ã£o',  icon: <Download  size={12} /> },
];

// â”€â”€ Left sidebar â€” fleet list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function FleetSidebar({
  fleet, loading, selected, search, onSearch, onSelect, onRefresh, lastAt,
}: {
  fleet: FleetRow[];
  loading: boolean;
  selected: string | null;
  search: string;
  onSearch: (v: string) => void;
  onSelect: (fc: string, jid?: string) => void;
  onRefresh: () => void;
  lastAt: Date | null;
}) {
  const filtered = fleet.filter(r =>
    !search ||
    r.fleetCode?.toLowerCase().includes(search.toLowerCase()) ||
    (r.operatorName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="w-[300px] shrink-0 flex flex-col border-r border-[#2d3647]/60 bg-[#050812]/80 h-full">
      {/* sidebar header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#2d3647]/50 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black text-primary uppercase tracking-[0.3em]">Frota Ativa</p>
            <p className="text-[11px] font-bold text-white/60">{fleet.length} equipamentos</p>
          </div>
          <button
            onClick={onRefresh}
            title="Atualizar"
            className="p-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-primary hover:bg-[#252d4a] transition-all"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        {/* search */}
        <div className="relative">
          <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Frota ou operador..."
            className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl py-2 pl-8 pr-3 text-[11px] text-white placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/50"
          />
        </div>
        {lastAt && (
          <p className="text-[8px] text-muted-foreground/50 uppercase font-bold">
            Sync {lastAt.toLocaleTimeString('pt-BR')}
          </p>
        )}
      </div>

      {/* fleet cards */}
      <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
        {loading && (
          <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[10px] font-bold uppercase">Carregando...</span>
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <WifiOff size={20} />
            <span className="text-[10px] font-bold uppercase">Nenhuma frota</span>
          </div>
        )}
        {!loading && filtered.map(r => (
          <FleetCard
            key={r.equipmentId}
            row={r}
            isSelected={selected === r.fleetCode}
            onSelect={() => onSelect(r.fleetCode, r.journeyId ?? undefined)}
          />
        ))}
      </div>
    </div>
  );
}

function FleetCard({
  row: r, isSelected, onSelect,
}: {
  row: FleetRow;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const statusColor = STATUS_COLOR[r.status ?? ''] ?? 'bg-slate-600';
  const fichaStatus = deriveFleetFichaStatus(r);
  const opName = (r.operatorName || (r as unknown as Record<string,unknown>).currentOperator as string) ?? null;
  const age = gpsAgeStr(r.lastGpsAt);
  const hasAlert = fichaStatus === 'INCONSISTENTE';

  return (
    <button
      onClick={onSelect}
      className={cn(
        'w-full text-left px-3 py-2.5 mx-2 mb-1 rounded-xl border transition-all flex items-stretch gap-3 group',
        'w-[calc(100%-16px)]',
        isSelected
          ? 'bg-primary/10 border-primary/40 shadow-lg shadow-primary/10'
          : 'bg-[#0a0e27]/40 border-[#2d3647]/40 hover:bg-[#1a1f3a]/60 hover:border-[#2d3647]',
      )}
    >
      {/* status strip */}
      <div className={cn('w-0.5 rounded-full shrink-0 self-stretch', statusColor)} />

      {/* content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center justify-between gap-1">
          <span className="text-sm font-black italic text-white tracking-tighter leading-none">{r.fleetCode}</span>
          {hasAlert && <AlertTriangle size={10} className="text-red-400 shrink-0" />}
          <ChevronRight size={10} className={cn('text-muted-foreground shrink-0 transition-transform', isSelected && 'rotate-90 text-primary')} />
        </div>
        {opName && (
          <p className="text-[10px] font-bold text-white/60 uppercase truncate leading-none">{opName}</p>
        )}
        {!!(r as unknown as Record<string,unknown>).implementName && (
          <p className="text-[9px] text-muted-foreground/60 truncate leading-none">
            {String((r as unknown as Record<string,unknown>).implementName)}
          </p>
        )}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          <span className={cn(
            'text-[7px] font-black uppercase px-1.5 py-0.5 rounded border',
            r.status === 'ONLINE'     ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' :
            r.status === 'OFFLINE'    ? 'text-slate-400  bg-slate-500/10  border-slate-500/20'  :
            r.status === 'PARADO'     ? 'text-amber-300  bg-amber-500/10  border-amber-500/20'  :
            r.status === 'FINALIZADO' ? 'text-blue-300   bg-blue-500/10   border-blue-500/20'   :
                                        'text-cyan-300   bg-cyan-500/10   border-cyan-500/20'
          )}>{r.status ?? 'â€”'}</span>
          <div className="flex items-center gap-1 text-muted-foreground/50">
            <Clock size={8} />
            <span className="text-[8px] font-bold">{age}</span>
          </div>
        </div>
      </div>
    </button>
  );
}

// â”€â”€ Right panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DetailPanel({
  fleet, ficha, loading, error, activeTab, onTabChange, onGerar, onExport,
}: {
  fleet: FleetRow | null;
  ficha: FichaOperador | null;
  loading: boolean;
  error: string | null;
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
  onGerar: () => void;
  onExport: () => void;
}) {
  if (!fleet) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-12">
        <div className="w-16 h-16 rounded-3xl bg-[#1a1f3a] border border-[#2d3647] flex items-center justify-center">
          <Tractor size={28} className="text-primary/40" />
        </div>
        <div>
          <p className="text-sm font-black uppercase text-white/40 tracking-widest">Selecione uma frota</p>
          <p className="text-[10px] text-muted-foreground/40 mt-1">Clique em qualquer equipamento na lista Ã  esquerda</p>
        </div>
      </div>
    );
  }

  const fichaStatus = ficha?.status ?? deriveFleetFichaStatus(fleet);
  const opName = ficha?.operatorName
    || (fleet.operatorName ?? (fleet as unknown as Record<string,unknown>).currentOperator as string)
    || null;
  const implName = ficha?.implementName
    || String((fleet as unknown as Record<string,unknown>).implementName ?? '')
    || ficha?.implementCode
    || null;

  const blocking = (ficha?.inconsistencies ?? []).filter(i => !i.includes('(alerta)'));
  const alerts   = (ficha?.inconsistencies ?? []).filter(i =>  i.includes('(alerta)'));

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* detail header */}
      <div className="px-6 py-4 border-b border-[#2d3647]/50 bg-[#050812]/60 flex items-start gap-4 shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">{fleet.fleetCode}</h2>
            {implName && (
              <span className="text-[10px] font-bold text-white/40 uppercase">Â·</span>
            )}
            {implName && (
              <span className="text-[11px] font-bold text-white/60 uppercase truncate">{implName}</span>
            )}
            <span className={cn(
              'px-2.5 py-1 rounded-full text-[8px] font-black uppercase border',
              FICHA_BADGE[fichaStatus]
            )}>{fichaStatus}</span>
          </div>
          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            {opName && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <User size={9} />
                <span className="text-[10px] font-bold uppercase">{opName}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock size={9} />
              <span className="text-[10px]">{fmtDT(fleet.lastGpsAt)}</span>
            </div>
            {ficha?.journeyId && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Hash size={9} />
                <span className="text-[9px] font-mono truncate max-w-[160px]">{ficha.journeyId}</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={onGerar}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-[#0a0e27] rounded-xl text-[9px] font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-primary/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 shrink-0"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
          {loading ? 'Gerando...' : 'Atualizar ficha'}
        </button>
      </div>

      {/* inconsistency banner */}
      {(blocking.length > 0 || alerts.length > 0) && (
        <div className="px-6 py-2.5 border-b border-[#2d3647]/30 bg-[#050812]/30 flex flex-wrap gap-2 shrink-0">
          {blocking.map(inc => (
            <div key={inc} className="flex items-center gap-1.5 bg-red-950/50 border border-red-500/30 rounded-lg px-2.5 py-1">
              <AlertTriangle size={9} className="text-red-400" />
              <span className="text-[8px] font-black text-red-300 uppercase">{inc}</span>
            </div>
          ))}
          {alerts.map(a => (
            <div key={a} className="flex items-center gap-1.5 bg-amber-950/40 border border-amber-500/20 rounded-lg px-2.5 py-1">
              <AlertTriangle size={9} className="text-amber-400" />
              <span className="text-[8px] font-black text-amber-300 uppercase">{a}</span>
            </div>
          ))}
        </div>
      )}

      {/* tabs */}
      <div className="px-6 pt-3 pb-0 border-b border-[#2d3647]/50 shrink-0">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-t-xl text-[9px] font-black uppercase tracking-widest border-b-2 transition-all',
                activeTab === t.id
                  ? 'text-primary border-primary bg-primary/5'
                  : 'text-muted-foreground border-transparent hover:text-white/60 hover:bg-white/5',
              )}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* tab content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {error && (
          <div className="m-6 flex items-center gap-3 bg-red-950/40 border border-red-500/30 rounded-2xl px-5 py-3">
            <XCircle size={14} className="text-red-400 shrink-0" />
            <span className="text-[11px] font-bold text-red-300">{error}</span>
          </div>
        )}
        {!ficha && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
            <FileText size={28} className="text-primary/30" />
            <p className="text-[10px] font-bold uppercase">Clique em Atualizar ficha para carregar os dados</p>
          </div>
        )}
        {loading && !ficha && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-[10px] font-bold uppercase text-muted-foreground">Gerando ficha...</p>
          </div>
        )}
        {ficha && (
          <>
            {activeTab === 'geral'       && <GeralTab       ficha={ficha} fleet={fleet} />}
            {activeTab === 'operacional' && <OperacionalTab  ficha={ficha} fleet={fleet} />}
            {activeTab === 'paradas'     && <ParadasTab      ficha={ficha} />}
            {activeTab === 'rastro'      && <RastroTab       ficha={ficha} fleet={fleet} />}
            {activeTab === 'exportacao'  && <ExportacaoTab   ficha={ficha} onGerar={onGerar} onExport={onExport} loading={loading} />}
          </>
        )}
      </div>
    </div>
  );
}

// â”€â”€ Geral Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function GeralTab({ ficha, fleet }: { ficha: FichaOperador; fleet: FleetRow }) {
  const rows = [
    ['Operador',          fv(ficha.operatorName)],
    ['MatrÃ­cula',         fv(ficha.operatorRegistration)],
    ['DescriÃ§Ã£o OperaÃ§Ã£o',fv(ficha.operationName || ficha.operationCode)],
    ['Cod. OperaÃ§Ã£o',     fv(ficha.operationCode)],
    ['Implemento',        fv(ficha.implementName || ficha.implementCode)],
    ['Cod. Implemento',   fv(ficha.implementCode)],
    ['ComunicaÃ§Ã£o',       fv((fleet as unknown as Record<string,unknown>).communicationType || (fleet as unknown as Record<string,unknown>).communication || 'GPRS')],
    ['Fazenda',           fv((fleet as unknown as Record<string,unknown>).farm || (fleet as unknown as Record<string,unknown>).fazenda)],
    ['Grupo/Frente',      fv((fleet as unknown as Record<string,unknown>).group || (fleet as unknown as Record<string,unknown>).frente || (fleet as unknown as Record<string,unknown>).operationGroup)],
    ['TalhÃ£o',            fv((fleet as unknown as Record<string,unknown>).talhao || (fleet as unknown as Record<string,unknown>).field)],
    ['InÃ­cio Jornada',    fmtDT(ficha.startedAt)],
    ['Fim Jornada',       fmtDT(ficha.endedAt)],
    ['Ãšltima GPS',        fmtDT(fleet.lastGpsAt)],
    ['Journey ID',        fv(ficha.journeyId)],
  ];
  return (
    <div className="p-6">
      <SectionTitle icon={<User size={12} />} title="InformaÃ§Ãµes Gerais" />
      <FieldGrid rows={rows} />
    </div>
  );
}

// â”€â”€ Operacional Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function OperacionalTab({ ficha, fleet }: { ficha: FichaOperador; fleet: FleetRow }) {
  const hStart   = ficha.hourmeterStart   != null ? ficha.hourmeterStart   + 'h' : NI;
  const hCurrent = fleet.hourmeterCurrent != null ? fleet.hourmeterCurrent + 'h' : NI;
  const hEnd     = ficha.hourmeterEnd     != null ? ficha.hourmeterEnd     + 'h' : NI;
  const hTotal   = ficha.totalHourmeter   != null ? ficha.totalHourmeter   + 'h' : NI;

  const rows = [
    ['Horimetro InÃ­cio',   hStart,   ficha.hourmeterStart   == null],
    ['Horimetro Atual',    hCurrent, false],
    ['Horimetro Final',    hEnd,     false],
    ['Total Horimetro',    hTotal,   ficha.totalHourmeter   != null && ficha.totalHourmeter < 0],
  ] as [string, string, boolean][];

  return (
    <div className="p-6 space-y-6">
      <div>
        <SectionTitle icon={<Activity size={12} />} title="HorÃ­metros" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mt-3">
          {rows.map(([label, value, alert]) => (
            <HourmeterCard key={label} label={label} value={value} alert={alert} />
          ))}
        </div>
      </div>
      <div>
        <SectionTitle icon={<Activity size={12} />} title="OperaÃ§Ã£o" />
        <FieldGrid rows={[
          ['CÃ³digo OperaÃ§Ã£o',  fv(ficha.operationCode)],
          ['Nome OperaÃ§Ã£o',    fv(ficha.operationName)],
          ['CÃ³digo Implement.',fv(ficha.implementCode)],
          ['Nome Implement.',  fv(ficha.implementName)],
          ['Status Jornada',   fleet.status ?? NI],
        ]} />
      </div>
    </div>
  );
}

function HourmeterCard({ label, value, alert }: { label: string; value: string; alert: boolean }) {
  const isNI = value === NI;
  return (
    <div className={cn(
      'rounded-2xl border p-4 flex flex-col gap-2',
      alert ? 'border-red-500/30 bg-red-950/20' : 'border-[#2d3647] bg-[#0a0e27]/60',
    )}>
      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className={cn(
        'text-2xl font-black font-mono',
        alert ? 'text-red-400' : isNI ? 'text-muted-foreground/40' : 'text-primary',
      )}>{value}</span>
    </div>
  );
}

// â”€â”€ Paradas Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ParadasTab({ ficha }: { ficha: FichaOperador }) {
  if (ficha.stops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
        <CheckCircle2 size={28} className="text-emerald-500/50" />
        <p className="text-[11px] font-bold uppercase">Nenhuma parada registrada</p>
      </div>
    );
  }
  return (
    <div className="p-6">
      <SectionTitle icon={<Square size={12} />} title={'Paradas (' + ficha.stops.length + ')'}/>
      <div className="mt-3 space-y-2">
        {ficha.stops.map((s, i) => (
          <div key={i} className="flex items-start gap-3 bg-[#0a0e27]/60 border border-[#2d3647]/60 rounded-2xl px-5 py-4">
            <span className="shrink-0 mt-0.5 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border text-amber-300 bg-amber-500/10 border-amber-500/30">
              {s.code}
            </span>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-[11px] font-bold text-white uppercase">{s.description || NI}</p>
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Play size={8} />
                  <span className="text-[9px]">InÃ­cio: {fmtDT(s.startedAt)}</span>
                </div>
                {s.endedAt && (
                  <div className="flex items-center gap-1">
                    <Square size={8} />
                    <span className="text-[9px]">Fim: {fmtDT(s.endedAt)}</span>
                  </div>
                )}
              </div>
            </div>
            <span className={cn(
              'shrink-0 text-[7px] font-black uppercase px-2 py-0.5 rounded border mt-0.5',
              s.endedAt
                ? 'text-slate-400 bg-slate-500/10 border-slate-500/20'
                : 'text-amber-300 bg-amber-500/10 border-amber-500/30',
            )}>{s.endedAt ? 'ENCERRADA' : 'ATIVA'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// â”€â”€ Rastro Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function RastroTab({ ficha, fleet }: { ficha: FichaOperador; fleet: FleetRow }) {
  const { trailSummary: ts } = ficha;
  const hasTrail = ts.points > 0;

  const goToMap = () => {
    window.open('/mapa', '_blank');
  };

  return (
    <div className="p-6 space-y-6">
      <SectionTitle icon={<Route size={12} />} title="Rastro GPS" />

      {/* summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <TrailStat label="Pontos GPS"      value={String(ts.points)}         dim={!hasTrail} />
        <TrailStat label="DistÃ¢ncia"       value={ts.distanceKm + ' km'}    dim={!hasTrail} />
        <TrailStat label="Primeiro GPS"    value={fmtTime(ts.firstGpsAt)}    dim={!hasTrail} />
        <TrailStat label="Ãšltimo GPS"      value={fmtTime(ts.lastGpsAt)}     dim={!hasTrail} />
      </div>

      {/* position detail */}
      {hasTrail && (
        <div>
          <FieldGrid rows={[
            ['InÃ­cio GPS', fmtDT(ts.firstGpsAt)],
            ['Fim GPS',    fmtDT(ts.lastGpsAt)],
            ['Journey ID', fv(ficha.journeyId)],
            ['Frota',      fleet.fleetCode],
          ]} />
        </div>
      )}

      {/* action */}
      <div className="flex items-center gap-3">
        <button
          onClick={goToMap}
          className="flex items-center gap-2 px-5 py-3 bg-primary text-[#0a0e27] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-primary/20"
        >
          <MapPin size={14} /> Ver no Mapa
        </button>
        {!hasTrail && (
          <div className="flex items-center gap-2 text-amber-400">
            <AlertTriangle size={14} />
            <span className="text-[10px] font-bold uppercase">Sem rastro registrado para esta jornada</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TrailStat({ label, value, dim }: { label: string; value: string; dim: boolean }) {
  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#0a0e27]/60 p-4 flex flex-col gap-2">
      <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className={cn('text-lg font-black font-mono', dim ? 'text-muted-foreground/30' : 'text-white')}>{value}</span>
    </div>
  );
}

// â”€â”€ ExportaÃ§Ã£o Tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ExportacaoTab({
  ficha, onGerar, onExport, loading,
}: {
  ficha: FichaOperador;
  onGerar: () => void;
  onExport: () => void;
  loading: boolean;
}) {
  const isInc = ficha.status === 'INCONSISTENTE';
  const blocking = ficha.inconsistencies.filter(i => !i.includes('(alerta)'));

  return (
    <div className="p-6 space-y-6">
      <SectionTitle icon={<Download size={12} />} title="ExportaÃ§Ã£o" />

      {/* status card */}
      <div className={cn(
        'rounded-2xl border p-5 flex items-start gap-4',
        isInc ? 'border-red-500/30 bg-red-950/10' : 'border-emerald-500/30 bg-emerald-950/10',
      )}>
        {isInc
          ? <AlertTriangle size={22} className="text-red-400 shrink-0 mt-0.5" />
          : <CheckCircle2  size={22} className="text-emerald-400 shrink-0 mt-0.5" />
        }
        <div className="space-y-1">
          <p className={cn('text-sm font-black uppercase', isInc ? 'text-red-300' : 'text-emerald-300')}>
            {isInc ? 'Ficha com InconsistÃªncias' : 'Ficha Pronta para ExportaÃ§Ã£o'}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {isInc
              ? 'Corrija as inconsistÃªncias abaixo antes de exportar.'
              : 'Todos os dados obrigatÃ³rios estÃ£o presentes.'}
          </p>
          {blocking.length > 0 && (
            <ul className="mt-2 space-y-1">
              {blocking.map(inc => (
                <li key={inc} className="flex items-center gap-1.5 text-[9px] font-bold text-red-300 uppercase">
                  <span className="text-red-500">â€¢</span>{inc}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* export summary */}
      <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl p-5 space-y-3">
        <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Resumo da Ficha</p>
        <FieldGrid rows={[
          ['Frota',          ficha.fleetCode],
          ['Journey ID',     fv(ficha.journeyId)],
          ['Operador',       fv(ficha.operatorName)],
          ['MatrÃ­cula',      fv(ficha.operatorRegistration)],
          ['OperaÃ§Ã£o',       fv(ficha.operationName || ficha.operationCode)],
          ['HorÃ­m. InÃ­cio',  ficha.hourmeterStart != null ? ficha.hourmeterStart + 'h' : NI],
          ['HorÃ­m. Final',   ficha.hourmeterEnd   != null ? ficha.hourmeterEnd   + 'h' : NI],
          ['Total HorÃ­m.',   ficha.totalHourmeter != null ? ficha.totalHourmeter + 'h' : NI],
          ['Paradas',        String(ficha.stops.length)],
          ['Rastro GPS',     ficha.trailSummary.points + ' pontos Â· ' + ficha.trailSummary.distanceKm + 'km'],
        ]} />
      </div>

      {/* actions */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={onGerar}
          disabled={loading}
          className="flex items-center gap-2 px-5 py-3 bg-[#1a1f3a] border border-primary/30 text-primary rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/10 transition-all disabled:opacity-40"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Regenerar Ficha
        </button>
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-5 py-3 bg-emerald-700 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-700/20"
        >
          <Download size={14} /> Exportar CSV
        </button>
      </div>
    </div>
  );
}

// â”€â”€ Shared sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-primary">{icon}</span>
      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em]">{title}</p>
    </div>
  );
}

function FieldGrid({ rows }: { rows: string[][] }) {
  return (
    <div className="grid grid-cols-1 gap-y-4 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => {
        const label = row[0] ?? '';
        const value = row[1] ?? NI;
        return (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
            <span className={cn(
              'text-[11px] font-bold uppercase',
              value === NI ? 'text-muted-foreground/40 italic' : 'text-white',
            )}>{value}</span>
          </div>
        );
      })}
    </div>
  );
}

// â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ── Main page ─────────────────────────────────────────────────────────────────
function FichaOperadorPage() {
  const [fleet,          setFleet]          = useState<FleetRow[]>([]);
  const [fleetLoading,   setFleetLoading]   = useState(true);
  const [lastAt,         setLastAt]         = useState<Date | null>(null);
  const [search,         setSearch]         = useState('');
  const [selectedFleet,  setSelectedFleet]  = useState<string | null>(null);
  const [selectedJourney,setSelectedJourney]= useState<string | undefined>(undefined);
  const [ficha,          setFicha]          = useState<FichaOperador | null>(null);
  const [fichaLoading,   setFichaLoading]   = useState(false);
  const [fichaError,     setFichaError]     = useState<string | null>(null);
  const [activeTab,      setActiveTab]      = useState<TabId>('geral');

  const abortRef = useRef<AbortController | null>(null);

  const fetchFleet = useCallback(async () => {
    setFleetLoading(true);
    try {
      const res  = await fetch('/api/equipamentos/status', { cache: 'no-store' });
      const data = res.ok ? await res.json() : [];
      setFleet(Array.isArray(data) ? data : []);
      setLastAt(new Date());
    } catch { /* silent */ }
    finally { setFleetLoading(false); }
  }, []);

  const fetchFicha = useCallback(async (fleetCode: string, journeyId?: string) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setFichaLoading(true);
    setFichaError(null);
    try {
      const url = new URL('/api/ficha-operador', window.location.origin);
      url.searchParams.set('fleetCode', fleetCode);
      if (journeyId) url.searchParams.set('journeyId', journeyId);

      const res = await fetch(url.toString(), { signal: ctrl.signal, cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
        setFichaError(String(err.error ?? 'Erro ao gerar ficha'));
        setFicha(null);
      } else {
        setFicha(await res.json());
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== 'AbortError') {
        setFichaError('Falha de conexão com o servidor.');
        setFicha(null);
      }
    } finally {
      setFichaLoading(false);
    }
  }, []);

  useEffect(() => { fetchFleet(); }, [fetchFleet]);

  const handleSelectFleet = useCallback((fc: string, jid?: string) => {
    setSelectedFleet(fc);
    setSelectedJourney(jid);
    setFicha(null);
    setFichaError(null);
    setActiveTab('geral');
    fetchFicha(fc, jid);
  }, [fetchFicha]);

  const handleGerar = useCallback(() => {
    if (selectedFleet) fetchFicha(selectedFleet, selectedJourney);
  }, [fetchFicha, selectedFleet, selectedJourney]);

  const handleExport = useCallback(() => {
    const fc  = selectedFleet   || ficha?.fleetCode  || '';
    const jid = selectedJourney || ficha?.journeyId  || '';
    if (!fc) { alert('Selecione uma frota antes de exportar.'); return; }
    const url = new URL('/api/ficha-operador/export', window.location.origin);
    url.searchParams.set('fleetCode', fc);
    if (jid) url.searchParams.set('journeyId', jid);
    window.open(url.toString(), '_blank');
  }, [selectedFleet, selectedJourney, ficha]);

  const selectedFleetObj = fleet.find(f => f.fleetCode === selectedFleet) ?? null;

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <div className="flex-1 flex min-h-0 overflow-hidden">
          <FleetSidebar
            fleet={fleet}
            loading={fleetLoading}
            selected={selectedFleet}
            search={search}
            onSearch={setSearch}
            onSelect={handleSelectFleet}
            onRefresh={fetchFleet}
            lastAt={lastAt}
          />
          <DetailPanel
            fleet={selectedFleetObj}
            ficha={ficha}
            loading={fichaLoading}
            error={fichaError}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onGerar={handleGerar}
            onExport={handleExport}
          />
        </div>
      </div>
    </div>
  );
}

export default withAuth(FichaOperadorPage, { module: 'FICHA_OPERADOR' });
