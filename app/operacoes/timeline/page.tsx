"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { TimelineService, EquipmentService, OperatorService } from '@/services/api-service';
import { TimelineEvent, Equipment, Operator } from '@/lib/types';
import { withAuth } from '@/components/shared/with-auth';
import {
  History,
  Search,
  Truck,
  User,
  Clock,
  AlertCircle,
  CheckCircle2,
  Play,
  ArrowRight,
  X,
  Loader2,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';

function TimelinePage() {
  const [data, setData] = useState<TimelineEvent[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: '',
    equipmentId: '',
    operatorId: '',
    type: ''
  });
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [evts, eqs, oprs] = await Promise.all([
      TimelineService.getAll(),
      EquipmentService.getAll(),
      OperatorService.getAll()
    ]);
    setData(evts);
    setEquipments(eqs);
    setOperators(oprs);
    setLoading(false);
  };

  const filteredEvents = data.filter(evt => {
    const matchesSearch = evt.title.toLowerCase().includes(filters.search.toLowerCase()) ||
                         evt.description.toLowerCase().includes(filters.search.toLowerCase());
    const matchesEquip = !filters.equipmentId || evt.equipmentId === filters.equipmentId;
    const matchesOpr = !filters.operatorId || evt.operatorId === filters.operatorId;
    const matchesType = !filters.type || evt.type === filters.type;
    return matchesSearch && matchesEquip && matchesOpr && matchesType;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const getEventIcon = (type: string, severity: string) => {
    switch (type) {
      case 'STATUS_CHANGE': return <Play size={14} className="text-emerald-500" />;
      case 'ALERT': return <AlertCircle size={14} className={severity === 'CRITICAL' ? 'text-red-500' : 'text-amber-500'} />;
      case 'CHECKLIST': return <CheckCircle2 size={14} className="text-primary" />;
      default: return <Clock size={14} className="text-muted-foreground" />;
    }
  };

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Timeline Operacional" description="Rastro Cronológico de Eventos e Atividades de Frota" />

          {/* Filters Bar */}
          <div className="bg-[#0a0e27]/60 border border-[#2d3647] p-4 rounded-2xl mb-8 flex flex-wrap gap-4 items-center">
             <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="text"
                  placeholder="Buscar na timeline..."
                  className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl py-2 pl-10 pr-4 text-xs focus:border-primary outline-none"
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                />
             </div>
             <select
               className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-4 py-2 text-xs focus:border-primary outline-none font-bold"
               value={filters.equipmentId}
               onChange={(e) => setFilters({...filters, equipmentId: e.target.value})}
             >
                <option value="">Todos Equipamentos</option>
                {equipments.map(e => <option key={e.id} value={e.id}>{e.code}</option>)}
             </select>
             <select
               className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-4 py-2 text-xs focus:border-primary outline-none font-bold"
               value={filters.operatorId}
               onChange={(e) => setFilters({...filters, operatorId: e.target.value})}
             >
                <option value="">Todos Operadores</option>
                {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
             </select>
             <button className="p-2.5 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-muted-foreground hover:text-white"><Calendar size={18} /></button>
          </div>

          {loading ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4"><Loader2 size={40} className="text-primary animate-spin" /><p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Recompondo Histórico...</p></div>
          ) : (
             <div className="max-w-4xl mx-auto space-y-1 relative">
                {/* Central Line */}
                <div className="absolute left-[23px] top-0 bottom-0 w-[2px] bg-[#2d3647]"></div>

                {filteredEvents.map((evt) => {
                   const eq = equipments.find(e => e.id === evt.equipmentId);
                   const opr = operators.find(o => o.id === evt.operatorId);

                   return (
                      <div key={evt.id} className="relative pl-16 py-4 group cursor-pointer" onClick={() => setSelectedEvent(evt)}>
                         {/* Bullet */}
                         <div className={cn(
                           "absolute left-2.5 top-6 w-8 h-8 rounded-full bg-[#0a0e27] border-2 flex items-center justify-center z-10 transition-transform group-hover:scale-110",
                           evt.severity === 'CRITICAL' ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' :
                           evt.severity === 'WARNING' ? 'border-amber-500/50' : 'border-[#2d3647]'
                         )}>
                            {getEventIcon(evt.type, evt.severity)}
                         </div>

                         <div className="bg-[#0a0e27]/40 border border-[#2d3647] rounded-2xl p-4 hover:border-primary/40 transition-all shadow-lg group-hover:bg-[#1a1f3a]/20">
                            <div className="flex items-center justify-between mb-2">
                               <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">{new Date(evt.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                  <div className="h-3 w-[1px] bg-[#2d3647]"></div>
                                  <h4 className="text-sm font-bold text-white uppercase tracking-tight">{evt.title}</h4>
                               </div>
                               <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#1a1f3a] rounded border border-[#2d3647] text-[8px] font-black uppercase text-white/60">
                                     <Truck size={10} className="text-primary" /> {eq?.code}
                                  </div>
                               </div>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-1">{evt.description}</p>
                            <div className="mt-3 flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-[#1a1f3a] flex items-center justify-center border border-[#2d3647]"><User size={10} className="text-muted-foreground" /></div>
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase">{opr?.name}</span>
                               </div>
                               <span className="text-[9px] font-black text-primary/40 uppercase group-hover:text-primary transition-colors flex items-center gap-1">Detalhes <ArrowRight size={10} /></span>
                            </div>
                         </div>
                      </div>
                   )
                })}

                {filteredEvents.length === 0 && (
                   <div className="text-center py-20 opacity-30">
                      <History size={48} className="mx-auto mb-4" />
                      <p className="text-xs font-black uppercase tracking-widest">Nenhum evento registrado no período</p>
                   </div>
                )}
             </div>
          )}
        </main>
      </div>

      {/* Detail Drawer */}
      {selectedEvent && (
         <div className="fixed inset-0 z-[2000] flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedEvent(null)}></div>
            <div className="relative w-full max-w-md bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">Detalhes do Evento</h2>
                  <button onClick={() => setSelectedEvent(null)} className="p-2 hover:bg-[#1a1f3a] rounded-xl text-white transition-all"><X size={24} /></button>
               </div>

               <div className="space-y-8 overflow-y-auto custom-scrollbar pr-2">
                  <div className="bg-[#1a1f3a]/40 border border-[#2d3647] p-6 rounded-3xl">
                     <div className="flex items-center gap-4 mb-4">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl",
                          selectedEvent.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500 border border-red-500/30' : 'bg-primary/20 text-primary border border-primary/30'
                        )}>
                           {getEventIcon(selectedEvent.type, selectedEvent.severity)}
                        </div>
                        <div>
                           <h3 className="text-lg font-black italic tracking-tighter text-white uppercase">{selectedEvent.title}</h3>
                           <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{selectedEvent.type}</p>
                        </div>
                     </div>
                     <p className="text-sm text-white/80 leading-relaxed">{selectedEvent.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <InfoItem label="Timestamp" value={new Date(selectedEvent.timestamp).toLocaleString()} />
                     <InfoItem label="Severidade" value={selectedEvent.severity} />
                     <InfoItem label="Equipamento" value={equipments.find(e => e.id === selectedEvent.equipmentId)?.code || '-'} />
                     <InfoItem label="Operador" value={operators.find(o => o.id === selectedEvent.operatorId)?.name || '-'} />
                  </div>

                  {selectedEvent.metadata && (
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Dados Adicionais</h4>
                       <div className="bg-[#050812] border border-[#2d3647] rounded-2xl p-4 font-mono text-[10px] text-emerald-500/80">
                          <pre>{JSON.stringify(selectedEvent.metadata, null, 2)}</pre>
                       </div>
                    </div>
                  )}
               </div>

               <div className="mt-auto pt-8 flex gap-3 border-t border-[#2d3647]">
                  <button className="flex-1 py-3 bg-[#1a1f3a] rounded-xl text-xs font-black uppercase hover:bg-[#252d4a] transition-all">Exportar Log</button>
                  <button onClick={() => setSelectedEvent(null)} className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest">Fechar</button>
               </div>
            </div>
         </div>
      )}
    </div>
  );
}

function InfoItem({ label, value }: { label: string, value: string }) {
   return (
      <div className="bg-[#0a0e27]/60 border border-[#2d3647] p-4 rounded-2xl flex flex-col gap-1">
         <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
         <span className="text-xs font-bold text-white truncate uppercase">{value}</span>
      </div>
   );
}

export default withAuth(TimelinePage, { module: 'OPERACIONAL' });
