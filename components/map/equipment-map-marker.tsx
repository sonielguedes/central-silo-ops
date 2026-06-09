"use client";
/* ─────────────────────────────────────────────────────────────────────────────
 * SILO OPS — Equipment Map Marker
 * Cria L.divIcon com SVG do equipamento + anel de status colorido.
 * Leaflet é carregado apenas no client (guarded por typeof window).
 * ────────────────────────────────────────────────────────────────────────── */

import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  type EquipmentIconType,
  type EquipmentMapStatus,
  STATUS_COLORS,
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
 *
 * Retorna undefined se chamado no servidor (SSR-safe).
 */
export function createEquipmentMarkerIcon(opts: MarkerOptions) {
  if (typeof window === 'undefined') return undefined;

  const L = require('leaflet');

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
