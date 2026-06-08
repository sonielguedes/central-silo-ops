"use client";

import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle, BarChart3, Clock, Download, Gauge,
  Loader2, RefreshCw, Search, Wrench, ZapOff,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { withAuth } from '@/components/shared/with-auth';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────────────────

interface TempoReport {
  period: { from: string; to: string };
  summary: {
    totalHours: number;
    productiveHours: number;
    unproductiveHours: number;
    maintenanceHours: number;
    averageJourneyHours: number;
    totalJourneys: number;
    finalizedJourneys: number;
    inconsistentJourneys: number;
  };
  byGroup: Array<{ group: string; hours: number; percent: number; occurrences: number }>;
  byFleet: Array<{
    fleetCode: string;
    operatorName: string;
    operationName: string;
    implementName: string;
    totalHours: number;
    productiveHours: number;
    unproductiveHours: number;
    maintenanceHours: number;
    journeyCount: number;
    avgHours: number;
    inconsistencies?: string[];
  }>;
  byOperator: Array<{ registration: string; name: string; totalHours: number; journeyCount: number; avgHours: number }>;
  byOperation: Array<{ code: string; name: string; group: string; hours: number; percent: number; occurrences: number }>;
  byStop: Array<{ code: string; description: string; group: string; hours: number; percent: number; occurrences: number }>;
  timeline: Array<{ dateHour: string; productiveHours: number; unproductiveHours: number; maintenanceHours: number }>;
  inconsistencies: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  return Math.min(100, value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

const GROUP_COLORS: Record<string, { text: string; bar: string; badge: string }> = {
  PRODUTIVA:   { text: 'text-emerald-300', bar: 'bg-emerald-500', badge: 'text-emerald-300 bg-emerald-500/10' },
  IMPRODUTIVA: { text: 'text-amber-300',   bar: 'bg-amber-500',   badge: 'text-amber-300 bg-amber-500/10' },
  MANUTENCAO:  { text: 'text-red-300',     bar: 'bg-red-500',     badge: 'text-red-300 bg-red-500/10' },
};

function groupColor(group: string) {
  return GROUP_COLORS[group] || { text: 'text-slate-300', bar: 'bg-slate-500', badge: 'text-slate-300 bg-slate-500/10' };
}

// ── Components ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, tone = 'text-white', icon }: { label: string; value: string; tone?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#0a0e27]/70 p-5 shadow-lg shadow-black/10">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-[8px] font-black uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      </div>
      <p className={cn("text-2xl font-black tracking-tight", tone)}>{value}</p>
    </div>
  );
}

function DataTable({ title, headers, rows, emptyMsg }: { title: string; headers: string[]; rows: string[][]; emptyMsg?: string }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70">
      <div className="border-b border-[#2d3647] p-4">
        <h2 className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">{title}</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#050812]/70 text-[9px] uppercase tracking-widest text-muted-foreground">
            <tr>{headers.map(h => <th key={h} className="whitespace-nowrap px-4 py-3 font-black">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td className="px-4 py-8 text-center text-muted-foreground" colSpan={headers.length}>{emptyMsg || 'Sem dados.'}</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i} className="border-t border-[#1a1f3a]">
                {row.map((cell, j) => <td key={j} className="whitespace-nowrap px-4 py-3 text-white/80">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

function TempoOperacionalPage() {
  const [from, setFrom] = useState(dateDaysAgo(7));
  const [to, setTo] = useState(today());
  const [fleetCode, setFleetCode] = useState('');
  const [operatorReg, setOperatorReg] = useState('');
  const [group, setGroup] = useState('');
  const [report, setReport] = useState<TempoReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL('/api/relatorios/tempo-operacional', window.location.origin);
      if (from) url.searchParams.set('from', new Date(from + 'T00:00:00').toISOString());
      if (to) url.searchParams.set('to', new Date(to + 'T23:59:59').toISOString());
      if (fleetCode.trim()) url.searchParams.set('fleetCode', fleetCode.trim());
      if (operatorReg.trim()) url.searchParams.set('operatorRegistration', operatorReg.trim());
      if (group) url.searchParams.set('group', group);

      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: 'Falha ao carregar' }));
        throw new Error(String(body.error || 'Falha ao carregar'));
      }
      setReport(await res.json() as TempoReport);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : 'Falha ao carregar');
    } finally {
      setLoading(false);
    }
  }, [from, to, fleetCode, operatorReg, group]);

  useEffect(() => {
    fetchReport();
    const id = window.setInterval(fetchReport, 60_000);
    return () => window.clearInterval(id);
  }, [fetchReport]);

  const exportCsv = useCallback(() => {
    const url = new URL('/api/relatorios/tempo-operacional/export', window.location.origin);
    url.searchParams.set('format', 'csv');
    if (from) url.searchParams.set('from', new Date(from + 'T00:00:00').toISOString());
    if (to) url.searchParams.set('to', new Date(to + 'T23:59:59').toISOString());
    if (fleetCode.trim()) url.searchParams.set('fleetCode', fleetCode.trim());
    if (operatorReg.trim()) url.searchParams.set('operatorRegistration', operatorReg.trim());
    if (group) url.searchParams.set('group', group);
    window.open(url.toString(), '_blank');
  }, [from, to, fleetCode, operatorReg, group]);

  const r = report;

  return (
    <div className="flex h-screen overflow-hidden bg-[#050812] text-white">
      <Sidebar className="hidden shrink-0 lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-4 border-b border-[#2d3647] pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.3em] text-primary">
                <Clock size={13} /> Relatórios · C4.5
              </p>
              <h1 className="text-2xl font-black uppercase italic tracking-tight">Tempo Operacional</h1>
              <p className="mt-1 text-xs text-muted-foreground">Tempo por operação, parada, frota, operador e grupo operacional.</p>
            </div>
            <button
              onClick={exportCsv}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-[10px] font-black uppercase tracking-widest text-[#050812] shadow-lg shadow-primary/10 transition hover:scale-[1.02]"
            >
              <Download size={14} /> Exportar CSV
            </button>
          </div>

          {/* Filters */}
          <section className="mb-6 grid gap-3 rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-4 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
            <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
              Início
              <input value={from} onChange={e => setFrom(e.target.value)} type="date" className="mt-2 w-full rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-xs text-white [color-scheme:dark]" />
            </label>
            <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
              Fim
              <input value={to} onChange={e => setTo(e.target.value)} type="date" className="mt-2 w-full rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-xs text-white [color-scheme:dark]" />
            </label>
            <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
              Frota
              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={13} />
                <input value={fleetCode} onChange={e => setFleetCode(e.target.value)} placeholder="Todas" className="w-full rounded-xl border border-[#2d3647] bg-[#050812] py-2 pl-9 pr-3 text-xs text-white" />
              </div>
            </label>
            <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
              Operador
              <input value={operatorReg} onChange={e => setOperatorReg(e.target.value)} placeholder="Matrícula" className="mt-2 w-full rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-xs text-white" />
            </label>
            <label className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">
              Grupo
              <select value={group} onChange={e => setGroup(e.target.value)} className="mt-2 w-full rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-xs text-white [color-scheme:dark]">
                <option value="">Todos</option>
                <option value="PRODUTIVA">Produtiva</option>
                <option value="IMPRODUTIVA">Improdutiva</option>
                <option value="MANUTENCAO">Manutenção</option>
              </select>
            </label>
            <button onClick={fetchReport} disabled={loading} className="rounded-xl bg-emerald-700 px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50 self-end">
              {loading ? <Loader2 className="mx-auto animate-spin" size={15} /> : <span className="inline-flex items-center gap-2"><RefreshCw size={13} /> Atualizar</span>}
            </button>
          </section>

          {/* Error */}
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <AlertTriangle size={18} /> {error}
            </div>
          )}

          {/* Loading */}
          {loading && !r ? (
            <div className="flex items-center justify-center py-20 text-primary"><Loader2 className="animate-spin" size={36} /></div>
          ) : r && r.summary.totalJourneys > 0 ? (
            <div className="space-y-6">
              {/* KPI Cards */}
              <section className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
                <KpiCard label="Total Horas" value={fmtHours(r.summary.totalHours)} icon={<Clock size={12} className="text-primary" />} />
                <KpiCard label="Produtiva" value={fmtHours(r.summary.productiveHours)} tone="text-emerald-300" icon={<BarChart3 size={12} className="text-emerald-400" />} />
                <KpiCard label="Improdutiva" value={fmtHours(r.summary.unproductiveHours)} tone="text-amber-300" icon={<ZapOff size={12} className="text-amber-400" />} />
                <KpiCard label="Manutenção" value={fmtHours(r.summary.maintenanceHours)} tone="text-red-300" icon={<Wrench size={12} className="text-red-400" />} />
                <KpiCard label="Média Jornada" value={fmtHours(r.summary.averageJourneyHours)} />
                <KpiCard label="Jornadas" value={String(r.summary.totalJourneys)} tone="text-blue-300" />
                <KpiCard label="Finalizadas" value={String(r.summary.finalizedJourneys)} tone="text-blue-300" />
                <KpiCard label="Inconsistentes" value={String(r.summary.inconsistentJourneys)} tone={r.summary.inconsistentJourneys > 0 ? 'text-amber-300' : 'text-emerald-300'} icon={r.summary.inconsistentJourneys > 0 ? <AlertTriangle size={12} className="text-amber-400" /> : undefined} />
              </section>

              {/* By Group */}
              {r.byGroup.length > 0 && (
                <div className="overflow-hidden rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70">
                  <div className="border-b border-[#2d3647] p-4">
                    <h2 className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">Distribuição por Grupo</h2>
                  </div>
                  <div className="p-4 space-y-3">
                    {r.byGroup.map(g => {
                      const gc = groupColor(g.group);
                      return (
                        <div key={g.group}>
                          <div className="mb-1 flex justify-between text-xs">
                            <span className={cn("font-black", gc.text)}>{g.group}</span>
                            <span className="text-muted-foreground">{fmtHours(g.hours)} · {fmtPercent(g.percent)} · {g.occurrences} ocorr.</span>
                          </div>
                          <div className="h-3 overflow-hidden rounded-full bg-[#1a1f3a]">
                            <div className={cn("h-full rounded-full", gc.bar)} style={{ width: `${Math.min(100, g.percent)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* By Fleet Table */}
              <div className="overflow-hidden rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70">
                <div className="border-b border-[#2d3647] p-4">
                  <h2 className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">Por Frota</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#050812]/70 text-[9px] uppercase tracking-widest text-muted-foreground">
                      <tr>
                        {['Frota','Operador','Operação','Implemento','Total','Produtiva','Improd.','Manut.','Jornadas','Média','Status'].map(h =>
                          <th key={h} className="whitespace-nowrap px-3 py-3 font-black">{h}</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {r.byFleet.map(f => {
                        const hasInc = (f.inconsistencies?.length || 0) > 0;
                        return (
                          <tr key={f.fleetCode} className={cn("border-t border-[#1a1f3a]", hasInc && "bg-amber-500/5")}>
                            <td className="whitespace-nowrap px-3 py-3 font-bold text-white">{f.fleetCode}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-white/80">{f.operatorName}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-white/80">{f.operationName}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-white/80">{f.implementName || '—'}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-white/80">{fmtHours(f.totalHours)}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-emerald-300">{fmtHours(f.productiveHours)}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-amber-300">{fmtHours(f.unproductiveHours)}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-red-300">{fmtHours(f.maintenanceHours)}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-white/80">{f.journeyCount}</td>
                            <td className="whitespace-nowrap px-3 py-3 text-white/80">{fmtHours(f.avgHours)}</td>
                            <td className="whitespace-nowrap px-3 py-3">
                              {hasInc ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[9px] font-bold text-amber-300" title={(f.inconsistencies || []).join('\n')}>
                                  <AlertTriangle size={10} /> Inconsistência
                                </span>
                              ) : (
                                <span className="text-emerald-400 text-[9px] font-bold">OK</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* By Operator + By Operation */}
              <section className="grid gap-6 xl:grid-cols-2">
                <DataTable
                  title="Por Operador"
                  headers={['Matrícula', 'Nome', 'Total', 'Jornadas', 'Média']}
                  rows={r.byOperator.map(o => [o.registration, o.name, fmtHours(o.totalHours), String(o.journeyCount), fmtHours(o.avgHours)])}
                />
                <DataTable
                  title="Por Operação"
                  headers={['Código', 'Nome', 'Grupo', 'Horas', '%', 'Ocorrências']}
                  rows={r.byOperation.map(o => [o.code, o.name, o.group, fmtHours(o.hours), fmtPercent(o.percent), String(o.occurrences)])}
                />
              </section>

              {/* By Stop */}
              <DataTable
                title="Por Parada"
                headers={['Código', 'Descrição', 'Grupo', 'Horas', '%', 'Ocorrências']}
                rows={r.byStop.map(s => [s.code, s.description, s.group, fmtHours(s.hours), fmtPercent(s.percent), String(s.occurrences)])}
              />

              {/* Timeline */}
              {r.timeline.length > 0 && (
                <div className="rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5">
                  <h2 className="mb-5 text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">Timeline</h2>
                  <div className="overflow-x-auto">
                    <div className="flex items-end gap-1" style={{ minWidth: Math.max(r.timeline.length * 38, 300) }}>
                      {r.timeline.map(slot => {
                        const slotTotal = slot.productiveHours + slot.unproductiveHours + slot.maintenanceHours;
                        const maxBar = 80;
                        const scale = slotTotal > 0 ? maxBar / slotTotal : 0;
                        const d = new Date(slot.dateHour);
                        const label = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}h`;
                        return (
                          <div key={slot.dateHour} className="flex flex-col items-center" style={{ minWidth: 34 }}>
                            <div className="flex flex-col-reverse">
                              {slot.productiveHours > 0 && <div className="w-5 rounded-sm bg-emerald-500" style={{ height: slot.productiveHours * scale }} title={`Produtiva: ${fmtHours(slot.productiveHours)}`} />}
                              {slot.unproductiveHours > 0 && <div className="w-5 rounded-sm bg-amber-500" style={{ height: slot.unproductiveHours * scale }} title={`Improdutiva: ${fmtHours(slot.unproductiveHours)}`} />}
                              {slot.maintenanceHours > 0 && <div className="w-5 rounded-sm bg-red-500" style={{ height: slot.maintenanceHours * scale }} title={`Manutenção: ${fmtHours(slot.maintenanceHours)}`} />}
                            </div>
                            <span className="mt-1 text-[7px] text-muted-foreground leading-none">{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-3 flex gap-4 text-[9px] text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Produtiva</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-amber-500" /> Improdutiva</span>
                    <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-sm bg-red-500" /> Manutenção</span>
                  </div>
                </div>
              )}

              {/* Inconsistencies */}
              {r.inconsistencies.length > 0 && (
                <div className="rounded-3xl border border-amber-500/30 bg-amber-500/5 p-5">
                  <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-[0.25em] text-amber-300">
                    <AlertTriangle size={14} /> Inconsistências ({r.inconsistencies.length})
                  </h2>
                  <ul className="space-y-1 max-h-48 overflow-y-auto text-[10px] text-amber-200/80">
                    {r.inconsistencies.map((msg, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-400 shrink-0">•</span>
                        <span>{msg}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-3xl border border-[#2d3647] bg-[#0a0e27]/50 p-12 text-center">
              <Gauge className="mx-auto mb-4 text-primary/30" size={42} />
              <p className="text-sm font-black uppercase tracking-widest text-white/40">Sem dados no período</p>
              <p className="mt-2 text-xs text-muted-foreground">Ajuste os filtros ou sincronize jornadas reais.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default withAuth(TempoOperacionalPage, { module: 'RELATORIOS' });
