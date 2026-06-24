"use client";

import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import {
  FileText,
  BarChart3,
  Clock,
  ChevronRight,
  ChevronLeft,
  Calendar,
  CheckCircle2,
  Download,
  Play,
  ArrowRight,
  Filter,
  FileDown,
  TrendingUp,
  Database,
  AlertCircle,
  MapPin,
  History,
  Star
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/auth-context';
import { AuditService } from '@/services/master.service';
import { withAuth } from '@/components/shared/with-auth';
import { ActionFeedback, type ActionFeedbackMessage } from '@/components/shared/action-feedback';

// --- Types ---
type ReportType =
  | 'HOURS'
  | 'EFFICIENCY'
  | 'STOPS'
  | 'SUPPLY'
  | 'CHECKLIST'
  | 'OPERATIONS'
  | 'PRODUCTION'
  | 'TIMELINE'
  | 'MAP'
  | 'RANKING';

type Step = 1 | 2 | 3 | 4 | 5;

// --- Constants ---
const REPORT_TYPES = [
  { id: 'HOURS', label: 'Horas Operacionais', icon: Clock, description: 'Análise de utilização de motor e trabalho.' },
  { id: 'EFFICIENCY', label: 'Eficiência Operacional', icon: TrendingUp, description: 'Relação entre tempo produtivo e improdutivo.' },
  { id: 'STOPS', label: 'Motivos de Parada', icon: AlertCircle, description: 'Gargalos e causas de indisponibilidade.' },
  { id: 'SUPPLY', label: 'Abastecimentos', icon: Database, description: 'Consumo de combustível e indicadores L/h.' },
  { id: 'CHECKLIST', label: 'Checklists', icon: CheckCircle2, description: 'Conformidade técnica pré-operacional.' },
  { id: 'OPERATIONS', label: 'Atividades', icon: Play, description: 'Rastro de execuções no campo.' },
  { id: 'PRODUCTION', label: 'Produção', icon: BarChart3, description: 'Volume colhido ou área trabalhada.' },
  { id: 'TIMELINE', label: 'Linha do Tempo', icon: History, description: 'Visão sequencial de eventos.' },
  { id: 'MAP', label: 'Relatórios Geográficos', icon: MapPin, description: 'Mapas de calor e rastro GPS.' },
  { id: 'RANKING', label: 'Ranking', icon: Star, description: 'Benchmarks de operadores e máquinas.' },
];

const MODELS: Record<string, string[]> = {
  HOURS: ['Por Equipamento', 'Por Operador', 'Por Frente', 'Por Fazenda/Talhão', 'Resumido', 'Detalhado'],
  EFFICIENCY: ['KPI Global', 'Comparativo Máquinas', 'Evolução Semanal'],
  STOPS: ['Top 10 Motivos', 'Duração por Categoria', 'Eventos Críticos'],
};

function ReportsPage() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedbackMessage | null>(null);

  const handleNext = () => step < 5 && setStep((s) => (s + 1) as Step);
  const handleBack = () => step > 1 && setStep((s) => (s - 1) as Step);

  const handleExport = async (format: string) => {
    if (!user) return;

    await AuditService.create({
      userId: user.id,
      userName: user.name,
      module: 'REPORTS',
      action: 'EXPORT',
      timestamp: new Date().toISOString(),
      ip: '127.0.0.1',
      origin: 'WEB',
      after: { format, reportType: selectedType, model: selectedModel }
    });

    setFeedback({
      type: 'success',
      message: 'Relatorio exportado em ' + format + '. Acao registrada em auditoria.',
    });
  };

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader
            title="SILO OPS / Relatórios"
            description="Motor de análise e exportação de dados operacionais."
          />
          <ActionFeedback feedback={feedback} onDismiss={() => setFeedback(null)} />

          {/* Stepper Enterprise */}
          <div className="flex items-center justify-between mb-10 max-w-4xl mx-auto bg-[#0a0e27]/40 p-4 rounded-3xl border border-[#2d3647]">
             {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center">
                   <div className={cn(
                     "w-10 h-10 rounded-2xl flex items-center justify-center font-black italic transition-all duration-300",
                     step >= i ? "bg-primary text-[#0a0e27] shadow-lg shadow-primary/20" : "bg-[#1a1f3a] text-muted-foreground border border-[#2d3647]"
                   )}>
                      {i}
                   </div>
                   {i < 5 && (
                     <div className={cn("w-12 h-0.5 mx-2", step > i ? "bg-primary" : "bg-[#2d3647]")} />
                   )}
                </div>
             ))}
          </div>

          <div className="max-w-6xl mx-auto animate-in fade-in duration-500 slide-in-from-bottom-4">
             {/* Step 1: Type Selection */}
             {step === 1 && (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                 {REPORT_TYPES.map((type) => (
                   <button
                    key={type.id}
                    onClick={() => { setSelectedType(type.id as ReportType); handleNext(); }}
                    className={cn(
                      "p-6 bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl text-left hover:border-primary/40 transition-all group flex flex-col h-full",
                      selectedType === type.id && "border-primary/60 bg-primary/5"
                    )}
                   >
                     <div className="p-3 bg-[#1a1f3a] rounded-2xl w-fit mb-4 group-hover:scale-110 transition-transform text-primary border border-[#2d3647]">
                        <type.icon size={24} />
                     </div>
                     <h3 className="font-black italic uppercase tracking-tighter text-white mb-2 group-hover:text-primary transition-colors">{type.label}</h3>
                     <p className="text-[10px] text-muted-foreground leading-relaxed uppercase font-bold tracking-tight">{type.description}</p>
                     <ChevronRight className="mt-auto pt-4 self-end text-primary opacity-0 group-hover:opacity-100 transition-all" size={18} />
                   </button>
                 ))}
               </div>
             )}

             {/* Step 2: Model Selection */}
             {step === 2 && selectedType && (
               <div className="space-y-6">
                 <h2 className="text-xl font-black italic tracking-tighter uppercase text-primary">Modelos para {REPORT_TYPES.find(t => t.id === selectedType)?.label}</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(MODELS[selectedType] || MODELS['HOURS']).map(model => (
                      <button
                        key={model}
                        onClick={() => { setSelectedModel(model); handleNext(); }}
                        className={cn(
                          "p-6 bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl text-left hover:border-primary/40 transition-all group flex items-center justify-between",
                          selectedModel === model && "border-primary/60 bg-primary/5"
                        )}
                      >
                         <span className="font-bold text-white uppercase text-sm tracking-tight">{model}</span>
                         <div className="w-8 h-8 rounded-xl bg-[#1a1f3a] flex items-center justify-center text-muted-foreground group-hover:text-primary"><ArrowRight size={16} /></div>
                      </button>
                    ))}
                 </div>
                 <button onClick={handleBack} className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground hover:text-white mt-10"><ChevronLeft size={16} /> Voltar</button>
               </div>
             )}

             {/* Step 3: Filters (Simplified Simulation) */}
             {step === 3 && (
               <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-[40px] p-10 shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-10 opacity-5"><Filter size={120} /></div>
                 <h2 className="text-xl font-black italic tracking-tighter uppercase text-primary mb-8">Parâmetros de Geração</h2>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Período Inicial</label>
                       <div className="relative"><Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={16} /><input type="date" className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-2xl p-4 pl-12 text-sm focus:border-primary outline-none" /></div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Período Final</label>
                       <div className="relative"><Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" size={16} /><input type="date" className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-2xl p-4 pl-12 text-sm focus:border-primary outline-none" /></div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Frente de Trabalho</label>
                       <select className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-2xl p-4 text-sm focus:border-primary outline-none appearance-none font-bold uppercase"><option>Todas as Frentes</option><option>Frente 01</option><option>Frente 02</option></select>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Origem de Dados</label>
                       <div className="flex gap-2">
                          {['APK', 'MQTT', 'API', 'PIMS'].map(o => <button key={o} className="px-4 py-2 bg-[#1a1f3a] rounded-xl border border-[#2d3647] text-[9px] font-black text-white hover:border-primary/50">{o}</button>)}
                       </div>
                    </div>
                 </div>

                 <div className="flex justify-between items-center pt-6 border-t border-[#2d3647]">
                   <button onClick={handleBack} className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground hover:text-white"><ChevronLeft size={16} /> Voltar</button>
                   <button onClick={handleNext} className="bg-primary text-[#0a0e27] px-10 py-4 rounded-2xl font-black italic tracking-tighter uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-transform flex items-center gap-2">Gerar Prévia <TrendingUp size={18} /></button>
                 </div>
               </div>
             )}

             {/* Step 4: Preview (Simulation) */}
             {step === 4 && (
               <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                     <PreviewCard label="Registros" value="1.240" />
                     <PreviewCard label="Horas Totais" value="480.5h" color="text-primary" />
                     <PreviewCard label="Eficiência Média" value="84%" />
                     <PreviewCard label="Integridade" value="100%" color="text-emerald-500" />
                  </div>

                  <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl overflow-hidden shadow-2xl">
                     <table className="w-full text-left">
                        <thead className="bg-[#1a1f3a]/50 text-[10px] uppercase font-black tracking-widest text-muted-foreground border-b border-[#2d3647]">
                           <tr><th className="px-6 py-4">Data</th><th className="px-6 py-4">Equipamento</th><th className="px-6 py-4">Operador</th><th className="px-6 py-4">Horas</th></tr>
                        </thead>
                        <tbody className="divide-y divide-[#2d3647] text-xs font-medium">
                           {[1,2,3,4,5].map(i => (
                             <tr key={i} className="hover:bg-primary/5 transition-colors"><td className="px-6 py-4">04/06/2024</td><td className="px-6 py-4 font-black italic text-primary">605112</td><td className="px-6 py-4 uppercase text-white/70">Ricardo Silva</td><td className="px-6 py-4">08:00h</td></tr>
                           ))}
                        </tbody>
                     </table>
                  </div>

                  <div className="flex justify-between items-center mt-10">
                    <button onClick={handleBack} className="flex items-center gap-2 text-xs font-black uppercase text-muted-foreground hover:text-white"><ChevronLeft size={16} /> Voltar</button>
                    <button onClick={handleNext} className="bg-primary text-[#0a0e27] px-10 py-4 rounded-2xl font-black italic tracking-tighter uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-transform flex items-center gap-2">Configurar Exportação <Download size={18} /></button>
                  </div>
               </div>
             )}

             {/* Step 5: Export */}
             {step === 5 && (
               <div className="flex flex-col items-center justify-center py-20 text-center animate-in zoom-in duration-500">
                  <div className="w-24 h-24 rounded-[40px] bg-primary/10 flex items-center justify-center text-primary mb-8 border-2 border-primary/20 shadow-2xl shadow-primary/10">
                     <FileDown size={48} />
                  </div>
                  <h2 className="text-3xl font-black italic tracking-tighter uppercase text-white mb-4">Relatório Pronto!</h2>
                  <p className="text-muted-foreground text-sm uppercase font-bold tracking-widest mb-12">Selecione o formato de saída para processamento.</p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 w-full max-w-3xl">
                     <ExportButton label="Excel (XLSX)" icon={<FileText className="text-emerald-500" />} onClick={() => handleExport('XLSX')} />
                     <ExportButton label="Dados (CSV)" icon={<Database className="text-blue-500" />} onClick={() => handleExport('CSV')} />
                     <ExportButton label="Documento (PDF)" icon={<FileDown className="text-red-500" />} onClick={() => handleExport('PDF')} />
                  </div>

                  <button onClick={() => setStep(1)} className="mt-20 text-xs font-black uppercase text-primary border-b border-primary border-dashed pb-1 hover:brightness-110">Criar Novo Relatório</button>
               </div>
             )}
          </div>
        </main>
      </div>
    </div>
  );
}

function PreviewCard({ label, value, color = "text-white" }: { label: string, value: string, color?: string }) {
  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] p-5 rounded-3xl flex flex-col gap-1">
      <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
      <span className={cn("text-2xl font-black italic tracking-tighter", color)}>{value}</span>
    </div>
  );
}

function ExportButton({ label, icon, onClick }: { label: string, icon: any, onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-[#0a0e27] border border-[#2d3647] p-8 rounded-[40px] hover:border-primary transition-all flex flex-col items-center gap-4 group"
    >
       <div className="p-4 bg-[#1a1f3a] rounded-3xl group-hover:scale-110 transition-transform">{icon}</div>
       <span className="text-xs font-black uppercase tracking-widest text-white">{label}</span>
    </button>
  );
}

export default withAuth(ReportsPage, { module: 'RELATORIOS' });


