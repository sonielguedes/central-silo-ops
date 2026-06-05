import React from 'react';
import { ReportLayout, ReportKpiCard } from '@/components/reports/report-layout';
import { TrendingUp, Sprout, Target, BarChart2 } from 'lucide-react';

export default function RelatorioProdutividadePage() {
  const tableData = [
    { id: '1', farm: 'Faz. Santa Clara', field: 'Talhão 12', crop: 'Soja', area: '150 ha', yield: '72 sc/ha', total: '10.800 sc' },
    { id: '2', farm: 'Faz. Santa Clara', field: 'Talhão 14', area: '220 ha', crop: 'Soja', yield: '65 sc/ha', total: '14.300 sc' },
    { id: '3', farm: 'Faz. Rio Verde', field: 'Talhão 05', area: '180 ha', crop: 'Milho', yield: '110 sc/ha', total: '19.800 sc' },
  ];

  return (
    <ReportLayout
      title="Relatório de Produtividade"
      description="Consolidado de colheita e produtividade por área de plantio"
      kpis={
        <>
          <ReportKpiCard label="Total Produzido (Soja)" value="25.100 sc" trend="+8%" icon={<Sprout />} />
          <ReportKpiCard label="Produtividade Média" value="68.5 sc/ha" trend="+4.2%" icon={<TrendingUp />} />
          <ReportKpiCard label="Meta de Produção" value="92%" trend="-2%" trendDown icon={<Target />} />
          <ReportKpiCard label="Área Total Processada" value="550 ha" trend="+15%" icon={<BarChart2 />} />
        </>
      }
    >
      <div className="p-6 border-b border-[#2d3647] flex items-center justify-between bg-[#1a1f3a]/20">
        <h3 className="text-sm font-black italic tracking-tighter uppercase text-white">Produtividade por Talhão</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[10px] uppercase text-muted-foreground font-black tracking-widest bg-[#050812]/50 border-b border-[#2d3647]">
            <tr>
              <th className="px-6 py-4">Fazenda / Talhão</th>
              <th className="px-6 py-4">Cultura</th>
              <th className="px-6 py-4">Área Processada</th>
              <th className="px-6 py-4">Produtividade</th>
              <th className="px-6 py-4">Produção Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2d3647]/30 text-[11px]">
            {tableData.map((row) => (
              <tr key={row.id} className="hover:bg-primary/5 transition-colors group">
                <td className="px-6 py-4">
                  <p className="font-bold text-white uppercase">{row.field}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">{row.farm}</p>
                </td>
                <td className="px-6 py-4 font-bold text-white/80 uppercase">{row.crop}</td>
                <td className="px-6 py-4 text-white/60">{row.area}</td>
                <td className="px-6 py-4 text-primary font-black italic tracking-tighter">{row.yield}</td>
                <td className="px-6 py-4 font-bold text-white">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportLayout>
  );
}
