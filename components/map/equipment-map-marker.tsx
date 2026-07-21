"use client";

import React from 'react';
import { renderToString } from 'react-dom/server';
import { EquipmentIcon } from '@/components/icons/equipment-icons';
import {
  resolveIconType,
  resolveMapStatus,
  STATUS_COLORS,
  type EquipmentIconType,
  type EquipmentMapStatus,
} from '@/lib/equipment-icon-types';

type AlertLevel = 'INFO' | 'WARNING' | 'ALARM' | 'HEARTBEAT' | 'OFFLINE' | string;

export interface EquipmentMapMarkerProps {
  iconType?: EquipmentIconType | string | null | undefined;
  status?: EquipmentMapStatus | string | null | undefined;
  heading?: number | null | undefined;
  fleetCode?: string | null | undefined;
  iconSrc?: string | null | undefined;
  iconLabel?: string | null | undefined;
  alertLevel?: AlertLevel | null | undefined;
  selected?: boolean;
  pinSize?: number;
}

function normalizeHeading(heading?: number | null): number {
  if (heading == null || !Number.isFinite(heading)) return 0;
  return ((heading % 360) + 360) % 360;
}

function alertTheme(alertLevel?: AlertLevel | null) {
  const value = String(alertLevel ?? '').toUpperCase();
  if (!value) return null;
  if (value.includes('ALARM') || value.includes('FAIL') || value.includes('OFFLINE')) return { label: '!', ring: '#ef4444', bg: '#7f1d1d' };
  if (value.includes('HEART')) return { label: '•', ring: '#ef4444', bg: '#7f1d1d' };
  if (value.includes('WARN')) return { label: '!', ring: '#f59e0b', bg: '#78350f' };
  return { label: 'i', ring: '#3b82f6', bg: '#1d4ed8' };
}

export const EquipmentMapMarker = React.memo(({
  iconType,
  status,
  heading,
  fleetCode,
  iconSrc,
  iconLabel,
  alertLevel,
  selected = false,
  pinSize = 52,
}: EquipmentMapMarkerProps) => {
  const resolvedIcon = resolveIconType(iconType);
  const resolvedStatus = resolveMapStatus(status);
  const theme = STATUS_COLORS[resolvedStatus];
  const alert = alertTheme(alertLevel);
  const iconSize = Math.round(pinSize * 0.56);
  const imageSize = Math.round(pinSize * 0.7);
  const headingDeg = normalizeHeading(heading);
  const coreSize = Math.round(pinSize * 0.9);
  const fleetLabel = String(fleetCode || '—').toUpperCase();
  const iconSvg = renderToString(<EquipmentIcon type={resolvedIcon} size={iconSize} color="#ffffff" />);

  return (
    <div
      style={{
        width: `${pinSize}px`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        pointerEvents: 'auto',
        filter: selected ? 'drop-shadow(0 0 18px rgba(34,197,94,0.45))' : 'drop-shadow(0 10px 18px rgba(0,0,0,0.45))',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: `${pinSize}px`,
          height: `${pinSize}px`,
          borderRadius: '999px',
          background: `${theme.ring}18`,
          transform: 'scale(1.18)',
          filter: 'blur(10px)',
          opacity: selected ? 0.95 : 0.7,
        }}
      />
      <div
        style={{
          position: 'relative',
          width: `${pinSize}px`,
          height: `${Math.round(pinSize * 1.08)}px`,
          transform: selected ? 'translateY(-1px)' : 'none',
          zIndex: selected ? 10 : 1,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: selected ? '0px' : '4px',
            borderRadius: '18px',
            background: theme.bg,
            boxShadow: selected
              ? `0 0 0 2px ${theme.ring}, 0 0 24px ${theme.ring}55, inset 0 0 0 1px rgba(255,255,255,0.06)`
              : `0 0 0 1.5px ${theme.ring}CC, inset 0 0 0 1px rgba(255,255,255,0.06)`,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: selected ? '6px' : '9px',
            borderRadius: '16px',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
            border: '1px solid rgba(255,255,255,0.04)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: '0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `rotate(${headingDeg}deg)`,
          }}
        >
          <div
            style={{
              width: `${coreSize}px`,
              height: `${coreSize}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '16px',
              background: 'rgba(15,23,42,0.82)',
              border: `1px solid ${theme.ring}55`,
              boxShadow: selected ? `0 0 0 1px ${theme.ring}55, inset 0 0 18px rgba(255,255,255,0.04)` : 'inset 0 0 18px rgba(255,255,255,0.03)',
            }}
          >
            {iconSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={iconSrc}
                alt={iconLabel || resolvedIcon}
                width={imageSize}
                height={imageSize}
                style={{ width: `${imageSize}px`, height: `${imageSize}px`, objectFit: 'contain' }}
                draggable={false}
              />
            ) : (
              <span dangerouslySetInnerHTML={{ __html: iconSvg }} />
            )}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '-5px',
              left: '50%',
              width: 0,
              height: 0,
              borderLeft: '6px solid transparent',
              borderRight: '6px solid transparent',
              borderTop: `9px solid ${theme.ring}`,
              transform: `translateX(-50%) rotate(${headingDeg}deg)`,
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
            }}
          />
        </div>

        {alert && (
          <div
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              minWidth: '16px',
              height: '16px',
              padding: '0 4px',
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: alert.bg,
              color: '#fff',
              fontSize: '10px',
              fontWeight: 900,
              border: '1px solid rgba(255,255,255,0.25)',
              boxShadow: '0 4px 10px rgba(0,0,0,0.35)',
            }}
          >
            {alert.label}
          </div>
        )}
      </div>

      <div
        style={{
          marginTop: '-2px',
          minWidth: '44px',
          maxWidth: '72px',
          padding: '2px 8px 3px',
          borderRadius: '999px',
          border: `1px solid ${theme.ring}55`,
          background: 'rgba(8,13,30,0.94)',
          boxShadow: selected ? `0 0 0 1px ${theme.ring}44, 0 8px 18px rgba(0,0,0,0.45)` : '0 8px 18px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            color: '#fff',
            fontSize: '9px',
            fontWeight: 900,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            textAlign: 'center',
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {fleetLabel}
        </div>
      </div>
    </div>
  );
});

EquipmentMapMarker.displayName = 'EquipmentMapMarker';

export interface MarkerOptions extends EquipmentMapMarkerProps {}

export function createEquipmentMarkerIcon(opts: MarkerOptions) {
  if (typeof window === 'undefined') return undefined;

  const L = require('leaflet');
  const pinSize = opts.pinSize ?? 52;
  const html = renderToString(<EquipmentMapMarker {...opts} pinSize={pinSize} />);

  return L.divIcon({
    className: 'silo-equipment-marker',
    html,
    iconSize: [pinSize, Math.round(pinSize * 1.42)],
    iconAnchor: [pinSize / 2, Math.round(pinSize * 0.92)],
    popupAnchor: [0, -Math.round(pinSize * 0.78)],
  });
}
