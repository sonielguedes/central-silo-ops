"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import {
  Maximize2,
  Filter,
  Map as MapIcon,
} from 'lucide-react';
import type { FleetStatusCounts } from '@/app/api/dashboard/summary/route';

const FullMap = dynamic(() => import('@/components/mapa/full-map-enterprise'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-[#050812] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-primary/10 border-t-primary rounded-full animate-spin"></div>
        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Carregando Mapa...</p>
      </div>
    </div>
  )
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
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-xl overflow-hidden flex flex-col relative min-h-[500px] h-full group shadow-2xl select-none">
      {/* Header Overlay */}
      <div className="p-4 border-b border-[#2d3647]/50 flex items-center justify-between absolute top-0 left-0 right-0 z-[50] bg-[#0a0e27]/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-primary/10 rounded-lg text-primary">
            <MapIcon size={16} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white tracking-tight">Monitoramento Georeferenciado</h3>
            <span className="text-[10px] text-primary flex items-center gap-1 font-medium">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.8)]"></div>
              Fazenda Santa Clara • Frente 03
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-2 bg-[#1a1f3a]/80 rounded-lg hover:bg-primary/20 hover:text-primary transition-all border border-[#2d3647] text-muted-foreground">
            <Filter size={14} />
          </button>
          <button className="p-2 bg-[#1a1f3a]/80 rounded-lg hover:bg-primary/20 hover:text-primary transition-all border border-[#2d3647] text-muted-foreground">
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Leaflet Map */}
      <div className="flex-1 relative bg-[#050812] overflow-hidden">
        <FullMap />
      </div>

      {/* Status Legend Overlay */}
      <div
        className="absolute bottom-5 left-5 z-[40] w-[220px] rounded-2xl border border-slate-600/30 p-4 shadow-2xl backdrop-blur-xl"
        style={{ background: 'rgba(8, 13, 30, 0.88)', boxShadow: '0 16px 40px rgba(0,0,0,0.35)' }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
            Legenda
          </span>
          <span className="rounded-full border border-slate-600/40 bg-slate-900/70 px-2 py-0.5 text-[10px] font-black text-slate-200">
            {resolvedCounts.total} equipamento{resolvedCounts.total === 1 ? '' : 's'}
          </span>
        </div>
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Status</p>
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
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}70` }}
        />
        <span className="truncate text-xs font-bold text-slate-200">{label}</span>
      </div>
      <span className="text-xs font-black text-white">{count}</span>
    </div>
  );
}
