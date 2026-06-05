import React from 'react';
import { ReportLayout, ReportKpiCard } from '@/components/reports/report-layout';
import { Shield, Eye, Lock, UserCheck } from 'lucide-react';

export default function RelatorioAuditoriaPage() {
  const tableData = [
    { id: '1', user: 'João Oliveira', action: 'Alteração de Status', target: 'Equipamento 605112', date: '04/06 14:20', ip: '192.168.1.45' },
    { id: '2', user: 'Sistema (Job)', action: 'Backup Automático', target: 'Database Central', date: '04/06 03:00', ip: '127.0.0.1' },
    { id: '3', user: 'Marcos Souza', action: 'Login Efetuado', target: 'Terminal Móvel #02', date: '04/06 07:15', ip: '10.0.0.12' },
    { id: '4', user: 'Admin', action: 'Exclusão de Registro', target: 'Operador ID #154', date: '03/06 18:45', ip: '192.168.1.10' },
  ];

  return (
    <ReportLayout
      title="Relatório de Auditoria"
      description="Rastreabilidade completa de ações, acessos e alterações críticas no sistema"
      kpis={
        <>
          <ReportKpiCard label="Total de Logs (Dia)" value="1.248" trend="+15%" icon={<Shield />} />
          <ReportKpiCard label="Ações Sensíveis" value="24" trend="-5%" color="text-amber-500" icon={<Lock />} />
          <ReportKpiCard label="Acessos Simultâneos" value="18" icon={<UserCheck />} />
          <ReportKpiCard label="Nível de Segurança" value="98%" trend="+0.2%" color="text-emerald-500" icon={<Eye />} />
        </>
      }
    >
      <div className="p-6 border-b border-[#2d3647] flex items-center justify-between bg-[#1a1f3a]/20">
        <h3 className="text-sm font-black italic tracking-tighter uppercase text-white">Log de Atividades do Sistema</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[10px] uppercase text-muted-foreground font-black tracking-widest bg-[#050812]/50 border-b border-[#2d3647]">
            <tr>
              <th className="px-6 py-4">Usuário</th>
              <th className="px-6 py-4">Ação Realizada</th>
              <th className="px-6 py-4">Alvo / Entidade</th>
              <th className="px-6 py-4">Data / Hora</th>
              <th className="px-6 py-4">Origem (IP)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2d3647]/30 text-[11px]">
            {tableData.map((row) => (
              <tr key={row.id} className="hover:bg-primary/5 transition-colors group">
                <td className="px-6 py-4 font-bold text-white uppercase">{row.user}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-0.5 rounded-lg bg-[#1a1f3a] border border-[#2d3647] text-white/80 font-bold uppercase text-[9px]">
                    {row.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground font-medium">{row.target}</td>
                <td className="px-6 py-4 font-bold text-white/60">{row.date}</td>
                <td className="px-6 py-4 font-mono text-muted-foreground">{row.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportLayout>
  );
}
