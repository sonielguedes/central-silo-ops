"use client";
/* ─────────────────────────────────────────────────────────────────────────────
 * SILO OPS — Equipment Map Marker
 * Cria L.divIcon com SVG do equipamento + anel de status colorido.
 * Também exporta MapLegend para legenda dinâmica no mapa.
 * ────────────────────────────────────────────────────────────────────────── */

import React, { memo, useMemo } from 'react';
import L from 'leaflet';
import { renderToString } from 'react-dom/server';
import {
  type EquipmentIconType,
  type EquipmentMapStatus,
  STATUS_COLORS,
  EQUIPMENT_ICON_LABELS,
  EQUIPMENT_OPERATIONAL_STATUSES,
  resolveIconType,
  resolveMapStatus,
} from '@/lib/equipment-icon-types';
import { ICON_MAP } from '@/components/icons/equipment-icons';

/* ── createEquipmentMarkerIcon ──────────────────────────────────────────── */

export interface MarkerOptions {
  iconType: EquipmentIconType | string | null | undefined;
  status: EquipmentMapStatus | string | null | undefined;
  label?: string;
  /** tamanho do pin (default 48) */
  pinSize?: number;
}

/**
 * Cria um L.DivIcon com SVG inline do equipamento dentro de um pin
 * com anel colorido pelo status operacional.
 */
export function createEquipmentMarkerIcon(opts: MarkerOptions): L.DivIcon {
  const resolved = resolveIconType(opts.iconType);
  const mapStatus = resolveMapStatus(opts.status as string);
  const colors = STATUS_COLORS[mapStatus];
  const ps = opts.pinSize || 48;
  const iconSvgSize = Math.round(ps * 0.45);
  const label = opts.label || '';

  const IconComponent = ICON_MAP[resolved];
  const iconSvg = renderToString(
    <IconComponent size={iconSvgSize} color="white" />
  );

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto">
      <div style="position:relative;width:${ps}px;height:${Math.round(ps * 1.17)}px;display:flex;align-items:center;justify-content:center">
        <svg width="${ps}" height="${Math.round(ps * 1.17)}" viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 56C24 56 48 36.4 48 24C48 10.7452 37.2548 0 24 0C10.7452 0 0 10.7452 0 24C0 36.4 24 56 24 56Z" fill="${colors.bg}"/>
          <circle cx="24" cy="24" r="21" fill="black" fill-opacity="0.15"/>
          <circle cx="24" cy="24" r="20" stroke="${colors.ring}" stroke-width="2.5" stroke-opacity="0.9"/>
        </svg>
        <div style="position:absolute;top:${Math.round(ps * 0.2)}px;left:50%;transform:translateX(-50%);display:flex;align-items:center;justify-content:center">
          ${iconSvg}
        </div>
      </div>
      ${label ? `<div style="margin-top:-6px;background:rgba(10,14,39,0.92);backdrop-filter:blur(4px);padding:1px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.15);box-shadow:0 2px 8px rgba(0,0,0,0.4);z-index:20;position:relative">
        <span style="font-size:9px;font-weight:900;color:white;font-style:italic;letter-spacing:-0.5px;text-transform:uppercase;white-space:nowrap">${label}</span>
      </div>` : ''}
    </div>
  `;

  return L.divIcon({
    className: 'silo-equipment-marker',
    html,
    iconSize: [ps, Math.round(ps * 1.4)],
    iconAnchor: [ps / 2, Math.round(ps * 1.17)],
    popupAnchor: [0, -Math.round(ps * 0.9)],
  });
}

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
