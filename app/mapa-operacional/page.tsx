"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import {
  Search,
  Filter,
  Settings2,
  Globe,
  Clock,
  LayoutGrid,
  Map as MapIcon,
  Maximize2,
  MoreVertical,
  Menu,
  X as CloseIcon,
  AlertTriangle,
  HelpCircle
} from 'lucide-react';
import { MAP_KPIS, FLEET_DATA, STATUS_CONFIG, MACHINE_TYPES } from '@/lib/mock/map-data';
import { cn } from '@/lib/utils';
import { Sidebar } from '@/components/layout/sidebar';
import { useSidebar } from '@/lib/context/sidebar-context';
import { withAuth } from '@/components/shared/with-auth';

const FullMap = dynamic(() => import('@/components/mapa/full-map-enterprise'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-[#050812] flex items-center justify-center">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-xs text-primary animate-pulse uppercase tracking-[0.4em] font-black">SILO OPS CENTRAL</p>
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Carregando Módulos Geoespaciais...</p>
        </div>
      </div>
    </div>
  )
});

function MapaOperacionalPage() {
  const { toggle } = useSidebar();
  const [isFleetSidebarOpen, setIsFleetSidebarOpen] = React.useState(true);

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans selection:bg-primary/30">

      {/* Sidebar de Navegação (Global) */}
      <Sidebar className="hidden lg:flex shrink-0" />

      {/* Sidebar Lateral de Frota (Específica do Mapa) */}
      <aside className={cn(
        "fixed inset-y-0 left-0 lg:static w-full sm:w-[380px] bg-[#0a0e27]/95 border-r border-[#2d3647] flex flex-col z-[1500] shadow-[10px_0_30px_rgba(0,0,0,0.5)] transition-transform duration-300 lg:translate-x-0",
        isFleetSidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
      )}>

        {/* Mobile Close for Fleet Sidebar */}
        <button
          onClick={() => setIsFleetSidebarOpen(false)}
          className="lg:hidden absolute right-4 top-6 p-2 text-muted-foreground"
        >
          <CloseIcon size={20} />
        </button>

        {/* Logo & Header Sidebar */}
        <div className="p-6 border-b border-[#2d3647]">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-black tracking-tighter">
              SILO <span className="text-primary italic">OPS</span> <span className="font-normal opacity-40">Central</span>
            </h1>
            <Settings2 size={18} className="text-muted-foreground hover:text-white cursor-pointer transition-colors" />
          </div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Monitoramento de Frota</p>
        </div>

        {/* KPIs Operacionais */}
        <div className="grid grid-cols-3 gap-2 p-4 bg-[#050812]/50">
          {MAP_KPIS.map((kpi) => (
            <div key={kpi.label} className="bg-[#1a1f3a]/30 border border-[#2d3647] p-3 rounded-xl flex flex-col items-center group hover:border-primary/30 transition-all cursor-pointer">
              <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter mb-1 group-hover:text-primary transition-colors">{kpi.label}</span>
              <span className={cn("text-2xl font-black italic tracking-tighter leading-none", kpi.color)}>{kpi.value}</span>
            </div>
          ))}
        </div>

        {/* Busca e Ações Rápidas */}
        <div className="p-4 space-y-4">
          <div className="relative group">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Pesquise por equipamento, fazenda, talhão ou operador..."
              className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl py-3 pl-11 pr-4 text-xs focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 text-white font-medium shadow-inner"
            />
          </div>

          <div className="flex gap-2">
            <button className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-[#252d4a] hover:border-primary/30 transition-all shadow-lg">
              <LayoutGrid size={14} className="text-primary" /> Busca Avançada
            </button>
            <button className="px-4 py-2.5 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[11px] font-black uppercase hover:bg-[#252d4a] transition-all shadow-lg">
              <Filter size={14} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Lista de Equipamentos */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-6 space-y-3">
          <div className="flex items-center justify-between py-2 sticky top-0 bg-[#0a0e27] z-10 mb-1">
             <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Frota Ativa</h3>
             <span className="text-[10px] text-primary font-black uppercase">{FLEET_DATA.length} UNIDADES</span>
          </div>

          {FLEET_DATA.map((machine) => (
            <EquipmentMapCard key={machine.id} machine={machine} />
          ))}
        </div>

        {/* Footer Sidebar */}
        <div className="p-4 bg-[#050812] border-t border-[#2d3647] flex items-center justify-between">
           <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground">
             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
             SINCRO: ONLINE
           </div>
           <span className="text-[10px] text-muted-foreground font-medium">v0.1.0-piloto</span>
        </div>
      </aside>

      {/* Área Principal do Mapa */}
      <main className="flex-1 flex flex-col relative overflow-hidden">

        {/* Header Superior Fino */}
        <header className="absolute top-4 left-4 right-4 h-14 bg-[#0a0e27]/80 backdrop-blur-xl border border-[#2d3647] rounded-2xl flex items-center justify-between px-4 sm:px-6 z-[1400] shadow-2xl">
          <div className="flex items-center gap-3 sm:gap-6">
            <button
              onClick={toggle}
              className="lg:hidden p-2 hover:bg-[#1a1f3a] rounded-lg text-muted-foreground hover:text-white transition-colors"
            >
              <Menu size={20} />
            </button>

            <div className="flex items-center gap-3 hidden xs:flex">
              <div className="p-2 bg-primary/10 rounded-lg hidden sm:block">
                <Globe size={18} className="text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] sm:text-xs font-black italic tracking-tighter text-white uppercase">Visão Geoespacial</span>
                <span className="text-[8px] sm:text-[9px] text-muted-foreground font-bold uppercase tracking-widest leading-none">Global Operations Center</span>
              </div>
            </div>

            <div className="h-6 w-[1px] bg-[#2d3647] hidden md:block"></div>

            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground hidden md:flex">
              <div className="flex flex-col">
                <span className="text-white">04 JUN 2024</span>
                <span className="text-[8px] text-primary">TERÇA-FEIRA</span>
              </div>
              <span className="text-xl italic text-white font-black tracking-tighter">14:55:10</span>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6">
            <button
               onClick={() => setIsFleetSidebarOpen(true)}
               className={cn("lg:hidden p-2 bg-[#1a1f3a] rounded-xl text-primary border border-[#2d3647]", isFleetSidebarOpen && "hidden")}
            >
               <LayoutGrid size={18} />
            </button>

            <div className="flex items-center gap-4 pr-3 sm:pr-6 border-r border-[#2d3647] hidden sm:flex">
               <MapControl icon={<Maximize2 size={16} />} />
               <MapControl icon={<MapIcon size={16} />} />
               <MapControl icon={<Settings2 size={16} />} />
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-black italic text-white tracking-tighter uppercase leading-none">João Oliveira</p>
                <p className="text-[9px] text-primary font-bold uppercase tracking-widest">Admin</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#1a1f3a] to-[#2d3647] p-[1px] shadow-lg">
                <div className="w-full h-full rounded-[11px] bg-[#0a0e27] flex items-center justify-center font-black italic text-primary text-sm">JO</div>
              </div>
            </div>
          </div>
        </header>

        {/* Mapa Real */}
        <FullMap />

        {/* Float Controls Layer Switcher */}
        <div className="absolute bottom-8 right-8 flex flex-col gap-3 z-[1400]">
           <div className="bg-[#0a0e27]/90 backdrop-blur-xl border border-[#2d3647] rounded-2xl p-2 flex flex-col gap-2 shadow-2xl">
              <button className="w-12 h-12 rounded-xl bg-primary text-[#0a0e27] flex items-center justify-center font-black text-[10px] shadow-lg shadow-primary/20 hover:scale-105 transition-transform">SAT</button>
              <button className="w-12 h-12 rounded-xl bg-[#1a1f3a] text-white/40 flex items-center justify-center font-black text-[10px] border border-white/5 hover:text-white hover:bg-primary/20 transition-all uppercase">Op</button>
              <button className="w-12 h-12 rounded-xl bg-[#1a1f3a] text-white/40 flex items-center justify-center font-black text-[10px] border border-white/5 hover:text-white hover:bg-primary/20 transition-all uppercase">Tal</button>
           </div>
        </div>

        {/* Overlay Alarmes Ativos */}
        <div className="absolute top-24 right-8 w-80 space-y-3 z-[1300] pointer-events-none">
           <div className="bg-red-500/10 border border-red-500/50 backdrop-blur-xl rounded-2xl p-4 flex items-center gap-4 shadow-2xl animate-in slide-in-from-right duration-500 pointer-events-auto cursor-pointer hover:bg-red-500/20 transition-all group">
              <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center text-white shadow-lg group-hover:scale-110 transition-transform">
                <AlertTriangle size={24} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-black italic tracking-tighter text-white uppercase leading-none">614004</span>
                  <span className="text-[9px] font-black text-red-500 uppercase">Agora</span>
                </div>
                <p className="text-[10px] text-red-500/80 font-black uppercase tracking-tight leading-tight">RPM MÁXIMA MOTOR</p>
                <p className="text-[8px] text-white/40 font-bold uppercase mt-1">CARREGADEIRA • FRENTE 03</p>
              </div>
           </div>
        </div>

      </main>
    </div>
  );
}

function EquipmentMapCard({ machine }: { machine: typeof FLEET_DATA[0] }) {
  const status = STATUS_CONFIG[machine.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.offline;
  const machineType = MACHINE_TYPES[machine.type as keyof typeof MACHINE_TYPES];
  const TypeIcon = machineType?.icon || HelpCircle;

  return (
    <div className="group relative flex items-center gap-4 p-4 bg-[#1a1f3a]/30 border border-[#2d3647] rounded-2xl hover:border-primary/50 hover:bg-[#1a1f3a]/50 transition-all cursor-pointer shadow-lg overflow-hidden">
      {/* Barra de Status Lateral */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5 opacity-80 transition-all group-hover:w-2", status.tailwind)}></div>

      {/* Ícone & Status Indicador */}
      <div className={cn("p-2.5 rounded-xl border flex items-center justify-center transition-transform group-hover:scale-110",
        status.tailwind.replace('bg-', 'bg-').replace('500', '500/10'),
        status.text.replace('text-', 'border-').replace('500', '500/20')
      )}>
        <TypeIcon size={18} className={status.text} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black italic text-white tracking-tighter leading-none group-hover:text-primary transition-colors">{machine.id}</span>
            <div className="h-3 w-[1px] bg-white/10"></div>
            <span className="text-[9px] text-muted-foreground uppercase font-black tracking-widest">{machine.type}</span>
          </div>
          <span className="text-[8px] text-muted-foreground font-bold uppercase">{machine.lastSignal}</span>
        </div>

        <p className="text-[10px] text-white/60 font-bold uppercase truncate mb-1 tracking-tight">{machine.operation}</p>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
             <div className={cn("w-1.5 h-1.5 rounded-full", status.tailwind)}></div>
             <span className={cn("text-[9px] font-black uppercase tracking-tighter", status.text)}>{status.label}</span>
          </div>
          <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-bold">
             <Clock size={10} />
             <span>{machine.hourmeter}</span>
          </div>
        </div>
      </div>

      <button className="p-1.5 text-muted-foreground hover:text-white transition-colors">
        <MoreVertical size={16} />
      </button>
    </div>
  );
}

function MapControl({ icon }: any) {
  return (
    <button className="p-2 text-muted-foreground hover:text-white hover:bg-[#1a1f3a] rounded-xl transition-all">
      {icon}
    </button>
  );
}

export default withAuth(MapaOperacionalPage, { module: 'MAPA' });
