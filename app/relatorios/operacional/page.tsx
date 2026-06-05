import React from 'react';
import { ReportLayout, ReportKpiCard } from '@/components/reports/report-layout';
import { OPERATIONAL_REPORT_DATA } from '@/lib/mock/report-data';
import { Download } from 'lucide-react';

export default function RelatorioOperacionalPage() {
  return (
    <ReportLayout
      title="Relatório Operacional Geral"
      description="Consolidado de todas as atividades e desempenho de campo"
      kpis={
        <>
          <ReportKpiCard label="Área Total Colhida" value="1.240 ha" trend="+12%" />
          <ReportKpiCard label="Produtividade Média" value="68 sc/ha" trend="+2.4%" />
          <ReportKpiCard label="Eficiência Média" value="89.5%" trend="-1.2%" trendDown />
          <ReportKpiCard label="Tempo Total Operado" value="450 h" trend="+15%" />
        </>
      }
    >
      <div className="p-6 border-b border-[#2d3647] flex items-center justify-between bg-[#1a1f3a]/20">
        <h3 className="text-sm font-black italic tracking-tighter uppercase text-white">Detalhamento por Talhão</h3>
        <span className="text-[10px] text-muted-foreground font-bold uppercase">{OPERATIONAL_REPORT_DATA.length} Registros encontrados</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[10px] uppercase text-muted-foreground font-black tracking-widest bg-[#050812]/50 border-b border-[#2d3647]">
            <tr>
              <th className="px-6 py-4">Fazenda / Talhão</th>
              <th className="px-6 py-4">Operação</th>
              <th className="px-6 py-4">Período</th>
              <th className="px-6 py-4">Duração</th>
              <th className="px-6 py-4">Produção</th>
              <th className="px-6 py-4">Eficiência</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2d3647]/30 text-[11px]">
            {OPERATIONAL_REPORT_DATA.map((row) => (
              <tr key={row.id} className="hover:bg-primary/5 transition-colors group">
                <td className="px-6 py-4">
                  <p className="font-bold text-white uppercase">{row.field}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">{row.farm}</p>
                </td>
                <td className="px-6 py-4 font-bold text-white/80 uppercase">{row.operation}</td>
                <td className="px-6 py-4">
                  <p className="text-white/60">{row.start.split(' ')[1]} → {row.end.split(' ')[1]}</p>
                  <p className="text-[9px] text-muted-foreground">{row.start.split(' ')[0]}</p>
                </td>
                <td className="px-6 py-4 font-black italic text-white tracking-tighter">{row.duration}</td>
                <td className="px-6 py-4 font-bold text-primary">{row.production}</td>
                <td className="px-6 py-4">
                   <div className="flex items-center gap-2">
                      <div className="flex-1 w-12 h-1.5 bg-[#1a1f3a] rounded-full overflow-hidden border border-[#2d3647]">
                        <div className="h-full bg-primary" style={{ width: row.efficiency }}></div>
                      </div>
                      <span className="font-bold text-white">{row.efficiency}</span>
                   </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="p-2 text-muted-foreground hover:text-white transition-colors">
                    <Download size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-6 bg-[#050812]/20 border-t border-[#2d3647] flex justify-between items-center">
         <div className="flex gap-2">
            <button className="px-3 py-1 bg-[#1a1f3a] border border-[#2d3647] rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#252d4a]">Anterior</button>
            <button className="px-3 py-1 bg-[#1a1f3a] border border-[#2d3647] rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-[#252d4a]">Próximo</button>
         </div>
         <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Página 1 de 1</span>
      </div>
    </ReportLayout>
  );
}
