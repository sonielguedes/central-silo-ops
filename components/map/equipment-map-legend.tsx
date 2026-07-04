"use client";
/* ─────────────────────────────────────────────────────────────────────────────
 * SILO OPS — Equipment Map Legend
 * Legenda dinâmica do mapa — SSR-safe (sem Leaflet / sem window).
 * ────────────────────────────────────────────────────────────────────────── */

import React, { memo, useMemo } from 'react';
import { Layers3 } from 'lucide-react';
import { EquipmentIcon } from '@/components/icons/equipment-icons';
import {
  type EquipmentIconType,
  STATUS_COLORS,
  EQUIPMENT_ICON_LABELS,
  EQUIPMENT_OPERATIONAL_STATUSES,
  resolveIconType,
  resolveMapStatus,
} from '@/lib/equipment-icon-types';

/* ── MapLegend ──────────────────────────────────────────────────────────── */

interface MapLegendProps {
  items: Array<{ iconType?: string | null; status?: string | null }>;
}

export const MapLegend = memo<MapLegendProps>(({ items }) => {
  const grouped = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};

    items.forEach(item => {
      const st = resolveMapStatus(item.status);
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      const it = resolveIconType(item.iconType);
      typeCounts[it] = (typeCounts[it] || 0) + 1;
    });

    return { statusCounts, typeCounts };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div
      className="w-[240px] sm:w-[268px] rounded-2xl border border-slate-600/30 p-4 shadow-2xl backdrop-blur-xl"
      style={{
        background: 'linear-gradient(180deg, rgba(10,14,39,0.96), rgba(8,13,30,0.88))',
        boxShadow: '0 18px 44px rgba(0,0,0,0.42)',
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers3 size={15} />
          </span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Legenda operacional</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">Frota real sincronizada</p>
          </div>
        </div>
        <span className="rounded-full border border-slate-600/40 bg-slate-900/70 px-2.5 py-1 text-[10px] font-black text-slate-100">
          {items.length} {items.length === 1 ? 'equipamento' : 'equipamentos'}
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Status</p>
        {EQUIPMENT_OPERATIONAL_STATUSES.map(st => {
          const count = grouped.statusCounts[st] || 0;
          if (count === 0) return null;
          const c = STATUS_COLORS[st];
          return (
            <div key={st} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/5"
                  style={{
                    backgroundColor: c.ring,
                    boxShadow: `0 0 10px ${c.ring}80`,
                  }}
                />
                <span className="truncate text-xs font-bold text-slate-100">{c.label}</span>
              </div>
              <span className="text-xs font-black text-white">{count}</span>
            </div>
          );
        })}
      </div>

      <div className="my-3 h-px bg-slate-700/50" />

      <div className="space-y-2">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Tipos</p>
        {Object.entries(grouped.typeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([type, count]) => (
            <div key={type} className="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-100">
                  <EquipmentIcon type={type as EquipmentIconType} size={15} />
                </span>
                <span className="truncate text-xs font-bold text-slate-100">
                  {EQUIPMENT_ICON_LABELS[type as EquipmentIconType] || type}
                </span>
              </div>
              <span className="text-xs font-black text-white">{count}</span>
            </div>
          ))}
      </div>
    </div>
  );
});

MapLegend.displayName = 'MapLegend';
