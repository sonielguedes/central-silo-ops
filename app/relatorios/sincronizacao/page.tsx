import React from 'react';
import { ReportLayout, ReportKpiCard } from '@/components/reports/report-layout';
import { cn } from '@/lib/utils';
import { RefreshCw, Server, Database, CheckCircle } from 'lucide-react';

export default function RelatorioSincronizacaoPage() {
  const tableData = [
    { id: '1', terminal: 'Terminal Móvel #01', events: '1.240', pending: '0', last: 'Há 2 min', status: 'Online' },
    { id: '2', terminal: 'Coletor Frente 03', events: '850', pending: '12', last: 'Há 15 min', status: 'Atrasado' },
    { id: '3', terminal: 'Gateway Balança', events: '240', pending: '0', last: 'Agora', status: 'Online' },
    { id: '4', terminal: 'Terminal Oficina', events: '0', pending: '0', last: 'Há 5h', status: 'Offline' },
  ];

  return (
    <ReportLayout
      title="Relatório de Sincronização"
      description="Monitoramento de tráfego de dados e integridade de terminais remotos"
      kpis={
        <>
          <ReportKpiCard label="Eventos Sincronizados" value="45.890" trend="+18%" icon={<RefreshCw />} />
          <ReportKpiCard label="Taxa de Entrega" value="99.98%" trend="+0.01%" color="text-emerald-500" icon={<CheckCircle />} />
          <ReportKpiCard label="Terminais Online" value="32 / 35" trend="-2" trendDown color="text-amber-500" icon={<Server />} />
          <ReportKpiCard label="Volume de Dados" value="1.2 GB" icon={<Database />} />
        </>
      }
    >
      <div className="p-6 border-b border-[#2d3647] flex items-center justify-between bg-[#1a1f3a]/20">
        <h3 className="text-sm font-black italic tracking-tighter uppercase text-white">Status de Terminais de Campo</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[10px] uppercase text-muted-foreground font-black tracking-widest bg-[#050812]/50 border-b border-[#2d3647]">
            <tr>
              <th className="px-6 py-4">Terminal / Ponto de Coleta</th>
              <th className="px-6 py-4">Eventos Enviados</th>
              <th className="px-6 py-4">Pendentes</th>
              <th className="px-6 py-4">Última Comunicação</th>
              <th className="px-6 py-4">Status Atual</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2d3647]/30 text-[11px]">
            {tableData.map((row) => (
              <tr key={row.id} className="hover:bg-primary/5 transition-colors group">
                <td className="px-6 py-4 font-bold text-white uppercase">{row.terminal}</td>
                <td className="px-6 py-4 font-black italic text-white tracking-tighter">{row.events}</td>
                <td className="px-6 py-4 font-bold text-amber-500">{row.pending}</td>
                <td className="px-6 py-4 text-white/60">{row.last}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full animate-pulse",
                      row.status === 'Online' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" :
                      row.status === 'Atrasado' ? "bg-amber-500" : "bg-red-500"
                    )}></div>
                    <span className={cn(
                      "text-[9px] font-black uppercase tracking-tighter",
                      row.status === 'Online' ? "text-emerald-500" :
                      row.status === 'Atrasado' ? "text-amber-500" : "text-red-500"
                    )}>{row.status}</span>
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
