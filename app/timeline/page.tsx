"use client";

import React, { useState, useEffect, useCallback } from 'react';
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
  FilterX,
  MapPin,
  Activity,
  Zap,
  Fuel,
  Settings,
  PauseCircle,
  Flag
} from 'lucide-react';
import { cn } from '@/lib/utils';

function TimelinePage() {
  const [data, setData] = useState<TimelineEvent[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    equipmentId: '',
    fleetCode: '',
    operatorRegistration: '',
    journeyId: '',
    type: ''
  });
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const apiParams: Record<string, string> = {};
      if (filters.equipmentId) apiParams.equipmentId = filters.equipmentId;
      if (filters.fleetCode) apiParams.fleetCode = filters.fleetCode;
      if (filters.journeyId) apiParams.journeyId = filters.journeyId;
      if (filters.operatorRegistration) apiParams.operatorRegistration = filters.operatorRegistration;

      const [evts, eqs, oprs] = await Promise.all([
        TimelineService.getAll(apiParams).catch(() => [] as TimelineEvent[]),
        EquipmentService.getAll().catch(() => [] as Equipment[]),
        OperatorService.getAll().catch(() => [] as Operator[]),
      ]);

      setData(Array.isArray(evts) ? evts : []);
      setEquipments(Array.isArray(eqs) ? eqs : []);
      setOperators(Array.isArray(oprs) ? oprs : []);
    } catch (err) {
      console.error('[timeline] loadData error', err);
      setError('Erro ao carregar timeline. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [filters.equipmentId, filters.fleetCode, filters.journeyId, filters.operatorRegistration]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredEvents = data.filter(evt => {
    if (filters.search) {
      const term = filters.search.toLowerCase();
      const titleMatch = (evt.title || '').toLowerCase().includes(term);
      const descMatch = (evt.description || '').toLowerCase().includes(term);
      if (!titleMatch && !descMatch) return false;
    }
    if (filters.type && evt.type !== filters.type) return false;
    return true;
  });

  const getEventIcon = (type: string, severity: string) => {
    switch (type) {
      case 'STATUS_CHANGED':
      case 'STATUS_CHANGE':
        return <Activity size={14} className="text-emerald-500" />;
      case 'STOP_DETECTED':
      case 'STOP_REASON':
      case 'PARADA':
        return <PauseCircle size={14} className="text-amber-500" />;
      case 'STOP_ENDED':
        return <Play size={14} className="text-emerald-500" />;
      case 'ALERT':
        return <AlertCircle size={14} className={severity === 'CRITICAL' ? 'text-red-500' : 'text-amber-500'} />;
      case 'CHECKLIST':
        return <CheckCircle2 size={14} className="text-primary" />;
      case 'GPS_POINT':
      case 'LOCATION':
        return <MapPin size={14} className="text-blue-400" />;
      case 'HEARTBEAT':
        return <Zap size={14} className="text-purple-400" />;
      case 'FUELING':
        return <Fuel size={14} className="text-amber-400" />;
      case 'OPERATION_SELECTED':
      case 'OPERATION_CHANGED':
        return <Settings size={14} className="text-primary" />;
      case 'JOURNEY_START':
      case 'JOURNEY_END':
        return <Flag size={14} className="text-white" />;
      default:
        return <Clock size={14} className="text-muted-foreground" />;
    }
  };

  const hasAnyFilter = filters.equipmentId || filters.fleetCode || filters.operatorRegistration || filters.journeyId || filters.search || filters.type;

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Timeline Operacional" description="Rastro CronolÃ³gico de Eventos e Atividades de Frota" />

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
               value={filters.fleetCode}
               onChange={(e) => setFilters({...filters, fleetCode: e.target.value})}
             >
                <option value="">Todas as frotas</option>
                {equipments.map(e => <option key={e.id} value={e.code}>{e.code}</option>)}
             </select>
             <input
                type="text"
                placeholder="ID da jornada..."
                className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-4 py-2 text-xs focus:border-primary outline-none font-bold max-w-[150px]"
                value={filters.journeyId}
                onChange={(e) => setFilters({...filters, journeyId: e.target.value})}
             />
             <button
               onClick={() => setFilters({search: '', equipmentId: '', fleetCode: '', operatorRegistration: '', journeyId: '', type: ''})}
               className="p-2.5 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-muted-foreground hover:text-white transition-colors"
               title="Limpar filtros"
             >
               <FilterX size={18} />
             </button>
          </div>

          {loading ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4">
                <Loader2 size={40} className="text-primary animate-spin" />
                <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Sincronizando eventos reais...</p>
             </div>
          ) : error ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4">
               <AlertCircle size={40} className="text-red-500" />
               <p className="text-sm text-red-400 font-bold">{error}</p>
               <button onClick={loadData} className="px-4 py-2 bg-primary/20 text-primary rounded-xl text-xs font-black uppercase hover:bg-primary/30 transition-colors">Tentar novamente</button>
             </div>
          ) : (
             <div className="max-w-4xl mx-auto space-y-1 relative">
                {/* Central Line */}
                {filteredEvents.length > 0 && (
                   <div className="absolute left-[23px] top-0 bottom-0 w-[2px] bg-[#2d3647]"></div>
                )}

                {filteredEvents.map((evt) => {
                   const eq = equipments.find(e =>
                      e.id === evt.equipmentId ||
                      e.code === evt.metadata?.fleetCode ||
                      e.code === evt.metadata?.equipmentCode ||
                      e.code === evt.metadata?.machineCode ||
                      e.id === evt.metadata?.equipmentId
                   );
                   const opr = operators.find(o =>
                      o.id === evt.operatorId ||
                      o.registration === evt.metadata?.operatorRegistration ||
                      o.registration === evt.metadata?.registration ||
                      o.id === evt.metadata?.operatorId
                   );

                   return (
                      <div key={evt.id} className="relative pl-16 py-4 group cursor-pointer" onClick={() => setSelectedEvent(evt)}>
                         {/* Bullet */}
                         <div className={cn(
                           "absolute left-2.5 top-6 w-8 h-8 rounded-full bg-[#0a0e27] border-2 flex items-center justify-center z-10 transition-transform group-hover:scale-110",
                           evt.severity === 'CRITICAL' ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' :
                           evt.severity === 'WARNING' ? 'border-amber-500/50' : 'border-[#2d3647]'
                         )}>
                            {getEventIcon(evt.type, evt.severity || 'INFO')}
                         </div>

                         <div className="bg-[#0a0e27]/40 border border-[#2d3647] rounded-2xl p-4 hover:border-primary/40 transition-all shadow-lg group-hover:bg-[#1a1f3a]/20">
                            <div className="flex items-center justify-between mb-2">
                               <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-black text-primary uppercase tracking-widest">
                                     {evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit', second: '2-digit'}) : '--:--'}
                                  </span>
                                  <div className="h-3 w-[1px] bg-[#2d3647]"></div>
                                  <h4 className="text-sm font-bold text-white uppercase tracking-tight">{evt.title}</h4>
                               </div>
                               <div className="flex items-center gap-3">
                                  {eq && (
                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#1a1f3a] rounded border border-[#2d3647] text-[8px] font-black uppercase text-white/60">
                                       <Truck size={10} className="text-primary" /> {eq.code}
                                    </div>
                                  )}
                                  <span className="text-[8px] font-black text-muted-foreground uppercase opacity-40">{evt.type}</span>
                               </div>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">{evt.description}</p>
                            <div className="mt-3 flex items-center justify-between">
                               <div className="flex items-center gap-2">
                                  <div className="w-5 h-5 rounded-full bg-[#1a1f3a] flex items-center justify-center border border-[#2d3647]"><User size={10} className="text-muted-foreground" /></div>
                                  <span className="text-[9px] font-bold text-muted-foreground uppercase">{opr?.name || evt.metadata?.operatorName || evt.metadata?.operatorRegistration || 'Operador Desconhecido'}</span>
                               </div>
                               <span className="text-[9px] font-black text-primary/40 uppercase group-hover:text-primary transition-colors flex items-center gap-1">Detalhes <ArrowRight size={10} /></span>
                            </div>
                         </div>
                      </div>
                   )
                })}

                {filteredEvents.length === 0 && (
                   <div className="text-center py-20 bg-[#0a0e27]/20 rounded-3xl border border-dashed border-[#2d3647]">
                      <History size={48} className="mx-auto mb-4 text-muted-foreground opacity-20" />
                      <p className="text-sm font-black uppercase tracking-widest text-muted-foreground">
                        {hasAnyFilter ? "Nenhum evento corresponde aos filtros atuais" : "Nenhum evento registrado no perÃ­odo"}
                      </p>
                      {hasAnyFilter && (
                         <p className="text-[10px] text-muted-foreground/60 mt-2 uppercase font-bold">
                           Existem eventos no storage, mas os filtros estÃ£o restringindo a visualizaÃ§Ã£o. <br/>
                           Tente ajustar a frota, operador ou jornada.
                         </p>
                      )}
                      {hasAnyFilter && (
                         <button
                           onClick={() => setFilters({search: '', equipmentId: '', fleetCode: '', operatorRegistration: '', journeyId: '', type: ''})}
                           className="mt-6 px-4 py-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[10px] font-black uppercase hover:text-white transition-colors"
                         >
                           Limpar filtros
                         </button>
                      )}
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
                           {getEventIcon(selectedEvent.type, selectedEvent.severity || 'INFO')}
                        </div>
                        <div>
                           <h3 className="text-lg font-black italic tracking-tighter text-white uppercase">{selectedEvent.title}</h3>
                           <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{selectedEvent.type}</p>
                        </div>
                     </div>
                     <p className="text-sm text-white/80 leading-relaxed">{selectedEvent.description}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                     <InfoItem label="HorÃ¡rio Real" value={selectedEvent.timestamp ? new Date(selectedEvent.timestamp).toLocaleString('pt-BR') : '-'} />
                     <InfoItem label="Severidade" value={selectedEvent.severity || 'INFO'} />
                     <InfoItem label="Frota" value={selectedEvent.metadata?.fleetCode || selectedEvent.metadata?.equipmentCode || '-'} />
                     <InfoItem label="MatrÃ­cula" value={selectedEvent.metadata?.operatorRegistration || selectedEvent.metadata?.registration || '-'} />
                     <InfoItem label="Jornada" value={selectedEvent.metadata?.journeyId || '-'} />
                     <InfoItem label="ID Evento" value={selectedEvent.id} />
                  </div>

                  {selectedEvent.metadata && (
                    <div className="space-y-4">
                       <h4 className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Payload Bruto (APK)</h4>
                       <div className="bg-[#050812] border border-[#2d3647] rounded-2xl p-4 font-mono text-[10px] text-emerald-500/80 overflow-x-auto">
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

export default withAuth(TimelinePage, { module: 'OPERACIONAL' })
