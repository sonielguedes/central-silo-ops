"use client";
/* ─────────────────────────────────────────────────────────────────────────────
 * SILO OPS — Equipment Map Legend
 * Legenda dinâmica do mapa — SSR-safe (sem Leaflet / sem window).
 * ────────────────────────────────────────────────────────────────────────── */

import React, { memo, useMemo } from 'react';
import { Layers3 } from 'lucide-react';
import {
  type EquipmentIconType,
  STATUS_COLORS,
  EQUIPMENT_ICON_LABELS,
  EQUIPMENT_OPERATIONAL_STATUSES,
  resolveIconType,
  resolveMapStatus,
} from '@/lib/equipment-icon-types';
import { resolveEquipmentIcon } from '@/lib/equipment-icon-resolver';

/* ── MapLegend ──────────────────────────────────────────────────────────── */

interface MapLegendProps {
  items: Array<{ iconType?: string | null; iconSource?: string | null; iconLabel?: string | null; resolvedIconType?: string | null; status?: string | null; label?: string | null }>;
  isTvMode?: boolean;
}

export const MapLegend = memo<MapLegendProps>(({ items, isTvMode = false }) => {
  const grouped = useMemo(() => {
    const statusCounts: Record<string, number> = {};
    const typeCounts: Record<string, { iconType: EquipmentIconType; iconSource: string; iconLabel: string; count: number }> = {};

    items.forEach(item => {
      const st = resolveMapStatus(item.status);
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      const it = resolveIconType(item.iconType);
      const operationalIcon = item.iconSource
        ? { src: item.iconSource, label: item.iconLabel || item.label?.trim() || EQUIPMENT_ICON_LABELS[it] || it }
        : resolveEquipmentIcon({ type: item.resolvedIconType || item.iconType, status: item.status });
      const label = item.iconLabel || item.label?.trim() || operationalIcon.label || EQUIPMENT_ICON_LABELS[it] || it;
      const current = typeCounts[label];
      typeCounts[label] = current
        ? { iconType: current.iconType, iconSource: current.iconSource, iconLabel: current.iconLabel, count: current.count + 1 }
        : { iconType: it, iconSource: operationalIcon.src, iconLabel: operationalIcon.label, count: 1 };
    });

    return { statusCounts, typeCounts };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div
      className={isTvMode
        ? "w-[420px] rounded-[22px] border border-slate-500/40 p-5 shadow-2xl backdrop-blur-xl"
        : "w-[240px] sm:w-[268px] rounded-2xl border border-slate-600/30 p-4 shadow-2xl backdrop-blur-xl"}
      style={{
        background: 'linear-gradient(180deg, rgba(10,14,39,0.96), rgba(8,13,30,0.88))',
        boxShadow: '0 18px 44px rgba(0,0,0,0.42)',
      }}
    >
      <div className="mb-3 flex items-start gap-3">
        <div className="flex items-center gap-2">
          <span className={isTvMode ? "flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary" : "flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary"}>
            <Layers3 size={isTvMode ? 22 : 15} />
          </span>
          <div>
            <p className={isTvMode ? "text-lg font-black uppercase tracking-[0.12em] text-slate-300" : "text-[10px] font-black uppercase tracking-[0.2em] text-slate-400"}>Legenda operacional</p>
            <p className={isTvMode ? "text-sm font-semibold uppercase tracking-[0.1em] text-slate-500" : "text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500"}>Frota real sincronizada</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className={isTvMode ? "text-sm font-black uppercase tracking-[0.14em] text-slate-500" : "text-[9px] font-black uppercase tracking-[0.18em] text-slate-500"}>Status</p>
        {EQUIPMENT_OPERATIONAL_STATUSES.map(st => {
          const count = grouped.statusCounts[st] || 0;
          if (count === 0) return null;
          const c = STATUS_COLORS[st];
          return (
            <div key={st} className={isTvMode ? "flex min-h-[54px] items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3" : "flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2"}>
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={isTvMode ? "h-4 w-4 shrink-0 rounded-full ring-2 ring-white/5" : "h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/5"}
                  style={{
                    backgroundColor: c.ring,
                    boxShadow: `0 0 10px ${c.ring}80`,
                  }}
                />
                <span className={isTvMode ? "truncate text-base font-bold text-slate-100" : "truncate text-xs font-bold text-slate-100"}>{c.label}</span>
              </div>
              <span className={isTvMode ? "text-lg font-black text-white" : "text-xs font-black text-white"}>{count}</span>
            </div>
          );
        })}
      </div>

      <div className="my-3 h-px bg-slate-700/50" />

      <div className="space-y-2">
        <p className={isTvMode ? "text-sm font-black uppercase tracking-[0.14em] text-slate-500" : "text-[9px] font-black uppercase tracking-[0.18em] text-slate-500"}>Tipos</p>
        {Object.entries(grouped.typeCounts)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 6)
          .map(([label, meta]) => (
            <div key={label} className={isTvMode ? "flex min-h-[54px] items-center justify-between gap-4 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3" : "flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-white/[0.03] px-2.5 py-2"}>
              <div className="flex min-w-0 items-center gap-2">
                <span className={isTvMode ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-slate-100" : "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-slate-100"}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={meta.iconSource} alt={meta.iconLabel} className={isTvMode ? "h-8 w-8 object-contain" : "h-5 w-5 object-contain"} draggable={false} />
                </span>
                <span className={isTvMode ? "truncate text-base font-bold text-slate-100" : "truncate text-xs font-bold text-slate-100"}>
                  {label}
                </span>
              </div>
              <span className={isTvMode ? "text-lg font-black text-white" : "text-xs font-black text-white"}>{meta.count}</span>
            </div>
          ))}
      </div>
    </div>
  );
});

MapLegend.displayName = 'MapLegend';
