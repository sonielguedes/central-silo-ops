import React from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { cn } from '@/lib/utils';
import { ArrowLeft, Download, Printer, FileDown, Filter, Calendar, MapPin, Truck, User } from 'lucide-react';
import Link from 'next/link';

interface ReportLayoutProps {
  title: string;
  description: string;
  children: React.ReactNode;
  kpis?: React.ReactNode;
}

export function ReportLayout({ title, description, children, kpis }: ReportLayoutProps) {
  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <Link href="/relatorios" className="p-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-muted-foreground hover:text-white transition-all">
                <ArrowLeft size={20} />
              </Link>
              <div>
                <h1 className="text-2xl font-black italic tracking-tighter uppercase text-white leading-none">{title}</h1>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">{description}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ExportButton icon={<FileDown size={14} />} label="CSV" />
              <ExportButton icon={<Download size={14} />} label="PDF" />
              <ExportButton icon={<Printer size={14} />} label="Imprimir" />
            </div>
          </div>

          {/* Filtros Globais de Relatório */}
          <div className="bg-[#0a0e27]/40 border border-[#2d3647] p-4 rounded-2xl mb-8 flex flex-wrap gap-4 items-end">
            <FilterField icon={<Calendar size={14} />} label="Período" value="Hoje, 04 Jun 2024" />
            <FilterField icon={<MapPin size={14} />} label="Fazenda / Frente" value="Todas as Unidades" />
            <FilterField icon={<Truck size={14} />} label="Equipamento" value="Todos" />
            <FilterField icon={<User size={14} />} label="Operador" value="Todos" />
            <button className="px-6 py-2.5 bg-primary text-[#0a0e27] rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform ml-auto">
              Atualizar Relatório
            </button>
          </div>

          {kpis && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {kpis}
            </div>
          )}

          <div className="bg-[#0a0e27]/40 border border-[#2d3647] rounded-3xl overflow-hidden shadow-2xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function ExportButton({ icon, label }: { icon: React.ReactNode, label: string }) {
  return (
    <button className="flex items-center gap-2 px-3 py-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white hover:bg-[#252d4a] transition-all">
      {icon} <span>{label}</span>
    </button>
  );
}

function FilterField({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-[180px]">
      <label className="text-[9px] text-muted-foreground font-black uppercase tracking-widest flex items-center gap-1.5">
        {icon} {label}
      </label>
      <div className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-3 py-2 text-[11px] font-bold text-white flex items-center justify-between cursor-pointer hover:border-primary/30 transition-all">
        {value}
        <Filter size={10} className="text-muted-foreground opacity-50" />
      </div>
    </div>
  );
}

export function ReportKpiCard({ label, value, trend, trendDown = false, color = "text-white" }: any) {
  return (
    <div className="bg-[#0a0e27]/40 border border-[#2d3647] p-5 rounded-2xl">
      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-2">{label}</p>
      <div className="flex items-baseline gap-3">
        <p className={cn("text-2xl font-black italic tracking-tighter", color)}>{value}</p>
        {trend && (
          <span className={cn("text-[10px] font-bold", trendDown ? "text-red-500" : "text-emerald-500")}>
            {trend}
          </span>
        )}
      </div>
    </div>
  );
}
