import React from 'react';
import { ReportLayout, ReportKpiCard } from '@/components/reports/report-layout';
import { Truck, Gauge, Fuel, Clock } from 'lucide-react';

export default function RelatorioEquipamentosPage() {
  const tableData = [
    { id: '605112', model: 'John Deere S770', hours: '45.5h', fuel: '1.240L', efficiency: '94%', availability: '98%' },
    { id: '601076', model: 'Scania R540', hours: '32.0h', fuel: '850L', efficiency: '88%', availability: '95%' },
    { id: '613020', model: 'Volvo L120H', hours: '28.5h', fuel: '320L', efficiency: '91%', availability: '92%' },
  ];

  return (
    <ReportLayout
      title="Relatório de Equipamentos"
      description="Análise individualizada de consumo, horas trabalhadas e eficiência da frota"
      kpis={
        <>
          <ReportKpiCard label="Disponibilidade Média" value="96.2%" trend="+0.5%" icon={<Clock />} />
          <ReportKpiCard label="Consumo Total Diesel" value="8.450 L" trend="+12%" icon={<Fuel />} />
          <ReportKpiCard label="Custo por Hora" value="R$ 145,20" trend="-2.4%" trendDown icon={<Gauge />} />
          <ReportKpiCard label="Frota Operacional" value="23 / 35" trend="+2" icon={<Truck />} />
        </>
      }
    >
      <div className="p-6 border-b border-[#2d3647] flex items-center justify-between bg-[#1a1f3a]/20">
        <h3 className="text-sm font-black italic tracking-tighter uppercase text-white">Ranking de Performance - Frota</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[10px] uppercase text-muted-foreground font-black tracking-widest bg-[#050812]/50 border-b border-[#2d3647]">
            <tr>
              <th className="px-6 py-4">Frota / Modelo</th>
              <th className="px-6 py-4">Horas Operadas</th>
              <th className="px-6 py-4">Consumo Total</th>
              <th className="px-6 py-4">Eficiência de Trabalho</th>
              <th className="px-6 py-4">Disponibilidade Mecânica</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2d3647]/30 text-[11px]">
            {tableData.map((row) => (
              <tr key={row.id} className="hover:bg-primary/5 transition-colors group">
                <td className="px-6 py-4">
                  <p className="font-bold text-white uppercase italic tracking-tighter">{row.id}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">{row.model}</p>
                </td>
                <td className="px-6 py-4 font-black italic text-white tracking-tighter">{row.hours}</td>
                <td className="px-6 py-4 font-bold text-blue-400">{row.fuel}</td>
                <td className="px-6 py-4 text-emerald-500 font-bold">{row.efficiency}</td>
                <td className="px-6 py-4 text-white font-bold">{row.availability}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportLayout>
  );
}
