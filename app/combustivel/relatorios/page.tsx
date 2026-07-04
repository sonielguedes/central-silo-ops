"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { withAuth } from '@/components/shared/with-auth';
import { CombustivelPageHeader } from '@/components/combustivel/combustivel-page-header';
import { resolveComboioBomba } from '@/lib/fueling-display';
import { AlertTriangle, AlertCircle, Fuel, Loader2, Search, ShieldAlert, SlidersHorizontal, Truck, Users, X, ChevronRight, FileText, Waves } from 'lucide-react';

type JourneyStatus = 'FINALIZADA' | 'ATIVA' | 'INCONSISTENTE';
type SyncStatus = 'SYNCED' | 'PENDENTE_SYNC' | 'ERRO_SYNC';
type InconsistencyType = 'all' | 'orphan' | 'fueling' | 'divergence' | 'sync' | 'duplicate' | 'unknown';

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
  status: JourneyStatus;
  syncStatus: SyncStatus;
  calculationModeLabel?: string;
  inconsistencyReasons?: string[];
  fuelingCount?: number;
  eventCount?: number;
};

type JourneyTimelineItem = {
  offlineId: string;
  type: string;
  summary: string;
  occurredAtLabel: string;
  source: string;
  syncStatus: SyncStatus | string;
};

type JourneyFuelingItem = {
  offlineId: string;
  occurredAtLabel: string;
  fleetCode: string;
  operatorName?: string;
  operatorRegistration?: string;
  pumpCode?: string;
  product?: string;
  meterStart?: number;
  meterEnd?: number;
  liters: number;
  hourmeter?: number;
  odometer?: number;
  journeyId?: string;
  journeyOfflineId?: string;
  comboioFleetCode?: string;
  syncStatus: SyncStatus | string;
};

type JourneyDetail = {
  summary: JourneySummary;
  timeline: JourneyTimelineItem[];
  fuelings: JourneyFuelingItem[];
};

type ReportResponse = {
  success?: boolean;
  items?: JourneySummary[];
  summary?: unknown;
};

type DetailResponse = {
  success?: boolean;
  item?: JourneyDetail;
};

type Filters = {
  from: string;
  to: string;
  fleet: string;
  operator: string;
  status: string;
  inconsistencyType: InconsistencyType;
};

type Kpis = {
  totalJourneys: number;
  inconsistentJourneys: number;
  totalSuppliedLiters: number;
  averagePerJourney: number;
  maxDivergence: number;
};

const DEFAULT_INCONSISTENCY_FILTER: InconsistencyType = 'all';

function todayInput(value: Date = new Date()): string {
  return value.toLocaleDateString('en-CA');
}

function startOfMonthInput(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
}

function liters(value?: number): string {
  if (!Number.isFinite(value ?? NaN)) return '0,0 L';
  return `${(value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`;
}

function maybeNumber(value?: number): string {
  if (!Number.isFinite(value ?? NaN)) return '—';
  return (value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function dateTime(value?: string): string {
  return value || '—';
}

function classification(item: JourneySummary): InconsistencyType {
  if (item.status !== 'INCONSISTENTE') return 'all';
  const reasons = (item.inconsistencyReasons ?? []).join(' ').toLowerCase();
  if (!reasons) return 'unknown';
  if (reasons.includes('duplicada')) return 'duplicate';
  if (reasons.includes('sincroniz') || reasons.includes('sync')) return 'sync';
  if (reasons.includes('divergên') || reasons.includes('divergenc') || reasons.includes('saldo negativo')) return 'divergence';
  if (reasons.includes('abastecimento sem jornada') || reasons.includes('jornada vinculada')) return 'fueling';
  if (reasons.includes('sem jornada') || reasons.includes('sem início') || reasons.includes('sem evento de início') || reasons.includes('jornada órfã') || reasons.includes('jornada sem evento de início')) return 'orphan';
  return 'unknown';
}

function inconsistencyLabel(type: InconsistencyType): string {
  switch (type) {
    case 'orphan':
      return 'Órfã / sem início';
    case 'fueling':
      return 'Abastecimento sem jornada';
    case 'divergence':
      return 'Divergência contábil';
    case 'sync':
      return 'Sincronismo';
    case 'duplicate':
      return 'Comboio duplicado';
    case 'unknown':
      return 'Sem motivo detalhado';
    default:
      return 'Todas';
  }
}

function badgeStyle(status: JourneyStatus) {
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

function syncBadgeStyle(status: SyncStatus) {
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

function getReason(item: JourneySummary): string {
  return item.inconsistencyReasons?.[0] ?? 'Inconsistência operacional sem motivo detalhado';
}

function recommendation(item: JourneySummary): string {
  const reasons = (item.inconsistencyReasons ?? []).join(' ').toLowerCase();
  if (!reasons) return 'Auditar a jornada no detalhe e validar o vínculo com os eventos de combustível.';
  if (reasons.includes('duplicada')) return 'Encerrar a jornada concorrente do mesmo comboio e manter apenas um ciclo ativo.';
  if (reasons.includes('sincroniz') || reasons.includes('sync')) return 'Reprocessar a sincronização e confirmar a chegada de todos os eventos na Central.';
  if (reasons.includes('divergên') || reasons.includes('divergenc') || reasons.includes('saldo negativo')) return 'Revisar tanque inicial, litros carregados e abastecidos; validar a divergência antes de fechar a operação.';
  if (reasons.includes('abastecimento sem jornada') || reasons.includes('jornada vinculada')) return 'Vincular o abastecimento a uma jornada válida ou corrigir o mapeamento journeyId/journeyOfflineId.';
  if (reasons.includes('sem jornada') || reasons.includes('sem início') || reasons.includes('jornada órfã') || reasons.includes('sem evento de início')) return 'Confirmar o ciclo de jornada no APK e reenviar os eventos de início/fim, se necessário.';
  return 'Auditar os eventos de combustível e validar o encadeamento operacional.';
}

function buildQuery(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.from) params.set('from', `${filters.from}T00:00:00-03:00`);
  if (filters.to) params.set('to', `${filters.to}T23:59:59.999-03:00`);
  if (filters.fleet.trim()) params.set('comboio', filters.fleet.trim());
  if (filters.operator.trim()) params.set('driver', filters.operator.trim());
  if (filters.status.trim()) params.set('status', filters.status.trim());
  return params.toString();
}

function initialFilters(): Filters {
  return {
    from: startOfMonthInput(),
    to: todayInput(),
    fleet: '',
    operator: '',
    status: '',
    inconsistencyType: DEFAULT_INCONSISTENCY_FILTER,
  };
}

function journeyMeterLabel(item: JourneySummary): string {
  const initial = item.kmInicial;
  const final = item.kmFinal;
  if (initial == null && final == null) return '—';
  return `${maybeNumber(initial)} / ${maybeNumber(final)}`;
}

function reportKpis(items: JourneySummary[]): Kpis {
  const totalJourneys = items.length;
  const inconsistentJourneys = items.filter((item) => item.status === 'INCONSISTENTE').length;
  const totalSuppliedLiters = Math.round(items.reduce((sum, item) => sum + (item.totalSuppliedLiters ?? item.totalAbastecidoMaquinas ?? 0), 0) * 10) / 10;
  const averagePerJourney = totalJourneys > 0 ? Math.round((totalSuppliedLiters / totalJourneys) * 10) / 10 : 0;
  const maxDivergence = items.reduce((max, item) => Math.max(max, Math.abs(item.divergenceLiters ?? item.diferenca ?? 0)), 0);
  return { totalJourneys, inconsistentJourneys, totalSuppliedLiters, averagePerJourney, maxDivergence };
}

function FuelAuditReportPage() {
  const [draftFilters, setDraftFilters] = useState<Filters>(() => initialFilters());
  const [appliedFilters, setAppliedFilters] = useState<Filters>(() => initialFilters());
  const [items, setItems] = useState<JourneySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detail, setDetail] = useState<JourneyDetail | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<JourneySummary | null>(null);

  const load = useCallback(async (filters: Filters) => {
    setRefreshing(true);
    setError(null);
    try {
      const query = buildQuery(filters);
      const res = await fetch(`/api/combustivel/jornadas${query ? `?${query}` : ''}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar relatório');
      const payload = (await res.json()) as ReportResponse;
      setItems(payload.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar relatório');
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load(appliedFilters);
  }, [appliedFilters, load]);

  const visibleItems = useMemo(() => {
    return items.filter((item) => {
      if (appliedFilters.inconsistencyType !== 'all' && classification(item) !== appliedFilters.inconsistencyType) return false;
      return true;
    });
  }, [items, appliedFilters.inconsistencyType]);

  const kpis = useMemo(() => reportKpis(visibleItems), [visibleItems]);

  const openDetails = useCallback(async (item: JourneySummary) => {
    setDrawerOpen(true);
    setSelectedJourney(item);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const url = new URL(`/api/combustivel/jornadas/${item.journeyId}`, window.location.origin);
      if (item.companyCode) url.searchParams.set('companyCode', item.companyCode);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar detalhes da jornada');
      const payload = (await res.json()) as DetailResponse;
      setDetail(payload.item ?? null);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Falha ao carregar detalhes da jornada');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const applyFilters = () => setAppliedFilters(draftFilters);
  const clearFilters = () => {
    const next = initialFilters();
    setDraftFilters(next);
    setAppliedFilters(next);
  };
  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedJourney(null);
    setDetail(null);
    setDetailError(null);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#060c1a] text-white">
      <CombustivelPageHeader
        title="Relatório/Auditoria de Combustível"
        subtitle="Análise operacional de jornadas, abastecimentos e inconsistências"
        currentPage="Relatórios"
        actions={
          <button
            onClick={() => void load(appliedFilters)}
            className="inline-flex items-center gap-2 rounded-xl border border-[#2d3647] bg-[#0d1426] px-4 py-2 text-xs font-bold text-muted-foreground transition hover:text-white"
          >
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <Waves size={14} />}
            Atualizar
          </button>
        }
      />

      <div className="px-8 py-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <KpiCard icon={<FileText size={18} />} label="Total de jornadas" value={kpis.totalJourneys} accent="text-white" />
          <KpiCard icon={<ShieldAlert size={18} />} label="Jornadas com inconsistência" value={kpis.inconsistentJourneys} accent="text-red-300" />
          <KpiCard icon={<Fuel size={18} />} label="Total abastecido" value={liters(kpis.totalSuppliedLiters)} accent="text-amber-300" />
          <KpiCard icon={<Users size={18} />} label="Média por jornada" value={liters(kpis.averagePerJourney)} accent="text-cyan-300" />
          <KpiCard icon={<AlertTriangle size={18} />} label="Maior divergência" value={liters(kpis.maxDivergence)} accent="text-orange-300" />
        </div>

        <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-5">
          <div className="grid gap-4 xl:grid-cols-6">
            <FilterInput
              label="Data inicial"
              type="date"
              value={draftFilters.from}
              onChange={(value) => setDraftFilters((current) => ({ ...current, from: value }))}
            />
            <FilterInput
              label="Data final"
              type="date"
              value={draftFilters.to}
              onChange={(value) => setDraftFilters((current) => ({ ...current, to: value }))}
            />
            <FilterInput
              label="Frota"
              icon={<Truck size={12} />}
              value={draftFilters.fleet}
              placeholder="Comboio"
              onChange={(value) => setDraftFilters((current) => ({ ...current, fleet: value }))}
            />
            <FilterInput
              label="Operador"
              icon={<Users size={12} />}
              value={draftFilters.operator}
              placeholder="Nome ou matrícula"
              onChange={(value) => setDraftFilters((current) => ({ ...current, operator: value }))}
            />
            <FilterSelect
              label="Status"
              value={draftFilters.status}
              onChange={(value) => setDraftFilters((current) => ({ ...current, status: value }))}
              options={[
                { value: '', label: 'Todos' },
                { value: 'FINALIZADA', label: 'FINALIZADA' },
                { value: 'ATIVA', label: 'ATIVA' },
                { value: 'INCONSISTENTE', label: 'INCONSISTENTE' },
              ]}
            />
            <FilterSelect
              label="Tipo de inconsistência"
              value={draftFilters.inconsistencyType}
              onChange={(value) => setDraftFilters((current) => ({ ...current, inconsistencyType: value as InconsistencyType }))}
              options={[
                { value: 'all', label: 'Todas' },
                { value: 'orphan', label: inconsistencyLabel('orphan') },
                { value: 'fueling', label: inconsistencyLabel('fueling') },
                { value: 'divergence', label: inconsistencyLabel('divergence') },
                { value: 'sync', label: inconsistencyLabel('sync') },
                { value: 'duplicate', label: inconsistencyLabel('duplicate') },
                { value: 'unknown', label: inconsistencyLabel('unknown') },
              ]}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={applyFilters}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-[#060c1a] transition hover:scale-[1.01]"
            >
              <Search size={13} />
              Aplicar filtros
            </button>
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-2 rounded-xl border border-[#2d3647] bg-[#050812] px-4 py-2 text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground transition hover:text-white"
            >
              <X size={13} />
              Limpar filtros
            </button>
            <div className="ml-auto flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
              <SlidersHorizontal size={12} />
              {visibleItems.length} registro(s) visível(is)
            </div>
          </div>
        </div>

        {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">{error}</div> : null}

        <div className="overflow-hidden rounded-2xl border border-[#2d3647] bg-[#0d1426]">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-[#2d3647]">
                  {['Data/Hora', 'Frota', 'Operador', 'Jornada', 'Horímetro/KM', 'Volume abastecido', 'Status', 'Motivo da inconsistência', 'Ação'].map((head) => (
                    <th key={head} className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                      {head}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!loading && visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <AlertCircle size={36} className="opacity-20" />
                        <p className="text-sm font-black text-white/60">Nenhuma jornada encontrada</p>
                        <p className="max-w-sm text-[11px]">Ajuste os filtros para localizar jornadas, abastecimentos e inconsistências do período selecionado.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  visibleItems.map((item) => (
                    <tr key={item.journeyId} className="border-t border-[#1f2740] hover:bg-white/5">
                      <td className="whitespace-nowrap px-4 py-3 text-white/80">{dateTime(item.startedAtLabel)}</td>
                      <td className="px-4 py-3 text-white/80">{resolveComboioBomba({ pumpCode: item.comboioFleetCode, comboioFleetCode: item.comboioFleetCode, comboioDescription: item.comboioDescription })}</td>
                      <td className="px-4 py-3 text-white/80">{item.driverName ?? item.driverRegistration ?? '—'}</td>
                      <td className="px-4 py-3 text-white/80">{item.journeyId}</td>
                      <td className="px-4 py-3 text-white/80">{journeyMeterLabel(item)}</td>
                      <td className="px-4 py-3 text-white/80">{liters(item.totalSuppliedLiters ?? item.totalAbastecidoMaquinas)}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${badgeStyle(item.status)}`}>{item.status}</span>
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${syncBadgeStyle(item.syncStatus)}`}>{item.syncStatus}</span>
                          {item.calculationModeLabel ? <span className="inline-flex items-center rounded-md border border-blue-500/30 bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold text-blue-300">{item.calculationModeLabel}</span> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={item.status === 'INCONSISTENTE' ? 'line-clamp-2 text-[10px] font-semibold leading-snug text-red-200/90' : 'text-[10px] text-white/45'}>
                          {item.status === 'INCONSISTENTE' ? getReason(item) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => void openDetails(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#2d3647] bg-[#050812] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-white transition hover:border-orange-500/40 hover:text-orange-300"
                        >
                          Ver detalhes
                          <ChevronRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-[2px]">
          <div className="h-full w-full max-w-5xl overflow-y-auto border-l border-[#2d3647] bg-[#050812] shadow-2xl shadow-black/40">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#2d3647] bg-[#050812]/95 px-6 py-4 backdrop-blur">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">Relatório / Auditoria</p>
                <h2 className="mt-1 text-lg font-black text-white">
                  {selectedJourney ? `Jornada ${selectedJourney.journeyId}` : 'Detalhes da jornada'}
                </h2>
              </div>
              <button onClick={closeDrawer} className="rounded-xl border border-[#2d3647] bg-[#0d1426] p-2 text-muted-foreground transition hover:text-white">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-6 p-6">
              {detailLoading ? (
                <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto mb-3 animate-spin" size={24} />
                  Carregando detalhes da jornada...
                </div>
              ) : detailError ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{detailError}</div>
              ) : detail ? (
                <>
                  <div className="grid gap-4 xl:grid-cols-4">
                    <MiniCard label="Status" value={detail.summary.status} />
                    <MiniCard label="Sincronismo" value={detail.summary.syncStatus} />
                    <MiniCard label="Total abastecido" value={liters(detail.summary.totalSuppliedLiters ?? detail.summary.totalAbastecidoMaquinas)} />
                    <MiniCard label="Divergência" value={liters(detail.summary.divergenceLiters ?? detail.summary.diferenca)} />
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Panel title="Dados completos da jornada">
                      <InfoRow label="Comboio" value={resolveComboioBomba({ pumpCode: detail.summary.comboioFleetCode, comboioFleetCode: detail.summary.comboioFleetCode, comboioDescription: detail.summary.comboioDescription })} />
                      <InfoRow label="Operador" value={detail.summary.driverName ?? detail.summary.driverRegistration ?? '—'} />
                      <InfoRow label="Turno" value={detail.summary.shift ?? '—'} />
                      <InfoRow label="Início" value={dateTime(detail.summary.startedAtLabel)} />
                      <InfoRow label="Fim" value={dateTime(detail.summary.finishedAtLabel)} />
                      <InfoRow label="Horímetro/KM" value={journeyMeterLabel(detail.summary)} />
                      <InfoRow label="Tanque inicial" value={liters(detail.summary.tankInitialLiters ?? detail.summary.tanqueInicial)} />
                      <InfoRow label="Volume carregado" value={liters(detail.summary.totalLoadedLiters ?? detail.summary.totalCarregadoPosto)} />
                    </Panel>

                    <Panel title="Motivo técnico e recomendação">
                      <div className="space-y-3">
                        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-red-300">Motivo técnico</p>
                          <p className="mt-2 text-sm text-red-100">{getReason(detail.summary)}</p>
                        </div>
                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-300">Recomendação operacional</p>
                          <p className="mt-2 text-sm text-blue-100">{recommendation(detail.summary)}</p>
                        </div>
                        <div className="rounded-xl border border-[#2d3647] bg-[#050812] p-4">
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">Inconsistências detectadas</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(detail.summary.inconsistencyReasons?.length ?? 0) > 0 ? detail.summary.inconsistencyReasons!.map((reason) => (
                              <span key={reason} className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200">
                                {reason}
                              </span>
                            )) : (
                              <span className="rounded-lg border border-[#2d3647] bg-[#0d1426] px-3 py-2 text-xs font-bold text-white/70">
                                Inconsistência operacional sem motivo detalhado
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Panel>
                  </div>

                  <Panel title="Eventos de abastecimento">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="border-b border-[#1f2740]">
                            {['Data/hora', 'Frota', 'Operador', 'Bomba', 'Produto', 'Litros', 'Horímetro/KM', 'Status'].map((head) => (
                              <th key={head} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                                {head}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {detail.fuelings.length > 0 ? detail.fuelings.map((fueling) => (
                            <tr key={fueling.offlineId} className="border-t border-[#1f2740]">
                              <td className="px-4 py-3 text-white/80">{dateTime(fueling.occurredAtLabel)}</td>
                              <td className="px-4 py-3 text-white/80">{fueling.fleetCode}</td>
                              <td className="px-4 py-3 text-white/80">{fueling.operatorName ?? fueling.operatorRegistration ?? '—'}</td>
                              <td className="px-4 py-3 text-white/80">{fueling.pumpCode ?? '—'}</td>
                              <td className="px-4 py-3 text-white/80">{fueling.product ?? '—'}</td>
                              <td className="px-4 py-3 text-white/80">{liters(fueling.liters)}</td>
                              <td className="px-4 py-3 text-white/80">{fueling.meterEnd ?? fueling.meterStart ?? fueling.hourmeter ?? fueling.odometer ?? '—'}</td>
                              <td className="px-4 py-3 text-white/80">{fueling.syncStatus}</td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Nenhum abastecimento vinculado a esta jornada.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </Panel>

                  <Panel title="Linha do tempo">
                    <div className="space-y-3">
                      {detail.timeline.length > 0 ? detail.timeline.map((event) => (
                        <div key={event.offlineId} className="rounded-xl border border-[#1f2740] bg-[#050812] p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-300">{event.type}</p>
                              <p className="mt-1 text-sm text-white">{event.summary}</p>
                            </div>
                            <span className="text-[10px] text-muted-foreground">{event.occurredAtLabel}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <Tag>{event.source}</Tag>
                            <Tag>{event.syncStatus}</Tag>
                            <Tag>{event.offlineId}</Tag>
                          </div>
                        </div>
                      )) : (
                        <div className="rounded-xl border border-dashed border-[#2d3647] bg-[#050812] p-8 text-center text-xs text-muted-foreground">Nenhum evento consolidado encontrado.</div>
                      )}
                    </div>
                  </Panel>
                </>
              ) : (
                <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-10 text-center text-muted-foreground">
                  Selecione uma jornada para ver os detalhes.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string | number; accent?: string }) {
  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-5 shadow-lg shadow-black/10">
      <div className="flex items-start gap-4">
        <div className={`mt-0.5 ${accent ?? 'text-orange-400'}`}>{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-black leading-none text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function FilterInput({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  type?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">
        {icon}
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-xs text-white outline-none transition focus:border-orange-500/40"
      />
    </label>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-2 text-xs text-white outline-none transition focus:border-orange-500/40"
      >
        {options.map((option) => (
          <option key={option.value || option.label} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-5">
      <h3 className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/5 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-white">{value}</span>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-black text-white">{value}</p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-lg border border-[#2d3647] bg-[#050812] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{children}</span>;
}

export default withAuth(FuelAuditReportPage, { module: 'COMBUSTIVEL_REL' });
