"use client";

import React from 'react';
import { BarChart2, Calendar, Truck, Users, Package, Clock, AlertTriangle, Download } from 'lucide-react';
import { withAuth } from '@/components/shared/with-auth';

interface ReportCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  disabled?: boolean;
}

function ReportCard({ icon, title, description, badge, disabled }: ReportCardProps) {
  return (
    <div className={`bg-[#0d1426] border rounded-xl p-5 transition-all group ${
      disabled
        ? 'border-[#2d3647] opacity-50 cursor-not-allowed'
        : 'border-[#2d3647] hover:border-orange-500/30 cursor-pointer hover:shadow-orange-500/5 hover:shadow-lg'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <span className={`${disabled ? 'text-slate-500' : 'text-orange-400 group-hover:text-orange-300'} transition-colors`}>
          {icon}
        </span>
        {badge && (
          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
            badge === 'Em breve'
              ? 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
              : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
          }`}>
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-sm font-black text-white mb-1">{title}</h3>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
      {!disabled && (
        <div className="flex items-center gap-1.5 mt-3 text-[10px] font-bold text-muted-foreground group-hover:text-orange-400 transition-colors">
          <Download size={11} />
          Gerar Relatório
        </div>
      )}
    </div>
  );
}

function CombustivelRelatoriosPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[#060c1a] text-white">
      <div className="px-8 pt-8 pb-4 border-b border-[#2d3647]">
        <div className="flex items-center gap-3">
          <BarChart2 size={24} className="text-orange-400" />
          <div>
            <h1 className="text-xl font-black tracking-tight">Relatórios de Combustível</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Análises de consumo, abastecimentos e divergências por período</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-8">
        {/* Período */}
        <div className="flex items-center gap-3">
          <Calendar size={14} className="text-muted-foreground" />
          <span className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Período:</span>
          {(['Hoje', 'Esta Semana', 'Este Mês', 'Personalizado'] as const).map(p => (
            <button
              key={p}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                p === 'Este Mês'
                  ? 'bg-orange-500/15 border border-orange-500/30 text-orange-300'
                  : 'bg-[#0d1426] border border-[#2d3647] text-muted-foreground hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Relatórios disponíveis */}
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-4">Relatórios Disponíveis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ReportCard
              icon={<Calendar size={20} />}
              title="Abastecimentos por Período"
              description="Lista completa de abastecimentos com filtro de data, hora, frota e operador."
              badge="Em breve"
              disabled
            />
            <ReportCard
              icon={<Truck size={20} />}
              title="Consumo por Frota"
              description="Total de litros consumidos por equipamento no período selecionado."
              badge="Em breve"
              disabled
            />
            <ReportCard
              icon={<Users size={20} />}
              title="Consumo por Operador"
              description="Consumo médio e total agrupado por operador responsável pelo abastecimento."
              badge="Em breve"
              disabled
            />
            <ReportCard
              icon={<Package size={20} />}
              title="Consumo por Produto"
              description="Distribuição de consumo entre Diesel S10, S500, Arla 32, lubrificantes e demais."
              badge="Em breve"
              disabled
            />
            <ReportCard
              icon={<Clock size={20} />}
              title="Consumo por Comboio"
              description="Volume dispensado por unidade abastecedora, com detalhamento por compartimento."
              badge="Em breve"
              disabled
            />
            <ReportCard
              icon={<AlertTriangle size={20} />}
              title="Divergências"
              description="Apontamentos com volume discrepante, horímetro fora de sequência ou sincronismo pendente."
              badge="Em breve"
              disabled
            />
          </div>
        </div>

        {/* Exportação futura */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <Download size={18} className="text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-black text-blue-300 mb-1">Exportação — Em desenvolvimento</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Futuramente os relatórios poderão ser exportados em <strong className="text-white">CSV</strong> e <strong className="text-white">Excel (.xlsx)</strong>.
                Os dados incluirão todos os campos de cada abastecimento com rastreabilidade completa de origem
                (Web / App Robson / Offline).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(CombustivelRelatoriosPage, { module: 'COMBUSTIVEL_REL' });
