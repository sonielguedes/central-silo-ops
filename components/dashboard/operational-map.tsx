"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { Activity, Filter, Layers3, Map as MapIcon, Maximize2 } from 'lucide-react';
import type { FleetStatusCounts } from '@/app/api/dashboard/summary/route';

const FullMap = dynamic(() => import('@/components/mapa/full-map-enterprise'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-[#050812] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Carregando mapa...</p>
      </div>
    </div>
  ),
});

const STATUS_META: Array<{ key: keyof FleetStatusCounts; color: string; label: string }> = [
  { key: 'TRABALHANDO', color: '#10b981', label: 'Trabalhando' },
  { key: 'DESLOCANDO', color: '#fbbf24', label: 'Deslocando' },
  { key: 'PARADA', color: '#f97316', label: 'Parada' },
  { key: 'ALERTA', color: '#ef4444', label: 'Alerta' },
  { key: 'OFFLINE', color: '#6b7280', label: 'Offline' },
];

export function OperationalMap({ totalFleet = 0, counts }: { totalFleet?: number; counts?: FleetStatusCounts }) {
  const resolvedCounts = counts ?? { total: totalFleet, TRABALHANDO: 0, DESLOCANDO: 0, PARADA: 0, ALERTA: 0, OFFLINE: 0 };

  return (
    <div className="relative flex h-full min-h-[380px] flex-col overflow-hidden bg-[#050812] select-none group">
      <div className="absolute left-0 right-0 top-0 z-[50] flex items-center justify-between border-b border-white/6 bg-[#07101f]/85 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-white/8 bg-white/[0.04] p-2 text-sky-300 ring-1 ring-sky-400/15">
            <MapIcon size={16} />
          </div>
          <div>
            <h3 className="font-black text-[13px] text-white tracking-tight uppercase">Monitoramento Georreferenciado</h3>
            <span className="flex items-center gap-1 text-[9px] font-medium uppercase tracking-[0.18em] text-slate-300">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]" />
              Central ao vivo
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
            <Activity size={11} /> Ao vivo
          </span>
          <button className="rounded-xl border border-white/8 bg-white/[0.04] p-2 text-slate-300 transition-all hover:border-sky-400/30 hover:text-white">
            <Filter size={14} />
          </button>
          <button className="rounded-xl border border-white/8 bg-white/[0.04] p-2 text-slate-300 transition-all hover:border-sky-400/30 hover:text-white">
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden bg-[#050812]">
        <FullMap />
      </div>

      <div
        className="absolute bottom-4 left-4 z-[40] w-[210px] rounded-2xl border border-white/8 p-3 shadow-2xl backdrop-blur-xl"
        style={{ background: 'linear-gradient(180deg, rgba(7,16,31,0.96), rgba(5,8,18,0.92))', boxShadow: '0 16px 40px rgba(0,0,0,0.35)' }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-sky-300"><Layers3 size={14} /></span>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-300">Legenda</p>
              <p className="text-[8px] font-semibold uppercase tracking-[0.14em] text-slate-500">Frota real do tenant</p>
            </div>
          </div>
          <span className="rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[9px] font-black text-slate-100">
            {resolvedCounts.total} equipamento{resolvedCounts.total === 1 ? '' : 's'}
          </span>
        </div>
        <div className="space-y-1.5">
          <p className="text-[8px] font-black uppercase tracking-[0.18em] text-slate-500">Status</p>
          {STATUS_META.map((item) => (
            <StatusItem key={item.key} color={item.color} label={item.label} count={resolvedCounts[item.key]} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusItem({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/5"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}70` }}
        />
        <span className="truncate text-[11px] font-bold text-slate-100">{label}</span>
      </div>
      <span className="text-[11px] font-black text-white">{count}</span>
    </div>
  );
}
