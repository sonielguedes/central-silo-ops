import React from 'react';
import { ReportLayout, ReportKpiCard } from '@/components/reports/report-layout';
import { Fuel, Droplets, CreditCard, Activity } from 'lucide-react';

export default function RelatorioAbastecimentosPage() {
  const tableData = [
    { id: '1', equipment: '605112', date: '04/06 10:30', volume: '450 L', price: 'R$ 5,85', total: 'R$ 2.632,50', type: 'Diesel S10' },
    { id: '2', equipment: '601076', date: '04/06 08:15', volume: '320 L', price: 'R$ 5,85', total: 'R$ 1.872,00', type: 'Diesel S10' },
    { id: '3', equipment: '613020', date: '03/06 16:45', volume: '45 L', price: 'R$ 8,20', total: 'R$ 369,00', type: 'Arla 32' },
  ];

  return (
    <ReportLayout
      title="Relatório de Abastecimentos"
      description="Controle detalhado de consumo de combustível e análise de custos operacionais"
      kpis={
        <>
          <ReportKpiCard label="Volume Total Diesel" value="8.450 L" trend="+12%" icon={<Fuel />} />
          <ReportKpiCard label="Custo Total Acumulado" value="R$ 49.432" trend="+8%" color="text-red-500" icon={<CreditCard />} />
          <ReportKpiCard label="Consumo Médio Global" value="28.5 L/h" trend="-1.5%" color="text-emerald-500" icon={<Activity />} />
          <ReportKpiCard label="Tanques Ativos" value="12" icon={<Droplets />} />
        </>
      }
    >
      <div className="p-6 border-b border-[#2d3647] flex items-center justify-between bg-[#1a1f3a]/20">
        <h3 className="text-sm font-black italic tracking-tighter uppercase text-white">Extrato de Abastecimentos</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[10px] uppercase text-muted-foreground font-black tracking-widest bg-[#050812]/50 border-b border-[#2d3647]">
            <tr>
              <th className="px-6 py-4">Equipamento</th>
              <th className="px-6 py-4">Data / Hora</th>
              <th className="px-6 py-4">Volume</th>
              <th className="px-6 py-4">Preço Unit.</th>
              <th className="px-6 py-4">Total</th>
              <th className="px-6 py-4">Insumo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2d3647]/30 text-[11px]">
            {tableData.map((row) => (
              <tr key={row.id} className="hover:bg-primary/5 transition-colors group">
                <td className="px-6 py-4 font-black italic text-white tracking-tighter uppercase">{row.equipment}</td>
                <td className="px-6 py-4 text-white/60 font-bold">{row.date}</td>
                <td className="px-6 py-4 font-black italic text-primary tracking-tighter">{row.volume}</td>
                <td className="px-6 py-4 text-muted-foreground">{row.price}</td>
                <td className="px-6 py-4 font-bold text-white">{row.total}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 rounded-full border border-blue-500/20 text-blue-500 text-[9px] font-black uppercase">
                    {row.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportLayout>
  );
}
