"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import {
  Wifi,
  WifiOff,
  Clock,
  MapPin,
  AlertTriangle,
  RefreshCw,
  Search,
  Radio,
  Signal,
  Database,
  Activity,
  X,
  History,
  Truck,
  Settings2,
  Download,
  MoreVertical
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';

// --- Types ---
type ConnectivityStatus = 'OK' | 'ATENCAO' | 'CRITICO' | 'SEVERO';

interface ConnectivityItem {
  id: string;
  unit: string;
  front: string;
  group: string;
  equipment: string;
  type: string;
  operator: string;
  operation: string;
  lastGPS: string;
  lastRecord: string;
  lastHeartbeat: string;
  offlineTimeMinutes: number;
  status: ConnectivityStatus;
  origin: 'APK' | 'MQTT' | 'API' | 'GPS';
}

// --- Mock Data ---
const MOCK_CONNECTIVITY_DATA: ConnectivityItem[] = [
  { id: '1', unit: 'Sorriso', front: 'FRENTE 01', group: 'COLHEITA', equipment: '605112', type: 'COLHEDORA', operator: 'Ricardo Silva', operation: 'COLHEITA SOJA', lastGPS: 'Agora', lastRecord: '2 min', lastHeartbeat: 'Agora', offlineTimeMinutes: 2, status: 'OK', origin: 'APK' },
  { id: '2', unit: 'Sorriso', front: 'FRENTE 01', group: 'TRANSPORTE', equipment: '601076', type: 'CAMINHÃO', operator: 'Marcos Souza', operation: 'TRANSPORTE', lastGPS: 'Agora', lastRecord: '15 min', lastHeartbeat: 'Agora', offlineTimeMinutes: 1, status: 'OK', origin: 'MQTT' },
  { id: '3', unit: 'Sorriso', front: 'FRENTE 02', group: 'COLHEITA', equipment: '613020', type: 'COLHEDORA', operator: 'Luiz Castro', operation: 'COLHEITA MILHO', lastGPS: '18 min', lastRecord: '22 min', lastHeartbeat: '18 min', offlineTimeMinutes: 18, status: 'ATENCAO', origin: 'APK' },
  { id: '4', unit: 'Sorriso', front: 'FRENTE 03', group: 'APOIO', equipment: '614004', type: 'TRATOR', operator: 'João P.', operation: 'PREPARO', lastGPS: '1h 12m', lastRecord: '1h 20m', lastHeartbeat: '1h 12m', offlineTimeMinutes: 72, status: 'CRITICO', origin: 'API' },
  { id: '5', unit: 'Sorriso', front: 'FRENTE 01', group: 'COLHEITA', equipment: '609001', type: 'COLHEDORA', operator: 'Antônio M.', operation: 'MANUTENÇÃO', lastGPS: '4h 45m', lastRecord: '5h 10m', lastHeartbeat: '4h 45m', offlineTimeMinutes: 285, status: 'SEVERO', origin: 'GPS' },
];

const COMM_TREND_DATA = [
  { time: '08:00', online: 45, offline: 2 },
  { time: '10:00', online: 42, offline: 5 },
  { time: '12:00', online: 38, offline: 9 },
  { time: '14:00', online: 44, offline: 3 },
  { time: '16:00', online: 46, offline: 1 },
];

function ConectividadePage() {
  const [activeTab, setActiveTab] = useState<'GERAL' | 'COMUNICACAO' | 'APONTAMENTOS' | 'SEM_LOCAL' | 'FALHAS' | 'ANALITICA'>('GERAL');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedEquip, setSelectedEquip] = useState<ConnectivityItem | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const filteredData = useMemo(() => {
    return MOCK_CONNECTIVITY_DATA.filter(item =>
      item.equipment.toLowerCase().includes(search.toLowerCase()) ||
      item.operator.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const getStatusStyle = (status: ConnectivityStatus) => {
    switch (status) {
      case 'OK': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'ATENCAO': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'CRITICO': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'SEVERO': return 'text-red-500 bg-red-500/10 border-red-500/20';
    }
  };

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader
            title="Conectividade Operacional"
            description="Saúde de Comunicação Field APK, MQTT e Sensores"
          >
            <div className="flex gap-2">
               <button className="p-2.5 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-primary hover:bg-[#252d4a] transition-all">
                  <RefreshCw size={20} className={cn(loading && "animate-spin")} />
               </button>
               <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-[#0a0e27] rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-primary/20">
                  <Download size={16} /> Exportar CSV
               </button>
            </div>
          </PageHeader>

          {/* KPI Ribbon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            <KpiCard label="Equipamentos Online" value="42" icon={<Wifi size={18} className="text-emerald-500" />} />
            <KpiCard label="Equipamentos Offline" value="05" icon={<WifiOff size={18} className="text-red-500" />} />
            <KpiCard label="Último Pacote" value="0s ago" icon={<Radio size={18} className="text-blue-500" />} />
            <KpiCard label="Tempo Médio Off" value="12m" icon={<Clock size={18} className="text-amber-500" />} />
            <KpiCard label="Sem Localização" value="02" icon={<MapPin size={18} className="text-purple-500" />} />
            <KpiCard label="Falhas de Sync" value="0" icon={<AlertTriangle size={18} className="text-emerald-500" />} />
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-[#0a0e27] border border-[#2d3647] p-1 rounded-2xl mb-8 overflow-x-auto no-scrollbar">
            <TabButton active={activeTab === 'GERAL'} onClick={() => setActiveTab('GERAL')} label="Visão Geral" />
            <TabButton active={activeTab === 'COMUNICACAO'} onClick={() => setActiveTab('COMUNICACAO')} label="Comunicação" />
            <TabButton active={activeTab === 'APONTAMENTOS'} onClick={() => setActiveTab('APONTAMENTOS')} label="Apontamentos" />
            <TabButton active={activeTab === 'SEM_LOCAL'} onClick={() => setActiveTab('SEM_LOCAL')} label="Sem Localização" />
            <TabButton active={activeTab === 'FALHAS'} onClick={() => setActiveTab('FALHAS')} label="Falhas Críticas" />
            <TabButton active={activeTab === 'ANALITICA'} onClick={() => setActiveTab('ANALITICA')} label="Tabela Analítica" />
          </div>

          {loading ? (
             <div className="flex flex-col items-center justify-center h-96 gap-4 bg-[#0a0e27]/40 border border-[#2d3647] rounded-[40px]">
                <Loader />
                <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.4em] animate-pulse">Escanenado Conectividade...</p>
             </div>
          ) : (
            <div className="animate-in fade-in duration-500">
               {activeTab === 'GERAL' && (
                 <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-8 bg-[#0a0e27]/60 border border-[#2d3647] rounded-[40px] p-8 flex flex-col gap-6 shadow-2xl">
                       <h3 className="text-sm font-black italic uppercase text-white flex items-center gap-2">
                          <Activity size={16} className="text-primary" /> Tendência de Conectividade (24h)
                       </h3>
                       <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                             <AreaChart data={COMM_TREND_DATA}>
                                <defs>
                                   <linearGradient id="colorOnline" x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                                   </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#1a1f3a" vertical={false} />
                                <XAxis dataKey="time" stroke="#6b7280" fontSize={10} axisLine={false} tickLine={false} />
                                <YAxis stroke="#6b7280" fontSize={10} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ backgroundColor: '#0a0e27', border: '1px solid #2d3647', borderRadius: '16px' }} />
                                <Area type="monotone" dataKey="online" stroke="#10b981" fillOpacity={1} fill="url(#colorOnline)" strokeWidth={3} />
                                <Area type="monotone" dataKey="offline" stroke="#ef4444" fill="transparent" strokeWidth={2} strokeDasharray="5 5" />
                             </AreaChart>
                          </ResponsiveContainer>
                       </div>
                    </div>

                    <div className="lg:col-span-4 bg-[#0a0e27]/60 border border-[#2d3647] rounded-[40px] p-8 shadow-2xl flex flex-col gap-6">
                       <h3 className="text-sm font-black italic uppercase text-white flex items-center gap-2">
                          <Signal size={16} className="text-primary" /> Status por Faixa
                       </h3>
                       <div className="space-y-4 flex-1">
                          <StatusRangeItem label="0 - 15 min (OK)" value={42} total={47} color="bg-emerald-500" />
                          <StatusRangeItem label="15 - 60 min (Atenção)" value={3} total={47} color="bg-amber-500" />
                          <StatusRangeItem label="1 - 3 h (Crítico)" value={1} total={47} color="bg-orange-500" />
                          <StatusRangeItem label="Acima 3 h (Severo)" value={1} total={47} color="bg-red-500" />
                       </div>
                       <div className="pt-6 border-t border-[#2d3647] flex justify-between items-center">
                          <span className="text-[10px] font-black text-muted-foreground uppercase">Tempo Médio Resposta</span>
                          <span className="text-xl font-black italic text-primary">8.2s</span>
                       </div>
                    </div>

                    <div className="lg:col-span-12">
                       <ConnectivityTable
                        data={filteredData}
                        onSelect={(item) => { setSelectedEquip(item); setIsDrawerOpen(true); }}
                        onSearch={setSearch}
                       />
                    </div>
                 </div>
               )}

               {activeTab === 'ANALITICA' && (
                 <ConnectivityTable
                  data={filteredData}
                  onSelect={(item) => { setSelectedEquip(item); setIsDrawerOpen(true); }}
                  onSearch={setSearch}
                 />
               )}
            </div>
          )}
        </main>
      </div>

      {isDrawerOpen && selectedEquip && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
           <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setIsDrawerOpen(false)}></div>
           <div className="relative w-full max-w-xl bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-10 flex flex-col h-full animate-in slide-in-from-right duration-500 overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between mb-12">
                 <div className="flex items-center gap-4">
                    <div className="p-4 bg-[#1a1f3a] rounded-3xl border border-primary/20 text-primary">
                       <Truck size={32} />
                    </div>
                    <div>
                       <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white leading-none">{selectedEquip.equipment}</h2>
                       <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-2">{selectedEquip.type} • {selectedEquip.front}</p>
                    </div>
                 </div>
                 <button onClick={() => setIsDrawerOpen(false)} className="p-3 hover:bg-[#1a1f3a] rounded-2xl transition-all text-white"><X size={24} /></button>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-10">
                 <DetailItem label="Status de Conexão" value={selectedEquip.status} className={getStatusStyle(selectedEquip.status)} />
                 <DetailItem label="Origem dos Dados" value={selectedEquip.origin} />
                 <DetailItem label="Operador Atual" value={selectedEquip.operator} />
                 <DetailItem label="Último GPS" value={selectedEquip.lastGPS} />
                 <DetailItem label="Último Apontamento" value={selectedEquip.lastRecord} />
                 <DetailItem label="Heartbeat MQTT" value={selectedEquip.lastHeartbeat} />
              </div>

              <div className="bg-[#050812] border border-[#2d3647] rounded-3xl p-6 mb-8">
                 <h4 className="text-[10px] font-black uppercase text-muted-foreground mb-4 flex items-center gap-2"><History size={12} /> Histórico de Instabilidade (Últimas 4h)</h4>
                 <div className="space-y-4">
                    <HistoryLine time="14:32" event="Desconexão MQTT" duration="12m" status="RESOLVIDO" />
                    <HistoryLine time="12:05" event="Baixa Precisão GPS" duration="45s" status="RECORRENTE" />
                 </div>
              </div>

              <div className="mt-auto pt-10 border-t border-[#2d3647] flex gap-4">
                 <button className="flex-1 py-4 bg-[#1a1f3a] border border-[#2d3647] rounded-2xl text-[10px] font-black uppercase hover:bg-[#252d4a] transition-all flex items-center justify-center gap-2"><Settings2 size={16} /> Ver Telemetria</button>
                 <button className="flex-1 py-4 bg-primary text-[#0a0e27] rounded-2xl text-[10px] font-black uppercase hover:scale-105 transition-transform flex items-center justify-center gap-2"><Wifi size={16} /> Forçar Sincronização</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon }: { label: string, value: string, icon: any }) {
  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] p-5 rounded-3xl group hover:border-primary/40 transition-all flex flex-col gap-2">
      <div className="flex items-center gap-2">
         <div className="p-1.5 bg-[#1a1f3a] rounded-lg border border-[#2d3647]">{icon}</div>
         <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-xl font-black italic tracking-tighter text-white group-hover:text-primary transition-colors">{value}</span>
    </div>
  );
}

function TabButton({ active, onClick, label }: { active: boolean, onClick: () => void, label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
        active ? "bg-primary text-[#0a0e27] shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-white"
      )}
    >
      {label}
    </button>
  );
}

function StatusRangeItem({ label, value, total, color }: { label: string, value: number, total: number, color: string }) {
  const percentage = (value / total) * 100;
  return (
    <div className="space-y-1.5">
       <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight">
          <span className="text-white/80">{label}</span>
          <span className="text-white">{value}</span>
       </div>
       <div className="h-1.5 w-full bg-[#1a1f3a] rounded-full overflow-hidden">
          <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${percentage}%` }} />
       </div>
    </div>
  );
}

function ConnectivityTable({ data, onSelect, onSearch }: { data: ConnectivityItem[], onSelect: (i: ConnectivityItem) => void, onSearch: (s: string) => void }) {
  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-[40px] overflow-hidden shadow-2xl flex flex-col">
       <div className="p-8 border-b border-[#2d3647] bg-[#1a1f3a]/10 flex items-center justify-between">
          <h3 className="text-sm font-black italic tracking-tighter uppercase text-white flex items-center gap-2">
             <Database size={16} className="text-primary" /> Inventário Analítico de Conectividade
          </h3>
          <div className="relative w-80">
             <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
             <input
              type="text"
              placeholder="Buscar equipamento ou operador..."
              onChange={(e) => onSearch(e.target.value)}
              className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-primary/50 text-white placeholder:text-muted-foreground/40 shadow-inner"
             />
          </div>
       </div>
       <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
             <thead className="bg-[#050812]/50 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                <tr>
                   <th className="px-6 py-5">Equipamento</th>
                   <th className="px-6 py-5">Frente / Grupo</th>
                   <th className="px-6 py-5">Sinal / GPS</th>
                   <th className="px-6 py-5">Status</th>
                   <th className="px-6 py-5">Origem</th>
                   <th className="px-6 py-5 text-right">Ações</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-[#2d3647]/30 text-[11px] font-medium">
                {data.map(item => (
                   <tr key={item.id} className="hover:bg-primary/5 transition-colors group cursor-pointer" onClick={() => onSelect(item)}>
                      <td className="px-6 py-5">
                         <div className="flex flex-col">
                            <span className="text-sm font-black italic text-white group-hover:text-primary transition-colors tracking-tighter uppercase">{item.equipment}</span>
                            <span className="text-[9px] text-muted-foreground uppercase font-bold">{item.operator}</span>
                         </div>
                      </td>
                      <td className="px-6 py-5 uppercase font-bold text-white/60">
                         <p>{item.front}</p>
                         <p className="text-[9px] text-muted-foreground">{item.group}</p>
                      </td>
                      <td className="px-6 py-5">
                         <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-white flex items-center gap-1.5"><Radio size={10} className="text-primary" /> {item.lastHeartbeat}</span>
                            <span className="text-[9px] text-muted-foreground flex items-center gap-1.5 italic"><MapPin size={10} /> {item.lastGPS}</span>
                         </div>
                      </td>
                      <td className="px-6 py-5">
                         <div className={cn(
                            "px-3 py-1 rounded-full text-[9px] font-black border w-fit",
                            item.status === 'OK' ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" :
                            item.status === 'ATENCAO' ? "text-amber-500 bg-amber-500/10 border-amber-500/20" :
                            item.status === 'CRITICO' ? "text-orange-500 bg-orange-500/10 border-orange-500/20" :
                            "text-red-500 bg-red-500/10 border-red-500/20"
                         )}>
                            {item.status} ({item.offlineTimeMinutes}m)
                         </div>
                      </td>
                      <td className="px-6 py-5">
                         <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-[#1a1f3a] rounded border border-[#2d3647] text-white/50">{item.origin}</span>
                      </td>
                      <td className="px-6 py-5 text-right">
                         <button className="p-2 text-muted-foreground hover:text-white transition-all"><MoreVertical size={16} /></button>
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>
       <div className="p-4 bg-[#050812]/20 border-t border-[#2d3647] flex justify-center">
          <button className="text-[9px] font-black uppercase text-primary hover:underline tracking-widest">Carregar registros históricos</button>
       </div>
    </div>
  );
}

function DetailItem({ label, value, className }: { label: string, value: any, className?: string }) {
   return (
      <div className="flex flex-col gap-1">
         <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{label}</span>
         <span className={cn("text-xs font-black uppercase text-white", className)}>{value}</span>
      </div>
   );
}

function HistoryLine({ time, event, duration, status }: { time: string, event: string, duration: string, status: string }) {
   return (
      <div className="flex items-center justify-between group">
         <div className="flex items-center gap-4">
            <span className="text-[10px] font-bold text-white/40">{time}</span>
            <div className="flex flex-col">
               <span className="text-[11px] font-bold text-white uppercase group-hover:text-primary transition-colors">{event}</span>
               <span className="text-[9px] text-muted-foreground uppercase">{duration} off</span>
            </div>
         </div>
         <span className="text-[8px] font-black text-emerald-500 uppercase">{status}</span>
      </div>
   );
}

function Loader() {
  return (
    <div className="relative flex items-center justify-center">
       <div className="w-20 h-20 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
       <Signal size={24} className="text-primary absolute animate-pulse" />
    </div>
  );
}

export default withAuth(ConectividadePage, { module: 'CONECTIVIDADE' });
