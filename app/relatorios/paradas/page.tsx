import React from 'react';
import { ReportLayout, ReportKpiCard } from '@/components/reports/report-layout';

export default function RelatorioParadasPage() {
  const tableData = [
    { id: '1', equipment: '605112', reason: 'Abastecimento', duration: '25 min', type: 'Operacional', category: 'Logística' },
    { id: '2', equipment: '601076', reason: 'Manutenção Preventiva', duration: '2h 15m', type: 'Técnica', category: 'Mecânica' },
    { id: '3', equipment: '613020', reason: 'Aguardando Caminhão', duration: '45 min', type: 'Operacional', category: 'Inoperância' },
  ];

  return (
    <ReportLayout
      title="Relatório de Paradas"
      description="Análise detalhada de tempos improdutivos e motivos de interrupção"
      kpis={
        <>
          <ReportKpiCard label="Tempo Total Parado" value="12h 45m" trend="+5%" trendDown color="text-orange-500" />
          <ReportKpiCard label="Paradas Operacionais" value="45" trend="-10%" color="text-blue-500" />
          <ReportKpiCard label="Paradas Técnicas" value="12" trend="+2" trendDown color="text-purple-500" />
          <ReportKpiCard label="MTTR (Tempo Médio Reparo)" value="1h 12m" trend="-15%" color="text-emerald-500" />
        </>
      }
    >
      <div className="p-6 border-b border-[#2d3647] flex items-center justify-between bg-[#1a1f3a]/20">
        <h3 className="text-sm font-black italic tracking-tighter uppercase text-white">Log de Interrupções Detalhado</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[10px] uppercase text-muted-foreground font-black tracking-widest bg-[#050812]/50 border-b border-[#2d3647]">
            <tr>
              <th className="px-6 py-4">Equipamento</th>
              <th className="px-6 py-4">Motivo / Descrição</th>
              <th className="px-6 py-4">Duração</th>
              <th className="px-6 py-4">Tipo</th>
              <th className="px-6 py-4">Categoria</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2d3647]/30 text-[11px]">
            {tableData.map((row) => (
              <tr key={row.id} className="hover:bg-primary/5 transition-colors group">
                <td className="px-6 py-4 font-black italic text-white tracking-tighter uppercase">{row.equipment}</td>
                <td className="px-6 py-4 font-bold text-white/80 uppercase">{row.reason}</td>
                <td className="px-6 py-4 text-orange-500 font-black italic tracking-tighter">{row.duration}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 rounded-full border border-blue-500/20 text-blue-500 text-[9px] font-black uppercase">
                    {row.type}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground font-bold uppercase">{row.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportLayout>
  );
}
