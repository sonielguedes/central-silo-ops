"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Activity, AlertTriangle, Clock, LayoutGrid, Maximize2, PanelLeftClose, PanelLeftOpen, Pin, PinOff, RadioTower, Satellite, Wifi, WifiOff } from 'lucide-react';
import { MapLegend } from '@/components/map/equipment-map-legend';
import type { LiveMapItem, MapCounts } from '@/components/mapa/map-filters';
import { withAuth } from '@/components/shared/with-auth';
import { useAuth } from '@/lib/context/auth-context';
import { cn } from '@/lib/utils';

const FullMap = dynamic(
  () => import('@/components/mapa/full-map-enterprise').then((m) => ({ default: m.default })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#050812] text-primary">
        <Activity className="h-12 w-12 animate-pulse" />
      </div>
    ),
  },
);

const EMPTY_COUNTS: MapCounts = { online: 0, operando: 0, parado: 0, offline: 0, staleGps: 0, staleHeartbeat: 0 };

function normalizeStatus(value?: string | null) {
  return String(value ?? '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatAgo(value: Date | null, now: Date) {
  if (!value) return 'aguardando dados';
  const seconds = Math.max(0, Math.floor((now.getTime() - value.getTime()) / 1000));
  if (seconds < 60) return `atualizado ha ${seconds}s`;
  return `atualizado ha ${Math.floor(seconds / 60)}min`;
}

function isCritical(machine: LiveMapItem) {
  const status = normalizeStatus(machine.operationalStatus || machine.status);
  return (
    machine.pos === null ||
    machine.hasRecentGps === false ||
    machine.hasRecentHeartbeat === false ||
    machine.hourmeterInconsistent ||
    status === 'OFFLINE' ||
    status === 'FINALIZADO' ||
    machine.stop?.state === 'PARADA_INCONSISTENTE'
  );
}

function buildTvCounts(items: Array<Record<string, unknown>>): MapCounts {
  const stopped = new Set(['PARADO', 'AGUARDANDO_PARADA', 'PARADA_APONTADA']);
  return items.reduce<MapCounts>((acc, item) => {
    const status = normalizeStatus(String(item.status ?? ''));
    const operationalStatus = normalizeStatus(String(item.operationalStatus ?? item.status ?? ''));
    const isOnline = typeof item.isOnline === 'boolean' ? item.isOnline : status !== 'OFFLINE';
    const hasRecentGps = typeof item.hasRecentGps === 'boolean' ? item.hasRecentGps : Boolean(item.lastGpsAt);
    const hasRecentHeartbeat = typeof item.hasRecentHeartbeat === 'boolean' ? item.hasRecentHeartbeat : Boolean(item.lastHeartbeatAt);

    if (isOnline) acc.online += 1;
    if (!isOnline) acc.offline += 1;
    if (operationalStatus === 'OPERANDO') acc.operando += 1;
    if (stopped.has(operationalStatus)) acc.parado += 1;
    if (!hasRecentGps) acc.staleGps += 1;
    if (!hasRecentHeartbeat) acc.staleHeartbeat += 1;
    return acc;
  }, { ...EMPTY_COUNTS });
}

function TvPage() {
  const searchParams = useSearchParams();
  const view = searchParams.get('view') || 'wall';
  const isMapOnly = view === 'mapa';
  const { userRole } = useAuth();
  const [fleet, setFleet] = React.useState<LiveMapItem[]>([]);
  const [counts, setCounts] = React.useState<MapCounts>(EMPTY_COUNTS);
  const [lastUpdate, setLastUpdate] = React.useState<Date | null>(null);
  const [now, setNow] = React.useState(() => new Date());
  const [error, setError] = React.useState<string | null>(null);
  const [arePanelsOpen, setArePanelsOpen] = React.useState(false);
  const [arePanelsPinned, setArePanelsPinned] = React.useState(false);
  const [isLegendOpen, setIsLegendOpen] = React.useState(false);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const panelsAutoHideRef = React.useRef<number | null>(null);

  const canExitTv = userRole !== 'OPERADOR_APK';

  const clearPanelsAutoHide = React.useCallback(() => {
    if (panelsAutoHideRef.current) window.clearTimeout(panelsAutoHideRef.current);
    panelsAutoHideRef.current = null;
  }, []);

  const schedulePanelsAutoHide = React.useCallback((delay = 10000) => {
    if (arePanelsPinned) return;
    clearPanelsAutoHide();
    panelsAutoHideRef.current = window.setTimeout(() => {
      setArePanelsOpen(false);
      setIsLegendOpen(false);
    }, delay);
  }, [arePanelsPinned, clearPanelsAutoHide]);

  const openPanels = React.useCallback((delay = 10000) => {
    setArePanelsOpen(true);
    setIsLegendOpen(true);
    schedulePanelsAutoHide(delay);
  }, [schedulePanelsAutoHide]);

  React.useEffect(() => () => clearPanelsAutoHide(), [clearPanelsAutoHide]);

  React.useEffect(() => {
    const onFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (!arePanelsPinned) setArePanelsOpen(false);
      setIsLegendOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [arePanelsPinned]);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleFleetUpdate = React.useCallback((data: { fleet: LiveMapItem[]; counts: MapCounts }) => {
    setFleet(data.fleet);
    setCounts(data.counts);
    setLastUpdate(new Date());
    setError(null);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      try {
        const response = await fetch('/api/equipamentos/status', { cache: 'no-store', credentials: 'include' });
        if (!response.ok) throw new Error('status');
        const raw = await response.json();
        if (!cancelled && Array.isArray(raw)) {
          setCounts(buildTvCounts(raw as Array<Record<string, unknown>>));
          setLastUpdate(new Date());
          setError(null);
        }
      } catch {
        if (!cancelled) setError('Falha ao atualizar dados. Tentando novamente...');
      }
    };
    probe();
    const interval = window.setInterval(probe, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const criticalFleet = React.useMemo(() => fleet.filter(isCritical).slice(0, 8), [fleet]);
  const footer = `${fleet.length} frotas monitoradas • ${counts.online} online • ${counts.offline} offline • ${counts.staleHeartbeat} sem heartbeat`;

  const requestFullscreen = React.useCallback(() => {
    if (typeof document === 'undefined') return;
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => null);
      return;
    }
    document.documentElement.requestFullscreen?.().catch(() => null);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#050812] text-white">
      <header className="flex h-[104px] shrink-0 items-center justify-between border-b border-white/10 bg-[#08101f]/95 px-8 shadow-[0_18px_60px_rgba(0,0,0,0.38)]">
        <div>
          <p className="text-[clamp(28px,2.2vw,46px)] font-black uppercase tracking-tight">Sala Operacional <span className="text-primary">SILO</span></p>
          <p className="text-[clamp(16px,1vw,22px)] font-bold uppercase tracking-[0.18em] text-slate-400">Monitoramento agricola em tempo real</p>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="text-[clamp(38px,3vw,60px)] font-black italic leading-none">{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
            <p className="mt-2 text-lg font-bold uppercase tracking-[0.16em] text-slate-400">{now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-full border border-emerald-400/25 bg-emerald-500/10 px-5 py-2 text-base font-black uppercase text-emerald-300">Producao</span>
            <span className={cn("text-sm font-bold uppercase", error ? "text-orange-300" : "text-slate-400")}>{error || formatAgo(lastUpdate, now)}</span>
          </div>
          <button onClick={requestFullscreen} className="flex h-[60px] items-center gap-3 rounded-2xl border border-primary/25 bg-primary/10 px-5 text-base font-black uppercase text-primary hover:bg-primary/20">
            <Maximize2 size={22} /> {isFullscreen ? 'Sair tela cheia' : 'Tela cheia'}
          </button>
          {canExitTv && (
            <Link href="/mapa-operacional" className="flex h-[60px] items-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-base font-black uppercase text-slate-200 hover:bg-white/[0.08]">
              Sair TV
            </Link>
          )}
        </div>
      </header>

      {isMapOnly ? (
        <main className="relative flex-1">
          <FullMap onFleetUpdate={handleFleetUpdate} isTvMode />
          {!isLegendOpen && (
            <button onClick={() => openPanels(10000)} className="absolute left-8 top-8 z-[1500] flex h-16 items-center gap-3 rounded-2xl border border-primary/25 bg-[#08101f]/92 px-5 text-lg font-black uppercase text-primary shadow-2xl backdrop-blur-xl hover:bg-primary/15">
              <LayoutGrid size={26} /> Frotas
            </button>
          )}
          {isLegendOpen && (
            <div className="absolute bottom-8 left-8 z-[1400]" onMouseEnter={clearPanelsAutoHide} onMouseLeave={() => schedulePanelsAutoHide(5000)}>
              <MapLegend isTvMode items={fleet.map((m) => ({ iconType: m.iconType, iconSource: m.iconSource, iconLabel: m.iconLabel, resolvedIconType: m.resolvedIconType, status: m.status, label: m.implementName || m.equipmentModel || m.equipmentType || m.type || m.name }))} />
            </div>
          )}
        </main>
      ) : (
        <main className={cn("relative grid flex-1 overflow-hidden p-5 transition-[grid-template-columns] duration-300", arePanelsOpen ? "grid-cols-[320px_minmax(0,1fr)_390px] gap-5" : "grid-cols-[minmax(0,1fr)] gap-0")}>
          {!arePanelsOpen && (
            <button onClick={() => openPanels(10000)} className="absolute left-8 top-8 z-[1500] flex h-16 items-center gap-3 rounded-2xl border border-primary/25 bg-[#08101f]/92 px-5 text-lg font-black uppercase text-primary shadow-2xl backdrop-blur-xl hover:bg-primary/15">
              <PanelLeftOpen size={26} /> Painéis
            </button>
          )}
          <section
            className={cn("grid grid-rows-6 gap-4 transition-transform duration-300", !arePanelsOpen && "hidden")}
            onMouseEnter={clearPanelsAutoHide}
            onMouseLeave={() => schedulePanelsAutoHide(5000)}
          >
            <TvKpi label="Online" value={counts.online} tone="blue" icon={<Wifi />} />
            <TvKpi label="Operando" value={counts.operando} tone="green" icon={<Activity />} />
            <TvKpi label="Parado" value={counts.parado} tone="orange" icon={<AlertTriangle />} />
            <TvKpi label="Offline" value={counts.offline} tone="gray" icon={<WifiOff />} />
            <TvKpi label="Sem GPS" value={counts.staleGps} tone="amber" icon={<Satellite />} />
            <TvKpi label="Sem heartbeat" value={counts.staleHeartbeat} tone="red" icon={<RadioTower />} />
          </section>

          <section className="relative min-w-0 overflow-hidden rounded-[28px] border border-white/10 bg-[#08101f] shadow-[0_30px_80px_rgba(0,0,0,0.42)]">
            <FullMap onFleetUpdate={handleFleetUpdate} isTvMode />
            {arePanelsOpen && <div className="absolute right-6 top-6 z-[1500] flex gap-2">
              <button onClick={() => setArePanelsPinned((value) => !value)} className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#08101f]/92 text-slate-200 shadow-2xl backdrop-blur-xl hover:border-primary/35 hover:text-primary">
                {arePanelsPinned ? <PinOff size={22} /> : <Pin size={22} />}
              </button>
              <button onClick={() => setArePanelsOpen(false)} className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#08101f]/92 text-slate-200 shadow-2xl backdrop-blur-xl hover:border-primary/35 hover:text-primary">
                <PanelLeftClose size={24} />
              </button>
            </div>}
            {arePanelsOpen && <div className="absolute bottom-6 left-6 z-[1400]" onMouseEnter={clearPanelsAutoHide} onMouseLeave={() => schedulePanelsAutoHide(5000)}>
              <MapLegend isTvMode items={fleet.map((m) => ({ iconType: m.iconType, iconSource: m.iconSource, iconLabel: m.iconLabel, resolvedIconType: m.resolvedIconType, status: m.status, label: m.implementName || m.equipmentModel || m.equipmentType || m.type || m.name }))} />
            </div>}
          </section>

          <aside
            className={cn("flex min-w-0 flex-col gap-5 overflow-hidden transition-transform duration-300", !arePanelsOpen && "hidden")}
            onMouseEnter={clearPanelsAutoHide}
            onMouseLeave={() => schedulePanelsAutoHide(5000)}
          >
            <TvPanel title="Frotas criticas" subtitle="Somente leitura">
              {criticalFleet.length === 0 ? (
                <EmptyState text={fleet.length === 0 ? 'Nenhuma frota ativa no periodo.' : 'Sem criticidade operacional no momento.'} />
              ) : (
                <div className="space-y-3">
                  {criticalFleet.map((machine) => <CriticalItem key={machine.id} machine={machine} />)}
                </div>
              )}
            </TvPanel>
            <TvPanel title="Resumo operacional" subtitle="Tenant ao vivo">
              <div className="grid gap-3 text-lg font-bold text-slate-300">
                <SummaryRow label="Equipamentos" value={fleet.length} />
                <SummaryRow label="Sem posicao GPS" value={counts.staleGps} />
                <SummaryRow label="Sem heartbeat" value={counts.staleHeartbeat} />
                <SummaryRow label="Inconsistencias" value={fleet.filter((m) => m.hourmeterInconsistent || m.stop?.state === 'PARADA_INCONSISTENTE').length} />
              </div>
            </TvPanel>
          </aside>
        </main>
      )}

      <footer className="flex h-14 shrink-0 items-center border-t border-white/10 bg-[#08101f] px-8 text-xl font-black uppercase tracking-[0.08em] text-slate-300">
        <Clock className="mr-3 h-6 w-6 text-primary" /> {footer}
      </footer>
    </div>
  );
}

function TvKpi({ label, value, tone, icon }: { label: string; value: number; tone: 'blue' | 'green' | 'orange' | 'gray' | 'amber' | 'red'; icon: React.ReactNode }) {
  const toneClass = {
    blue: 'text-blue-300 border-blue-400/25 bg-blue-500/10',
    green: 'text-emerald-300 border-emerald-400/25 bg-emerald-500/10',
    orange: 'text-orange-300 border-orange-400/25 bg-orange-500/10',
    gray: 'text-slate-300 border-slate-400/20 bg-slate-500/10',
    amber: 'text-amber-300 border-amber-400/25 bg-amber-500/10',
    red: 'text-red-300 border-red-400/25 bg-red-500/10',
  }[tone];

  return (
    <div className={cn("flex min-h-[120px] items-center justify-between rounded-[26px] border p-5 shadow-[0_18px_50px_rgba(0,0,0,0.28)]", toneClass)}>
      <div>
        <p className="text-lg font-black uppercase tracking-[0.14em] opacity-80">{label}</p>
        <p className="mt-2 text-[clamp(48px,3.4vw,64px)] font-black italic leading-none">{value}</p>
      </div>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-black/20">{icon}</div>
    </div>
  );
}

function TvPanel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="min-h-0 flex-1 overflow-hidden rounded-[28px] border border-white/10 bg-[#08101f]/92 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.34)]">
      <div className="mb-4">
        <h2 className="text-2xl font-black uppercase tracking-tight text-white">{title}</h2>
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">{subtitle}</p>
      </div>
      <div className="max-h-[calc(100%-72px)] overflow-hidden">{children}</div>
    </section>
  );
}

function CriticalItem({ machine }: { machine: LiveMapItem }) {
  const status = normalizeStatus(machine.operationalStatus || machine.status);
  const reason = machine.pos === null ? 'Sem GPS' : machine.hasRecentHeartbeat === false ? 'Sem heartbeat' : machine.hourmeterInconsistent ? 'Horimetro inconsistente' : status;

  return (
    <div className="min-h-[110px] rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-2xl font-black italic text-white">{machine.code}</p>
        <span className="rounded-full border border-red-400/25 bg-red-500/10 px-3 py-1 text-sm font-black uppercase text-red-300">{reason}</span>
      </div>
      <p className="mt-2 truncate text-base font-bold uppercase text-slate-400">{machine.displayOperation || machine.currentOperation || 'Operacao nao informada'}</p>
      <p className="mt-1 truncate text-sm font-bold uppercase text-slate-500">{machine.displayOperator || machine.currentOperator || 'Operador nao informado'}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.035] px-4 py-3">
      <span>{label}</span>
      <span className="text-2xl font-black text-primary">{value}</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.03] text-center text-lg font-bold uppercase text-slate-500">
      {text}
    </div>
  );
}

export default withAuth(TvPage, { module: 'MAPA' });
