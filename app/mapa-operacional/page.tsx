"use client";
/* ─────────────────────────────────────────────────────────────────────────────
 * SILO OPS — Mapa Operacional (C4.7)
 * Mapa avançado com filtros, busca, rastro por jornada e ficha operador.
 * ────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle, CheckCircle2, ChevronDown, Clock, Filter,
  Globe, Hash, LayoutGrid, Map as MapIcon, Maximize2,
  Menu, MoreVertical, Search, Settings2, X as CloseIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/layout/sidebar';
import { useSidebar } from '@/lib/context/sidebar-context';
import { withAuth } from '@/components/shared/with-auth';
import { EquipmentIcon } from '@/components/icons/equipment-icons';
import { MapLegend } from '@/components/map/equipment-map-legend';
import type { LiveMapItem, MapCounts, MapFilters } from '@/components/mapa/map-filters';
import { EMPTY_FILTERS, applyFilters } from '@/components/mapa/map-filters';

const STATUS_OPTIONS = [
  { key: 'ONLINE',     label: 'Online',     tw: 'bg-blue-500'    },
  { key: 'OPERANDO',   label: 'Operando',   tw: 'bg-emerald-500' },
  { key: 'PARADO',     label: 'Parado',     tw: 'bg-orange-500'  },
  { key: 'ALERTA',     label: 'Alerta',     tw: 'bg-red-500'     },
  { key: 'FINALIZADO', label: 'Finalizado', tw: 'bg-gray-500'    },
  { key: 'INCONSISTENTE', label: 'Inconsistente', tw: 'bg-amber-500' },
  { key: 'OFFLINE',    label: 'Offline',    tw: 'bg-gray-500'    },
];

const STATUS_CONFIG = {
  online:     { label: 'Online',     tailwind: 'bg-blue-500',    text: 'text-blue-500'    },
  operando:   { label: 'Operando',   tailwind: 'bg-emerald-500', text: 'text-emerald-500' },
  movimento:  { label: 'Movimento',  tailwind: 'bg-emerald-500', text: 'text-emerald-500' },
  deslocando: { label: 'Deslocando', tailwind: 'bg-blue-500',    text: 'text-blue-500'    },
  parado:     { label: 'Parado',     tailwind: 'bg-orange-500',  text: 'text-orange-500'  },
  alarme:     { label: 'Alarme',     tailwind: 'bg-red-500',     text: 'text-red-500'     },
  alerta:     { label: 'Alerta',     tailwind: 'bg-red-500',     text: 'text-red-500'     },
  falha:      { label: 'Falha',      tailwind: 'bg-red-500',     text: 'text-red-500'     },
  sem_heartbeat: { label: 'Sem heartbeat', tailwind: 'bg-red-500', text: 'text-red-500' },
  manutencao: { label: 'Manutenção', tailwind: 'bg-purple-500',  text: 'text-purple-500'  },
  finalizado: { label: 'Finalizado', tailwind: 'bg-gray-500',    text: 'text-gray-500'    },
  offline:    { label: 'Offline',    tailwind: 'bg-gray-500',    text: 'text-gray-500'    },
};

const EMPTY_COUNTS: MapCounts = { online: 0, operando: 0, parado: 0, offline: 0, staleGps: 0, staleHeartbeat: 0 };

const FullMap = dynamic(
  () => import('@/components/mapa/full-map-enterprise').then((m) => ({ default: m.default })),
  { ssr: false,
  loading: () => (
    <div className="flex-1 bg-[#050812] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-primary animate-pulse uppercase tracking-[0.4em] font-black">SILO OPS CENTRAL</p>
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Carregando Modulos Geoespaciais...</p>
        </div>
      </div>
    </div>
  ),
});

/* ── Main page ─────────────────────────────────────────────────────────── */

function MapaOperacionalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toggle } = useSidebar();
  const [isFleetSidebarOpen, setIsFleetSidebarOpen] = React.useState(true);
  const [showFilters, setShowFilters]     = React.useState(false);
  const [allFleetData, setAllFleetData]   = React.useState<LiveMapItem[]>([]);
  const [counts, setCounts]               = React.useState<MapCounts>(EMPTY_COUNTS);
  const [selectedId, setSelectedId]       = React.useState<string | null>(null);
  const [noGpsCode, setNoGpsCode]         = React.useState<string | null>(null);
  const [filters, setFilters]             = React.useState<MapFilters>(EMPTY_FILTERS);
  const [trailPanelOpen, setTrailPanelOpen] = React.useState(false);
  const isTvMode = searchParams.get('modo') === 'tv' || searchParams.get('tv') === '1';

  // Filtered fleet for sidebar display
  const filteredFleetData = React.useMemo(
    () => applyFilters(allFleetData, filters),
    [allFleetData, filters],
  );

  const activeFilterCount = React.useMemo(() => {
    let c = 0;
    if (filters.search) c++;
    if (filters.status.length > 0) c++;
    if (filters.operation) c++;
    if (filters.operator) c++;
    if (filters.withOpenStop) c++;
    if (filters.withFinishedJourney) c++;
    if (filters.withInconsistency) c++;
    return c;
  }, [filters]);

  const handleFleetUpdate = React.useCallback((data: { fleet: LiveMapItem[]; counts: MapCounts }) => {
    setAllFleetData(data.fleet);
    setCounts(data.counts);
  }, []);

  const handleMachineSelect = React.useCallback((machine: LiveMapItem) => {
    setSelectedId(machine.id);
    if (!machine.pos) {
      setNoGpsCode(machine.code);
    } else {
      setNoGpsCode(null);
    }
  }, []);

  const handleSearchChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters(prev => ({ ...prev, search: e.target.value }));
  }, []);

  const toggleStatusFilter = React.useCallback((status: string) => {
    setFilters(prev => ({
      ...prev,
      status: prev.status.includes(status)
        ? prev.status.filter(s => s !== status)
        : [...prev.status, status],
    }));
  }, []);

  const clearFilters = React.useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setShowFilters(false);
  }, []);

  const toggleTvMode = React.useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (isTvMode) {
      next.delete('modo');
      next.delete('tv');
    } else {
      next.set('modo', 'tv');
      next.delete('tv');
    }
    const query = next.toString();
    router.push(query ? `/mapa-operacional?${query}` : '/mapa-operacional');
  }, [isTvMode, router, searchParams]);

  const kpis = [
    { label: 'Online',           value: String(counts.online),         color: 'text-blue-500'    },
    { label: 'Operando',         value: String(counts.operando),       color: 'text-emerald-500' },
    { label: 'Parado',           value: String(counts.parado),         color: 'text-orange-500'  },
    { label: 'Offline',          value: String(counts.offline),        color: 'text-gray-400'    },
    { label: 'Sem GPS recente',  value: String(counts.staleGps),       color: 'text-amber-500'   },
    { label: 'Sem heartbeat',    value: String(counts.staleHeartbeat), color: 'text-red-500'     },
  ];

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans selection:bg-primary/30">

      <Sidebar className="hidden lg:flex shrink-0" />

      {/* ── Fleet sidebar ──────────────────────────────────────────── */}
      <aside className={cn(
        "fixed inset-y-0 left-0 lg:static w-full bg-[#0a0e27]/96 border-r border-[#2d3647] flex flex-col z-[1500] shadow-[10px_0_40px_rgba(0,0,0,0.55)] transition-transform duration-300 lg:translate-x-0",
        isTvMode ? "sm:w-[440px] xl:w-[460px]" : "sm:w-[392px]",
        isFleetSidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
      )}>
        <button onClick={() => setIsFleetSidebarOpen(false)}
          className="lg:hidden absolute right-4 top-6 p-2 text-muted-foreground">
          <CloseIcon size={20} />
        </button>

        {/* Header */}
        <div className={cn("border-b border-[#2d3647] bg-gradient-to-b from-white/[0.02] to-transparent", isTvMode ? "p-7" : "p-6")}>
          <div className="flex items-center justify-between mb-1">
            <h1 className={cn("font-black tracking-tighter", isTvMode ? "text-2xl" : "text-lg")}>
              SILO <span className="text-primary italic">OPS</span> <span className="font-normal opacity-40">Central</span>
            </h1>
            <Settings2 size={18} className="text-muted-foreground hover:text-white cursor-pointer transition-colors" />
          </div>
          <p className={cn("text-muted-foreground uppercase tracking-widest font-bold", isTvMode ? "text-sm" : "text-[10px]")}>Monitoramento de Frota</p>
        </div>

        {/* KPIs */}
        <div className={cn("grid grid-cols-3 bg-[#050812]/65", isTvMode ? "gap-3 p-5" : "gap-2 p-4")}>
          {kpis.map((kpi) => (
            <div key={kpi.label}
              className={cn("bg-[#1a1f3a]/30 border border-[#2d3647] rounded-xl flex flex-col items-center justify-center group hover:border-primary/30 transition-all cursor-pointer", isTvMode ? "min-h-24 p-4" : "p-3")}>
              <span className={cn("text-muted-foreground uppercase font-black tracking-tighter mb-1 group-hover:text-primary transition-colors", isTvMode ? "text-[13px]" : "text-[9px]")}>{kpi.label}</span>
              <span className={cn("font-black italic tracking-tighter leading-none", isTvMode ? "text-4xl" : "text-2xl", kpi.color)}>{kpi.value}</span>
            </div>
          ))}
        </div>

        {/* Search + filter toggle */}
        <div className={cn("space-y-3", isTvMode ? "p-5" : "p-4")}>
          <div className="relative group">
            <Search size={isTvMode ? 22 : 16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input type="text"
              value={filters.search}
              onChange={handleSearchChange}
              placeholder="Pesquise por frota, operador, operacao..."
              className={cn("w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl pl-11 pr-4 focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 text-white font-medium shadow-inner", isTvMode ? "py-4 text-base" : "py-3 text-xs")} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 border rounded-xl font-black uppercase tracking-widest transition-all shadow-lg",
                isTvMode ? "py-4 text-sm" : "py-2.5 text-[11px]",
                showFilters
                  ? "bg-primary/10 border-primary/40 text-primary"
                  : "bg-[#1a1f3a] border-[#2d3647] hover:bg-[#252d4a] hover:border-primary/30"
              )}>
              <Filter size={isTvMode ? 18 : 14} />
              Filtros
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-primary/20 rounded-full text-[9px] font-black text-primary">{activeFilterCount}</span>
              )}
              <ChevronDown size={12} className={cn("transition-transform", showFilters && "rotate-180")} />
            </button>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className={cn("px-4 bg-red-500/10 border border-red-500/30 rounded-xl font-black uppercase text-red-400 hover:bg-red-500/20 transition-all", isTvMode ? "py-4 text-sm" : "py-2.5 text-[11px]")}>
                Limpar
              </button>
            )}
          </div>
        </div>

        {/* ── Filter panel (collapsible) ─────────────────────────── */}
        {showFilters && (
          <div className="px-4 pb-4 space-y-3 border-b border-[#2d3647] animate-in slide-in-from-top-2 duration-200">
            {/* Status chips */}
            <div>
              <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {STATUS_OPTIONS.map(opt => {
                  const active = filters.status.includes(opt.key);
                  return (
                    <button key={opt.key}
                      onClick={() => toggleStatusFilter(opt.key)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all",
                        active
                          ? "bg-primary/15 border-primary/40 text-white"
                          : "bg-[#1a1f3a]/50 border-[#2d3647] text-muted-foreground hover:border-primary/30"
                      )}>
                      <div className={cn("w-2 h-2 rounded-full", opt.tw)} />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Operacao */}
            <div>
              <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Operacao</label>
              <input type="text"
                value={filters.operation}
                onChange={(e) => setFilters(prev => ({ ...prev, operation: e.target.value }))}
                placeholder="Ex: Colheita, Transbordo..."
                className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-lg py-2 px-3 text-[10px] focus:outline-none focus:border-primary/50 text-white placeholder:text-muted-foreground/40" />
            </div>

            {/* Operador */}
            <div>
              <label className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 block">Operador</label>
              <input type="text"
                value={filters.operator}
                onChange={(e) => setFilters(prev => ({ ...prev, operator: e.target.value }))}
                placeholder="Nome do operador..."
                className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-lg py-2 px-3 text-[10px] focus:outline-none focus:border-primary/50 text-white placeholder:text-muted-foreground/40" />
            </div>

            {/* Toggle flags */}
            <div className="flex flex-wrap gap-2">
              <FilterToggle
                label="Com parada aberta"
                active={filters.withOpenStop}
                onClick={() => setFilters(prev => ({ ...prev, withOpenStop: !prev.withOpenStop }))} />
              <FilterToggle
                label="Jornada finalizada"
                active={filters.withFinishedJourney}
                onClick={() => setFilters(prev => ({ ...prev, withFinishedJourney: !prev.withFinishedJourney }))} />
              <FilterToggle
                label="Com inconsistencia"
                active={filters.withInconsistency}
                onClick={() => setFilters(prev => ({ ...prev, withInconsistency: !prev.withInconsistency }))} />
            </div>
          </div>
        )}

        {/* ── Fleet list ─────────────────────────────────────────── */}
        <div className={cn("flex-1 overflow-y-auto custom-scrollbar pb-6", isTvMode ? "px-5 space-y-4" : "px-4 space-y-3")}>
          <div className="flex items-center justify-between py-2 sticky top-0 bg-[#0a0e27] z-10 mb-1">
            <h3 className={cn("font-black text-muted-foreground uppercase tracking-[0.2em]", isTvMode ? "text-sm" : "text-[10px]")}>Frota Ativa</h3>
            <span className={cn("text-primary font-black uppercase", isTvMode ? "text-sm" : "text-[10px]")}>
              {filteredFleetData.length === allFleetData.length
                ? allFleetData.length + ' UNIDADES'
                : filteredFleetData.length + ' / ' + allFleetData.length + ' UNIDADES'}
            </span>
          </div>

          {filteredFleetData.length > 0 ? (
            filteredFleetData.map((machine) => (
              <EquipmentMapCard
                key={machine.id}
                machine={machine}
                isSelected={selectedId === machine.id}
                isTvMode={isTvMode}
                onSelect={handleMachineSelect}
              />
            ))
          ) : allFleetData.length > 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-[#1a1f3a]/20 border border-[#2d3647] rounded-2xl border-dashed">
              <div className="w-12 h-12 bg-[#1a1f3a] rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                <Filter size={20} />
              </div>
              <p className="text-[11px] font-black uppercase text-white mb-1">Nenhum resultado</p>
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-tight">Ajuste os filtros para ver equipamentos.</p>
              <button onClick={clearFilters}
                className="mt-3 text-[10px] font-black uppercase text-primary hover:underline">
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-[#1a1f3a]/20 border border-[#2d3647] rounded-2xl border-dashed">
              <div className="w-12 h-12 bg-[#1a1f3a] rounded-full flex items-center justify-center mb-4 text-muted-foreground">
                <LayoutGrid size={20} />
              </div>
              <p className="text-[11px] font-black uppercase text-white mb-1">Nenhuma frota real online</p>
              <p className="text-[9px] text-muted-foreground font-medium uppercase tracking-tight">Aguardando sinais de GPS ou Heartbeat via APK.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[#050812] border-t border-[#2d3647] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            SINCRO: ONLINE
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">v0.2.0-c4.7</span>
        </div>
      </aside>

      {/* ── Map area ───────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className={cn("absolute left-4 right-4 z-[1400] rounded-2xl border border-white/8 bg-[#08101f]/88 px-4 sm:px-5 shadow-[0_22px_55px_rgba(0,0,0,0.48)] backdrop-blur-2xl", isTvMode ? "top-5 h-20" : "top-4 h-14")}>
          <div className="grid h-full grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1fr)] items-center gap-4">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
              <button
                onClick={toggle}
                className="rounded-xl border border-white/5 bg-white/[0.03] p-2 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-white lg:hidden"
              >
                <Menu size={20} />
              </button>

              <div className="hidden min-w-0 items-center gap-3 sm:flex">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                  <Globe size={isTvMode ? 24 : 16} />
                </div>
                <div className="min-w-0">
                  <span className={cn("block truncate font-black uppercase tracking-[0.22em] text-white", isTvMode ? "text-base" : "text-[10px]")}>
                    Vis?o Geoespacial
                  </span>
                  <span className={cn("block truncate font-bold uppercase tracking-[0.18em] text-muted-foreground", isTvMode ? "text-xs" : "text-[8px]")}>
                    Central operacional ao vivo
                  </span>
                </div>
              </div>
            </div>

            <div className="hidden min-w-0 items-center justify-center gap-3 md:flex">
              <div className="flex flex-col items-center">
                <span className={cn("font-bold uppercase tracking-[0.22em] text-muted-foreground", isTvMode ? "text-sm" : "text-[9px]")}>Data</span>
                <span className={cn("font-black uppercase tracking-tight text-white", isTvMode ? "text-lg" : "text-[11px]")}>
                  {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="h-8 w-px bg-white/8" />
              <div className="flex flex-col items-center">
                <span className={cn("font-bold uppercase tracking-[0.22em] text-muted-foreground", isTvMode ? "text-sm" : "text-[9px]")}>Hora</span>
                <span className={cn("font-black italic tracking-tighter leading-none text-white", isTvMode ? "text-[28px]" : "text-[18px]")}>
                  {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            </div>

            <div className="flex min-w-0 items-center justify-end gap-2 sm:gap-3">
              <button
                onClick={() => setIsFleetSidebarOpen(true)}
                className={cn(
                  "lg:hidden rounded-xl border border-white/5 bg-white/[0.03] p-2 text-primary transition-colors hover:border-primary/30 hover:bg-primary/10",
                  isFleetSidebarOpen && "hidden",
                )}
              >
                <LayoutGrid size={18} />
              </button>
              <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1.5 sm:flex">
                <button onClick={toggleTvMode} className={cn("rounded-xl border border-primary/20 bg-primary/10 px-3 font-black uppercase tracking-[0.12em] text-primary hover:bg-primary/20", isTvMode ? "h-12 text-sm" : "h-8 text-[10px]")}>
                  {isTvMode ? 'Sair TV' : 'Modo TV'}
                </button>
                <MapControl icon={<Maximize2 size={isTvMode ? 20 : 15} />} isTvMode={isTvMode} />
                <MapControl icon={<MapIcon size={isTvMode ? 20 : 15} />} isTvMode={isTvMode} />
                <MapControl icon={<Settings2 size={isTvMode ? 20 : 15} />} isTvMode={isTvMode} />
              </div>
              <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/5 bg-white/[0.03] px-2.5 py-1.5">
                <div className="hidden min-w-0 text-right sm:block">
                  <p className="truncate text-[11px] font-black italic uppercase tracking-tighter text-white leading-none">Joao Oliveira</p>
                  <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-primary">Admin</p>
                </div>
                <div className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-tr from-[#1a1f3a] to-[#2d3647] p-[1px] shadow-[0_0_18px_rgba(0,0,0,0.24)]">
                  <div className="flex h-full w-full items-center justify-center rounded-full bg-[#0a0e27] font-black italic text-sm text-primary">JO</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <FullMap onFleetUpdate={handleFleetUpdate} onTrailOpenChange={setTrailPanelOpen} selectedId={selectedId} filters={filters} isTvMode={isTvMode} />

        {noGpsCode && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1450] flex items-center gap-2 bg-[#1a0f08] border border-orange-500/40 text-orange-300 px-4 py-2.5 rounded-xl shadow-2xl text-[11px] font-bold uppercase tracking-wide">
            <AlertTriangle size={14} className="text-orange-400 shrink-0" />
            {'Frota ' + noGpsCode + ' sem ultima posicao valida'}
            <button onClick={() => setNoGpsCode(null)} className="ml-2 text-orange-400/60 hover:text-orange-300 transition-colors">
              <CloseIcon size={12} />
            </button>
          </div>
        )}

        {allFleetData.length > 0 && !trailPanelOpen && (
          <div className="absolute bottom-8 left-4 z-[1400]">
            <MapLegend isTvMode={isTvMode} items={filteredFleetData.map(m => ({
              iconType: m.iconType,
              iconSource: m.iconSource,
              iconLabel: m.iconLabel,
              resolvedIconType: m.resolvedIconType,
              status: m.status,
              label: m.implementName || m.equipmentModel || m.equipmentType || m.type || m.name,
            }))} />
            {filteredFleetData.length !== allFleetData.length && (
              <div className="mt-1 text-[9px] font-bold text-muted-foreground text-center">
                {filteredFleetData.filter(m => m.pos).length} visiveis no mapa
              </div>
            )}
          </div>
        )}

        <div className={cn(
          "absolute right-4 flex flex-col gap-2 z-[1400] transition-all duration-300",
          trailPanelOpen ? (isTvMode ? "top-32" : "top-24") : "bottom-8",
        )}>
          <div className={cn("bg-[#0a0e27]/90 backdrop-blur-xl border border-[#2d3647] rounded-xl flex flex-col shadow-2xl", isTvMode ? "p-2.5 gap-2.5" : "p-1.5 gap-1.5")}>
            <button className={cn("rounded-lg bg-primary text-[#0a0e27] flex items-center justify-center font-black shadow-md shadow-primary/20 hover:scale-105 transition-transform", isTvMode ? "h-16 w-16 text-sm" : "w-10 h-7 text-[9px]")}>SAT</button>
            <button className={cn("rounded-lg bg-[#1a1f3a] text-white/40 flex items-center justify-center font-black border border-white/5 hover:text-white hover:bg-primary/20 transition-all uppercase", isTvMode ? "h-16 w-16 text-sm" : "w-10 h-7 text-[9px]")}>Op</button>
            <button className={cn("rounded-lg bg-[#1a1f3a] text-white/40 flex items-center justify-center font-black border border-white/5 hover:text-white hover:bg-primary/20 transition-all uppercase", isTvMode ? "h-16 w-16 text-sm" : "w-10 h-7 text-[9px]")}>Tal</button>
          </div>
        </div>
      </main>
    </div>
  );
}

const NOT_INFORMED = 'Nao informado';

const formatLiveTime = (value?: string) => {
  if (!value) return NOT_INFORMED;
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return NOT_INFORMED;
  return time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const formatLiveValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return NOT_INFORMED;
  return String(value);
};

function FilterToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn(
      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all",
      active ? "bg-primary/15 border-primary/40 text-primary" : "bg-[#1a1f3a]/50 border-[#2d3647] text-muted-foreground hover:border-primary/30"
    )}>
      {active ? <CheckCircle2 size={10} /> : <div className="w-2.5 h-2.5 rounded border border-muted-foreground/40" />}
      {label}
    </button>
  );
}

function EquipmentMapCard({ machine, isSelected, isTvMode, onSelect }: { machine: LiveMapItem; isSelected: boolean; isTvMode: boolean; onSelect: (machine: LiveMapItem) => void }) {
  // Campos separados: status operacional (badge principal) e status de comunicação (secundário)
  type ExtMachine = LiveMapItem & { operationalStatus?: string; communicationStatus?: string; isOnline?: boolean };
  const ext = machine as ExtMachine;
  // Usar operationalStatus quando disponível; cair em status para retrocompat
  const opStatusKey = (ext.operationalStatus ?? machine.status)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') as keyof typeof STATUS_CONFIG;
  const status = STATUS_CONFIG[opStatusKey] || STATUS_CONFIG.offline;
  // Comunicação: isOnline quando disponível (computado em getLiveFleet), fallback em status
  const isOnline = ext.isOnline !== undefined ? ext.isOnline : machine.status !== 'OFFLINE';
  const hasGps = machine.pos !== null;

  return (
    <button type="button" onClick={() => onSelect(machine)}
      className={cn(
        "group w-full relative flex items-center border rounded-2xl transition-all cursor-pointer shadow-lg overflow-hidden text-left",
        isTvMode ? "min-h-[118px] gap-5 p-5" : "gap-4 p-4",
        isSelected ? "bg-primary/10 border-primary/70 shadow-[0_0_0_1px_rgba(34,197,94,0.25),0_0_24px_rgba(34,197,94,0.12)] ring-1 ring-primary/30" : "bg-[#1a1f3a]/30 border-[#2d3647] hover:border-primary/50 hover:bg-[#1a1f3a]/50"
      )}>
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 opacity-80 transition-all group-hover:w-2", status.tailwind, isSelected && "w-2")} />
      <div className={cn("rounded-xl border flex items-center justify-center transition-transform group-hover:scale-110", isTvMode ? "p-4" : "p-2.5", status.tailwind.replace('bg-', 'bg-').replace('500', '500/10'), status.text.replace('text-', 'border-').replace('500', '500/20'))}>
              <EquipmentIcon type={machine.iconType} size={isTvMode ? 34 : 20} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={cn("font-black italic tracking-tighter leading-none transition-colors", isTvMode ? "text-xl" : "text-sm", isSelected ? "text-primary" : "text-white group-hover:text-primary")}>{machine.code}</span>
            <div className="h-3 w-[1px] bg-white/10" />
            <span className={cn("text-muted-foreground uppercase font-black tracking-widest", isTvMode ? "text-sm" : "text-[9px]")}>
              {formatLiveValue(machine.implementName || machine.equipmentModel || machine.equipmentType || machine.type || machine.name)}
            </span>
          </div>
          <span className={cn("text-muted-foreground font-bold uppercase", isTvMode ? "text-xs" : "text-[8px]")}>{formatLiveTime(machine.lastHeartbeatAt || machine.lastGpsAt)}</span>
        </div>
        <p className={cn("text-white/60 font-bold uppercase truncate mb-1 tracking-tight", isTvMode ? "text-base" : "text-[10px]")}>{machine.displayOperation}</p>
        <div className={cn("flex items-center", isTvMode ? "gap-4" : "gap-3")}>
          {/* Status operacional — badge PRINCIPAL */}
          <div className="flex items-center gap-1">
            <div className={cn(isTvMode ? "h-2.5 w-2.5" : "w-1.5 h-1.5", "rounded-full", status.tailwind)} />
            <span className={cn("font-black uppercase tracking-tighter", isTvMode ? "text-sm" : "text-[9px]", status.text)}>{status.label}</span>
          </div>
          {/* Status de comunicação — SECUNDÁRIO */}
          <span className={cn("font-bold uppercase tracking-tighter", isTvMode ? "text-xs" : "text-[8px]",
            isOnline ? "text-blue-400/60" : "text-gray-500"
          )}>
            {isOnline ? 'Online' : 'Offline'}
          </span>
          {!hasGps && (<div className={cn("flex items-center gap-1 text-orange-400 font-bold", isTvMode ? "text-xs" : "text-[9px]")}><AlertTriangle size={isTvMode ? 13 : 9} /><span>Sem GPS</span></div>)}
          {hasGps && (<div className={cn("flex items-center gap-1 text-muted-foreground font-bold", isTvMode ? "text-xs" : "text-[9px]")}><Clock size={isTvMode ? 14 : 10} /><span>{machine.hourmeterCurrent != null
                ? (Number(machine.hourmeterCurrent).toFixed(1).replace('.', ',') + ' h')
                : NOT_INFORMED}</span></div>)}
          {machine.hourmeterInconsistent && (<div className={cn("flex items-center gap-1 text-red-400 font-bold", isTvMode ? "text-xs" : "text-[9px]")}><AlertTriangle size={isTvMode ? 13 : 9} /><span>Incons.</span></div>)}
          {isSelected && (<div className={cn("ml-auto flex items-center gap-1 text-primary font-bold", isTvMode ? "text-xs" : "text-[9px]")}><Hash size={isTvMode ? 13 : 9} /><span>Selecionado</span></div>)}
        </div>
      </div>
      <div className="p-1.5 text-muted-foreground"><MoreVertical size={isTvMode ? 22 : 16} /></div>
    </button>
  );
}

function MapControl({ icon, isTvMode = false }: { icon: React.ReactNode; isTvMode?: boolean }) {
  return (
    <button className={cn("flex items-center justify-center rounded-xl border border-white/5 bg-[#0a0e27]/70 text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-white focus:outline-none focus:ring-1 focus:ring-primary/20", isTvMode ? "h-12 w-12" : "h-8 w-8")}>
      {icon}
    </button>
  );
}

export default withAuth(MapaOperacionalPage, { module: 'MAPA' });
