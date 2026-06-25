"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context/auth-context';
import { withAuth } from '@/components/shared/with-auth';
import { CombustivelPageHeader } from '@/components/combustivel/combustivel-page-header';
import { resolveComboioBomba } from '@/lib/fueling-display';
import { CalendarDays, RefreshCw, Fuel, ArrowUpRight, Clock3, Activity, AlertTriangle, TrendingUp, BadgeInfo, Search } from 'lucide-react';

type JourneySummary = {
  journeyId: string;
  companyCode?: string;
  comboioFleetCode?: string;
  comboioDescription?: string;
  driverName?: string;
  driverRegistration?: string;
  shift?: string;
  startedAt?: string;
  startedAtLabel: string;
  finishedAt?: string;
  finishedAtLabel: string;
  kmInicial?: number;
  kmFinal?: number;
  distanciaPercorrida?: number;
  tanqueInicial?: number;
  totalCarregadoPosto?: number;
  totalAbastecidoMaquinas?: number;
  tankInitialLiters?: number;
  totalLoadedLiters?: number;
  totalSuppliedLiters?: number;
  theoreticalFinalBalanceLiters?: number;
  realFinalBalanceLiters?: number;
  divergenceLiters?: number;
  diferenca?: number;
  saldoFinalAutomatico?: number;
  source?: string;
  status: 'FINALIZADA' | 'ATIVA' | 'INCONSISTENTE';
  syncStatus: 'SYNCED' | 'PENDENTE_SYNC' | 'ERRO_SYNC';
  calculationModeLabel?: string;
  inconsistencyReasons?: string[];
};

type JourneyKpis = {
  journeysToday: number;
  finalized: number;
  active: number;
  dieselLiters: number;
  saldoFinalTotal: number;
  divergences: number;
  inconsistent: number;
  pendingSync: number;
};

type ApiResponse = { success?: boolean; items?: JourneySummary[]; summary?: JourneyKpis };
type Period = 'today' | 'week' | 'month' | 'custom';

function money(value?: number): string {
  if (!Number.isFinite(value ?? NaN)) return '0,0 L';
  return `${(value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`;
}

function kilometers(value?: number): string {
  if (!Number.isFinite(value ?? NaN)) return '—';
  return `${(value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function isoDayStart(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0).toISOString();
}

function isoDayEnd(date: Date): string {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999).toISOString();
}

function rangeFor(period: Period, from?: string, to?: string) {
  const now = new Date();
  if (period === 'today') return { from: isoDayStart(now), to: isoDayEnd(now) };
  if (period === 'week') {
    const day = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
    return { from: isoDayStart(start), to: isoDayEnd(now) };
  }
  if (period === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: isoDayStart(start), to: isoDayEnd(now) };
  }
  return { from, to };
}

function badge(status: JourneySummary['status']) {
  switch (status) {
    case 'FINALIZADA':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'ATIVA':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    case 'INCONSISTENTE':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    default:
      return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  }
}

function syncBadge(status: JourneySummary['syncStatus']) {
  switch (status) {
    case 'SYNCED':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'PENDENTE_SYNC':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    case 'ERRO_SYNC':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    default:
      return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  }
}

function KpiCard({ label, value, sub, icon }: { label: string; value: string | number; sub: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-5 shadow-lg shadow-black/10">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 text-orange-400">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-black text-white leading-none">{value}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function JornadasPage() {
  const { userRole } = useAuth();
  const [period, setPeriod] = useState<Period>('today');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [comboio, setComboio] = useState('');
  const [driver, setDriver] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [companyCode, setCompanyCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse>({ items: [] });

  const isMultiCompany = userRole === 'SUPER_ADMIN' || userRole === 'SUPER_ADMIN_SILO';
  const range = useMemo(() => rangeFor(period, from, to), [period, from, to]);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (range.from) params.set('from', range.from);
      if (range.to) params.set('to', range.to);
      if (comboio.trim()) params.set('comboio', comboio.trim());
      if (driver.trim()) params.set('driver', driver.trim());
      if (status.trim()) params.set('status', status.trim());
      if (source.trim()) params.set('source', source.trim());
      if (isMultiCompany && companyCode.trim()) params.set('companyCode', companyCode.trim());
      const res = await fetch(`/api/combustivel/jornadas?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar jornadas');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar jornadas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range.from, range.to, comboio, driver, status, source, companyCode, isMultiCompany]);

  useEffect(() => {
    void load();
  }, [load]);

  const items = data.items ?? [];
  const summary = data.summary ?? { journeysToday: 0, finalized: 0, active: 0, dieselLiters: 0, saldoFinalTotal: 0, divergences: 0, inconsistent: 0, pendingSync: 0 };
  const hasData = items.length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[#060c1a] text-white">
      <CombustivelPageHeader
        title="Jornadas do Comboio"
        subtitle="Ciclo completo das operações de abastecimento por comboio"
        currentPage="Jornadas"
        actions={
          <button onClick={load} className="flex items-center gap-2 rounded-xl border border-[#2d3647] bg-[#0d1426] px-4 py-2 text-xs font-bold text-muted-foreground transition-all hover:text-white">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Atualizar
          </button>
        }
      />

      <div className="px-8 py-6 space-y-6">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
          <KpiCard icon={<CalendarDays size={20} />} label="Jornadas Hoje" value={summary.journeysToday} sub="Iniciadas no período" />
          <KpiCard icon={<Clock3 size={20} />} label="Jornadas Finalizadas" value={summary.finalized} sub="Com JOURNEY_END" />
          <KpiCard icon={<Activity size={20} />} label="Jornadas Ativas" value={summary.active} sub="Ainda em andamento" />
          <KpiCard icon={<Fuel size={20} />} label="Diesel Abastecido" value={money(summary.dieselLiters)} sub="Soma de FUEL_SUPPLY" />
          <KpiCard icon={<TrendingUp size={20} />} label="Saldo Final Total" value={money(summary.saldoFinalTotal)} sub="Jornadas finalizadas" />
          <KpiCard icon={<AlertTriangle size={20} />} label="Divergências" value={summary.divergences} sub="Saldo negativo ou inconsistência" />
        </div>

        <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-5">
          <div className="flex flex-wrap items-center gap-3">
            {(['today', 'week', 'month', 'custom'] as Period[]).map((item) => (
              <button
                key={item}
                onClick={() => setPeriod(item)}
                className={`rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] transition-all ${
                  period === item ? 'border-orange-500/40 bg-orange-500/15 text-orange-300' : 'border-[#2d3647] bg-[#050812] text-muted-foreground hover:text-white'
                }`}
              >
                {item === 'today' ? 'Hoje' : item === 'week' ? 'Esta semana' : item === 'month' ? 'Este mês' : 'Personalizado'}
              </button>
            ))}
            <div className="ml-auto flex flex-wrap items-center gap-3">
              {period === 'custom' && (
                <>
                  <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-xs text-white" />
                  <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-xs text-white" />
                </>
              )}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={comboio} onChange={(e) => setComboio(e.target.value)} placeholder="Comboio" className="w-36 rounded-xl border border-[#2d3647] bg-[#050812] py-2 pl-9 pr-3 text-xs text-white" />
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input value={driver} onChange={(e) => setDriver(e.target.value)} placeholder="Motorista" className="w-40 rounded-xl border border-[#2d3647] bg-[#050812] py-2 pl-9 pr-3 text-xs text-white" />
              </div>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-xs text-white">
                <option value="">Status</option>
                <option value="FINALIZADA">FINALIZADA</option>
                <option value="ATIVA">ATIVA</option>
                <option value="INCONSISTENTE">INCONSISTENTE</option>
              </select>
              <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-xs text-white">
                <option value="">Origem</option>
                <option value="APK">APK</option>
                <option value="WEB">WEB</option>
              </select>
              {isMultiCompany && (
                <input value={companyCode} onChange={(e) => setCompanyCode(e.target.value)} placeholder="Empresa/Tenant" className="w-44 rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-xs text-white" />
              )}
            </div>
          </div>
        </div>

        {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">{error}</div> : null}

        <div className="overflow-hidden rounded-2xl border border-[#2d3647] bg-[#0d1426]">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2d3647]">
                {['Data Início', 'Data Fim', 'Comboio', 'Motorista', 'Turno', 'KM Inicial', 'KM Final', 'Distância', 'Tanque Inicial', 'Total Carregado', 'Total Abastecido', 'Saldo Final', 'Divergência', 'Origem', 'Status', 'Ações'].map((h) => (
                  <th key={h} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!loading && !hasData ? (
                <tr>
                  <td colSpan={16} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <BadgeInfo size={36} className="opacity-20" />
                      <p className="text-sm font-black text-white/60">Nenhuma jornada encontrada</p>
                      <p className="max-w-sm text-[11px]">Se o APK ainda não fechou um ciclo completo, a tela permanece vazia. Sem teatro, sem dado fake.</p>
                    </div>
                  </td>
                </tr>
              ) : items.map((item) => (
                <tr key={item.journeyId} className="border-t border-[#1f2740]">
                  <td className="px-4 py-3 whitespace-nowrap text-white/80">{item.startedAtLabel}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-white/80">{item.finishedAtLabel}</td>
                  <td className="px-4 py-3 text-white/80">{resolveComboioBomba({ pumpCode: item.comboioFleetCode, comboioFleetCode: item.comboioFleetCode, comboioDescription: item.comboioDescription })}</td>
                  <td className="px-4 py-3 text-white/80">{item.driverName ?? item.driverRegistration ?? '—'}</td>
                  <td className="px-4 py-3 text-white/80">{item.shift ?? '—'}</td>
                  <td className="px-4 py-3 text-white/80">{item.kmInicial ?? '—'}</td>
                  <td className="px-4 py-3 text-white/80">{item.kmFinal ?? '—'}</td>
                  <td className="px-4 py-3 text-white/80">{kilometers(item.distanciaPercorrida)}</td>
                  <td className="px-4 py-3 text-white/80">{money(item.tanqueInicial ?? item.tankInitialLiters)}</td>
                  <td className="px-4 py-3 text-white/80">{money(item.totalCarregadoPosto ?? item.totalLoadedLiters)}</td>
                  <td className="px-4 py-3 text-white/80">{money(item.totalAbastecidoMaquinas ?? item.totalSuppliedLiters)}</td>
                  <td className={`px-4 py-3 font-bold ${Math.abs(item.divergenceLiters ?? item.diferenca ?? 0) > 0.05 ? 'text-amber-300' : 'text-white/80'}`}>{money(item.realFinalBalanceLiters ?? item.saldoFinalAutomatico)}</td>
                  <td className={`px-4 py-3 font-bold ${Math.abs(item.divergenceLiters ?? item.diferenca ?? 0) > 0.05 ? 'text-red-300' : 'text-white/70'}`}>{money(item.divergenceLiters ?? item.diferenca)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-300">{item.source ?? 'APK'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-[260px] flex-col gap-1.5">
                      <div className="flex flex-wrap gap-2">
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${badge(item.status)}`}>{item.status}</span>
                        <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${syncBadge(item.syncStatus)}`}>{item.syncStatus}</span>
                        {item.calculationModeLabel ? <span className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-300">{item.calculationModeLabel}</span> : null}
                      </div>
                      {item.status === 'INCONSISTENTE' ? (
                        <span className="line-clamp-2 text-[10px] font-semibold leading-snug text-red-200/90">
                          {item.inconsistencyReasons?.[0] ?? 'Inconsistência operacional sem motivo detalhado'}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/combustivel/jornadas/${item.journeyId}${item.companyCode ? `?companyCode=${encodeURIComponent(item.companyCode)}` : ''}`} className="inline-flex items-center gap-1 rounded-lg border border-[#2d3647] bg-[#050812] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-white transition-all hover:border-orange-500/40 hover:text-orange-300">
                      Ver detalhes
                      <ArrowUpRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-4 text-xs text-muted-foreground">Jornadas finalizadas: <span className="font-black text-white">{summary.finalized}</span></div>
          <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-4 text-xs text-muted-foreground">Jornadas ativas: <span className="font-black text-white">{summary.active}</span></div>
          <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-4 text-xs text-muted-foreground">Pendentes: <span className="font-black text-white">{summary.pendingSync}</span></div>
          <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-4 text-xs text-muted-foreground">Inconsistentes: <span className="font-black text-white">{summary.inconsistent}</span></div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(JornadasPage, { module: 'COMBUSTIVEL' });
