"use client";
/* ─────────────────────────────────────────────────────────────────────────────
 * SILO OPS — Equipment Map Legend
 * Legenda dinâmica do mapa — SSR-safe (sem Leaflet / sem window).
 * ────────────────────────────────────────────────────────────────────────── */

import React, { memo, useMemo } from 'react';
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
      className="w-[220px] sm:w-[240px] rounded-2xl border border-slate-600/30 p-4 shadow-2xl backdrop-blur-xl"
      style={{
        background: 'rgba(8, 13, 30, 0.88)',
        boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
      }}
    >
      {/* Cabeçalho */}
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
          Legenda
        </span>
        <span className="rounded-full border border-slate-600/40 bg-slate-900/70 px-2 py-0.5 text-[10px] font-black text-slate-200">
          {items.length} {items.length === 1 ? 'equipamento' : 'equipamentos'}
        </span>
      </div>

      {/* Por status */}
      <div className="space-y-2">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Status</p>
        {EQUIPMENT_OPERATIONAL_STATUSES.map(st => {
          const count = grouped.statusCounts[st] || 0;
          if (count === 0) return null;
          const c = STATUS_COLORS[st];
          return (
            <div key={st} className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: c.ring,
                    boxShadow: `0 0 8px ${c.ring}70`,
                  }}
                />
                <span className="truncate text-xs font-bold text-slate-200">{c.label}</span>
              </div>
              <span className="text-xs font-black text-white">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Separador */}
      <div className="my-3 h-px bg-slate-700/50" />

      {/* Por tipo (top 6) */}
      <div className="space-y-2">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Tipos</p>
        {Object.entries(grouped.typeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([type, count]) => (
            <div key={type} className="flex items-center justify-between gap-4">
              <span className="truncate text-xs font-bold text-slate-200">
                {EQUIPMENT_ICON_LABELS[type as EquipmentIconType] || type}
              </span>
              <span className="text-xs font-black text-white">{count}</span>
            </div>
          ))}
      </div>
    </div>
  );
});

MapLegend.displayName = 'MapLegend';
