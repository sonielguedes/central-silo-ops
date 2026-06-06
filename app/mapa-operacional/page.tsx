"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import {
  AlertTriangle, Clock, Filter, Globe, Hash,
  LayoutGrid, Map as MapIcon, Maximize2,
  Menu, MoreVertical, Navigation, Search, Settings2,
  Tractor, Truck, X as CloseIcon, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/layout/sidebar';
import { useSidebar } from '@/lib/context/sidebar-context';
import { withAuth } from '@/components/shared/with-auth';
import type { LiveMapItem, MapCounts } from '@/components/mapa/full-map-enterprise';

const STATUS_CONFIG = {
  online:     { label: 'Online',     tailwind: 'bg-blue-500',    text: 'text-blue-500'    },
  operando:   { label: 'Operando',   tailwind: 'bg-emerald-500', text: 'text-emerald-500' },
  parado:     { label: 'Parado',     tailwind: 'bg-orange-500',  text: 'text-orange-500'  },
  finalizado: { label: 'Finalizado', tailwind: 'bg-gray-500',    text: 'text-gray-500'    },
  offline:    { label: 'Offline',    tailwind: 'bg-gray-500',    text: 'text-gray-500'    },
};

const EMPTY_COUNTS: MapCounts = { online: 0, operando: 0, parado: 0, offline: 0, staleGps: 0, staleHeartbeat: 0 };

const FullMap = dynamic(() => import('@/components/mapa/full-map-enterprise'), {
  ssr: false,
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

function MapaOperacionalPage() {
  const { toggle } = useSidebar();
  const [isFleetSidebarOpen, setIsFleetSidebarOpen] = React.useState(true);
  const [fleetData, setFleetData]   = React.useState<LiveMapItem[]>([]);
  const [counts, setCounts]         = React.useState<MapCounts>(EMPTY_COUNTS);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [noGpsCode, setNoGpsCode]   = React.useState<string | null>(null);

  const handleFleetUpdate = React.useCallback((data: { fleet: LiveMapItem[]; counts: MapCounts }) => {
    setFleetData(data.fleet);
    setCounts(data.counts);
  }, []);

  const handleMachineSelect = React.useCallback((machine: LiveMapItem) => {
    console.info('[map-ui] sidebar click fleetCode=' + machine.code);
    setSelectedId(machine.id);
    if (!machine.pos) {
      setNoGpsCode(machine.code);
    } else {
      setNoGpsCode(null);
    }
  }, []);

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

      <aside className={cn(
        "fixed inset-y-0 left-0 lg:static w-full sm:w-[380px] bg-[#0a0e27]/95 border-r border-[#2d3647] flex flex-col z-[1500] shadow-[10px_0_30px_rgba(0,0,0,0.5)] transition-transform duration-300 lg:translate-x-0",
        isFleetSidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
      )}>
        <button onClick={() => setIsFleetSidebarOpen(false)}
          className="lg:hidden absolute right-4 top-6 p-2 text-muted-foreground">
          <CloseIcon size={20} />
        </button>

        <div className="p-6 border-b border-[#2d3647]">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-black tracking-tighter">
              SILO <span className="text-primary italic">OPS</span> <span className="font-normal opacity-40">Central</span>
            </h1>
            <Settings2 size={18} className="text-muted-foreground hover:text-white cursor-pointer transition-colors" />
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Monitoramento de Frota</p>
        </div>

        <div className="grid grid-cols-3 gap-2 p-4 bg-[#050812]/50">
          {kpis.map((kpi) => (
            <div key={kpi.label}
              className="bg-[#1a1f3a]/30 border border-[#2d3647] p-3 rounded-xl flex flex-col items-center group hover:border-primary/30 transition-all cursor-pointer">
              <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter mb-1 group-hover:text-primary transition-colors">{kpi.label}</span>
              <span className={cn("text-2xl font-black italic tracking-tighter leading-none", kpi.color)}>{kpi.value}</span>
            </div>
          ))}
        </div>

        <div className="p-4 space-y-4">
          <div className="relative group">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input type="text"
              placeholder="Pesquise por equipamento, fazenda, talhao ou operador..."
              className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl py-3 pl-11 pr-4 text-xs focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 text-white font-medium shadow-inner" />
          </div>
          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#252d4a] hover:border-primary/30 transition-all shadow-lg">
              <LayoutGrid size={14} className="text-primary" /> Busca Avancada
            </button>
            <button className="px-4 py-2.5 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[11px] font-black uppercase hover:bg-[#252d4a] transition-all shadow-lg">
              <Filter size={14} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-6 space-y-3">
          <div className="flex items-center justify-between py-2 sticky top-0 bg-[#0a0e27] z-10 mb-1">
            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Frota Ativa</h3>
            <span className="text-[10px] text-primary font-black uppercase">{fleetData.length} UNIDADES</span>
          </div>

          {fleetData.length > 0 ? (
            fleetData.map((machine) => (
              <EquipmentMapCard
                key={machine.id}
                machine={machine}
                isSelected={selectedId === machine.id}
                onSelect={handleMachineSelect}
              />
            ))
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

        <div className="p-4 bg-[#050812] border-t border-[#2d3647] flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            SINCRO: ONLINE
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">v0.1.0-piloto</span>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="absolute top-4 left-4 right-4 h-14 bg-[#0a0e27]/80 backdrop-blur-xl border border-[#2d3647] rounded-2xl flex items-center justify-between px-4 sm:px-6 z-[1400] shadow-2xl">
          <div className="flex items-center gap-3 sm:gap-6">
            <button onClick={toggle}
              className="lg:hidden p-2 hover:bg-[#1a1f3a] rounded-lg text-muted-foreground hover:text-white transition-colors">
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-3 hidden xs:flex">
              <div className="p-2 bg-primary/10 rounded-lg hidden sm:block">
                <Globe size={18} className="text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] sm:text-xs font-black italic tracking-tighter text-white uppercase">Visao Geoespacial</span>
                <span className="text-[8px] sm:text-[9px] text-muted-foreground font-bold uppercase tracking-widest leading-none">Global Operations Center</span>
              </div>
            </div>
            <div className="h-6 w-[1px] bg-[#2d3647] hidden md:block" />
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:flex">
              <div className="flex flex-col">
                <span className="text-white uppercase">{new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <span className="text-[8px] text-primary uppercase">{new Date().toLocaleDateString('pt-BR', { weekday: 'long' })}</span>
              </div>
              <span className="text-xl italic text-white font-black tracking-tighter">
                {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <button onClick={() => setIsFleetSidebarOpen(true)}
              className={cn("lg:hidden p-2 bg-[#1a1f3a] rounded-xl text-primary border border-[#2d3647]", isFleetSidebarOpen && "hidden")}>
              <LayoutGrid size={18} />
            </button>
            <div className="flex items-center gap-4 pr-3 sm:pr-6 border-r border-[#2d3647] hidden sm:flex">
              <MapControl icon={<Maximize2 size={16} />} />
              <MapControl icon={<MapIcon size={16} />} />
              <MapControl icon={<Settings2 size={16} />} />
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black italic text-white tracking-tighter uppercase leading-none">Joao Oliveira</p>
                <p className="text-[9px] text-primary font-bold uppercase tracking-widest">Admin</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1a1f3a] to-[#2d3647] p-[1px] shadow-lg">
                <div className="w-full h-full rounded-[11px] bg-[#0a0e27] flex items-center justify-center font-black italic text-primary text-sm">JO</div>
              </div>
            </div>
          </div>
        </header>

        <FullMap onFleetUpdate={handleFleetUpdate} selectedId={selectedId} />

        {noGpsCode && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[1450] flex items-center gap-2 bg-[#1a0f08] border border-orange-500/40 text-orange-300 px-4 py-2.5 rounded-xl shadow-2xl text-[11px] font-bold uppercase tracking-wide">
            <AlertTriangle size={14} className="text-orange-400 shrink-0" />
            {'Frota ' + noGpsCode + ' sem ultima posicao valida'}
            <button onClick={() => setNoGpsCode(null)} className="ml-2 text-orange-400/60 hover:text-orange-300 transition-colors">
              <CloseIcon size={12} />
            </button>
          </div>
        )}

        <div className="absolute bottom-8 right-8 flex flex-col gap-3 z-[1400]">
          <div className="bg-[#0a0e27]/90 backdrop-blur-xl border border-[#2d3647] rounded-2xl p-2 flex flex-col gap-2 shadow-2xl">
            <button className="w-12 h-12 rounded-xl bg-primary text-[#0a0e27] flex items-center justify-center font-black text-[10px] shadow-lg shadow-primary/20 hover:scale-105 transition-transform">SAT</button>
            <button className="w-12 h-12 rounded-xl bg-[#1a1f3a] text-white/40 flex items-center justify-center font-black text-[10px] border border-white/5 hover:text-white hover:bg-primary/20 transition-all uppercase">Op</button>
            <button className="w-12 h-12 rounded-xl bg-[#1a1f3a] text-white/40 flex items-center justify-center font-black text-[10px] border border-white/5 hover:text-white hover:bg-primary/20 transition-all uppercase">Tal</button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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

// ── Equipment card in sidebar ─────────────────────────────────────────────────
function EquipmentMapCard({
  machine, isSelected, onSelect,
}: {
  machine: LiveMapItem;
  isSelected: boolean;
  onSelect: (machine: LiveMapItem) => void;
}) {
  const status   = STATUS_CONFIG[machine.status.toLowerCase() as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.offline;
  const TypeIcon = machine.typeIcon === 'Tractor' ? Tractor :
                   machine.typeIcon === 'Truck'   ? Truck   :
                   machine.typeIcon === 'Zap'     ? Zap     : Navigation;
  const hasGps   = machine.pos !== null;

  return (
    <button
      type="button"
      onClick={() => onSelect(machine)}
      className={cn(
        "group w-full relative flex items-center gap-4 p-4 border rounded-2xl transition-all cursor-pointer shadow-lg overflow-hidden text-left",
        isSelected
          ? "bg-primary/10 border-primary/60 shadow-primary/10"
          : "bg-[#1a1f3a]/30 border-[#2d3647] hover:border-primary/50 hover:bg-[#1a1f3a]/50"
      )}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 opacity-80 transition-all group-hover:w-2", status.tailwind, isSelected && "w-2")} />

      <div className={cn(
        "p-2.5 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-110",
        status.tailwind.replace('bg-', 'bg-').replace('500', '500/10'),
        status.text.replace('text-', 'border-').replace('500', '500/20')
      )}>
        <TypeIcon size={18} className={status.text} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-black italic tracking-tighter leading-none transition-colors",
              isSelected ? "text-primary" : "text-white group-hover:text-primary"
            )}>{machine.code}</span>
            <div className="h-3 w-[1px] bg-white/10" />
            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">
              {formatLiveValue(machine.type || machine.name)}
            </span>
          </div>
          <span className="text-[8px] text-muted-foreground font-bold uppercase">
            {formatLiveTime(machine.lastHeartbeatAt || machine.lastGpsAt)}
          </span>
        </div>

        <p className="text-[10px] text-white/60 font-bold uppercase truncate mb-1 tracking-tight">{machine.displayOperation}</p>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className={cn("w-1.5 h-1.5 rounded-full", status.tailwind)} />
            <span className={cn("text-[9px] font-black uppercase tracking-tighter", status.text)}>{status.label}</span>
          </div>
          {!hasGps && (
            <div className="flex items-center gap-1 text-[9px] text-orange-400 font-bold">
              <AlertTriangle size={9} />
              <span>Sem GPS</span>
            </div>
          )}
          {hasGps && (
            <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-bold">
              <Clock size={10} />
              <span>{machine.hourmeterCurrent != null ? machine.hourmeterCurrent + 'h' : NOT_INFORMED}</span>
            </div>
          )}
          {isSelected && (
            <div className="ml-auto flex items-center gap-1 text-[9px] text-primary font-bold">
              <Hash size={9} />
              <span>Selecionado</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-1.5 text-muted-foreground">
        <MoreVertical size={16} />
      </div>
    </button>
  );
}

function MapControl({ icon }: { icon: React.ReactNode }) {
  return (
    <button className="p-2 text-muted-foreground hover:text-white hover:bg-[#1a1f3a] rounded-xl transition-all">
      {icon}
    </button>
  );
}

export default withAuth(MapaOperacionalPage, { module: 'MAPA' });
