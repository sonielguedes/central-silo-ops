"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { FleetActivityService, EquipmentService, OperationalStateService } from '@/services/api-service';
import { FleetActivity, Equipment, OperationalState } from '@/lib/types';
import {
  RefreshCw,
  Clock,
  MapPin,
  Truck,
  Loader2,
  ChevronRight,
  Download
} from 'lucide-react';

export default function FleetActivityHistoryPage() {
  const [data, setData] = useState<FleetActivity[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [states, setStates] = useState<OperationalState[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [history, eqs, sts] = await Promise.all([
      FleetActivityService.getAll(),
      EquipmentService.getAll(),
      OperationalStateService.getAll()
    ]);
    setData(history);
    setEquipments(eqs);
    setStates(sts);
    setLoading(false);
  };

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Histórico de Atividade" description="Rastro Completo de Movimentação e Estados da Frota">
            <button className="flex items-center gap-2 px-4 py-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-[#252d4a] transition-all"><Download size={16} /> Exportar Log</button>
          </PageHeader>

          {loading ? (
             <div className="flex justify-center p-12"><Loader2 size={40} className="text-primary animate-spin" /></div>
          ) : data.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-96 gap-4 border-2 border-dashed border-[#2d3647] rounded-3xl opacity-50 text-muted-foreground">
                <RefreshCw size={48} />
                <p className="text-xs font-black uppercase">Nenhuma atividade registrada nas últimas 24h</p>
             </div>
          ) : (
             <div className="space-y-4">
                {data.map(activity => {
                   const eq = equipments.find(e => e.id === activity.equipmentId);
                   const state = states.find(s => s.id === activity.stateId);
                   return (
                      <div key={activity.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl p-4 flex items-center justify-between group hover:border-primary/40 transition-all">
                         <div className="flex items-center gap-6">
                            <div className="flex flex-col items-center">
                               <span className="text-[10px] font-black text-white/40 uppercase">Início</span>
                               <span className="text-xs font-black italic text-primary">{new Date(activity.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <div className="h-10 w-[1px] bg-[#2d3647]"></div>
                            <div className="flex items-center gap-4">
                               <div className="w-10 h-10 rounded-xl bg-[#1a1f3a] border border-[#2d3647] flex items-center justify-center text-muted-foreground">
                                  <Truck size={20} />
                               </div>
                               <div>
                                  <h3 className="text-sm font-black italic tracking-tighter text-white uppercase">{eq?.code}</h3>
                                  <div className="flex items-center gap-2 mt-1">
                                     <div className="w-2 h-2 rounded-full" style={{ backgroundColor: state?.color }}></div>
                                     <span className="text-[9px] font-black uppercase tracking-widest text-white/60">{state?.name}</span>
                                  </div>
                               </div>
                            </div>
                         </div>
                         <div className="flex items-center gap-8">
                            <div className="flex items-center gap-2 text-muted-foreground">
                               <MapPin size={12} />
                               <span className="text-[10px] font-bold uppercase">{activity.location || 'Localização Desconhecida'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-muted-foreground">
                               <Clock size={12} />
                               <span className="text-[10px] font-bold uppercase">{activity.durationMinutes} min</span>
                            </div>
                            <button className="p-2 hover:bg-[#1a1f3a] rounded-lg text-muted-foreground hover:text-white transition-all"><ChevronRight size={16} /></button>
                         </div>
                      </div>
                   )
                })}
             </div>
          )}
        </main>
      </div>
    </div>
  );
}
