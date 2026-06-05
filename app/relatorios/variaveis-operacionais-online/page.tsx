"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Legend
} from 'recharts';
import {
  RefreshCw,
  Clock,
  Filter,
  Download,
  Activity,
  AlertTriangle,
  Zap,
  TrendingUp,
  Settings2,
  Search,
  Wifi,
  WifiOff,
  Globe,
  MapPin,
  LayoutGrid,
  Truck,
  User,
  Database,
  MoreVertical,
  ChevronDown
} from 'lucide-react';
import { cn } from '@/lib/utils';

// --- Types & Interfaces ---
type OnlineStatus = 'ONLINE' | 'ATRASADO' | 'SEM_DADOS';

interface FilterState {
  unit: string;
  front: string;
  group: string;
  type: string;
  equipment: string;
  operation: string;
  operator: string;
}

// --- Mock Data ---
const TIME_BY_FRONT_DATA = [
  { name: 'Frente 01', Trabalho: 450, Manobra: 120, Deslocamento: 80, Parada: 60 },
  { name: 'Frente 02', Trabalho: 380, Manobra: 90, Deslocamento: 110, Parada: 120 },
  { name: 'Frente 03', Trabalho: 410, Manobra: 100, Deslocamento: 95, Parada: 45 },
];

const HOURLY_STATE_DATA = [
  { hour: '08:00', Produtivo: 85, Improdutivo: 15 },
  { hour: '09:00', Produtivo: 92, Improdutivo: 8 },
  { hour: '10:00', Produtivo: 78, Improdutivo: 22 },
  { hour: '11:00', Produtivo: 65, Improdutivo: 35 },
  { hour: '12:00', Produtivo: 40, Improdutivo: 60 },
  { hour: '13:00', Produtivo: 88, Improdutivo: 12 },
  { hour: '14:00', Produtivo: 95, Improdutivo: 5 },
];

const TOP_OFFENDERS = [
  { id: '1', reason: 'Aguardando Caminhão', time: '124h', count: 45, impact: 'High' },
  { id: '2', reason: 'Troca de Turno', time: '86h', count: 32, impact: 'Medium' },
  { id: '3', reason: 'Abastecimento', time: '54h', count: 28, impact: 'Medium' },
  { id: '4', reason: 'Refeição', time: '48h', count: 30, impact: 'Low' },
  { id: '5', reason: 'Manutenção Preventiva', time: '42h', count: 12, impact: 'High' },
];

const ANALYTIC_TABLE_DATA = [
  { id: 'REC-101', equipment: 'COL-605112', operator: 'Ricardo Silva', state: 'Trabalhando', duration: '02:45h', speed: '4.5 km/h', signal: 'Agora' },
  { id: 'REC-102', equipment: 'TR-601076', operator: 'Marcos Souza', state: 'Deslocamento', duration: '00:15h', speed: '12.0 km/h', signal: '2 min' },
  { id: 'REC-103', equipment: 'CAM-613020', operator: 'Luiz Castro', state: 'Parada', duration: '01:10h', speed: '0.0 km/h', signal: '15 min' },
  { id: 'REC-104', equipment: 'COL-609001', operator: 'João P.', state: 'Trabalhando', duration: '03:20h', speed: '4.2 km/h', signal: 'Agora' },
  { id: 'REC-105', equipment: 'TR-602073', operator: 'Antônio M.', state: 'Manutenção', duration: '04:50h', speed: '0.0 km/h', signal: '1h 12m' },
];

export default function VariaveisOperacionaisOnlinePage() {
  const [loading, setLoading] = useState(true);
  const [refreshInterval] = useState(30); // seconds
  const [countdown, setCountdown] = useState(30);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [status, setStatus] = useState<OnlineStatus>('ONLINE');

  const [filters] = useState<FilterState>({
    unit: 'Todas',
    front: 'Todas',
    group: 'Todos',
    type: 'Todos',
    equipment: 'Todos',
    operation: 'Todas',
    operator: 'Todos'
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (countdown <= 0) {
      handleRefresh();
      setCountdown(refreshInterval);
    }
    const interval = setInterval(() => {
      setCountdown(c => c - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown, refreshInterval]);

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => {
      setLastUpdate(new Date());
      setLoading(false);
      // Simulate status change
      setStatus(Math.random() > 0.1 ? 'ONLINE' : 'ATRASADO');
    }, 800);
  };

  const getStatusColor = (s: OnlineStatus) => {
    switch (s) {
      case 'ONLINE': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'ATRASADO': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'SEM_DADOS': return 'text-red-500 bg-red-500/10 border-red-500/20';
    }
  };

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black italic tracking-tighter uppercase text-white leading-none">Variáveis Operacionais Online</h1>
                <div className={cn("px-2 py-0.5 rounded-full text-[9px] font-black border flex items-center gap-1.5", getStatusColor(status))}>
                   {status === 'ONLINE' ? <Wifi size={10} /> : <WifiOff size={10} />}
                   {status.replace('_', ' ')}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                <Activity size={12} className="text-primary" /> Telemetria em tempo real • Global Ops Center
              </p>
            </div>

            <div className="flex items-center gap-3">
               <div className="bg-[#0a0e27] border border-[#2d3647] rounded-xl px-4 py-2 flex flex-col items-end">
                  <span className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">Próxima Atualização</span>
                  <span className="text-sm font-black italic text-primary tracking-tighter">{countdown}s</span>
               </div>
               <button
                onClick={handleRefresh}
                className="p-3 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-primary hover:bg-[#252d4a] transition-all"
               >
                 <RefreshCw size={20} className={cn(loading && "animate-spin")} />
               </button>
               <div className="h-10 w-[1px] bg-[#2d3647] mx-1"></div>
               <button className="flex items-center gap-2 px-4 py-3 bg-primary text-[#0a0e27] rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-primary/20">
                  <Download size={16} /> Exportar Dashboard
               </button>
            </div>
          </div>

          {/* Real-time Filters */}
          <div className="bg-[#0a0e27]/40 border border-[#2d3647] p-4 rounded-3xl mb-8">
             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <OnlineFilter label="Unidade" value={filters.unit} icon={<Globe size={12} />} />
                <OnlineFilter label="Frente" value={filters.front} icon={<MapPin size={12} />} />
                <OnlineFilter label="Grupo" value={filters.group} icon={<LayoutGrid size={12} />} />
                <OnlineFilter label="Tipo" value={filters.type} icon={<Settings2 size={12} />} />
                <OnlineFilter label="Equipamento" value={filters.equipment} icon={<Truck size={12} />} />
                <OnlineFilter label="Operação" value={filters.operation} icon={<Zap size={12} />} />
                <OnlineFilter label="Operador" value={filters.operator} icon={<User size={12} />} />
             </div>
          </div>

          {/* Status Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
             <MetricCard
                label="Última Atualização"
                value={lastUpdate.toLocaleTimeString()}
                subValue={lastUpdate.toLocaleDateString()}
                icon={<RefreshCw className="text-primary" size={20} />}
             />
             <MetricCard
                label="Último Dado Recebido"
                value="Agora"
                subValue="Sensor: COL-605112"
                icon={<Wifi className="text-emerald-500" size={20} />}
             />
             <MetricCard
                label="Eficiência Global"
                value="91.2%"
                subValue="+2.4% vs última hora"
                icon={<TrendingUp className="text-blue-500" size={20} />}
                trend="+2.4%"
             />
          </div>

          {loading ? (
             <div className="h-96 flex flex-col items-center justify-center gap-4 bg-[#0a0e27]/40 border border-[#2d3647] rounded-[40px]">
                <Loader2 size={48} className="text-primary animate-spin" />
                <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.4em]">Processando Fluxo Online...</p>
             </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-700">

               {/* Charts Row 1 */}
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <ChartContainer title="Tempo por Frente e Grupo de Operação" icon={<MapPin size={16} />}>
                     <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={TIME_BY_FRONT_DATA} layout="vertical">
                           <CartesianGrid strokeDasharray="3 3" stroke="#2d3647" horizontal={false} />
                           <XAxis type="number" stroke="#6b7280" fontSize={10} />
                           <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={10} width={80} />
                           <Tooltip
                              contentStyle={{ backgroundColor: '#0a0e27', border: '1px solid #2d3647', borderRadius: '12px' }}
                              itemStyle={{ fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}
                           />
                           <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                           <Bar dataKey="Trabalho" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                           <Bar dataKey="Manobra" stackId="a" fill="#34d399" />
                           <Bar dataKey="Deslocamento" stackId="a" fill="#fbbf24" />
                           <Bar dataKey="Parada" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                        </BarChart>
                     </ResponsiveContainer>
                  </ChartContainer>

                  <ChartContainer title="Produtividade por Hora e Estado" icon={<Clock size={16} />}>
                     <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={HOURLY_STATE_DATA}>
                           <defs>
                              <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                 <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" stroke="#2d3647" vertical={false} />
                           <XAxis dataKey="hour" stroke="#6b7280" fontSize={10} />
                           <YAxis stroke="#6b7280" fontSize={10} />
                           <Tooltip
                              contentStyle={{ backgroundColor: '#0a0e27', border: '1px solid #2d3647', borderRadius: '12px' }}
                           />
                           <Area type="monotone" dataKey="Produtivo" stroke="#10b981" fillOpacity={1} fill="url(#colorProd)" strokeWidth={3} />
                           <Area type="monotone" dataKey="Improdutivo" stroke="#ef4444" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                        </AreaChart>
                     </ResponsiveContainer>
                  </ChartContainer>
               </div>

               {/* Row 2: Offenders Ranking & Analytic Table */}
               <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">

                  {/* Offenders Ranking */}
                  <div className="xl:col-span-4 flex flex-col gap-6">
                     <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-[40px] p-6 flex-1">
                        <div className="flex items-center justify-between mb-6">
                           <h3 className="text-sm font-black italic tracking-tighter uppercase text-white flex items-center gap-2">
                              <AlertTriangle size={16} className="text-red-500" /> Top 5 Ofensores (Tempo)
                           </h3>
                        </div>
                        <div className="space-y-4">
                           {TOP_OFFENDERS.map((offender, idx) => (
                              <div key={offender.id} className="flex items-center justify-between group">
                                 <div className="flex items-center gap-3">
                                    <span className="text-xs font-black italic text-white/20 w-4">{idx + 1}</span>
                                    <div className="flex flex-col">
                                       <span className="text-[11px] font-bold text-white uppercase group-hover:text-primary transition-colors">{offender.reason}</span>
                                       <span className="text-[9px] text-muted-foreground uppercase">{offender.count} Eventos</span>
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <p className="text-sm font-black italic text-red-500 tracking-tighter">{offender.time}</p>
                                    <span className={cn(
                                       "text-[8px] font-black uppercase",
                                       offender.impact === 'High' ? "text-red-400" : "text-amber-400"
                                    )}>{offender.impact} Impact</span>
                                 </div>
                              </div>
                           ))}
                        </div>
                        <button className="w-full mt-8 py-3 bg-[#1a1f3a] border border-[#2d3647] rounded-2xl text-[10px] font-black uppercase text-muted-foreground hover:text-white transition-all">Ver análise completa</button>
                     </div>
                  </div>

                  {/* Analytic Table */}
                  <div className="xl:col-span-8">
                     <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-[40px] overflow-hidden shadow-2xl flex flex-col h-full">
                        <div className="p-6 border-b border-[#2d3647] bg-[#1a1f3a]/10 flex items-center justify-between">
                           <h3 className="text-sm font-black italic tracking-tighter uppercase text-white flex items-center gap-2">
                              <Database size={16} className="text-primary" /> Rastro Analítico Online
                           </h3>
                           <div className="flex items-center gap-2">
                              <button className="p-2 text-muted-foreground hover:text-white transition-colors"><Search size={16} /></button>
                              <button className="p-2 text-muted-foreground hover:text-white transition-colors"><Filter size={16} /></button>
                           </div>
                        </div>
                        <div className="overflow-x-auto">
                           <table className="w-full text-left">
                              <thead className="bg-[#050812]/50 text-[10px] uppercase font-black tracking-widest text-muted-foreground border-b border-[#2d3647]">
                                 <tr>
                                    <th className="px-6 py-4">Equipamento / Operador</th>
                                    <th className="px-6 py-4">Estado Atual</th>
                                    <th className="px-6 py-4">Duração</th>
                                    <th className="px-6 py-4">Velo.</th>
                                    <th className="px-6 py-4">Sinal</th>
                                    <th className="px-6 py-4 text-right">Ações</th>
                                 </tr>
                              </thead>
                              <tbody className="divide-y divide-[#2d3647]/30 text-[11px] font-medium">
                                 {ANALYTIC_TABLE_DATA.map(row => (
                                    <tr key={row.id} className="hover:bg-primary/5 transition-colors group">
                                       <td className="px-6 py-4">
                                          <p className="font-bold text-white uppercase group-hover:text-primary transition-colors">{row.equipment}</p>
                                          <p className="text-[9px] text-muted-foreground uppercase">{row.operator}</p>
                                       </td>
                                       <td className="px-6 py-4">
                                          <div className="flex items-center gap-2">
                                             <div className={cn(
                                                "w-2 h-2 rounded-full",
                                                row.state === 'Trabalhando' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                                                row.state === 'Manutenção' ? "bg-red-500" : "bg-amber-500"
                                             )}></div>
                                             <span className="text-white uppercase font-bold">{row.state}</span>
                                          </div>
                                       </td>
                                       <td className="px-6 py-4 font-black italic text-white tracking-tighter">{row.duration}</td>
                                       <td className="px-6 py-4 font-bold text-primary">{row.speed}</td>
                                       <td className="px-6 py-4">
                                          <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-bold uppercase">
                                             <Clock size={10} /> {row.signal}
                                          </span>
                                       </td>
                                       <td className="px-6 py-4 text-right">
                                          <button className="p-2 text-muted-foreground hover:text-white transition-all"><MoreVertical size={16} /></button>
                                       </td>
                                    </tr>
                                 ))}
                              </tbody>
                           </table>
                        </div>
                        <div className="mt-auto p-4 border-t border-[#2d3647] flex justify-center bg-[#050812]/20">
                           <button className="text-[9px] font-black uppercase text-primary hover:underline">Ver mais registros</button>
                        </div>
                     </div>
                  </div>

               </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function OnlineFilter({ label, value, icon }: { label: string, value: string, icon: any }) {
  return (
    <div className="flex flex-col gap-1.5">
       <label className="text-[8px] text-muted-foreground font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
          {icon} {label}
       </label>
       <div className="bg-[#1a1f3a]/60 border border-[#2d3647] rounded-xl px-3 py-2 text-[10px] font-bold text-white flex items-center justify-between cursor-pointer hover:border-primary/40 transition-all group">
          <span className="truncate">{value}</span>
          <ChevronDown size={10} className="text-muted-foreground group-hover:text-primary" />
       </div>
    </div>
  );
}

function MetricCard({ label, value, subValue, icon, trend }: { label: string, value: string, subValue?: string, icon: any, trend?: string }) {
  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] p-6 rounded-[32px] flex items-start justify-between relative overflow-hidden group hover:border-primary/30 transition-all">
       <div className="absolute top-0 right-0 p-8 opacity-[0.02] group-hover:scale-110 transition-transform">{icon}</div>
       <div className="space-y-3">
          <div className="flex items-center gap-2">
             <div className="p-2 bg-[#1a1f3a] rounded-xl border border-[#2d3647]">{icon}</div>
             <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
          </div>
          <div>
             <p className="text-2xl font-black italic text-white tracking-tighter leading-none">{value}</p>
             {subValue && <p className="text-[10px] text-white/40 font-bold uppercase mt-1.5 tracking-tight">{subValue}</p>}
          </div>
       </div>
       {trend && (
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 text-[9px] font-black italic tracking-tighter">
             {trend}
          </div>
       )}
    </div>
  );
}

function ChartContainer({ title, icon, children }: { title: string, icon: any, children: React.ReactNode }) {
  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-[40px] p-8 flex flex-col gap-6 shadow-2xl">
       <div className="flex items-center justify-between">
          <h3 className="text-sm font-black italic tracking-tighter uppercase text-white flex items-center gap-3">
             <div className="p-1.5 bg-primary/10 rounded-lg text-primary">{icon}</div>
             {title}
          </h3>
          <button className="p-2 text-muted-foreground hover:text-white transition-colors"><Settings2 size={16} /></button>
       </div>
       <div className="flex-1 min-h-[300px]">
          {children}
       </div>
    </div>
  );
}

function Loader2({ size, className }: any) {
  return <RefreshCw size={size} className={cn("animate-spin", className)} />;
}
