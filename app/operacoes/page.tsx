"use client";
/**
 * SILO OPS â€” OperaÃ§Ãµes Ativas Reais (Etapa 6.7)
 *
 * Consome /api/operacoes/ativas que combina live-state + ficha operador.
 * Sem dados fake. Sem mock estÃ¡tico.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MasterDataShell } from '@/components/master-data/master-data-shell';
import { withAuth } from '@/components/shared/with-auth';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  Clock,
  FileText,
  Filter,
  Loader2,
  Map,
  RefreshCw,
  Route,
  Search,
  Truck,
  User,
  WifiOff,
  X,
  ZapOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ActiveOperationItem, ActiveOperationsResponse } from '@/app/api/operacoes/ativas/route';
import type { ResolvedStop } from '@/lib/operational/resolve-active-operations';

// â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Formata YYYY-MM-DD â†’ DD/MM/YYYY sem usar new Date(dateString). */
function formatDateBR(s: string): string {
  const p = s.split('-');
  if (p.length !== 3) return s;
  return `${p[2]}/${p[1]}/${p[0]}`;
}

/** Data operacional de hoje em BRT (UTC-3) sem conversÃ£o de fuso. */
function todayBRT(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Formata timestamp ISO â†’ hora local. */
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return 'â€”';
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'â€”';
  }
}

/** Formata horÃ­metro. */
function fmtH(n: number | null | undefined): string {
  if (n === null || n === undefined) return 'â€”';
  return `${n.toFixed(1)} h`;
}

// â”€â”€ Status config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface StatusCfg {
  label: string;
  bar: string;
  badge: string;
  icon: React.ReactNode;
}

function statusConfig(s: string): StatusCfg {
  const map: Record<string, StatusCfg> = {
    OPERANDO:          { label: 'Operando',        bar: 'bg-emerald-500', badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', icon: <Activity size={10} /> },
    EM_ANDAMENTO:      { label: 'Em Andamento',    bar: 'bg-emerald-500', badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', icon: <Activity size={10} /> },
    TRABALHANDO:       { label: 'Trabalhando',      bar: 'bg-emerald-500', badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400', icon: <Activity size={10} /> },
    EM_MOVIMENTO:      { label: 'Em Movimento',     bar: 'bg-blue-500',   badge: 'bg-blue-500/10 border-blue-500/30 text-blue-400',         icon: <Route size={10} /> },
    ONLINE:            { label: 'Online',           bar: 'bg-blue-500',   badge: 'bg-blue-500/10 border-blue-500/30 text-blue-400',         icon: <Activity size={10} /> },
    PARADO:            { label: 'Parado',           bar: 'bg-orange-500', badge: 'bg-orange-500/10 border-orange-500/30 text-orange-400',   icon: <ZapOff size={10} /> },
    AGUARDANDO_PARADA: { label: 'Aguard. Parada',  bar: 'bg-amber-500',  badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',     icon: <ZapOff size={10} /> },
    PARADA_APONTADA:   { label: 'Parada Apontada', bar: 'bg-amber-500',  badge: 'bg-amber-500/10 border-amber-500/30 text-amber-400',     icon: <ZapOff size={10} /> },
    ABASTECENDO:       { label: 'Abastecendo',      bar: 'bg-cyan-500',   badge: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400',         icon: <Activity size={10} /> },
    FINALIZADO:        { label: 'Finalizado',       bar: 'bg-gray-500',   badge: 'bg-gray-500/10 border-gray-500/30 text-gray-400',         icon: <Clock size={10} /> },
    OFFLINE:           { label: 'Offline',          bar: 'bg-gray-600',   badge: 'bg-gray-600/10 border-gray-600/30 text-gray-500',         icon: <WifiOff size={10} /> },
    SEM_SINAL:         { label: 'Sem Sinal',        bar: 'bg-gray-600',   badge: 'bg-gray-600/10 border-gray-600/30 text-gray-500',         icon: <WifiOff size={10} /> },
    SEM_JORNADA:       { label: 'Sem Jornada',      bar: 'bg-gray-700',   badge: 'bg-gray-700/10 border-gray-700/30 text-gray-600',         icon: <WifiOff size={10} /> },
  };
  return map[s] ?? {
    label: s,
    bar: 'bg-gray-500',
    badge: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
    icon: <Activity size={10} />,
  };
}

// â”€â”€ KPI card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function KpiCard({ label, value, color = 'text-primary', icon }: {
  label: string;
  value: number | string;
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="bg-[#0a0e27]/70 border border-[#2d3647] rounded-3xl p-4 flex flex-col gap-1 shadow-lg shadow-black/10">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon && <span className="opacity-60">{icon}</span>}
        <span className="text-[9px] font-black uppercase tracking-[0.15em]">{label}</span>
      </div>
      <span className={cn('text-2xl font-black italic tracking-tighter', color)}>{value}</span>
    </div>
  );
}

// â”€â”€ Field helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Field({ label, icon, children, span }: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  span?: boolean;
}) {
  return (
    <div className={cn('space-y-0.5', span && 'col-span-2')}>
      <p className="text-[9px] text-muted-foreground font-black uppercase flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-xs font-bold text-white/90 uppercase truncate">{children}</p>
    </div>
  );
}

// â”€â”€ Stop block â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Bloco PARADA semantico â€” exibe estado resolvido da parada.
 * Nunca exibe "NÃƒO INFORMADO". Sempre visivel (mesmo sem parada ativa).
 */
function StopBlock({ stop }: { stop?: ResolvedStop }) {
  // Fallback seguro: sem stop object -> trata como SEM_PARADA_ATIVA
  const state = stop?.state ?? 'SEM_PARADA_ATIVA';
  const stopSince = stop?.startedAt ? fmtTime(stop.startedAt) : null;

  let content: React.ReactNode;

  if (state === 'PARADA_APONTADA') {
    content = (
      <div className="space-y-0.5">
        {(stop?.code || stop?.reason) && (
          <p className="text-xs font-bold text-white/90 uppercase truncate">
            Motivo: {stop?.code && stop?.reason ? `${stop.code} — ${stop.reason}` : (stop?.reason ?? stop?.code)}
          </p>
        )}
        {stopSince && <p className="text-xs font-bold text-orange-300 uppercase">Desde: {stopSince}</p>}
        {!stop?.code && !stop?.reason && (
          <p className="text-xs font-bold text-white/90 uppercase">Parada apontada</p>
        )}
      </div>
    );
  } else if (state === 'AGUARDANDO_APONTAMENTO') {
    content = (
      <div className="space-y-0.5">
        <p className="text-xs font-bold text-amber-300 uppercase">Aguardando apontamento de parada</p>
        <p className="text-xs font-bold text-white/50 uppercase">CÃ³digo: â€”</p>
      </div>
    );
  } else if (state === 'PARADA_INCONSISTENTE') {
    content = (
      <div className="space-y-0.5">
        <p className="text-xs font-bold text-red-400 uppercase">Parada inconsistente</p>
        {stop?.inconsistency && (
          <p className="text-[10px] text-red-300/70 uppercase">{stop.inconsistency}</p>
        )}
      </div>
    );
  } else {
    // SEM_PARADA_ATIVA (default)
    content = (
      <p className="text-xs font-bold text-white/40 uppercase">Sem parada ativa</p>
    );
  }

  return (
    <div className="col-span-2 space-y-0.5">
      <p className="text-[9px] text-muted-foreground font-black uppercase flex items-center gap-1">
        <ZapOff size={9} />
        PARADA
      </p>
      {content}
    </div>
  );
}

// â”€â”€ Action button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ActionButton({ onClick, icon, children, disabled, title }: {
  onClick?: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wide transition-all',
        disabled
          ? 'text-muted-foreground/30 cursor-not-allowed bg-[#1a1f3a]/30 border border-[#2d3647]/30'
          : 'text-primary bg-primary/5 border border-primary/20 hover:bg-primary/15 hover:border-primary/40',
      )}
    >
      {icon}
      {children}
    </button>
  );
}

// â”€â”€ Operation card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function OpCard({ item, selectedDate }: { item: ActiveOperationItem; selectedDate: string }) {
  const cfg = statusConfig(item.liveStatus);

  const verFicha = () => {
    const p = new URLSearchParams({ fleetCode: item.fleetCode, date: selectedDate });
    window.open(`/ferramentas/ficha-operador?${p}`, '_blank');
  };

  const abrirMapa = () => {
    const p = new URLSearchParams({ fleet: item.fleetCode });
    window.open(`/mapa-operacional?${p}`, '_blank');
  };

  const verTimeline = () => {
    const p = new URLSearchParams({ fleetCode: item.fleetCode, date: selectedDate });
    window.open(`/operacoes/timeline?${p}`, '_blank');
  };

  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-5 relative overflow-hidden group hover:border-primary/30 transition-colors">
      <div className={cn('absolute top-0 left-0 w-1.5 h-full rounded-l-3xl', cfg.bar)} />

      <div className="flex items-start justify-between mb-4 pl-2">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#1a1f3a] rounded-xl border border-[#2d3647] flex items-center justify-center text-primary shrink-0">
            <Truck size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black italic tracking-tighter text-white uppercase group-hover:text-primary transition-colors">
              Frota {item.fleetCode}
            </h3>
            <div className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase border',
              cfg.badge,
            )}>
              {cfg.icon}
              {cfg.label}
            </div>
          </div>
        </div>
        {item.hasInconsistency && (
          <div className="flex items-center gap-1 text-amber-400 shrink-0">
            <AlertTriangle size={14} />
            <span className="text-[9px] font-black uppercase">{item.inconsistencies.length} inconsist.</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-y-3 gap-x-4 pl-2 mb-4">
        <Field label="Operador" icon={<User size={9} />}>
          {item.operatorName ?? 'â€”'}
        </Field>
        <Field label="MatrÃ­cula">
          {item.operatorRegistration ?? 'â€”'}
        </Field>
        <Field label="O.S.">
          {item.workOrderNumber ?? 'â€”'}
        </Field>
        <Field label="HorÃ­metro">
          {fmtH(item.hourmeterCurrent)}
        </Field>
        <Field label="OperaÃ§Ã£o" span>
          {item.operationName
            ? `${item.operationCode ? item.operationCode + ' Â· ' : ''}${item.operationName}`
            : (item.operationCode ?? 'â€”')}
        </Field>
        <Field label="Centro de Custo">
          {item.costCenterName ?? 'â€”'}
        </Field>
        <Field label="Implemento">
          {item.implementName
            ? `${item.implementCode ? item.implementCode + ' Â· ' : ''}${item.implementName}`
            : (item.implementCode ?? 'â€”')}
        </Field>
        <Field label="Data Operacional">
          {formatDateBR(item.date)}
        </Field>
        <StopBlock stop={item.stop} />
        <Field label="Jornada ID">
          {item.journeyId ?? 'â€”'}
        </Field>
        <Field label="Ãšltima Atualiz.">
          {fmtTime(item.updatedAt)}
        </Field>
        <Field label="Ãšltimo GPS">
          {item.latitude !== null ? fmtTime(item.lastGpsAt) : 'Sem GPS'}
        </Field>
        <Field label="Origem" span>
          {item.dataSource}
        </Field>
      </div>

      <div className="pl-2 mb-3 flex items-center gap-2">
        <span className="text-[9px] text-muted-foreground font-black uppercase">Ficha:</span>
        <span className="text-[9px] font-black uppercase text-white/60">{item.fichaStatus}</span>
      </div>

      <div className="pl-2 pt-3 border-t border-[#2d3647] flex flex-wrap gap-2">
        <ActionButton onClick={verFicha} icon={<FileText size={12} />}>Ver Ficha</ActionButton>
        <ActionButton onClick={abrirMapa} icon={<Map size={12} />}>Abrir no Mapa</ActionButton>
        <ActionButton onClick={verTimeline} icon={<Clock size={12} />}>Ver Timeline</ActionButton>
        {item.latitude !== null ? (
          <ActionButton onClick={abrirMapa} icon={<Route size={12} />}>Ver Rastro</ActionButton>
        ) : (
          <ActionButton disabled title="Sem GPS registrado para esta jornada" icon={<Route size={12} />}>
            Ver Rastro
          </ActionButton>
        )}
      </div>
    </div>
  );
}

// â”€â”€ Filters â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const ALL_STATUSES = [
  'OPERANDO', 'EM_ANDAMENTO', 'TRABALHANDO', 'EM_MOVIMENTO',
  'ONLINE', 'PARADO', 'AGUARDANDO_PARADA', 'PARADA_APONTADA',
  'ABASTECENDO', 'FINALIZADO', 'OFFLINE', 'SEM_SINAL', 'SEM_JORNADA',
];

interface Filters {
  search: string;
  date: string;
  status: string;
  onlyActive: boolean;
  onlyInconsistency: boolean;
}

function initialFilters(): Filters {
  return { search: '', date: todayBRT(), status: '', onlyActive: false, onlyInconsistency: false };
}

// â”€â”€ Main page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function OperacoesPage() {
  const [response, setResponse] = useState<ActiveOperationsResponse | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [filters, setFilters]   = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [lastFetch, setLastFetch]     = useState<Date | null>(null);

  const fetchData = useCallback(async (date: string, onlyActive: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const sp = new URLSearchParams({ date });
      if (onlyActive) sp.set('onlyActive', 'true');
      const res = await fetch(`/api/operacoes/ativas?${sp}`, { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error(String(body.error ?? `HTTP ${res.status}`));
      }
      setResponse(await res.json() as ActiveOperationsResponse);
      setLastFetch(new Date());
    } catch (err) {
      console.error('[operacoes] fetch error', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar operaÃ§Ãµes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(filters.date, filters.onlyActive);
  }, [fetchData, filters.date, filters.onlyActive]);

  const items = useMemo<ActiveOperationItem[]>(() => {
    if (!response) return [];
    let list = response.items;
    if (filters.search.trim()) {
      const term = filters.search.trim().toLowerCase();
      list = list.filter((i) =>
        i.fleetCode.toLowerCase().includes(term) ||
        (i.operatorName ?? '').toLowerCase().includes(term) ||
        (i.operatorRegistration ?? '').toLowerCase().includes(term) ||
        (i.operationName ?? '').toLowerCase().includes(term) ||
        (i.costCenterName ?? '').toLowerCase().includes(term) ||
        (i.workOrderNumber ?? '').toLowerCase().includes(term) ||
        (i.implementName ?? '').toLowerCase().includes(term)
      );
    }
    if (filters.status) {
      list = list.filter((i) => i.liveStatus === filters.status);
    }
    if (filters.onlyInconsistency) {
      list = list.filter((i) => i.hasInconsistency);
    }
    return list;
  }, [response, filters.search, filters.status, filters.onlyInconsistency]);

  const kpis = response?.kpis;

  function setFilter(key: keyof Filters, value: Filters[keyof Filters]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function resetFilters() {
    setFilters(initialFilters());
    setShowFilters(false);
  }

  const activeFilterCount = [
    filters.search,
    filters.status,
    filters.onlyActive ? 'x' : '',
    filters.onlyInconsistency ? 'x' : '',
  ].filter(Boolean).length;

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">

                    <MasterDataShell
            title="Operações Ativas"
            description="Monitoramento em tempo real — live-state + ficha operador"
            actions={
              <button
                onClick={() => fetchData(filters.date, filters.onlyActive)}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/30 text-primary rounded-xl text-xs font-black uppercase hover:bg-primary/20 transition-all disabled:opacity-40"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                Atualizar
              </button>
            }
          >

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
            <KpiCard label="Ativas"            value={kpis?.totalAtivas ?? 0}        color="text-emerald-400" icon={<Activity size={12} />} />
            <KpiCard label="Em OperaÃ§Ã£o"       value={kpis?.frotasEmOperacao ?? 0}   color="text-blue-400"    icon={<Truck size={12} />} />
            <KpiCard label="Operadores"        value={kpis?.operadoresAtivos ?? 0}   color="text-primary"     icon={<User size={12} />} />
            <KpiCard label="Paradas"           value={kpis?.paradas ?? 0}            color="text-orange-400"  icon={<ZapOff size={12} />} />
            <KpiCard label="Offline/Sem Sinal" value={kpis?.offlineOuSemSinal ?? 0} color="text-gray-400"    icon={<WifiOff size={12} />} />
            <KpiCard label="InconsistÃªncias"   value={kpis?.inconsistencias ?? 0}    color="text-amber-400"   icon={<AlertTriangle size={12} />} />
            <KpiCard
              label="Ãšltima Sinc."
              value={kpis?.ultimaSincronizacao ? fmtTime(kpis.ultimaSincronizacao) : 'â€”'}
              color="text-muted-foreground"
              icon={<Clock size={12} />}
            />
          </div>

          <div className="flex flex-col gap-3 mb-6">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar frota, operador, operaÃ§Ã£o, implemento..."
                  value={filters.search}
                  onChange={(e) => setFilter('search', e.target.value)}
                  className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40"
                />
              </div>
              <input
                type="date"
                value={filters.date}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) setFilter('date', v);
                }}
                className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-2.5 px-4 text-sm focus:outline-none focus:border-primary/50 text-white"
              />
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase border transition-all',
                  showFilters || activeFilterCount > 0
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-[#0a0e27]/60 border-[#2d3647] text-muted-foreground hover:border-primary/30',
                )}
              >
                <Filter size={14} />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="bg-primary text-[#0a0e27] rounded-full w-4 h-4 text-[9px] flex items-center justify-center font-black">
                    {activeFilterCount}
                  </span>
                )}
                <ChevronDown size={12} className={cn('transition-transform', showFilters && 'rotate-180')} />
              </button>
            </div>

            {showFilters && (
              <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl p-4 flex flex-wrap gap-4 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-muted-foreground font-black uppercase">Status</label>
                  <select
                    value={filters.status}
                    onChange={(e) => setFilter('status', e.target.value)}
                    className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-3 py-2 text-xs focus:border-primary outline-none text-white min-w-[160px]"
                  >
                    <option value="">Todos</option>
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>{statusConfig(s).label}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.onlyActive}
                    onChange={(e) => setFilter('onlyActive', e.target.checked)}
                    className="accent-primary w-4 h-4"
                  />
                  <span className="text-xs font-bold text-white/70">Somente ativas</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.onlyInconsistency}
                    onChange={(e) => setFilter('onlyInconsistency', e.target.checked)}
                    className="accent-amber-500 w-4 h-4"
                  />
                  <span className="text-xs font-bold text-white/70">Com inconsistÃªncia</span>
                </label>
                <button
                  onClick={resetFilters}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-black uppercase text-red-400 border border-red-400/20 hover:bg-red-400/10 transition-all"
                >
                  <X size={12} /> Limpar
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 size={40} className="text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">
                Sincronizando operaÃ§Ãµes reais...
              </p>
            </div>

          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <AlertCircle size={40} className="text-red-500" />
              <p className="text-sm text-red-400 font-bold">{error}</p>
              <button
                onClick={() => fetchData(filters.date, filters.onlyActive)}
                className="px-4 py-2 bg-primary/20 text-primary rounded-xl text-xs font-black uppercase hover:bg-primary/30 transition-colors"
              >
                Tentar Novamente
              </button>
            </div>

          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#1a1f3a] border border-[#2d3647] flex items-center justify-center opacity-40">
                <Truck size={32} />
              </div>
              <div className="space-y-1 opacity-60">
                <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                  Nenhuma operaÃ§Ã£o ativa encontrada
                </p>
                <p className="text-xs text-muted-foreground/70">para os filtros selecionados.</p>
                <p className="text-xs text-muted-foreground/50">
                  Verifique a data operacional ({formatDateBR(filters.date)}), a frota ou a sincronizaÃ§Ã£o do APK.
                </p>
              </div>
              {activeFilterCount > 0 && (
                <button onClick={resetFilters} className="text-xs font-black text-primary uppercase hover:underline">
                  Limpar Filtros
                </button>
              )}
            </div>

          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-muted-foreground">
                  <span className="text-white font-black">{items.length}</span>{' '}
                  {items.length !== 1 ? 'operaÃ§Ãµes' : 'operaÃ§Ã£o'} â€” {formatDateBR(filters.date)}
                  {lastFetch && (
                    <span className="ml-2 opacity-50">
                      Â· atualizado Ã s {fmtTime(lastFetch.toISOString())}
                    </span>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {items.map((item) => (
                  <OpCard
                    key={`${item.fleetCode}-${item.date}`}
                    item={item}
                    selectedDate={filters.date}
                  />
                ))}
              </div>
            </>
          )}

          </MasterDataShell>
        </main>
      </div>
    </div>
  );
}

export default withAuth(OperacoesPage, { module: 'OPERACOES' });






