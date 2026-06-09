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
    <div className="bg-[#0a0e27]/92 backdrop-blur-xl border border-[#2d3647] rounded-2xl p-3 shadow-2xl min-w-[180px]">
      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-2">
        Legenda — {items.length} equipamentos
      </p>

      {/* Por status */}
      <div className="space-y-1 mb-3">
        <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Status</p>
        {EQUIPMENT_OPERATIONAL_STATUSES.map(st => {
          const count = grouped.statusCounts[st] || 0;
          if (count === 0) return null;
          const c = STATUS_COLORS[st];
          return (
            <div key={st} className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.ring }} />
              <span className="text-[10px] text-white/80 font-bold flex-1">{c.label}</span>
              <span className="text-[10px] font-black text-white/60">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Por tipo (top 6) */}
      <div className="space-y-1 border-t border-[#2d3647] pt-2">
        <p className="text-[8px] font-black text-white/40 uppercase tracking-widest">Tipos</p>
        {Object.entries(grouped.typeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([type, count]) => (
            <div key={type} className="flex items-center gap-2">
              <span className="text-[10px] text-white/80 font-bold flex-1">
                {EQUIPMENT_ICON_LABELS[type as EquipmentIconType] || type}
              </span>
              <span className="text-[10px] font-black text-white/60">{count}</span>
            </div>
          ))
        }
      </div>
    </div>
  );
});

MapLegend.displayName = 'MapLegend';
