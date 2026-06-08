"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, Download, Gauge, Loader2, RefreshCw, Search } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { withAuth } from '@/components/shared/with-auth';
import { cn } from '@/lib/utils';

interface EfficiencyReport {
  period: { from: string; to: string };
  summary: {
    totalHours: number;
    productiveHours: number;
    unproductiveHours: number;
    maintenanceHours: number;
    productivePercent: number;
    unproductivePercent: number;
    maintenancePercent: number;
    totalJourneys: number;
    finalizedJourneys: number;
    pendingJourneys: number;
  };
  topStops: Array<{ code: string; description: string; hours: number; percent: number; occurrences: number }>;
  byFleet: Array<{
    fleetCode: string;
    operatorName: string;
    operationName: string;
    implementName: string;
    totalHours: number;
    productiveHours: number;
    unproductiveHours: number;
    stopsCount: number;
    finalizedJourneys: number;
  }>;
  byOperator: Array<{
    registration: string;
    name: string;
    totalHours: number;
    productiveHours: number;
    unproductiveHours: number;
    efficiencyPercent: number;
  }>;
  byOperation: Array<{ code: string; name: string; hours: number; percent: number }>;
  timeline: Array<{ hour: string; productiveHours: number; unproductiveHours: number; maintenanceHours: number }>;
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtHours(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' h';
}

function fmtPercent(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

function kpiTone(value: number): string {
  if (value >= 70) return 'text-emerald-300';
  if (value >= 40) return 'text-amber-300';
  return 'text-red-300';
}

function KpiCard({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#0a0e27]/70 p-5 shadow-lg shadow-black/10">
      <p className="text-[8px] font-black uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className={cn("mt-3 text-2xl font-black tracking-tight", tone)}>{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-[#2d3647] bg-[#0a0e27]/50 p-12 text-center">
      <Gauge className="mx-auto mb-4 text-primary/30" size={42} />
      <p className="text-sm font-black uppercase tracking-widest text-white/40">Sem dados no periodo</p>
      <p className="mt-2 text-xs text-muted-foreground">Nenhum mock foi usado. Ajuste os filtros ou sincronize jornadas reais.</p>
    </div>
  );
}

function EficienciaOperacionalPage() {
  const [from, setFrom] = useState(dateDaysAgo(7));
  const [to, setTo] = useState(today());
  const [fleetCode, setFleetCode] = useState('');
  const [operatorRegistration, setOperatorRegistration] = useState('');
  const [report, setReport] = useState<EfficiencyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/relatorios/eficiencia-operacional', window.location.origin);
      if (from) url.searchParams.set('from', new Date(from + 'T00:00:00').toISOString());
      if (to) url.searchParams.set('to', new Date(to + 'T23:59:59').toISOString());
      if (fleetCode.trim()) url.searchParams.set('fleetCode', fleetCode.trim());
      if (operatorRegistration.trim()) url.searchParams.set('operatorRegistration', operatorRegistration.trim());

      const response = await fetch(url.toString(), { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Falha ao carregar relatorio' }));
        throw new Error(String(body.error || 'Falha ao carregar relatorio'));
      }
      setReport(await response.json() as EfficiencyReport);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : 'Falha ao carregar relatorio');
    } finally {
      setLoading(false);
    }
  }, [fleetCode, from, operatorRegistration, to]);

  useEffect(() => {
    fetchReport();
    const id = window.setInterval(fetchReport, 60_000);
    return () => window.clearInterval(id);
  }, [fetchReport]);

  const exportCsv = useCallback(() => {
    const url = new URL('/api/relatorios/eficiencia-operacional/export', window.location.origin);
    url.searchParams.set('format', 'csv');
    if (from) url.searchParams.set('from', new Date(from + 'T00:00:00').toISOString());
    if (to) url.searchParams.set('to', new Date(to + 'T23:59:59').toISOString());
    if (fleetCode.trim()) url.searchParams.set('fleetCode', fleetCode.trim());
    if (operatorRegistration.trim()) url.searchParams.set('operatorRegistration', operatorRegistration.trim());
    window.open(url.toString(), '_blank');
  }, [fleetCode, from, operatorRegistration, to]);

  const maxFleetHours = Math.max(...(report?.byFleet.map(item => item.totalHours) || [0]), 1);
  const maxStopHours = Math.max(...(report?.topStops.slice(0, 5).map(item => item.hours) || [0]), 1);

  return (
    <div className="flex h-screen overflow-hidden bg-[#050812] text-white">
      <Sidebar className="hidden shrink-0 lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <div className="mb-6 flex flex-col gap-4 border-b border-[#2d3647] pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-primary">
                <BarChart3 size={13} /> Relatorios
              </p>
              <h1 className="text-2xl font-black uppercase italic tracking-tight">Eficiencia Operacional</h1>
              <p className="mt-1 text-xs text-muted-foreground">Horas produtivas, improdutivas e manutencao por frota, operador e operacao.</p>
            </div>
            <button
              onClick={exportCsv}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#050812] shadow-lg shadow-primary/10 transition hover:scale-[1.02]"
            >
              <Download size={14} /> Exportar CSV
            </button>
          </div>

          <section className="mb-6 grid gap-3 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-4 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]">
            <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
              Inicio
              <input value={from} onChange={event => setFrom(event.target.value)} type="date" className="mt-2 w-full rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-xs text-white [color-scheme:dark]" />
            </label>
            <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
              Fim
              <input value={to} onChange={event => setTo(event.target.value)} type="date" className="mt-2 w-full rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-xs text-white [color-scheme:dark]" />
            </label>
            <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
              Frota
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
                <input value={fleetCode} onChange={event => setFleetCode(event.target.value)} placeholder="Todas" className="w-full rounded-xl border border-[#2d3647] bg-[#050812] py-2 pl-9 pr-3 text-xs text-white" />
              </div>
            </label>
            <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
              Operador
              <input value={operatorRegistration} onChange={event => setOperatorRegistration(event.target.value)} placeholder="Matricula" className="mt-2 w-full rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-xs text-white" />
            </label>
            <button onClick={fetchReport} disabled={loading} className="rounded-xl bg-emerald-700 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50">
              {loading ? <Loader2 className="mx-auto animate-spin" size={15} /> : <span className="inline-flex items-center gap-2"><RefreshCw size={13} /> Atualizar</span>}
            </button>
          </section>

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <AlertTriangle size={18} /> {error}
            </div>
          )}

          {loading && !report ? (
            <div className="flex items-center justify-center py-20 text-primary"><Loader2 className="animate-spin" size={36} /></div>
          ) : report && report.summary.totalJourneys > 0 ? (
            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-5">
                <KpiCard label="Total Horas" value={fmtHours(report.summary.totalHours)} />
                <KpiCard label="Produtiva" value={fmtPercent(report.summary.productivePercent)} tone={kpiTone(report.summary.productivePercent)} />
                <KpiCard label="Improdutiva" value={fmtPercent(report.summary.unproductivePercent)} tone="text-amber-300" />
                <KpiCard label="Manutencao" value={fmtPercent(report.summary.maintenancePercent)} tone="text-red-300" />
                <KpiCard label="Jornadas Finalizadas" value={String(report.summary.finalizedJourneys)} tone="text-blue-300" />
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5">
                  <h2 className="mb-5 text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">Top 5 Paradas / Ofensores</h2>
                  <div className="space-y-4">
                    {report.topStops.slice(0, 5).map(stop => (
                      <div key={stop.code + stop.description}>
                        <div className="mb-1 flex justify-between gap-4 text-xs">
                          <span className="font-bold text-white">{stop.code || 'S/C'} - {stop.description}</span>
                          <span className="font-black text-amber-300">{fmtHours(stop.hours)} ({fmtPercent(stop.percent)})</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#1a1f3a]">
                          <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min(100, (stop.hours / maxStopHours) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5">
                  <h2 className="mb-5 text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">Barras por Frota</h2>
                  <div className="space-y-4">
                    {report.byFleet.map(item => (
                      <div key={item.fleetCode}>
                        <div className="mb-1 flex justify-between text-xs">
                          <span className="font-black text-white">{item.fleetCode}</span>
                          <span className="text-muted-foreground">{fmtHours(item.totalHours)}</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-[#1a1f3a]">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (item.totalHours / maxFleetHours) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <DataTable
                  title="Por Operador"
                  headers={['Matricula', 'Nome', 'Total', 'Produtiva', 'Improdutiva', 'Efic.']}
                  rows={report.byOperator.map(item => [item.registration, item.name, fmtHours(item.totalHours), fmtHours(item.productiveHours), fmtHours(item.unproductiveHours), fmtPercent(item.efficiencyPercent)])}
                />
                <DataTable
                  title="Por Operacao"
                  headers={['Codigo', 'Nome', 'Horas', 'Percentual']}
                  rows={report.byOperation.map(item => [item.code, item.name, fmtHours(item.hours), fmtPercent(item.percent)])}
                />
              </section>

              <DataTable
                title="Operacao / Parada"
                headers={['Grupo', 'Codigo', 'Descricao', 'Horas', 'Percentual', 'Ocorrencias']}
                rows={report.topStops.map(item => ['PARADA', item.code, item.description, fmtHours(item.hours), fmtPercent(item.percent), String(item.occurrences)])}
              />
            </div>
          ) : (
            <EmptyState />
          )}
        </main>
      </div>
    </div>
  );
}

function DataTable({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70">
      <div className="border-b border-[#2d3647] p-4">
        <h2 className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#050812]/70 text-[9px] uppercase tracking-widest text-muted-foreground">
            <tr>{headers.map(header => <th key={header} className="px-4 py-3 font-black">{header}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={headers.length}>Sem dados reais.</td></tr>
            ) : rows.map((row, index) => (
              <tr key={index} className="border-t border-[#1a1f3a]">
                {row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3 text-white/80">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default withAuth(EficienciaOperacionalPage, { module: 'RELATORIOS' });
