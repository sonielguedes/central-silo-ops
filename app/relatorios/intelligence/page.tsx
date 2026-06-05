"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
  RefreshCw, Clock, Filter, Download, Zap, Activity, ShieldCheck, AlertTriangle,
  Settings2, Layers, Cpu, Gauge, Calendar, MapPin, Truck, X, Search
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Mock Data ---
const OVERVIEW_KPIS = [
  { label: 'Eficiência de Campo', value: '88.4%', trend: '+2.1%', status: 'ONLINE', icon: Zap, color: 'text-primary' },
  { label: 'Disp. Mecânica', value: '94.2%', trend: '-0.5%', status: 'ONLINE', icon: ShieldCheck, color: 'text-emerald-500' },
  { label: 'Motor Ocioso', value: '12.8%', trend: '+1.2%', status: 'ATRASADO', icon: Cpu, color: 'text-amber-500' },
  { label: 'Velocidade Média', value: '5.2 km/h', trend: 'Estável', status: 'ONLINE', icon: Gauge, color: 'text-blue-500' },
];

const OPERATIONAL_TIME_DATA = [
  { name: 'COLHEITA', Tempo: 1200, color: '#10b981' },
  { name: 'MANOBRA', Tempo: 300, color: '#34d399' },
  { name: 'DESLOCAMENTO', Tempo: 450, color: '#fbbf24' },
  { name: 'PARADA OP', Tempo: 150, color: '#f97316' },
  { name: 'MANUTENÇÃO', Tempo: 100, color: '#ef4444' },
];

const MECHANICAL_AVAILABILITY_DATA = [
  { subject: 'Motor', A: 98, fullMark: 100 },
  { subject: 'Hidráulico', A: 92, fullMark: 100 },
  { subject: 'Elétrico', A: 85, fullMark: 100 },
  { subject: 'Estrutural', A: 95, fullMark: 100 },
  { subject: 'Transmissão', A: 88, fullMark: 100 },
];

const LOSS_RANKING_DATA = [
  { reason: 'Aguardando Logística', hours: 145, percentage: 42 },
  { reason: 'Troca de Turno', hours: 82, percentage: 24 },
  { reason: 'Clima', hours: 56, percentage: 16 },
  { reason: 'Embucha', hours: 38, percentage: 11 },
  { reason: 'Outros', hours: 24, percentage: 7 },
];

const ANALYTIC_DATA = [
  { id: 'IQ-1001', equip: '605112', group: 'FRENTE 01', op: 'COLHEITA', efficiency: '92%', status: 'PRODUTIVO', last: 'Agora' },
  { id: 'IQ-1002', equip: '601076', group: 'LOGÍSTICA', op: 'TRANSPORTE', efficiency: '85%', status: 'TRANSPORTE', last: '5 min' },
  { id: 'IQ-1003', equip: '613020', group: 'FRENTE 02', op: 'MANOBRA', efficiency: '40%', status: 'PRODUTIVO', last: 'Agora' },
  { id: 'IQ-1004', equip: '609001', group: 'FRENTE 01', op: 'PARADA', efficiency: '0%', status: 'ATENÇÃO', last: '12 min' },
];

export default function IntelligencePage() {
  const [loading, setLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [refreshCountdown, setRefreshCountdown] = useState(60);
  const status = 'ONLINE';

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1500);
    const interval = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) return 60;
        return prev - 1;
      });
    }, 1000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setRefreshCountdown(60);
    }, 800);
  };

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">

          {/* Top Bar Intelligence */}
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                 <div className="p-2 bg-primary/10 rounded-xl">
                    <Activity size={24} className="text-primary" />
                 </div>
                 <h1 className="text-3xl font-black italic tracking-tighter uppercase text-white leading-none">Intelligence</h1>
                 <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black border flex items-center gap-2",
                    status === 'ONLINE' ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" : "text-amber-500 bg-amber-500/10 border-amber-500/20"
                 )}>
                    <div className={cn("w-1.5 h-1.5 rounded-full", status === 'ONLINE' ? "bg-emerald-500 animate-pulse" : "bg-amber-500")}></div>
                    {status}
                 </div>
              </div>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-2 ml-1">
                 Processamento Georeferenciado em Tempo Real
              </p>
            </div>

            <div className="flex items-center gap-3">
               <div className="flex bg-[#0a0e27]/80 border border-[#2d3647] rounded-2xl p-1 gap-1">
                  <button onClick={() => setIsFilterOpen(true)} className="flex items-center gap-2 px-4 py-2 hover:bg-[#1a1f3a] rounded-xl text-[10px] font-black uppercase transition-all">
                     <Filter size={14} className="text-primary" /> Filtros
                  </button>
                  <div className="w-[1px] h-6 bg-[#2d3647] my-auto"></div>
                  <button onClick={handleRefresh} className="flex items-center gap-2 px-4 py-2 hover:bg-[#1a1f3a] rounded-xl text-[10px] font-black uppercase transition-all">
                     <RefreshCw size={14} className={cn(loading && "animate-spin")} /> {refreshCountdown}s
                  </button>
               </div>
               <button className="flex items-center gap-2 px-6 py-3 bg-primary text-[#0a0e27] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-primary/20">
                  <Download size={16} /> Exportar Hub
               </button>
            </div>
          </div>

          {/* KPI Dashboard Top */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
             {OVERVIEW_KPIS.map((kpi) => (
               <div key={kpi.label} className="bg-[#0a0e27]/60 border border-[#2d3647] p-6 rounded-[32px] relative overflow-hidden group hover:border-primary/30 transition-all cursor-default shadow-xl">
                  <div className="absolute -right-4 -top-4 p-8 opacity-[0.03] group-hover:scale-125 transition-transform duration-700">
                     <kpi.icon size={120} />
                  </div>
                  <div className="relative z-10">
                     <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-[#1a1f3a] rounded-xl border border-[#2d3647]">
                           <kpi.icon size={18} className={kpi.color} />
                        </div>
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{kpi.label}</span>
                     </div>
                     <div className="flex items-baseline gap-3">
                        <span className="text-3xl font-black italic tracking-tighter text-white">{kpi.value}</span>
                        <span className={cn("text-[10px] font-black", kpi.trend.startsWith('+') ? "text-emerald-500" : "text-red-500")}>{kpi.trend}</span>
                     </div>
                  </div>
               </div>
             ))}
          </div>

          {loading ? (
             <div className="h-[600px] flex flex-col items-center justify-center gap-6 bg-[#0a0e27]/20 border-2 border-dashed border-[#2d3647] rounded-[48px]">
                <Loader />
                <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.4em] animate-pulse">Sincronizando BI Engine...</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-1000">

               {/* Tempo Operacional - Bar Chart */}
               <div className="lg:col-span-8 bg-[#0a0e27]/60 border border-[#2d3647] rounded-[48px] p-8 flex flex-col gap-8 shadow-2xl">
                  <div className="flex items-center justify-between">
                     <div>
                        <h3 className="text-sm font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
                           <Clock size={16} className="text-primary" /> Tempo Operacional por Estado
                        </h3>
                        <p className="text-[9px] text-muted-foreground font-bold uppercase mt-1 tracking-widest">Consolidado em Horas Totais</p>
                     </div>
                     <Settings2 size={16} className="text-muted-foreground cursor-pointer hover:text-white" />
                  </div>
                  <div className="h-[350px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={OPERATIONAL_TIME_DATA} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                           <CartesianGrid strokeDasharray="3 3" stroke="#1a1f3a" vertical={false} />
                           <XAxis dataKey="name" stroke="#6b7280" fontSize={10} fontVariant="black-italic" axisLine={false} tickLine={false} />
                           <YAxis stroke="#6b7280" fontSize={10} axisLine={false} tickLine={false} />
                           <Tooltip
                              cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                              contentStyle={{ backgroundColor: '#0a0e27', border: '1px solid #2d3647', borderRadius: '16px' }}
                           />
                           <Bar dataKey="Tempo" radius={[6, 6, 0, 0]}>
                              {OPERATIONAL_TIME_DATA.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                              ))}
                           </Bar>
                        </BarChart>
                     </ResponsiveContainer>
                  </div>
               </div>

               {/* Disponibilidade Mecânica - Radar Chart */}
               <div className="lg:col-span-4 bg-[#0a0e27]/60 border border-[#2d3647] rounded-[48px] p-8 flex flex-col gap-8 shadow-2xl">
                  <div>
                     <h3 className="text-sm font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
                        <ShieldCheck size={16} className="text-emerald-500" /> Saúde dos Ativos
                     </h3>
                     <p className="text-[9px] text-muted-foreground font-bold uppercase mt-1 tracking-widest">Disponibilidade por Sistema</p>
                  </div>
                  <div className="h-[350px] w-full flex items-center justify-center">
                     <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={MECHANICAL_AVAILABILITY_DATA}>
                           <PolarGrid stroke="#1a1f3a" />
                           <PolarAngleAxis dataKey="subject" stroke="#6b7280" fontSize={10} />
                           <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#1a1f3a" tick={false} />
                           <Radar name="Saúde" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                           <Tooltip contentStyle={{ backgroundColor: '#0a0e27', border: '1px solid #2d3647', borderRadius: '12px' }} />
                        </RadarChart>
                     </ResponsiveContainer>
                  </div>
               </div>

               {/* Ranking de Perdas - Vertical Custom List */}
               <div className="lg:col-span-4 bg-[#0a0e27]/60 border border-[#2d3647] rounded-[48px] p-8 flex flex-col gap-8 shadow-2xl">
                  <div>
                     <h3 className="text-sm font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
                        <AlertTriangle size={16} className="text-red-500" /> Ofensores Críticos
                     </h3>
                     <p className="text-[9px] text-muted-foreground font-bold uppercase mt-1 tracking-widest">Maiores Motivos de Parada</p>
                  </div>
                  <div className="space-y-6">
                     {LOSS_RANKING_DATA.map((item) => (
                        <div key={item.reason} className="group">
                           <div className="flex justify-between items-center mb-2">
                              <span className="text-[10px] font-black uppercase text-white/80 group-hover:text-primary transition-colors">{item.reason}</span>
                              <span className="text-xs font-black italic text-red-500">{item.hours}h</span>
                           </div>
                           <div className="w-full h-1.5 bg-[#1a1f3a] rounded-full overflow-hidden flex">
                              <div
                                 className="h-full bg-red-500/60 group-hover:bg-primary transition-all duration-1000"
                                 style={{ width: `${item.percentage}%` }}
                              ></div>
                           </div>
                        </div>
                     ))}
                  </div>
                  <button className="mt-auto py-3 bg-[#1a1f3a] border border-[#2d3647] rounded-2xl text-[9px] font-black uppercase text-muted-foreground hover:text-white transition-all">Ver Detalhes das Paradas</button>
               </div>

               {/* Tabela Analítica - Modern View */}
               <div className="lg:col-span-8 bg-[#0a0e27]/60 border border-[#2d3647] rounded-[48px] overflow-hidden flex flex-col shadow-2xl">
                  <div className="p-8 border-b border-[#2d3647] bg-[#1a1f3a]/10 flex items-center justify-between">
                     <h3 className="text-sm font-black italic uppercase tracking-tighter text-white flex items-center gap-2">
                        <Layers size={16} className="text-primary" /> Rastro Analítico
                     </h3>
                     <div className="flex items-center gap-2">
                        <Search size={14} className="text-muted-foreground" />
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Monitorando 4 Ativos</span>
                     </div>
                  </div>
                  <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="bg-[#050812]/50 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                           <tr>
                              <th className="px-8 py-5">Identificação</th>
                              <th className="px-8 py-5">Frente</th>
                              <th className="px-8 py-5 text-center">Eficiência</th>
                              <th className="px-8 py-5">Status</th>
                              <th className="px-8 py-5 text-right">Sinal</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2d3647]/30 text-[11px] font-medium">
                           {ANALYTIC_DATA.map(row => (
                              <tr key={row.id} className="hover:bg-primary/5 transition-colors group cursor-pointer">
                                 <td className="px-8 py-5">
                                    <div className="flex flex-col">
                                       <span className="text-sm font-black italic text-white group-hover:text-primary transition-colors">{row.equip}</span>
                                       <span className="text-[9px] text-muted-foreground uppercase">{row.op}</span>
                                    </div>
                                 </td>
                                 <td className="px-8 py-5 font-bold text-white/60 uppercase">{row.group}</td>
                                 <td className="px-8 py-5 text-center">
                                    <span className={cn(
                                       "px-2 py-1 rounded-lg font-black italic",
                                       parseInt(row.efficiency) > 80 ? "text-emerald-500 bg-emerald-500/10" : "text-amber-500 bg-amber-500/10"
                                    )}>{row.efficiency}</span>
                                 </td>
                                 <td className="px-8 py-5 uppercase font-black text-[9px]">
                                    <div className="flex items-center gap-2">
                                       <div className={cn(
                                          "w-2 h-2 rounded-full",
                                          row.status === 'PRODUTIVO' ? "bg-emerald-500" : row.status === 'TRANSPORTE' ? "bg-blue-500" : "bg-red-500"
                                       )}></div>
                                       {row.status}
                                    </div>
                                 </td>
                                 <td className="px-8 py-5 text-right font-black text-muted-foreground italic uppercase">{row.last}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
                  <div className="p-4 bg-[#050812]/20 border-t border-[#2d3647] flex justify-center">
                     <button className="text-[9px] font-black uppercase text-primary hover:underline tracking-widest">Explorar Base de Dados Completa</button>
                  </div>
               </div>

            </div>
          )}
        </main>
      </div>

      {/* Filter Drawer Intelligence */}
      {isFilterOpen && (
         <div className="fixed inset-0 z-[2000] flex justify-end">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setIsFilterOpen(false)}></div>
            <div className="relative w-full max-w-md bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-10 flex flex-col h-full animate-in slide-in-from-right duration-500">
               <div className="flex items-center justify-between mb-12">
                  <div>
                     <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white leading-none">Matriz de Filtros</h2>
                     <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-2">Refinar BI Operacional</p>
                  </div>
                  <button onClick={() => setIsFilterOpen(false)} className="p-3 hover:bg-[#1a1f3a] rounded-2xl transition-all text-white">
                    <X size={24} />
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar pr-4 space-y-10">
                  <FilterGroup label="Período" icon={<Calendar size={14} />}>
                     <div className="grid grid-cols-2 gap-4">
                        <input type="date" className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-xs focus:border-primary outline-none" />
                        <input type="date" className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-xs focus:border-primary outline-none" />
                     </div>
                  </FilterGroup>

                  <FilterGroup label="Localização" icon={<MapPin size={14} />}>
                     <select className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-xs focus:border-primary outline-none appearance-none font-bold uppercase"><option>Todas as Unidades</option></select>
                     <select className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-xs focus:border-primary outline-none appearance-none font-bold uppercase mt-4"><option>Todas as Frentes</option></select>
                  </FilterGroup>

                  <FilterGroup label="Recursos" icon={<Truck size={14} />}>
                     <select className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-xs focus:border-primary outline-none appearance-none font-bold uppercase"><option>Todos Equipamentos</option></select>
                     <select className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-xs focus:border-primary outline-none appearance-none font-bold uppercase mt-4"><option>Todos Operadores</option></select>
                  </FilterGroup>
               </div>

               <div className="pt-10 mt-auto border-t border-[#2d3647] flex gap-4">
                  <button onClick={() => setIsFilterOpen(false)} className="flex-1 py-4 bg-transparent border border-[#2d3647] rounded-2xl text-xs font-black uppercase hover:bg-[#1a1f3a] transition-all">Limpar</button>
                  <button onClick={() => setIsFilterOpen(false)} className="flex-1 py-4 bg-primary text-[#0a0e27] rounded-2xl text-xs font-black uppercase hover:scale-105 transition-transform shadow-lg shadow-primary/20">Aplicar</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}

function Loader() {
  return (
    <div className="relative flex items-center justify-center">
       <div className="w-20 h-20 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
       <Activity size={24} className="text-primary absolute animate-pulse" />
    </div>
  );
}

function FilterGroup({ label, icon, children }: { label: string, icon: any, children: React.ReactNode }) {
   return (
      <div className="space-y-4">
         <div className="flex items-center gap-2">
            <div className="text-primary">{icon}</div>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</span>
         </div>
         {children}
      </div>
   );
}
