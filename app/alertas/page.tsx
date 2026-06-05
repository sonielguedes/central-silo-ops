"use client";

import React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { AlertCircle, AlertTriangle, Info, MoreHorizontal, CheckCircle2 } from 'lucide-react';
import { ALERTS_DATA } from '@/lib/mock/dashboard-data';
import { cn } from '@/lib/utils';

import { withAuth } from '@/components/shared/with-auth';

function AlertasPage() {
  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-black italic tracking-tighter uppercase text-white">Alertas do Sistema</h1>
              <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mt-1">Monitoramento de Exceções e Eventos Críticos</p>
            </div>
            <div className="flex gap-2">
               <button className="px-4 py-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[10px] font-black uppercase hover:bg-[#252d4a] transition-all">Limpar Tudo</button>
               <button className="px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-[10px] font-black uppercase shadow-lg shadow-primary/20">Configurar Regras</button>
            </div>
          </div>

          <div className="space-y-4">
            {ALERTS_DATA.map((alert) => (
              <div key={alert.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-5 hover:border-primary/30 transition-all flex items-center justify-between group">
                <div className="flex items-center gap-5">
                   <div className={cn(
                     "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform",
                     alert.severity === 'error' ? "bg-red-500/10 text-red-500" :
                     alert.severity === 'warning' ? "bg-amber-500/10 text-amber-500" :
                     "bg-blue-500/10 text-blue-500"
                   )}>
                     {alert.severity === 'error' ? <AlertCircle size={28} /> :
                      alert.severity === 'warning' ? <AlertTriangle size={28} /> :
                      <Info size={28} />}
                   </div>
                   <div>
                      <div className="flex items-center gap-3">
                         <h3 className="text-sm font-black uppercase tracking-widest text-white group-hover:text-primary transition-colors">{alert.title}</h3>
                         <span className={cn(
                           "px-2 py-0.5 rounded text-[8px] font-black uppercase border",
                           alert.severity === 'error' ? "text-red-500 border-red-500/30 bg-red-500/5" :
                           alert.severity === 'warning' ? "text-amber-500 border-amber-500/30 bg-amber-500/5" :
                           "text-blue-400 border-blue-500/30 bg-blue-500/5"
                         )}>{alert.type}</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium mt-1 uppercase tracking-tight">{alert.equipment} • {alert.location}</p>
                      <p className="text-[9px] text-white/40 font-bold mt-2 uppercase flex items-center gap-1"><MoreHorizontal size={10} /> Registrado há {alert.time}</p>
                   </div>
                </div>
                <div className="flex gap-2">
                   <button className="p-2.5 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-muted-foreground hover:text-white transition-all"><CheckCircle2 size={18} /></button>
                   <button className="p-2.5 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-muted-foreground hover:text-white transition-all"><MoreHorizontal size={18} /></button>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export default withAuth(AlertasPage, { module: 'ALERTAS' });
