"use client";

import React, { useMemo, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  FileDown,
  Filter,
  History,
  Clock,
  MapPin,
  Play,
  Star,
  TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/context/auth-context';
import { AuditService } from '@/services/master.service';
import { withAuth } from '@/components/shared/with-auth';
import { ActionFeedback, type ActionFeedbackMessage } from '@/components/shared/action-feedback';

type ReportType = 'HOURS' | 'EFFICIENCY' | 'STOPS' | 'SUPPLY' | 'CHECKLIST' | 'OPERATIONS' | 'PRODUCTION' | 'TIMELINE' | 'MAP' | 'RANKING';
type Step = 1 | 2 | 3 | 4 | 5;

const REPORT_TYPES: Array<{
  id: ReportType;
  label: string;
  icon: LucideIcon;
  description: string;
  status: 'Disponível';
}> = [
  { id: 'HOURS', label: 'Horas Operacionais', icon: Clock, description: 'Análise de utilização de motor e trabalho.', status: 'Disponível' },
  { id: 'EFFICIENCY', label: 'Eficiência Operacional', icon: TrendingUp, description: 'Relação entre tempo produtivo e improdutivo.', status: 'Disponível' },
  { id: 'STOPS', label: 'Motivos de Parada', icon: AlertCircle, description: 'Gargalos e causas de indisponibilidade.', status: 'Disponível' },
  { id: 'SUPPLY', label: 'Abastecimentos', icon: Database, description: 'Consumo de combustível e indicadores L/h.', status: 'Disponível' },
  { id: 'CHECKLIST', label: 'Checklists', icon: CheckCircle2, description: 'Conformidade técnica pré-operacional.', status: 'Disponível' },
  { id: 'OPERATIONS', label: 'Atividades', icon: Play, description: 'Rastro de execuções no campo.', status: 'Disponível' },
  { id: 'PRODUCTION', label: 'Produção', icon: BarChart3, description: 'Volume colhido ou área trabalhada.', status: 'Disponível' },
  { id: 'TIMELINE', label: 'Linha do Tempo', icon: History, description: 'Visão sequencial de eventos.', status: 'Disponível' },
  { id: 'MAP', label: 'Relatórios Geográficos', icon: MapPin, description: 'Mapas de calor e rastro GPS.', status: 'Disponível' },
  { id: 'RANKING', label: 'Ranking', icon: Star, description: 'Benchmarks de operadores e máquinas.', status: 'Disponível' },
];

const MODELS: Record<ReportType, string[]> = {
  HOURS: ['Por Equipamento', 'Por Operador', 'Por Frente', 'Por Fazenda/Talhão', 'Resumido', 'Detalhado'],
  EFFICIENCY: ['KPI Global', 'Comparativo de Máquinas', 'Evolução Semanal'],
  STOPS: ['Top 10 Motivos', 'Duração por Categoria', 'Eventos Críticos'],
  SUPPLY: ['Consumo Diário', 'Comparativo Mensal', 'Eficiência por Frota'],
  CHECKLIST: ['Pré-operação', 'Conformidade Técnica', 'Execuções Pendentes'],
  OPERATIONS: ['Rastro Diário', 'Jornada por Frota', 'Eventos de Campo'],
  PRODUCTION: ['Volume por Área', 'Área Trabalhada', 'Consolidado Mensal'],
  TIMELINE: ['Linha Completa', 'Por Máquina', 'Por Operador'],
  MAP: ['Mapa de Calor', 'Trajeto GPS', 'Cobertura por Área'],
  RANKING: ['Operadores', 'Máquinas', 'Frentes'],
};

function ReportsPage() {
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(1);
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedbackMessage | null>(null);

  const selectedMeta = useMemo(
    () => REPORT_TYPES.find((type) => type.id === selectedType) ?? null,
    [selectedType],
  );

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
      after: { format, reportType: selectedType, model: selectedModel },
    });

    setFeedback({
      type: 'success',
      message: `Relatório exportado em ${format}. Ação registrada em auditoria.`,
    });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#050812] font-sans text-white">
      <Sidebar className="hidden shrink-0 lg:flex" />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
          <PageHeader
            title="Relatórios"
            description="Central de análises operacionais, consumo, conformidade e auditoria."
          />

          <ActionFeedback feedback={feedback} onDismiss={() => setFeedback(null)} />

          <div className="mx-auto mb-8 flex max-w-6xl items-center justify-between rounded-[28px] border border-white/10 bg-[#0a0e27]/60 p-4 shadow-2xl shadow-black/20">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-2xl border text-sm font-extrabold transition-all duration-300',
                    step >= i
                      ? 'border-primary/40 bg-primary text-[#0a0e27] shadow-lg shadow-primary/20'
                      : 'border-white/10 bg-[#1a1f3a] text-muted-foreground',
                  )}
                >
                  {i}
                </div>
                {i < 5 && <div className={cn('mx-2 h-0.5 w-12', step > i ? 'bg-primary' : 'bg-white/10')} />}
              </div>
            ))}
          </div>

          <div className="mx-auto max-w-6xl">
            {step === 1 && (
              <section>
                <div className="mb-6 flex items-end justify-between gap-4">
                  <div>
                    <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.35em] text-primary/80">Seleção de relatório</p>
                    <h2 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">Escolha a análise que quer abrir</h2>
                  </div>
                  <p className="max-w-md text-sm leading-6 text-muted-foreground">
                    Cards mais legíveis, hierarquia clara e ação explícita. Sem teatro tipográfico.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {REPORT_TYPES.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => {
                        setSelectedType(type.id);
                        handleNext();
                      }}
                      className={cn(
                        'group flex min-h-[220px] flex-col rounded-[28px] border border-white/10 bg-[#0a0e27]/70 p-6 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 hover:shadow-2xl hover:shadow-primary/10',
                        selectedType === type.id && 'border-primary/60 bg-primary/5 ring-1 ring-primary/20',
                      )}
                    >
                      <div className="mb-5 flex items-start justify-between gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#1a1f3a] text-primary transition-transform group-hover:scale-105">
                          <type.icon size={22} />
                        </div>
                        <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.22em] text-emerald-400">
                          {type.status}
                        </span>
                      </div>

                      <h3 className="text-lg font-extrabold tracking-tight text-white transition-colors group-hover:text-primary">
                        {type.label}
                      </h3>
                      <p className="mt-3 max-w-sm text-sm leading-6 text-slate-300/80">{type.description}</p>

                      <div className="mt-auto flex items-center justify-between pt-8">
                        <span className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">Abrir relatório</span>
                        <ChevronRight className="text-primary opacity-70 transition-all group-hover:translate-x-1 group-hover:opacity-100" size={18} />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === 2 && selectedType && (
              <section className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.35em] text-primary/80">Modelo</p>
                    <h2 className="text-2xl font-extrabold tracking-tight text-white">{selectedMeta?.label}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{selectedMeta?.description}</p>
                  </div>
                  <button onClick={handleBack} className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-white">
                    <ChevronLeft size={16} /> Voltar
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {MODELS[selectedType].map((model) => (
                    <button
                      key={model}
                      onClick={() => {
                        setSelectedModel(model);
                        handleNext();
                      }}
                      className={cn(
                        'flex items-center justify-between rounded-[24px] border border-white/10 bg-[#0a0e27]/70 px-5 py-5 text-left transition-all hover:border-primary/35 hover:bg-primary/5',
                        selectedModel === model && 'border-primary/60 bg-primary/5',
                      )}
                    >
                      <span className="text-sm font-bold tracking-tight text-white">{model}</span>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1a1f3a] text-muted-foreground transition-colors group-hover:text-primary">
                        <ArrowRight size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {step === 3 && (
              <section className="rounded-[32px] border border-white/10 bg-[#0a0e27]/70 p-6 shadow-2xl shadow-black/20 md:p-10">
                <div className="absolute right-10 top-10 opacity-5">
                  <Filter size={120} />
                </div>
                <h2 className="mb-8 text-2xl font-extrabold tracking-tight text-primary">Parâmetros de geração</h2>

                <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2">
                  <Field label="Período inicial" icon={<Calendar size={16} />} control={<input type="date" className="w-full rounded-2xl border border-white/10 bg-[#1a1f3a] p-4 text-sm outline-none transition focus:border-primary" />} />
                  <Field label="Período final" icon={<Calendar size={16} />} control={<input type="date" className="w-full rounded-2xl border border-white/10 bg-[#1a1f3a] p-4 text-sm outline-none transition focus:border-primary" />} />
                  <Field label="Frente de trabalho" icon={<MapPin size={16} />} control={<select className="w-full appearance-none rounded-2xl border border-white/10 bg-[#1a1f3a] p-4 text-sm font-bold outline-none transition focus:border-primary"><option>Todas as frentes</option><option>Frente 01</option><option>Frente 02</option></select>} />
                  <Field
                    label="Origem de dados"
                    icon={<Database size={16} />}
                    control={
                      <div className="flex gap-2">
                        {['APK', 'MQTT', 'API', 'PIMS'].map((origin) => (
                          <button key={origin} className="rounded-xl border border-white/10 bg-[#1a1f3a] px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-white transition hover:border-primary/40">
                            {origin}
                          </button>
                        ))}
                      </div>
                    }
                  />
                </div>

                <div className="flex items-center justify-between border-t border-white/10 pt-6">
                  <button onClick={handleBack} className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-white">
                    <ChevronLeft size={16} /> Voltar
                  </button>
                  <button onClick={handleNext} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-xs font-extrabold uppercase tracking-[0.22em] text-[#0a0e27] shadow-lg shadow-primary/20 transition hover:scale-[1.02]">
                    Gerar prévia <TrendingUp size={18} />
                  </button>
                </div>
              </section>
            )}

            {step === 4 && (
              <section className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <PreviewCard label="Registros" value="1.240" />
                  <PreviewCard label="Horas totais" value="480,5h" color="text-primary" />
                  <PreviewCard label="Eficiência média" value="84%" />
                  <PreviewCard label="Integridade" value="100%" color="text-emerald-400" />
                </div>

                <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#0a0e27]/70 shadow-2xl shadow-black/20">
                  <table className="w-full text-left">
                    <thead className="border-b border-white/10 bg-[#1a1f3a]/50 text-[10px] font-extrabold uppercase tracking-[0.25em] text-muted-foreground">
                      <tr>
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Equipamento</th>
                        <th className="px-6 py-4">Operador</th>
                        <th className="px-6 py-4">Horas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-sm">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <tr key={i} className="transition-colors hover:bg-primary/5">
                          <td className="px-6 py-4 text-white/80">04/06/2024</td>
                          <td className="px-6 py-4 font-bold text-primary">605112</td>
                          <td className="px-6 py-4 text-white/70">Ricardo Silva</td>
                          <td className="px-6 py-4 text-white/80">08:00h</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  <button onClick={handleBack} className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground hover:text-white">
                    <ChevronLeft size={16} /> Voltar
                  </button>
                  <button onClick={handleNext} className="inline-flex items-center gap-2 rounded-2xl bg-primary px-8 py-4 text-xs font-extrabold uppercase tracking-[0.22em] text-[#0a0e27] shadow-lg shadow-primary/20 transition hover:scale-[1.02]">
                    Configurar exportação <Download size={18} />
                  </button>
                </div>
              </section>
            )}

            {step === 5 && (
              <section className="flex flex-col items-center justify-center rounded-[32px] border border-white/10 bg-[#0a0e27]/70 px-6 py-20 text-center shadow-2xl shadow-black/20">
                <div className="mb-8 flex h-24 w-24 items-center justify-center rounded-[40px] border border-primary/20 bg-primary/10 text-primary shadow-2xl shadow-primary/10">
                  <FileDown size={48} />
                </div>
                <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white">Relatório pronto</h2>
                <p className="mb-12 max-w-xl text-sm leading-6 text-muted-foreground">Selecione o formato de saída para processamento.</p>

                <div className="grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
                  <ExportButton label="Excel (XLSX)" icon={<FileDown className="text-emerald-400" />} onClick={() => handleExport('XLSX')} />
                  <ExportButton label="Dados (CSV)" icon={<Database className="text-sky-400" />} onClick={() => handleExport('CSV')} />
                  <ExportButton label="Documento (PDF)" icon={<FileDown className="text-red-400" />} onClick={() => handleExport('PDF')} />
                </div>

                <button onClick={() => setStep(1)} className="mt-16 border-b border-dashed border-primary pb-1 text-xs font-bold uppercase tracking-[0.2em] text-primary transition hover:brightness-110">
                  Criar novo relatório
                </button>
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function Field({ label, icon, control }: { label: string; icon: React.ReactNode; control: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.25em] text-muted-foreground">
        {icon} {label}
      </label>
      {control}
    </div>
  );
}

function PreviewCard({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-[#0a0e27]/70 p-5">
      <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-muted-foreground">{label}</span>
      <span className={cn('mt-2 block text-2xl font-extrabold tracking-tight', color)}>{value}</span>
    </div>
  );
}

function ExportButton({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-4 rounded-[28px] border border-white/10 bg-[#0a0e27] p-8 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10"
    >
      <div className="rounded-3xl bg-[#1a1f3a] p-4">{icon}</div>
      <span className="text-xs font-extrabold uppercase tracking-[0.2em] text-white">{label}</span>
    </button>
  );
}

export default withAuth(ReportsPage, { module: 'RELATORIOS' });
