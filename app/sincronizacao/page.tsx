"use client";

import React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { RefreshCw, Wifi, Database, Server, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { withAuth } from '@/components/shared/with-auth';

function SincronizacaoPage() {
  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Sincronização SILO OPS" description="Monitoramento do fluxo Field, Central e Nuvem." />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <SyncStat icon={<Wifi className="text-emerald-500" />} label="Conexão MQTT" value="ESTÁVEL" />
            <SyncStat icon={<RefreshCw className="text-blue-500" />} label="Eventos Pendentes" value="12" />
            <SyncStat icon={<CheckCircle2 className="text-emerald-500" />} label="Sincronizados (24h)" value="1.450" />
            <SyncStat icon={<AlertTriangle className="text-red-500" />} label="Erros de Sync" value="2" />
          </div>

          <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-8 flex flex-col items-center justify-center gap-6 min-h-[400px]">
             <div className="relative">
                <Database size={64} className="text-primary/20" />
                <Server size={32} className="text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute inset-0 border-2 border-primary/20 rounded-full animate-ping"></div>
             </div>
             <div className="text-center">
                <h3 className="text-xl font-black italic tracking-tighter uppercase text-white">Fila de Processamento</h3>
                <p className="text-xs text-muted-foreground mt-2 max-w-md">Todos os dados coletados via APK estão em conformidade e sincronizados com o servidor central.</p>
             </div>
             <div className="flex items-center gap-2 bg-[#1a1f3a] px-4 py-2 rounded-xl border border-[#2d3647]">
                <Clock size={14} className="text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/60">Último Check: Agora</span>
             </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function SyncStat({ icon, label, value }: { icon: any, label: string, value: string }) {
  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] p-6 rounded-3xl flex items-center gap-4">
      <div className="p-3 bg-[#1a1f3a] rounded-2xl border border-[#2d3647]">{icon}</div>
      <div>
        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest leading-none mb-1.5">{label}</p>
        <p className="text-xl font-black italic text-white tracking-tighter leading-none">{value}</p>
      </div>
    </div>
  );
}

export default withAuth(SincronizacaoPage, { module: 'SINCRONIZACAO' });
