"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import {
  Maximize2,
  Filter,
  Map as MapIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

export function OperationalMap() {
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
      <div className="absolute bottom-6 left-6 bg-[#0a0e27]/90 backdrop-blur-xl border border-[#2d3647] p-4 rounded-xl space-y-2.5 z-[40] shadow-2xl">
        <StatusItem color="bg-emerald-500" label="Trabalhando" count={12} />
        <StatusItem color="bg-amber-500" label="Deslocando" count={5} />
        <StatusItem color="bg-orange-500" label="Parada" count={3} />
        <StatusItem color="bg-red-500" label="Alerta" count={2} />
        <StatusItem color="bg-gray-500" label="Offline" count={15} />
      </div>
    </div>
  );
}

function StatusItem({ color, label, count }: { color: string, label: string, count: number }) {
  return (
    <div className="flex items-center justify-between gap-8">
      <div className="flex items-center gap-3">
        <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)]", color)}></div>
        <span className="text-[10px] text-muted-foreground font-black uppercase tracking-tighter">{label}</span>
      </div>
      <span className="text-[10px] font-black text-white/40">{count}</span>
    </div>
  );
}
