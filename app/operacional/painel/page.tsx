"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import {
  Activity, AlertTriangle, CheckCircle2, Clock,
  Gauge, Hash, Loader2, MapPin, Navigation, PauseCircle,
  RefreshCw, Search, Tractor, Truck, User, Wifi, WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';
import type { EquipmentLiveState, EquipmentOperationalStatus } from '@/lib/types';

// ── Alert types ───────────────────────────────────────────────────────────────
type AlertSeverity = 'critical' | 'warning' | 'info';
type AlertCode     = 'GPS_STALE' | 'HB_STALE' | 'LONG_STOP' | 'STOP_NO_REASON' | 'NO_OPERATOR' | 'NO_HOURMETER';

const ALERT_META: Record<AlertCode, { label: string; severity: AlertSeverity; score: number }> = {
  HB_STALE:       { label: 'Sem heartbeat',     severity: 'critical', score: 4 },
  GPS_STALE:      { label: 'GPS desatualizado',  severity: 'critical', score: 3 },
  LONG_STOP:      { label: 'Parada >2min',       severity: 'critical', score: 3 },
  STOP_NO_REASON: { label: 'Parada sem motivo',  severity: 'warning',  score: 2 },
  NO_OPERATOR:    { label: 'Sem operador',        severity: 'warning',  score: 1 },
  NO_HOURMETER:   { label: 'Sem horimetro',       severity: 'info',     score: 1 },
};

const SEVERITY_CLASS: Record<AlertSeverity, string> = {
  critical: 'text-red-400 bg-red-500/10 border-red-500/30',
  warning:  'text-amber-400 bg-amber-500/10 border-amber-500/30',
  info:     'text-blue-400 bg-blue-500/10 border-blue-500/30',
};

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS_CFG: Record<Lowercase<EquipmentOperationalStatus>, { label: string; color: string; bg: string }> = {
  online:     { label: 'Online',     color: 'text-blue-400',    bg: 'bg-blue-500/15 border-blue-500/30'    },
  operando:   { label: 'Operando',   color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  parado:     { label: 'Parado',     color: 'text-orange-400',  bg: 'bg-orange-500/15 border-orange-500/30'  },
  finalizado: { label: 'Finalizado', color: 'text-gray-400',    bg: 'bg-gray-500/15 border-gray-500/30'    },
  offline:    { label: 'Offline',    color: 'text-gray-400',    bg: 'bg-gray-500/15 border-gray-500/30'    },
};

const getStatusCfg = (s: EquipmentOperationalStatus) =>
  STATUS_CFG[s.toLowerCase() as Lowercase<EquipmentOperationalStatus>] || STATUS_CFG.offline;

// ── Derived item type ─────────────────────────────────────────────────────────
interface DecisionItem extends EquipmentLiveState {
  alerts: AlertCode[];
  alertScore: number;
  gpsAgeMs: number;
  hbAgeMs: number;
  timeInStatusMs: number;
  stopDurationMs: number;
  hourmeterDelta: number | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const GPS_ALERT_MS    = 120 * 1000;
const HB_ALERT_MS     = 120 * 1000;
const STOP_ALERT_MS   = 120 * 1000;
const GPS_RECENT_MS   = 15 * 60 * 1000;
const HB_RECENT_MS    = 3  * 60 * 1000;
const POLL_MS         = 30 * 1000;

const ageOf = (v?: string): number => {
  if (!v) return Infinity;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? Math.max(0, Date.now() - t) : Infinity;
};

const isRecent = (v?: string, ms = GPS_RECENT_MS) =>
  !!v && Number.isFinite(new Date(v).getTime()) && Date.now() - new Date(v).getTime() <= ms;

const fmtAge = (ms: number): string => {
  if (!Number.isFinite(ms)) return 'N/A';
  const s = Math.floor(ms / 1000);
  if (s < 60)  return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60)  return m + 'min';
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'min';
};

const fmtTime = (v?: string): string => {
  if (!v) return 'Nao informado';
  const t = new Date(v);
  if (Number.isNaN(t.getTime())) return 'Nao informado';
  return t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const fv = (v: unknown): string =>
  (v === null || v === undefined || v === '') ? 'Nao informado' : String(v);

const hasOpenStop = (item: EquipmentLiveState): boolean =>
  Boolean(item.stopCode || item.stopDescription || (item as unknown as Record<string, unknown>)['stopReason']) &&
  !(item as unknown as Record<string, unknown>)['stopEndedAt'] &&
  item.status !== 'FINALIZADO';

const fmtHM = (h: number | null | undefined): string => {
  if (h == null || !Number.isFinite(h)) return 'N/A';
  const hrs = Math.floor(h);
  const min = Math.round((h - hrs) * 60);
  return min > 0 ? `${hrs}h ${min}min` : `${hrs}h`;
};

const deriveItem = (item: EquipmentLiveState): DecisionItem => {
  const gpsAgeMs       = ageOf(item.lastGpsAt);
  const hbAgeMs        = ageOf(item.lastHeartbeatAt);
  const timeInStatusMs = ageOf(item.statusStartedAt);
  const stopMs         = item.stopStartedAt ? ageOf(item.stopStartedAt)
    : (item.stopDurationSeconds ? item.stopDurationSeconds * 1000 : 0);

  const alerts: AlertCode[] = [];
  if (hbAgeMs  > HB_ALERT_MS)                                             alerts.push('HB_STALE');
  if (gpsAgeMs > GPS_ALERT_MS)                                             alerts.push('GPS_STALE');
  if (item.status === 'PARADO' && timeInStatusMs > STOP_ALERT_MS)         alerts.push('LONG_STOP');
  if (item.status === 'PARADO' && !item.stopDescription && !item.stopReason && !item.stopCode)
                                                                            alerts.push('STOP_NO_REASON');
  if (!item.currentOperator && !item.operatorName)                         alerts.push('NO_OPERATOR');
  const hasH = item.hourmeterCurrent != null || item.hourmeter != null;
  if (!hasH)                                                               alerts.push('NO_HOURMETER');

  const alertScore = alerts.reduce((s, a) => s + ALERT_META[a].score, 0);

  const hStart = item.hourmeterStart ?? item.hourmeterInitial;
  const hCurr  = item.hourmeterCurrent ?? item.hourmeter;
  const delta  = hStart != null && hCurr != null ? Math.max(0, hCurr - hStart) : null;

  return { ...item, alerts, alertScore, gpsAgeMs, hbAgeMs, timeInStatusMs, stopDurationMs: stopMs, hourmeterDelta: delta };
};

// ── Page ──────────────────────────────────────────────────────────────────────
function PainelOperacionalPage() {
  const [fleet,   setFleet]   = useState<EquipmentLiveState[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [search,  setSearch]  = useState('');
  const [statusFilter, setStatusFilter] = useState<EquipmentOperationalStatus | 'ALL'>('ALL');
  const [alertOnly, setAlertOnly] = useState(false);
  const [lastAt,  setLastAt]  = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    setSyncing(true);
    try {
      const res  = await fetch('/api/equipamentos/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setFleet(Array.isArray(data) ? (data as EquipmentLiveState[]) : []);
      setLastAt(new Date());
      setError(null);
    } catch (e) {
      console.error('[painel] fetch error', e);
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados');
    } finally {
      setSyncing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, POLL_MS);
    return () => clearInterval(iv);
  }, [fetchData]);

  const items = useMemo(() => fleet.map(deriveItem), [fleet]);

  const kpis = useMemo(() => {
    const total     = items.length;
    const operando  = items.filter(i => i.status === 'OPERANDO').length;
    const parado    = items.filter(i => hasOpenStop(i)).length;
    const offline   = items.filter(i => i.status === 'OFFLINE' || i.status === 'FINALIZADO').length;
    const noGps     = items.filter(i => !isRecent(i.lastGpsAt, GPS_RECENT_MS)).length;
    const noHb      = items.filter(i => !isRecent(i.lastHeartbeatAt, HB_RECENT_MS)).length;

    const longestStop = items
      .filter(i => i.status === 'PARADO')
      .sort((a, b) => b.stopDurationMs - a.stopDurationMs)[0] ?? null;

    const totalDelta = items.reduce((s, i) => s + (i.hourmeterDelta ?? 0), 0);

    return { total, operando, parado, offline, noGps, noHb, longestStop, totalDelta };
  }, [items]);

  const critical = useMemo(() =>
    items.filter(i => i.alertScore >= 3).sort((a, b) => b.alertScore - a.alertScore),
    [items]
  );

  const filtered = useMemo(() => {
    let list = [...items];
    if (statusFilter !== 'ALL') list = list.filter(i => i.status === statusFilter);
    if (alertOnly)              list = list.filter(i => i.alerts.length > 0);
    const q = search.toLowerCase();
    if (q) list = list.filter(i =>
      i.fleetCode.toLowerCase().includes(q) ||
      (i.operatorName  || '').toLowerCase().includes(q) ||
      (i.currentOperator || '').toLowerCase().includes(q) ||
      (i.operationName || '').toLowerCase().includes(q)
    );
    return list.sort((a, b) => b.alertScore - a.alertScore);
  }, [items, statusFilter, alertOnly, search]);

  if (loading) {
    return (
      <div className="flex h-screen bg-[#050812] text-white">
        <Sidebar className="hidden lg:flex shrink-0" />
        <div className="flex-1 flex items-center justify-center gap-4 flex-col">
          <Loader2 className="animate-spin text-primary" size={40} />
          <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.3em]">Carregando painel operacional...</p>
        </div>
      </div>
    );
  }

  if (error && fleet.length === 0) {
    return (
      <div className="flex h-screen bg-[#050812] text-white">
        <Sidebar className="hidden lg:flex shrink-0" />
        <div className="flex-1 flex items-center justify-center gap-4 flex-col">
          <AlertTriangle className="text-red-400" size={40} />
          <p className="text-sm text-red-400 font-bold">{error}</p>
          <button onClick={fetchData} className="px-4 py-2 text-xs font-black uppercase border border-primary/40 rounded-xl text-primary hover:bg-primary/10 transition-all">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <PageHeader title="Painel de Decisao Operacional" description="Visao consolidada para acao imediata em campo">
            <div className="flex items-center gap-3">
              {lastAt && (
                <span className="text-[9px] text-muted-foreground font-bold uppercase">
                  {'Atualizado ' + lastAt.toLocaleTimeString('pt-BR')}
                </span>
              )}
              <button onClick={fetchData} className="p-2.5 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-primary hover:bg-[#252d4a] transition-all">
                <RefreshCw size={18} className={cn(syncing && 'animate-spin')} />
              </button>
            </div>
          </PageHeader>

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <KpiCard label="Total"        value={String(kpis.total)}    icon={<Tractor size={16} />}     color="text-white" />
            <KpiCard label="Operando"     value={String(kpis.operando)} icon={<Activity size={16} />}    color="text-emerald-400" />
            <KpiCard label="Paradas"      value={String(kpis.parado)}   icon={<PauseCircle size={16} />} color="text-orange-400" />
            <KpiCard label="Offline"      value={String(kpis.offline)}  icon={<WifiOff size={16} />}     color="text-gray-400" />
            <KpiCard label="Sem GPS"      value={String(kpis.noGps)}    icon={<MapPin size={16} />}      color="text-amber-400" />
            <KpiCard label="Sem HB"       value={String(kpis.noHb)}     icon={<Wifi size={16} />}        color="text-red-400" />
            <KpiCard
              label="Parada Longa"
              value={kpis.longestStop ? fmtAge(kpis.longestStop.stopDurationMs) : '-'}
              sub={kpis.longestStop ? kpis.longestStop.fleetCode : ''}
              icon={<Clock size={16} />}
              color="text-orange-400"
            />
            <KpiCard
              label="Horimetro Turno"
              value={kpis.totalDelta > 0 ? fmtHM(kpis.totalDelta) : '-'}
              icon={<Gauge size={16} />}
              color="text-primary"
            />
          </div>

          {/* ── Alert Banner ── */}
          {critical.length > 0 && (
            <div className="bg-red-950/40 border border-red-500/30 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={14} className="text-red-400" />
                <span className="text-[10px] font-black uppercase text-red-300 tracking-wider">
                  {critical.length + ' equipamento(s) com alertas criticos'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {critical.slice(0, 8).map(i => (
                  <div key={i.equipmentId}
                    className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-1.5">
                    <span className="text-[11px] font-black text-white">{i.fleetCode}</span>
                    {i.alerts.slice(0, 2).map(a => (
                      <span key={a} className="text-[8px] font-black uppercase text-red-300">
                        {'• ' + ALERT_META[a].label}
                      </span>
                    ))}
                    {i.alerts.length > 2 && (
                      <span className="text-[8px] text-red-400">{'+' + (i.alerts.length - 2)}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Filters ── */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Frota, operador ou operacao..."
                className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl py-2.5 pl-9 pr-4 text-xs focus:outline-none focus:border-primary/50 text-white placeholder:text-muted-foreground/40" />
            </div>
            {(['ALL','OPERANDO','PARADO','OFFLINE','ONLINE'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s as typeof statusFilter)}
                className={cn('px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border',
                  statusFilter === s
                    ? 'bg-primary text-[#0a0e27] border-primary'
                    : 'bg-[#1a1f3a] border-[#2d3647] text-muted-foreground hover:text-white')}>
                {s === 'ALL' ? 'Todos' : s}
              </button>
            ))}
            <button onClick={() => setAlertOnly(!alertOnly)}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-xl text-[9px] font-black uppercase border transition-all',
                alertOnly
                  ? 'bg-red-500/20 border-red-500/40 text-red-300'
                  : 'bg-[#1a1f3a] border-[#2d3647] text-muted-foreground hover:text-white')}>
              <AlertTriangle size={11} /> Apenas alertas
            </button>
            <span className="text-[9px] text-muted-foreground font-bold uppercase ml-auto">
              {filtered.length + ' de ' + items.length}
            </span>
          </div>

          {/* ── Decision Table ── */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-[#0a0e27]/40 border border-[#2d3647] rounded-3xl gap-3">
              <CheckCircle2 size={36} className="text-emerald-500" />
              <p className="text-sm font-black uppercase text-white">Nenhuma frota com os filtros aplicados</p>
            </div>
          ) : (
            <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead className="bg-[#050812]/50 text-[9px] uppercase font-black tracking-widest text-muted-foreground border-b border-[#2d3647]">
                    <tr>
                      <th className="px-4 py-4 w-24">Frota</th>
                      <th className="px-4 py-4 w-28">Status</th>
                      <th className="px-4 py-4">Operador / Matricula</th>
                      <th className="px-4 py-4">Operacao</th>
                      <th className="px-4 py-4">Parada</th>
                      <th className="px-4 py-4 w-24">T. Status</th>
                      <th className="px-4 py-4 w-24">Horimetro</th>
                      <th className="px-4 py-4 w-28">Ultimo GPS</th>
                      <th className="px-4 py-4 w-28">Ultimo HB</th>
                      <th className="px-4 py-4 w-32">Alertas</th>
                      <th className="px-4 py-4 w-24 text-right">Acao</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d3647]/30">
                    {filtered.map(item => <DecisionRow key={item.equipmentId} item={item} />)}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ── Row component ─────────────────────────────────────────────────────────────
function DecisionRow({ item }: { item: DecisionItem }) {
  const sCfg      = getStatusCfg(item.status);
  const TypeIcon  =
    (item.type || '').toUpperCase().includes('TRATOR') ? Tractor :
    (item.type || '').toUpperCase().includes('CAM')    ? Truck   :
    (item.type || '').toUpperCase().includes('COLH')   ? Tractor : Navigation;

  // operatorName preferred; fallback to currentOperator; registration as sub
  const operator   = fv(item.operatorName || item.currentOperator);
  const regist     = fv(item.operatorRegistration || item.registration);
  // operationName preferred; fallback to operationCode then currentOperation
  const operation  = fv(item.operationName || item.operationCode || item.currentOperation);
  const hCurr      = item.hourmeterCurrent ?? item.hourmeter;
  // stopInfo visible even when OFFLINE if stopCode/stopDescription present
  const hasStop    = !!(item.stopCode || item.stopDescription || (item as unknown as Record<string, unknown>)['stopReason']);
  const stopInfo   = item.stopDescription ?? (item as unknown as Record<string, unknown>)['stopReason'] as string | undefined;
  const stopCode   = item.stopCode;
  // implement
  const implement  = item.implementName || (item as unknown as Record<string, unknown>)['implementCode'] as string | undefined;

  // ficha link
  const fichaHref  = '/ferramentas/ficha-operador?' +
    'fleetCode=' + encodeURIComponent(item.fleetCode) +
    (item.journeyId ? '&journeyId=' + encodeURIComponent(item.journeyId) : '');

  const rowBg = item.alertScore >= 4 ? 'bg-red-950/20' :
                item.alertScore >= 2 ? 'bg-amber-950/10' : '';

  return (
    <tr className={cn('group hover:bg-primary/5 transition-colors', rowBg)}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <TypeIcon size={14} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-black italic text-white tracking-tighter">{item.fleetCode}</span>
        </div>
      </td>

      <td className="px-4 py-3">
        <span className={cn('px-2.5 py-1 rounded-full text-[9px] font-black uppercase border', sCfg.bg, sCfg.color)}>
          {sCfg.label}
        </span>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <User size={10} className="text-muted-foreground shrink-0" />
            <span className={cn('text-[11px] font-bold uppercase truncate max-w-[140px]', operator === 'Nao informado' ? 'text-muted-foreground/50 italic' : 'text-white')}>
              {operator}
            </span>
          </div>
          {regist !== 'Nao informado' && (
            <div className="flex items-center gap-1">
              <Hash size={9} className="text-muted-foreground shrink-0" />
              <span className="text-[9px] text-muted-foreground font-bold">{regist}</span>
            </div>
          )}
        </div>
      </td>

      <td className="px-4 py-3">
        <span className={cn('text-[11px] font-bold uppercase truncate max-w-[150px] block', operation === 'Nao informado' ? 'text-muted-foreground/50 italic' : 'text-white/80')}>
          {operation}
        </span>
        {implement && (
          <span className="text-[9px] text-muted-foreground truncate block max-w-[150px]">🔧 {implement}</span>
        )}
      </td>

      <td className="px-4 py-3">
        {hasStop ? (
          <div className="flex flex-col gap-0.5">
            <span className={cn('text-[11px] font-bold uppercase truncate max-w-[130px]', stopInfo ? 'text-orange-300' : 'text-orange-400/60 italic')}>
              {stopInfo ?? stopCode ?? 'Sem motivo'}
            </span>
            {stopCode && <span className="text-[9px] text-muted-foreground">{stopCode}</span>}
            {item.stopDurationMs > 0 && (
              <span className="text-[9px] text-orange-400/70">{fmtAge(item.stopDurationMs)}</span>
            )}
          </div>
        ) : (
          <span className="text-[9px] text-muted-foreground/40">—</span>
        )}
      </td>

      <td className="px-4 py-3">
        <span className={cn('text-[11px] font-bold', item.alerts.includes('LONG_STOP') ? 'text-orange-400' : 'text-white/70')}>
          {Number.isFinite(item.timeInStatusMs) ? fmtAge(item.timeInStatusMs) : '—'}
        </span>
      </td>

      <td className="px-4 py-3">
        <span className={cn('text-[11px] font-bold', hCurr == null ? 'text-muted-foreground/40 italic' : 'text-white/80')}>
          {hCurr != null ? fmtHM(hCurr) : 'N/A'}
        </span>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className={cn('text-[10px] font-bold', item.alerts.includes('GPS_STALE') ? 'text-red-400' : 'text-white/70')}>
            {fmtTime(item.lastGpsAt)}
          </span>
          <span className={cn('text-[9px]', item.alerts.includes('GPS_STALE') ? 'text-red-400/70' : 'text-muted-foreground')}>
            {Number.isFinite(item.gpsAgeMs) ? fmtAge(item.gpsAgeMs) + ' atras' : 'Sem sinal'}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col gap-0.5">
          <span className={cn('text-[10px] font-bold', item.alerts.includes('HB_STALE') ? 'text-red-400' : 'text-white/70')}>
            {fmtTime(item.lastHeartbeatAt)}
          </span>
          <span className={cn('text-[9px]', item.alerts.includes('HB_STALE') ? 'text-red-400/70' : 'text-muted-foreground')}>
            {Number.isFinite(item.hbAgeMs) ? fmtAge(item.hbAgeMs) + ' atras' : 'Sem sinal'}
          </span>
        </div>
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {item.alerts.length === 0 ? (
            <span className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold">
              <CheckCircle2 size={9} /> OK
            </span>
          ) : (
            item.alerts.map(a => {
              const meta = ALERT_META[a];
              return (
                <span key={a} className={cn('text-[7px] font-black uppercase px-1.5 py-0.5 rounded border', SEVERITY_CLASS[meta.severity])}>
                  {meta.label}
                </span>
              );
            })
          )}
        </div>
      </td>

      <td className="px-4 py-3 text-right">
        <div className="flex flex-col items-end gap-1.5">
          <Link href={fichaHref}
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1a1f3a] border border-[#2d3647] rounded-lg text-[9px] font-black uppercase text-white hover:border-primary/40 hover:text-primary transition-all">
            <Activity size={10} /> Ver ficha
          </Link>
          <Link href="/mapa-operacional"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-lg text-[9px] font-black uppercase text-primary hover:bg-primary/20 transition-all">
            <MapPin size={10} /> Ver mapa
          </Link>
        </div>
      </td>
    </tr>
  );
}

// KPI Card
function KpiCard({ label, value, icon, color, sub }: {
  label: string; value: string; icon: React.ReactNode; color: string; sub?: string;
}) {
  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] p-4 rounded-2xl flex flex-col gap-1.5 hover:border-primary/30 transition-all">
      <div className="flex items-center gap-1.5">
        <span className={cn('opacity-70', color)}>{icon}</span>
        <span className="text-[8px] font-black text-muted-foreground uppercase tracking-widest leading-tight">{label}</span>
      </div>
      <span className={cn('text-xl font-black italic tracking-tighter leading-none', color)}>{value}</span>
      {sub && <span className="text-[8px] text-muted-foreground font-bold uppercase truncate">{sub}</span>}
    </div>
  );
}

export default withAuth(PainelOperacionalPage, { module: 'PAINEL' });
