import React from 'react';
import { ReportLayout, ReportKpiCard } from '@/components/reports/report-layout';
import { Users, UserCheck, Star, Clock } from 'lucide-react';

export default function RelatorioOperadoresPage() {
  const tableData = [
    { id: '1', name: 'Ricardo Silva', role: 'Operador Colhedora', hours: '176h', efficiency: '95%', production: '15.400 sc', grade: '4.8' },
    { id: '2', name: 'Marcos Souza', role: 'Operador Carregadeira', hours: '168h', efficiency: '88%', production: '-', grade: '4.2' },
    { id: '3', name: 'Antônio Mendes', role: 'Motorista Caminhão', hours: '192h', efficiency: '92%', production: '12.800 sc', grade: '4.5' },
  ];

  return (
    <ReportLayout
      title="Relatório de Operadores"
      description="Desempenho individual, horas de jornada e ranking de eficiência operativa"
      kpis={
        <>
          <ReportKpiCard label="Total Colaboradores" value="72" icon={<Users />} />
          <ReportKpiCard label="Jornada Média Mensal" value="172 h" trend="+2%" icon={<Clock />} />
          <ReportKpiCard label="Score de Eficiência" value="92 / 100" trend="+4.5%" color="text-emerald-500" icon={<UserCheck />} />
          <ReportKpiCard label="Operador Destaque" value="R. Silva" icon={<Star className="text-amber-500" />} />
        </>
      }
    >
      <div className="p-6 border-b border-[#2d3647] flex items-center justify-between bg-[#1a1f3a]/20">
        <h3 className="text-sm font-black italic tracking-tighter uppercase text-white">Performance Individual por Período</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[10px] uppercase text-muted-foreground font-black tracking-widest bg-[#050812]/50 border-b border-[#2d3647]">
            <tr>
              <th className="px-6 py-4">Operador / Função</th>
              <th className="px-6 py-4">Horas Totais</th>
              <th className="px-6 py-4">Eficiência</th>
              <th className="px-6 py-4">Produção Entregue</th>
              <th className="px-6 py-4">Nota (Avaliação)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2d3647]/30 text-[11px]">
            {tableData.map((row) => (
              <tr key={row.id} className="hover:bg-primary/5 transition-colors group">
                <td className="px-6 py-4">
                  <p className="font-bold text-white uppercase">{row.name}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">{row.role}</p>
                </td>
                <td className="px-6 py-4 font-black italic text-white tracking-tighter">{row.hours}</td>
                <td className="px-6 py-4 text-emerald-500 font-bold">{row.efficiency}</td>
                <td className="px-6 py-4 text-white/60 font-bold">{row.production}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5">
                    <Star size={10} className="text-amber-500 fill-amber-500" />
                    <span className="font-bold text-white">{row.grade}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportLayout>
  );
}
