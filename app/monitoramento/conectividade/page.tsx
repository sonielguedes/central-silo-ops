"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import {
  Activity, AlertTriangle, Clock, Database, Download,
  MapPin, MoreVertical, Radio, RefreshCw, Search,
  Signal, Wifi, WifiOff, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';
import type { EquipmentLiveState, EquipmentOperationalStatus } from '@/lib/types';

// ── Types ─────────────────────────────────────────────────────────────────────
type ConnectivityStatus = 'OK' | 'ATENCAO' | 'CRITICO' | 'SEVERO';

interface ConnItem extends EquipmentLiveState {
  connectivityStatus: ConnectivityStatus;
  ageMs: number;
  ageMins: number;
  hasGps: boolean;
  isOffline: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const computeConnStatus = (ageMins: number): ConnectivityStatus => {
  if (ageMins <= 15)  return 'OK';
  if (ageMins <= 60)  return 'ATENCAO';
  if (ageMins <= 180) return 'CRITICO';
  return 'SEVERO';
};

const formatAge = (ms: number): string => {
  if (!Number.isFinite(ms) || ms < 0) return 'N/A';
  const s = Math.floor(ms / 1000);
  if (s < 60)  return s + 's';
  const m = Math.floor(s / 60);
  if (m < 60)  return m + 'min';
  const h = Math.floor(m / 60);
  return h + 'h ' + (m % 60) + 'min';
};

const formatMins = (mins: number): string => {
  if (!Number.isFinite(mins) || mins <= 0) return '0min';
  if (mins < 60) return Math.round(mins) + 'min';
  return (mins / 60).toFixed(1) + 'h';
};

const formatDateTime = (value?: string): string => {
  if (!value) return 'Nao informado';
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return 'Nao informado';
  return t.toLocaleString('pt-BR');
};

const fv = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return 'Nao informado';
  return String(v);
};

const STATUS_STYLE: Record<ConnectivityStatus, string> = {
  OK:      'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
  ATENCAO: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
  CRITICO: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
  SEVERO:  'text-red-500 bg-red-500/10 border-red-500/20',
};

const OP_STATUS_LABEL: Record<EquipmentOperationalStatus, string> = {
  ONLINE:     'Online',
  OPERANDO:   'Operando',
  PARADO:     'Parado',
  FINALIZADO: 'Finalizado',
  OFFLINE:    'Offline',
};

// ── Main Page ─────────────────────────────────────────────────────────────────
function ConectividadePage() {
  const [fleet, setFleet]         = useState<EquipmentLiveState[]>([]);
  const [loading, setLoading]     = useState(true);
  const [fetching, setFetching]   = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'GERAL' | 'SEM_LOCAL' | 'ANALITICA'>('GERAL');
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState<ConnItem | null>(null);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      const res   = await fetch('/api/equipamentos/status', { cache: 'no-store' });
      const data  = res.ok ? await res.json() : [];
      const items = Array.isArray(data) ? (data as EquipmentLiveState[]) : [];
      setFleet(items);
      setLastFetch(new Date());

      const now  = Date.now();
      const conn = items.map(i => deriveConn(i, now));
      const onl  = conn.filter(i => !i.isOffline).length;
      const off  = conn.filter(i => i.isOffline).length;
      const nogps = conn.filter(i => !i.hasGps).length;
      console.info('[connectivity] fetched count=' + items.length);
      console.info('[connectivity] online=' + onl + ' offline=' + off + ' noGps=' + nogps);
    } catch (e) {
      console.error('[connectivity] fetch error', e);
    } finally {
      setFetching(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const deriveConn = (item: EquipmentLiveState, now: number): ConnItem => {
    const lastHb  = item.lastHeartbeatAt ? new Date(item.lastHeartbeatAt).getTime() : 0;
    const lastGps = item.lastGpsAt       ? new Date(item.lastGpsAt).getTime()       : 0;
    const lastSig = Math.max(lastHb, lastGps);
    const ageMs   = lastSig > 0 ? Math.max(0, now - lastSig) : Infinity;
    const ageMins = ageMs / 60000;
    return {
      ...item,
      connectivityStatus: computeConnStatus(ageMins),
      ageMs,
      ageMins,
      hasGps:    Number.isFinite(item.latitude) && Number.isFinite(item.longitude),
      isOffline: item.status === 'OFFLINE' || item.status === 'FINALIZADO',
    };
  };

  const derived = useMemo(() => {
    const now   = Date.now();
    const items = fleet.map(i => deriveConn(i, now));

    const online  = items.filter(i => !i.isOffline);
    const offline = items.filter(i => i.isOffline);
    const noGps   = items.filter(i => !i.hasGps);
    const total   = items.length;

    const minAge = items.reduce((m, i) => Math.min(m, i.ageMs), Infinity);
    const avgOff = offline.length > 0
      ? offline.reduce((s, i) => s + i.ageMins, 0) / offline.length : 0;

    const ok      = items.filter(i => i.connectivityStatus === 'OK').length;
    const atencao = items.filter(i => i.connectivityStatus === 'ATENCAO').length;
    const critico = items.filter(i => i.connectivityStatus === 'CRITICO').length;
    const severo  = items.filter(i => i.connectivityStatus === 'SEVERO').length;

    return { items, online, offline, noGps, total, minAge, avgOff, ok, atencao, critico, severo };
  }, [fleet]);  // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return derived.items.filter(i =>
      i.fleetCode.toLowerCase().includes(q) ||
      (i.operatorName || '').toLowerCase().includes(q) ||
      (i.currentOperator || '').toLowerCase().includes(q)
    );
  }, [derived.items, search]);

  const noGpsFiltered = useMemo(() => derived.noGps.filter(i => {
    const q = search.toLowerCase();
    return i.fleetCode.toLowerCase().includes(q) ||
           (i.operatorName || '').toLowerCase().includes(q);
  }), [derived.noGps, search]);

  const { total, online, offline, noGps, minAge, avgOff, ok, atencao, critico, severo } = derived;

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Conectividade Operacional" description="Saude de Comunicacao Field APK, MQTT e Sensores">
            <div className="flex items-center gap-2">
              {lastFetch && (
                <span className="text-[9px] text-muted-foreground font-bold uppercase">
                  {'Atualizado ' + lastFetch.toLocaleTimeString('pt-BR')}
                </span>
              )}
              <button onClick={fetchData}
                className="p-2.5 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-primary hover:bg-[#252d4a] transition-all">
                <RefreshCw size={20} className={cn(fetching && "animate-spin")} />
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-[#0a0e27] rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-primary/20">
                <Download size={16} /> Exportar CSV
              </button>
            </div>
          </PageHeader>

          {/* KPI Ribbon */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <KpiCard label="Online" value={String(online.length)} icon={<Wifi size={18} className="text-emerald-500" />} />
            <KpiCard label="Offline" value={String(offline.length)} icon={<WifiOff size={18} className="text-red-500" />} />
            <KpiCard label="Ultimo Pacote" value={Number.isFinite(minAge) ? formatAge(minAge) : 'N/A'} icon={<Radio size={18} className="text-blue-500" />} />
            <KpiCard label="Tempo Medio Off" value={offline.length > 0 ? formatMins(avgOff) : '0min'} icon={<Clock size={18} className="text-amber-500" />} />
            <KpiCard label="Sem Localizacao" value={String(noGps.length)} icon={<MapPin size={18} className="text-purple-500" />} />
            <KpiCard label="Falhas de Sync" value="0" icon={<AlertTriangle size={18} className="text-emerald-500" />} />
          </div>

          {/* Tabs */}
          <div className="flex bg-[#0a0e27] border border-[#2d3647] p-1 rounded-2xl mb-8 overflow-x-auto no-scrollbar">
            <TabBtn active={activeTab === 'GERAL'}    onClick={() => setActiveTab('GERAL')}    label="Visao Geral" />
            <TabBtn active={activeTab === 'SEM_LOCAL'} onClick={() => setActiveTab('SEM_LOCAL')} label={'Sem Localizacao (' + noGps.length + ')'} />
            <TabBtn active={activeTab === 'ANALITICA'} onClick={() => setActiveTab('ANALITICA')} label="Tabela Analitica" />
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-96 gap-4 bg-[#0a0e27]/40 border border-[#2d3647] rounded-[40px]">
              <div className="relative flex items-center justify-center">
                <div className="w-20 h-20 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                <Signal size={24} className="text-primary absolute animate-pulse" />
              </div>
              <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.4em] animate-pulse">Escaneando Conectividade...</p>
            </div>
          ) : (
            <div className="animate-in fade-in duration-500">
              {activeTab === 'GERAL' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                  {/* Chart — empty state if no history */}
                  <div className="lg:col-span-8 bg-[#0a0e27]/60 border border-[#2d3647] rounded-[40px] p-8 flex flex-col gap-6 shadow-2xl">
                    <h3 className="text-sm font-black italic uppercase text-white flex items-center gap-2">
                      <Activity size={16} className="text-primary" /> Tendencia de Conectividade (24h)
                    </h3>
                    <div className="h-[300px] flex items-center justify-center bg-[#050812]/30 rounded-2xl border border-[#2d3647]/40">
                      <div className="flex flex-col items-center gap-3 text-center px-8">
                        <Activity size={32} className="text-muted-foreground/30" />
                        <p className="text-[11px] font-black uppercase text-muted-foreground">Historico insuficiente para tendencia 24h</p>
                        <p className="text-[9px] text-muted-foreground/60 max-w-xs">O grafico sera alimentado conforme os APKs enviarem eventos ao longo do tempo. Volte apos 24h de operacao continua.</p>
                      </div>
                    </div>
                  </div>

                  {/* Status por faixa */}
                  <div className="lg:col-span-4 bg-[#0a0e27]/60 border border-[#2d3647] rounded-[40px] p-8 shadow-2xl flex flex-col gap-6">
                    <h3 className="text-sm font-black italic uppercase text-white flex items-center gap-2">
                      <Signal size={16} className="text-primary" /> Status por Faixa
                    </h3>
                    <div className="space-y-4 flex-1">
                      <RangeItem label="0-15 min (OK)"      value={ok}      total={total} color="bg-emerald-500" />
                      <RangeItem label="15-60 min (Atencao)" value={atencao} total={total} color="bg-amber-500" />
                      <RangeItem label="1-3h (Critico)"     value={critico} total={total} color="bg-orange-500" />
                      <RangeItem label="Acima 3h (Severo)"  value={severo}  total={total} color="bg-red-500" />
                    </div>
                    <div className="pt-6 border-t border-[#2d3647] flex justify-between items-center">
                      <span className="text-[10px] font-black text-muted-foreground uppercase">Total monitorado</span>
                      <span className="text-xl font-black italic text-primary">{total}</span>
                    </div>
                  </div>

                  <div className="lg:col-span-12">
                    <ConnTable data={filtered} onSelect={setSelected} onSearch={setSearch} title="Inventario Analitico" />
                  </div>
                </div>
              )}

              {activeTab === 'SEM_LOCAL' && (
                <div>
                  {noGpsFiltered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-[#0a0e27]/40 border border-[#2d3647] rounded-[40px]">
                      <MapPin size={40} className="text-emerald-500 mb-4" />
                      <p className="text-sm font-black uppercase text-white">Todos os equipamentos com GPS valido</p>
                      <p className="text-[10px] text-muted-foreground mt-2">Nenhum equipamento sem latitude/longitude no momento.</p>
                    </div>
                  ) : (
                    <ConnTable data={noGpsFiltered} onSelect={setSelected} onSearch={setSearch} title={'Equipamentos Sem GPS (' + noGpsFiltered.length + ')'} />
                  )}
                </div>
              )}

              {activeTab === 'ANALITICA' && (
                <ConnTable data={filtered} onSelect={setSelected} onSearch={setSearch} title="Inventario Analitico Completo" />
              )}
            </div>
          )}
        </main>
      </div>

      {/* Detail Drawer */}
      {selected && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-xl bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-10 flex flex-col h-full animate-in slide-in-from-right duration-500 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black italic tracking-tighter uppercase text-white leading-none">{selected.fleetCode}</h2>
                <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-1">
                  {fv(selected.type)} &bull; {OP_STATUS_LABEL[selected.status]}
                </p>
              </div>
              <button onClick={() => setSelected(null)} className="p-3 hover:bg-[#1a1f3a] rounded-2xl transition-all text-white">
                <X size={24} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-5 mb-8">
              <DrawerItem label="Status Conectividade" value={selected.connectivityStatus} extra={cn("font-black", STATUS_STYLE[selected.connectivityStatus])} />
              <DrawerItem label="Status Operacional"   value={OP_STATUS_LABEL[selected.status]} />
              <DrawerItem label="Ultimo GPS"           value={formatDateTime(selected.lastGpsAt)} />
              <DrawerItem label="Ultimo Heartbeat"     value={formatDateTime(selected.lastHeartbeatAt)} />
              <DrawerItem label="Operador"             value={fv(selected.currentOperator || selected.operatorName)} />
              <DrawerItem label="Matricula"            value={fv(selected.operatorRegistration || selected.registration)} />
              <DrawerItem label="Operacao"             value={fv(selected.currentOperation || selected.operationName)} />
              <DrawerItem label="Jornada ID"           value={fv(selected.journeyId)} />
              <DrawerItem label="Velocidade"           value={selected.speed != null ? Number(selected.speed).toFixed(1) + ' km/h' : 'Nao informado'} />
              <DrawerItem label="Precisao GPS"         value={selected.accuracy != null ? Number(selected.accuracy).toFixed(1) + ' m' : 'Nao informado'} />
              <DrawerItem label="Horimetro Atual"      value={selected.hourmeterCurrent != null ? selected.hourmeterCurrent + 'h' : (selected.hourmeter != null ? selected.hourmeter + 'h' : 'Nao informado')} />
              <DrawerItem label="Latitude / Longitude"
                value={selected.hasGps ? Number(selected.latitude).toFixed(5) + ' / ' + Number(selected.longitude).toFixed(5) : 'Sem posicao'} />
            </div>

            {!selected.hasGps && (
              <div className="flex items-center gap-2 p-4 bg-orange-500/10 border border-orange-500/30 rounded-2xl mb-6">
                <AlertTriangle size={16} className="text-orange-400 shrink-0" />
                <p className="text-[11px] font-bold text-orange-300">Equipamento sem ultima posicao GPS valida.</p>
              </div>
            )}

            <div className="mt-auto pt-8 border-t border-[#2d3647] flex gap-4">
              <button className="flex-1 py-3.5 bg-[#1a1f3a] border border-[#2d3647] rounded-2xl text-[10px] font-black uppercase hover:bg-[#252d4a] transition-all flex items-center justify-center gap-2">
                <Activity size={16} /> Ver Telemetria
              </button>
              <button className="flex-1 py-3.5 bg-primary text-[#0a0e27] rounded-2xl text-[10px] font-black uppercase hover:scale-105 transition-transform flex items-center justify-center gap-2">
                <Wifi size={16} /> Forcar Sincronizacao
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function KpiCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] p-5 rounded-3xl group hover:border-primary/40 transition-all flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="p-1.5 bg-[#1a1f3a] rounded-lg border border-[#2d3647]">{icon}</div>
        <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">{label}</span>
      </div>
      <span className="text-xl font-black italic tracking-tighter text-white group-hover:text-primary transition-colors">{value}</span>
    </div>
  );
}

function TabBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick}
      className={cn("px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
        active ? "bg-primary text-[#0a0e27] shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-white")}>
      {label}
    </button>
  );
}

function RangeItem({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight">
        <span className="text-white/80">{label}</span>
        <span className="text-white">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-[#1a1f3a] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", color)} style={{ width: pct + '%' }} />
      </div>
    </div>
  );
}

function ConnTable({
  data, onSelect, onSearch, title,
}: {
  data: ConnItem[];
  onSelect: (i: ConnItem) => void;
  onSearch: (s: string) => void;
  title: string;
}) {
  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-[40px] overflow-hidden shadow-2xl flex flex-col">
      <div className="p-8 border-b border-[#2d3647] bg-[#1a1f3a]/10 flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-sm font-black italic tracking-tighter uppercase text-white flex items-center gap-2">
          <Database size={16} className="text-primary" /> {title}
        </h3>
        <div className="relative w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Buscar frota ou operador..."
            onChange={e => onSearch(e.target.value)}
            className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-primary/50 text-white placeholder:text-muted-foreground/40 shadow-inner" />
        </div>
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Database size={32} className="text-muted-foreground/30" />
          <p className="text-[11px] font-black uppercase text-muted-foreground">Nenhum equipamento encontrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#050812]/50 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
              <tr>
                <th className="px-6 py-5">Frota</th>
                <th className="px-6 py-5">Operador / Operacao</th>
                <th className="px-6 py-5">Ultimo Sinal</th>
                <th className="px-6 py-5">GPS</th>
                <th className="px-6 py-5">Status</th>
                <th className="px-6 py-5 text-right">Acoes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3647]/30 text-[11px] font-medium">
              {data.map(item => (
                <tr key={item.equipmentId} onClick={() => onSelect(item)}
                  className="hover:bg-primary/5 transition-colors group cursor-pointer">
                  <td className="px-6 py-5">
                    <div className="flex flex-col">
                      <span className="text-sm font-black italic text-white group-hover:text-primary transition-colors tracking-tighter uppercase">{item.fleetCode}</span>
                      <span className="text-[9px] text-muted-foreground uppercase font-bold">{fv(item.type)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 uppercase font-bold">
                    <p className="text-white/80 text-[10px]">{fv(item.currentOperator || item.operatorName)}</p>
                    <p className="text-[9px] text-muted-foreground">{fv(item.currentOperation || item.operationName)}</p>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-white flex items-center gap-1.5">
                        <Radio size={10} className="text-primary" />
                        {Number.isFinite(item.ageMs) ? formatAge(item.ageMs) + ' atras' : 'Sem sinal'}
                      </span>
                      <span className="text-[9px] text-muted-foreground italic">
                        {item.lastHeartbeatAt ? new Date(item.lastHeartbeatAt).toLocaleTimeString('pt-BR') : 'N/A'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    {item.hasGps ? (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <MapPin size={10} /> Sim
                      </span>
                    ) : (
                      <span className="text-[10px] text-orange-400 flex items-center gap-1">
                        <MapPin size={10} /> Sem GPS
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-5">
                    <span className={cn("px-3 py-1 rounded-full text-[9px] font-black border w-fit inline-block", STATUS_STYLE[item.connectivityStatus])}>
                      {item.connectivityStatus}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <button className="p-2 text-muted-foreground hover:text-white transition-all">
                      <MoreVertical size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function DrawerItem({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">{label}</span>
      <span className={cn("text-xs font-black uppercase text-white", extra)}>{value}</span>
    </div>
  );
}

export default withAuth(ConectividadePage, { module: 'CONECTIVIDADE' });
