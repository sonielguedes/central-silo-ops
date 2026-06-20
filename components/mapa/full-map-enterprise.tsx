"use client";
/* ───────────────────────────────────────────────────────────────────────────────
 * SILO OPS — Full Map Enterprise (C4.7)
 * Mapa operacional avançado com rastro por jornada, popup completo,
 * ficha operador, filtros e auto-refresh 30s.
 * ─────────────────────────────────────────────────────────────────────────────── */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  LayersControl, MapContainer, Marker, Polygon, Polyline,
  Popup, TileLayer, ZoomControl, useMap, CircleMarker,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Activity, AlertTriangle, CheckCircle2, Clock, ClipboardCopy,
  Crosshair, FileText, Gauge, Hash, Loader2,
  MapPin, Navigation, PauseCircle, Route, User, Zap, X as XIcon,
} from 'lucide-react';

import { EquipmentLiveState, EquipmentOperationalStatus, TrailPoint } from '@/lib/types';
import { createEquipmentMarkerIcon } from '@/components/map/equipment-map-marker';
import { resolveIconType } from '@/lib/equipment-icon-types';
import type { FichaOperador } from '@/lib/operator-sheet-builder';
import {
  applyFilters,
  EMPTY_FILTERS,
  type LiveMapItem,
  type MapCounts,
  type MapFilters,
  type ResolvedStopForMap,
} from '@/components/mapa/map-filters';

export type { LiveMapItem, MapCounts, MapFilters };
export { EMPTY_FILTERS, applyFilters };

/* ── Constants ───────────────────────────────────────────────────────────────────── */

const LEAFLET_CSS = (
  '.leaflet-container{background:#050812!important}' +
  '.silo-enterprise-popup .leaflet-popup-content-wrapper{background:transparent!important;padding:0!important;box-shadow:none!important;border:none!important}' +
  '.silo-enterprise-popup .leaflet-popup-content{margin:0!important}' +
  '.silo-enterprise-popup .leaflet-popup-tip{background:#0a0e27!important;border:1px solid #2d3647!important}' +
  '.silo-enterprise-popup .leaflet-popup-tip-container{display:none}' +
  '.leaflet-popup-close-button{color:#6b7280!important;padding:10px!important;z-index:100}'
);

const GPS_RECENT_MS       = 15 * 60 * 1000;
const HEARTBEAT_RECENT_MS =  3 * 60 * 1000;
const GPS_ALERT_MS        =      120 * 1000;
const HB_ALERT_MS         =      120 * 1000;
const GPS_FRESH_MS        =       60 * 1000;
const REFRESH_INTERVAL_MS =  30 * 1000;
const NOT_INFORMED        = 'Nao informado';

const STATUS_CONFIG: Record<
  Lowercase<EquipmentOperationalStatus>,
  { label: string; color: string; tailwind: string; text: string }
> = {
  online:     { label: 'Online',     color: '#3b82f6', tailwind: 'bg-blue-500',    text: 'text-blue-500'    },
  operando:   { label: 'Operando',   color: '#10b981', tailwind: 'bg-emerald-500', text: 'text-emerald-500' },
  parado:     { label: 'Parado',     color: '#f97316', tailwind: 'bg-orange-500',  text: 'text-orange-500'  },
  finalizado: { label: 'Finalizado', color: '#6b7280', tailwind: 'bg-gray-500',    text: 'text-gray-500'    },
  offline:    { label: 'Offline',    color: '#6b7280', tailwind: 'bg-gray-500',    text: 'text-gray-500'    },
};

type TrailState = { fleetCode: string; journeyId: string; points: TrailPoint[] } | null;

/* ── Leaflet icons ─────────────────────────────────────────────────────────────────── */

const DefaultIcon = L.icon({
  iconUrl:    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:   [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const trailStartIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#10b981;border:3px solid white;border-radius:50%;box-shadow:0 0 10px rgba(16,185,129,0.9)"></div>',
  iconSize: [16, 16], iconAnchor: [8, 8],
});
const trailEndIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 0 10px rgba(239,68,68,0.9)"></div>',
  iconSize: [16, 16], iconAnchor: [8, 8],
});

/* ── Util helpers ──────────────────────────────────────────────────────────────────── */

/**
 * Returns true only when the item contains geographically valid GPS coordinates.
 * Rejects: undefined/NaN, 0,0 (null island), out-of-range values.
 */
const hasValidPosition = (
  item: EquipmentLiveState
): item is EquipmentLiveState & { latitude: number; longitude: number } => {
  const lat = item.latitude;
  const lng = item.longitude;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if ((lat as number) <= -90  || (lat as number) >= 90)  return false;
  if ((lng as number) <= -180 || (lng as number) >= 180) return false;
  return true;
};

const isRecent = (value: string | undefined, thresholdMs: number) => {
  if (!value) return false;
  const t = new Date(value).getTime();
  return Number.isFinite(t) && Date.now() - t <= thresholdMs;
};

const ageMs = (value?: string): number => {
  if (!value) return Infinity;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? Math.max(0, Date.now() - t) : Infinity;
};

const formatAge = (ms: number): string => {
  if (!Number.isFinite(ms)) return '';
  const s = Math.floor(ms / 1000);
  if (s < 60) return 'ha ' + s + 's';
  const m = Math.floor(s / 60);
  if (m < 60) return 'ha ' + m + 'min';
  return 'ha ' + Math.floor(m / 60) + 'h';
};

const formatDateTime = (value?: string): string => {
  if (!value) return NOT_INFORMED;
  const t = new Date(value);
  if (Number.isNaN(t.getTime())) return NOT_INFORMED;
  return t.toLocaleString('pt-BR');
};

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined || value === '') return NOT_INFORMED;
  return String(value);
};

const formatSpeed     = (v?: number): string => v == null ? NOT_INFORMED : Number(v).toFixed(1) + ' km/h';
const formatAccuracy  = (v?: number): string => v == null ? NOT_INFORMED : Number(v).toFixed(1) + ' m';
const formatHourmeter = (v?: number): string => v == null ? NOT_INFORMED : v + 'h';

const getTypeIcon = (type?: string): LiveMapItem['typeIcon'] => {
  const n = (type || '').toUpperCase();
  if (n.includes('TRATOR') || n.includes('COLH')) return 'Tractor';
  if (n.includes('CAM')    || n.includes('TRUCK')) return 'Truck';
  if (n.includes('CARREG') || n.includes('PA '))   return 'Zap';
  return 'Navigation';
};

const getStatus = (status: EquipmentOperationalStatus) =>
  STATUS_CONFIG[status.toLowerCase() as Lowercase<EquipmentOperationalStatus>] || STATUS_CONFIG.offline;

const normalizeLiveItem = (item: EquipmentLiveState): LiveMapItem => ({
  ...item,
  id:               item.equipmentId,
  code:             item.fleetCode || item.equipmentId,
  pos:              hasValidPosition(item) ? [item.latitude, item.longitude] : null,
  typeIcon:         getTypeIcon(item.type),
  iconType:         (item as unknown as Record<string, string>).iconType || resolveIconType(item.type),
  displayOperator:  formatValue(item.currentOperator || item.operatorName),
  displayOperation: formatValue(item.currentOperation || item.operationName),
});

export const buildLiveMapCounts = (items: EquipmentLiveState[]): MapCounts => ({
  online:         items.filter(i => i.status === 'ONLINE').length,
  operando:       items.filter(i => i.status === 'OPERANDO').length,
  parado:         items.filter(i => i.status === 'PARADO').length,
  offline:        items.filter(i => i.status === 'OFFLINE' || i.status === 'FINALIZADO').length,
  staleGps:       items.filter(i => !isRecent(i.lastGpsAt, GPS_RECENT_MS)).length,
  staleHeartbeat: items.filter(i => !isRecent(i.lastHeartbeatAt, HEARTBEAT_RECENT_MS)).length,
});

/* ── Direction arrows for trail ───────────────────────────────────────────────────────────────── */

function computeArrowPositions(
  positions: [number, number][],
  every: number = 8,
): Array<{ pos: [number, number]; angle: number }> {
  const arrows: Array<{ pos: [number, number]; angle: number }> = [];
  for (let i = every; i < positions.length; i += every) {
    const prev = positions[i - 1];
    const curr = positions[i];
    const angle = (Math.atan2(curr[1] - prev[1], curr[0] - prev[0]) * 180) / Math.PI;
    arrows.push({ pos: curr, angle });
  }
  return arrows;
}

/* ── Map sub-controllers ─────────────────────────────────────────────────────────────────── */

function MapController({
  selectedId,
  fleet,
  markerRefs,
}: {
  selectedId: string | null | undefined;
  fleet: LiveMapItem[];
  markerRefs: React.MutableRefObject<Record<string, L.Marker>>;
}) {
  const map = useMap();
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedId || selectedId === prevId.current) return;
    prevId.current = selectedId;
    const machine = fleet.find(m => m.id === selectedId);
    if (!machine?.pos) return;
    map.flyTo(machine.pos, 17, { animate: true, duration: 0.8 });
    const open = () => {
      const mk = markerRefs.current[selectedId];
      if (mk) mk.openPopup();
    };
    map.once('moveend', open);
    return () => { map.off('moveend', open); };
  }, [selectedId, fleet, map, markerRefs]);

  return null;
}

function TrailBoundsController({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length < 2) return;
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [80, 80], maxZoom: 17, animate: true });
  }, [points, map]);
  return null;
}

function FlyToController({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo(target, 17, { animate: true, duration: 0.8 });
  }, [target, map]);
  return null;
}

/* ── Trail arrow markers (SVG rotated) ──────────────────────────────────────────────────────────── */

function TrailArrows({ positions }: { positions: [number, number][] }) {
  const arrows = useMemo(() => computeArrowPositions(positions, 8), [positions]);
  return (
    <>
      {arrows.map((a, i) => (
        <Marker key={i} position={a.pos} icon={L.divIcon({
          className: '',
          html: `<div style="transform:rotate(${a.angle - 90}deg);width:14px;height:14px;display:flex;align-items:center;justify-content:center">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 0L12 10H0L6 0Z" fill="#3b82f6" fill-opacity="0.9"/></svg>
          </div>`,
          iconSize: [14, 14], iconAnchor: [7, 7],
        })} />
      ))}
    </>
  );
}

/* ── Trail waypoints (light dots every N points) ─────────────────────────────────────────────────────────── */

function TrailWaypoints({ positions }: { positions: [number, number][] }) {
  const waypoints = useMemo(() => {
    const pts: [number, number][] = [];
    for (let i = 3; i < positions.length - 1; i += 4) {
      pts.push(positions[i]);
    }
    return pts;
  }, [positions]);

  return (
    <>
      {waypoints.map((p, i) => (
        <CircleMarker key={i} center={p} radius={2.5}
          pathOptions={{ color: '#3b82f6', fillColor: '#93c5fd', fillOpacity: 0.7, weight: 1 }} />
      ))}
    </>
  );
}

/* ── Ficha panel ────────────────────────────────────────────────────────────────────────────────── */

function FichaPanel({
  fleetCode,
  journeyId,
  onClose,
}: {
  fleetCode: string;
  journeyId: string | null;
  onClose: () => void;
}) {
  const [ficha, setFicha]     = useState<FichaOperador | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({ fleetCode });
    if (journeyId) params.set('journeyId', journeyId);

    fetch('/api/ficha-operador?' + params.toString(), { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('Erro ' + res.status);
        return res.json();
      })
      .then((data) => { if (!cancelled) setFicha(data); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [fleetCode, journeyId]);

  return (
    <div className="absolute inset-y-0 right-0 w-[380px] max-w-full bg-[#0a0e27]/98 backdrop-blur-xl border-l border-[#2d3647] z-[1600] flex flex-col shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#2d3647]">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-primary" />
          <span className="text-xs font-black uppercase tracking-wider text-white">Ficha Operador</span>
          <span className="text-[9px] font-bold text-muted-foreground uppercase">{fleetCode}</span>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-[#1a1f3a] rounded-lg text-muted-foreground hover:text-white transition-colors">
          <XIcon size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4">
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="animate-spin text-primary" size={28} />
            <span className="text-[10px] text-muted-foreground font-bold uppercase">Carregando ficha...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <AlertTriangle className="text-orange-400" size={28} />
            <span className="text-[10px] text-orange-300 font-bold uppercase">{error}</span>
          </div>
        )}

        {!loading && !error && ficha && (
          <div className="space-y-4">
            {/* Status badge */}
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Status da Ficha</span>
              <span className={'text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ' + (
                ficha.status === 'INCONSISTENTE'
                  ? 'text-red-400 border-red-500/30 bg-red-500/10'
                  : ficha.status === 'FINALIZADO'
                    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                    : 'text-blue-400 border-blue-500/30 bg-blue-500/10'
              )}>{ficha.status}</span>
            </div>

            <FichaSection label="Identificacao">
              <FichaRow label="Frota" value={ficha.fleetCode} />
              <FichaRow label="Equipment ID" value={ficha.equipmentId} />
              <FichaRow label="Jornada" value={ficha.journeyId} />
            </FichaSection>

            <FichaSection label="Operador">
              <FichaRow label="Nome" value={ficha.operatorName} />
              <FichaRow label="Matricula" value={ficha.operatorRegistration} />
            </FichaSection>

            <FichaSection label="Operacao">
              <FichaRow label="Operacao" value={ficha.operationName} />
              <FichaRow label="Codigo" value={ficha.operationCode} />
              <FichaRow label="Implemento" value={ficha.implementName || ficha.implementCode} />
            </FichaSection>

            <FichaSection label="Horimetro">
              <div className="grid grid-cols-3 gap-2">
                <FichaBox label="Inicial" value={ficha.hourmeterStart != null ? ficha.hourmeterStart + 'h' : null} />
                <FichaBox label="Final" value={ficha.hourmeterEnd != null ? ficha.hourmeterEnd + 'h' : null} />
                <FichaBox label="Total" value={ficha.totalHourmeter != null ? ficha.totalHourmeter + 'h' : null} />
              </div>
            </FichaSection>

            <FichaSection label="Periodo">
              <FichaRow label="Inicio" value={ficha.startedAt ? new Date(ficha.startedAt).toLocaleString('pt-BR') : null} />
              <FichaRow label="Fim" value={ficha.endedAt ? new Date(ficha.endedAt).toLocaleString('pt-BR') : null} />
            </FichaSection>

            <FichaSection label="Rastro">
              <FichaRow label="Pontos" value={String(ficha.trailSummary.points)} />
              <FichaRow label="Distancia" value={ficha.trailSummary.distanceKm.toFixed(2) + ' km'} />
              <FichaRow label="Primeiro GPS" value={ficha.trailSummary.firstGpsAt ? new Date(ficha.trailSummary.firstGpsAt).toLocaleString('pt-BR') : null} />
              <FichaRow label="Ultimo GPS" value={ficha.trailSummary.lastGpsAt ? new Date(ficha.trailSummary.lastGpsAt).toLocaleString('pt-BR') : null} />
            </FichaSection>

            {ficha.stops.length > 0 && (
              <FichaSection label={'Paradas (' + ficha.stops.length + ')'}>
                {ficha.stops.map((s, i) => (
                  <div key={i} className="bg-[#1a1f3a]/30 border border-[#2d3647] rounded-lg p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-white uppercase">{s.code}</span>
                      <span className="text-[9px] text-muted-foreground font-bold">
                        {new Date(s.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        {s.endedAt && (' → ' + new Date(s.endedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))}
                      </span>
                    </div>
                    <p className="text-[10px] text-white/70 font-medium">{s.description}</p>
                  </div>
                ))}
              </FichaSection>
            )}

            {ficha.inconsistencies.length > 0 && (
              <FichaSection label="Inconsistencias">
                {ficha.inconsistencies.map((inc, i) => (
                  <div key={i} className="flex items-start gap-2 text-[10px] text-orange-300 font-bold">
                    <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                    <span>{inc}</span>
                  </div>
                ))}
              </FichaSection>
            )}
          </div>
        )}

        {!loading && !error && !ficha && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <FileText className="text-muted-foreground" size={28} />
            <span className="text-[10px] text-muted-foreground font-bold uppercase">Nenhuma ficha encontrada</span>
          </div>
        )}
      </div>
    </div>
  );
}

function FichaSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 flex items-center gap-2">
        <span>{label}</span>
        <div className="flex-1 h-px bg-[#2d3647]/60" />
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function FichaRow({ label, value }: { label: string; value: string | null | undefined }) {
  const v = value || NOT_INFORMED;
  const isNI = v === NOT_INFORMED;
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground font-bold uppercase">{label}</span>
      <span className={'text-[10px] font-bold uppercase ' + (isNI ? 'text-muted-foreground/40 italic' : 'text-white')}>{v}</span>
    </div>
  );
}

function FichaBox({ label, value }: { label: string; value: string | null | undefined }) {
  const v = value || NOT_INFORMED;
  const isNI = v === NOT_INFORMED;
  return (
    <div className="bg-[#1a1f3a]/30 border border-[#2d3647] rounded-lg p-2 flex flex-col items-center">
      <span className="text-[8px] text-muted-foreground font-black uppercase tracking-wider mb-1">{label}</span>
      <span className={'text-sm font-black italic tracking-tighter ' + (isNI ? 'text-muted-foreground/40' : 'text-white')}>{v}</span>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────────────────────────────── */

export default function FullMapEnterprise({
  onFleetUpdate,
  selectedId,
  filters,
}: {
  onFleetUpdate?: (data: { fleet: LiveMapItem[]; counts: MapCounts }) => void;
  selectedId?: string | null;
  filters?: MapFilters;
}) {
  const [allFleet, setAllFleet]     = useState<LiveMapItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [trail, setTrail]           = useState<TrailState>(null);
  const [trailLoading, setTrailLoading] = useState(false);
  const [fichaTarget, setFichaTarget]   = useState<{ fleetCode: string; journeyId: string | null } | null>(null);
  const [flyTarget, setFlyTarget]       = useState<[number, number] | null>(null);
  const [copiedId, setCopiedId]         = useState<string | null>(null);

  const farmCenter: [number, number]    = [-12.5568, -55.7229];
  const markerRefs = useRef<Record<string, L.Marker>>({});

  // Apply filters
  const fleet = useMemo(() => {
    if (!filters) return allFleet;
    return applyFilters(allFleet, filters);
  }, [allFleet, filters]);

  const fetchTrail = useCallback(async (fleetCode: string, journeyId: string) => {
    setTrailLoading(true);
    try {
      // Sem journeyId → busca pelo fleetCode na data atual (jornada ativa ou mais recente)
      let url = '/api/equipamentos/trail?fleetCode=' + encodeURIComponent(fleetCode);
      if (journeyId) {
        url += '&journeyId=' + encodeURIComponent(journeyId);
      } else {
        const today = new Date().toISOString().slice(0, 10);
        url += '&date=' + today;
      }
      const res = await fetch(url, { cache: 'no-store' });
      const data = res.ok ? await res.json() : { points: [] };
      // API retorna formato compacto {lat, lng} — mapear para TrailPoint {latitude, longitude}
      const rawPts: { lat?: number; lng?: number; latitude?: number; longitude?: number; speedKmh?: number; rpm?: number; accuracy?: number; hourmeter?: number; timestamp?: string; qualityStatus?: string; eventId?: string }[] =
        Array.isArray(data.points) ? data.points : [];
      const pts: TrailPoint[] = rawPts.map(p => ({
        tenantId: '',
        fleetCode,
        equipmentId: '',
        journeyId: journeyId || (data.journeyId as string) || '',
        latitude: p.latitude ?? p.lat ?? 0,
        longitude: p.longitude ?? p.lng ?? 0,
        timestamp: (p.timestamp as string) ?? '',
        speedKmh: p.speedKmh,
        rpm: p.rpm,
        accuracy: p.accuracy,
        hourmeterCurrent: p.hourmeter,
        qualityStatus: p.qualityStatus as TrailPoint['qualityStatus'],
        eventId: p.eventId,
      }));
      const resolvedJourneyId = journeyId || (data.journeyId as string) || '';
      setTrail({ fleetCode, journeyId: resolvedJourneyId, points: pts });
    } catch {
      setTrail({ fleetCode, journeyId, points: [] });
    } finally {
      setTrailLoading(false);
    }
  }, []);

  const clearTrail = useCallback(() => setTrail(null), []);

  const handleCenterOn = useCallback((pos: [number, number] | null) => {
    if (pos) setFlyTarget([...pos]);
  }, []);

  const handleCopyJourney = useCallback((journeyId: string) => {
    navigator.clipboard.writeText(journeyId).then(() => {
      setCopiedId(journeyId);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  }, []);

  const handleOpenFicha = useCallback((fleetCode: string, journeyId: string | null) => {
    setFichaTarget({ fleetCode, journeyId });
  }, []);

  const loadFleetData = useCallback(async () => {
    try {
      const response  = await fetch('/api/equipamentos/status', { cache: 'no-store' });
      const liveFleet = response.ok ? await response.json() : [];
      const source    = Array.isArray(liveFleet) ? (liveFleet as EquipmentLiveState[]) : [];
      const items     = source.map(normalizeLiveItem);
      const counts    = buildLiveMapCounts(source);
      setAllFleet(items);
      onFleetUpdate?.({ fleet: items, counts });
    } catch {
      setAllFleet([]);
      onFleetUpdate?.({ fleet: [], counts: buildLiveMapCounts([]) });
    } finally {
      setLoading(false);
    }
  }, [onFleetUpdate]);

  useEffect(() => {
    loadFleetData();
    const interval = setInterval(loadFleetData, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadFleetData]);

  useEffect(() => {
    if (!flyTarget) return;
    const t = setTimeout(() => setFlyTarget(null), 1200);
    return () => clearTimeout(t);
  }, [flyTarget]);

  const fieldsPolygons = [
    { name: 'T12', coords: [[-12.551,-55.730],[-12.551,-55.715],[-12.560,-55.715],[-12.560,-55.730]] as [number,number][] },
    { name: 'T14', coords: [[-12.561,-55.715],[-12.561,-55.730],[-12.570,-55.730],[-12.570,-55.715]] as [number,number][] },
  ];

  const trailPositions: [number, number][] = (trail?.points ?? [])
    .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    .map(p => [p.latitude, p.longitude]);

  if (loading) {
    return (
      <div className="flex-1 bg-[#050812] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <MapContainer center={farmCenter} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom zoomControl={false} className="z-0">
        <MapController selectedId={selectedId} fleet={fleet} markerRefs={markerRefs} />
        <FlyToController target={flyTarget} />
        {trailPositions.length >= 2 && <TrailBoundsController points={trailPositions} />}

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satelite">
            <TileLayer attribution="Esri" url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" maxZoom={20} maxNativeZoom={17} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Operacional">
            <TileLayer attribution="CARTO" url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{y}/{x}{r}.png" maxZoom={20} maxNativeZoom={19} />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="OSM">
            <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={20} maxNativeZoom={19} />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay name="Talhoes">
            {fieldsPolygons.map(f => (
              <Polygon key={f.name} positions={f.coords} pathOptions={{ color: '#10b981', weight: 1.5, fillOpacity: 0.08, dashArray: '10, 10' }} />
            ))}
          </LayersControl.Overlay>
        </LayersControl>

        {trailPositions.length >= 2 && (
          <>
            <Polyline positions={trailPositions} pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.85 }} />
            <TrailArrows positions={trailPositions} />
            <TrailWaypoints positions={trailPositions} />
          </>
        )}
        {trailPositions.length >= 1 && <Marker position={trailPositions[0]} icon={trailStartIcon} />}
        {trailPositions.length >= 2 && <Marker position={trailPositions[trailPositions.length - 1]} icon={trailEndIcon} />}

        {fleet.filter(m => m.pos !== null).map(machine => {
          const sCfg = getStatus(machine.status);
          return (
            <Marker key={machine.id} position={machine.pos!}
              icon={createEquipmentMarkerIcon({ iconType: machine.iconType, status: machine.status, label: machine.code })}
              eventHandlers={{
                add:    (e) => { markerRefs.current[machine.id] = e.target as L.Marker; },
                remove: ()  => { delete markerRefs.current[machine.id]; },
              }}>
              <Popup className="silo-enterprise-popup" minWidth={320} maxWidth={340}>
                <OperationalPopup machine={machine} statusCfg={sCfg} onRequestTrail={fetchTrail} onClearTrail={clearTrail} trailLoading={trailLoading} activeTrail={trail} onCenterOn={handleCenterOn} onCopyJourney={handleCopyJourney} copiedId={copiedId} onOpenFicha={handleOpenFicha} />
              </Popup>
            </Marker>
          );
        })}
        <ZoomControl position="bottomright" />
      </MapContainer>

      {trail && (
        <div className="absolute top-20 right-4 z-[1400]">
          <button onClick={clearTrail} className="flex items-center gap-2 px-3 py-2 bg-[#0a0e27]/90 backdrop-blur-xl border border-[#2d3647] rounded-xl text-[10px] font-black uppercase text-blue-300 hover:bg-blue-500/10 transition-all shadow-lg">
            <XIcon size={12} /> Limpar rastro ({trail.fleetCode})
          </button>
        </div>
      )}

      {fichaTarget && <FichaPanel fleetCode={fichaTarget.fleetCode} journeyId={fichaTarget.journeyId} onClose={() => setFichaTarget(null)} />}
      <style dangerouslySetInnerHTML={{ __html: LEAFLET_CSS }} />
    </div>
  );
}

/* ── Operational Popup ───────────────────────────────────────────────────────────────────────── */

type StatusCfg = { label: string; color: string };

function OperationalPopup({
  machine, statusCfg, onRequestTrail, onClearTrail, trailLoading, activeTrail,
  onCenterOn, onCopyJourney, copiedId, onOpenFicha,
}: {
  machine: LiveMapItem;
  statusCfg: StatusCfg;
  onRequestTrail: (fleetCode: string, journeyId: string) => void;
  onClearTrail: () => void;
  trailLoading: boolean;
  activeTrail: TrailState;
  onCenterOn: (pos: [number, number] | null) => void;
  onCopyJourney: (id: string) => void;
  copiedId: string | null;
  onOpenFicha: (fleetCode: string, journeyId: string | null) => void;
}) {
  const gpsAge   = ageMs(machine.lastGpsAt);
  const hbAge    = ageMs(machine.lastHeartbeatAt);
  const gpsStale = gpsAge > GPS_ALERT_MS;
  const hbStale  = hbAge  > HB_ALERT_MS;
  const gpsFresh = gpsAge <= GPS_FRESH_MS;
  const anyAlert = gpsStale || hbStale;

  const registration = machine.operatorRegistration ?? machine.registration;
  const hStart   = machine.hourmeterStart   ?? machine.hourmeterInitial;
  const hCurrent = machine.hourmeterCurrent ?? machine.hourmeter;
  const hEnd     = machine.hourmeterEnd     ?? machine.hourmeterFinal;
  const stopDesc = machine.stopDescription  ?? machine.stopReason;

  const isMyTrail = activeTrail?.fleetCode === machine.code;
  const trailHasPoints = isMyTrail && (activeTrail?.points.length ?? 0) > 0;
  const trailEmpty = isMyTrail && (activeTrail?.points.length ?? 0) === 0;

  return (
    <div className="bg-[#0a0e27] text-white rounded-xl border border-[#2d3647] font-sans shadow-2xl overflow-hidden" style={{ width: 320 }}>
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2d3647]/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg shrink-0" style={{ backgroundColor: statusCfg.color }}>
            <Navigation size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-base font-black italic tracking-tighter leading-none uppercase truncate">{machine.code}</span>
            <span className="text-[9px] uppercase text-muted-foreground font-bold tracking-widest truncate">{formatValue(machine.type || machine.name)}</span>
          </div>
        </div>
        <div className="shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase border" style={{ color: statusCfg.color, borderColor: statusCfg.color + '40', backgroundColor: statusCfg.color + '15' }}>
          {statusCfg.label}
        </div>
      </div>

      {anyAlert && (
        <div className="flex flex-col gap-1 px-4 py-2 bg-[#1a0f08] border-b border-[#3d2010]/60">
          {gpsStale && <AlertRow text={'GPS desatualizado (' + formatAge(gpsAge) + ')'} color="#f97316" />}
          {hbStale  && <AlertRow text={'Sem heartbeat (' + formatAge(hbAge) + ')'} color="#ef4444" />}
        </div>
      )}
      {gpsFresh && !anyAlert && (
        <div className="flex items-center gap-1.5 px-4 py-1.5 bg-[#061a0f] border-b border-[#0d3320]/60">
          <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
          <span className="text-[10px] font-bold text-emerald-400">{'GPS recente (' + formatAge(gpsAge) + ')'}</span>
        </div>
      )}

      <div className="px-4 py-3 flex flex-col gap-3">
        <PSection label="Telemetria">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            <PField icon={<Gauge size={11} />}    label="Velocidade"   value={formatSpeed(machine.speedKmh ?? (machine.speed != null ? machine.speed * 3.6 : undefined))} />
            <PField icon={<Activity size={11} />} label="RPM"          value={(machine as unknown as Record<string, number>).rpm != null ? String((machine as unknown as Record<string, number>).rpm) + ' rpm' : NOT_INFORMED} />
            <PField icon={<Clock size={11} />}    label="Horimetro"    value={formatHourmeter(machine.hourmeterCurrent ?? machine.hourmeter)} />
            <PField icon={<MapPin size={11} />}   label="Precisao GPS" value={formatAccuracy(machine.accuracy)} />
            <PField icon={<Clock size={11} />}    label="Ultimo GPS"   value={formatDateTime(machine.lastGpsAt)} alert={gpsStale} />
            <PField icon={<Activity size={11} />} label="Heartbeat"    value={formatDateTime(machine.lastHeartbeatAt)} alert={hbStale} />
          </div>
        </PSection>

        <PSection label="Operacao">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            <PField icon={<Hash size={11} />} label="Jornada ID" value={formatValue(machine.journeyId)} />
            <PField icon={<User size={11} />} label="Operador" value={machine.displayOperator} />
            <PField icon={<Hash size={11} />} label="Matricula" value={formatValue(registration)} />
            <PField icon={<Zap size={11} />} label="Operacao" value={machine.displayOperation} />
            <PField icon={<Hash size={11} />} label="Cod.Operacao" value={formatValue(machine.operationName || machine.operationCode)} />
            <PField icon={<Hash size={11} />} label="Implemento" value={formatValue((machine as unknown as Record<string,string>).implementName || machine.implementCode)} />
          </div>
        </PSection>

        <PSection label="Horimetro">
          <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
            <PField icon={<Clock size={11} />} label="Inicial" value={formatHourmeter(hStart)} />
            <PField icon={<Clock size={11} />} label="Atual" value={formatHourmeter(hCurrent)} />
            <PField icon={<Clock size={11} />} label="Final" value={formatHourmeter(hEnd)} />
          </div>
        </PSection>

        <PSection label="Parada">
          <StopBlock stop={machine.stop} stopDesc={stopDesc} stopCode={machine.stopCode} />
        </PSection>

        <div className="pt-2 border-t border-[#2d3647]/40 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onOpenFicha(machine.code, machine.journeyId ?? null)} className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase hover:bg-primary/20 transition-all">
              <FileText size={11} /> Ver ficha
            </button>
            <button onClick={() => onCenterOn(machine.pos)} disabled={!machine.pos} className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-white/5 border border-white/10 text-white/70 text-[10px] font-black uppercase hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
              <Crosshair size={11} /> Centralizar
            </button>
          </div>

          {machine.journeyId && (
            <button onClick={() => onCopyJourney(machine.journeyId!)} className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 text-[9px] font-bold uppercase hover:bg-white/10 transition-all">
              <ClipboardCopy size={10} /> {copiedId === machine.journeyId ? 'Copiado!' : 'Copiar journeyId'}
            </button>
          )}

          {!isMyTrail && (
            <button onClick={() => onRequestTrail(machine.code, machine.journeyId ?? '')} disabled={trailLoading} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 text-[10px] font-black uppercase hover:bg-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
              <Route size={11} /> {trailLoading ? 'Carregando rastro...' : 'Ver rastro'}
            </button>
          )}
          {isMyTrail && trailHasPoints && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold"><Route size={11} /> {(activeTrail?.points.length ?? 0) + ' pontos no rastro'}</div>
                <button onClick={onClearTrail} className="text-[9px] font-black uppercase text-muted-foreground hover:text-white transition-colors">Limpar</button>
              </div>
            </div>
          )}
          {isMyTrail && trailEmpty && (
            <p className="text-[10px] font-bold text-muted-foreground/60 italic text-center py-1">Sem rastro disponivel para esta jornada</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── StopBlock ────────────────────────────────────────────────────────────────────────────────── */

/**
 * Renderiza o bloco de parada no popup do mapa usando o estado semantico da API.
 * Nunca exibe "Nao informado" para motivo/codigo quando nao ha parada ativa.
 *
 * Estados:
 *  SEM_PARADA_ATIVA        -> "Sem parada ativa"
 *  AGUARDANDO_APONTAMENTO  -> "Aguardando apontamento de parada / Codigo: -"
 *  PARADA_APONTADA         -> Motivo + Codigo reais
 *  PARADA_INCONSISTENTE    -> alerta com mensagem de inconsistencia
 */
function StopBlock({
  stop,
  stopDesc,
  stopCode,
}: {
  stop?: ResolvedStopForMap;
  stopDesc: string | null | undefined;
  stopCode: string | null | undefined;
}) {
  // Caminho novo: usa o objeto stop estruturado
  if (stop) {
    const { state, reason, code, inconsistency } = stop;

    if (state === 'SEM_PARADA_ATIVA') {
      return (
        <p className="text-[11px] text-muted-foreground/60 italic font-bold uppercase">
          Sem parada ativa
        </p>
      );
    }

    if (state === 'AGUARDANDO_APONTAMENTO') {
      return (
        <div className="flex flex-col gap-1.5">
          <p className="text-[11px] text-orange-300 font-bold uppercase">
            Aguardando apontamento de parada
          </p>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-bold">
            <Hash size={9} />
            <span>Codigo: -</span>
          </div>
        </div>
      );
    }

    if (state === 'PARADA_INCONSISTENTE') {
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-orange-400 text-[11px] font-bold">
            <AlertTriangle size={11} />
            <span>Parada inconsistente</span>
          </div>
          {inconsistency && (
            <p className="text-[10px] text-muted-foreground font-bold">{inconsistency}</p>
          )}
        </div>
      );
    }

    // PARADA_APONTADA -- exibe motivo e codigo reais
    return (
      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
        <PField icon={<PauseCircle size={11} />} label="Motivo" value={reason ?? code ?? '-'} />
        <PField icon={<Hash size={11} />} label="Codigo" value={code ?? '-'} />
      </div>
    );
  }

  // Fallback legado: API anterior sem objeto stop
  const desc = stopDesc;
  const hasStop = desc != null || stopCode != null;
  if (!hasStop) {
    return (
      <p className="text-[11px] text-muted-foreground/60 italic font-bold uppercase">
        Sem parada ativa
      </p>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
      <PField icon={<PauseCircle size={11} />} label="Motivo" value={desc ?? '-'} />
      <PField icon={<Hash size={11} />} label="Codigo" value={stopCode ?? '-'} />
    </div>
  );
}

function AlertRow({ text, color }: { text: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <AlertTriangle size={11} style={{ color }} className="shrink-0" />
      <span className="text-[10px] font-bold" style={{ color }}>{text}</span>
    </div>
  );
}

function PSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground mb-2 flex items-center gap-2">
        <span>{label}</span>
        <div className="flex-1 h-px bg-[#2d3647]/60" />
      </div>
      {children}
    </div>
  );
}

function PField({ icon, label, value, alert = false }: {
  icon: React.ReactNode; label: string; value: string; alert?: boolean;
}) {
  const isNI = value === NOT_INFORMED;
  const cls = 'text-[11px] font-bold truncate uppercase ' +
    (isNI ? 'text-muted-foreground/50 italic' : alert ? 'text-orange-300' : 'text-white');
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1 text-[9px] text-muted-foreground font-black uppercase tracking-tighter">
        <span className={alert ? 'text-orange-400' : 'text-primary'}>{icon}</span>
        {label}
      </div>
      <div className={cls}>{value}</div>
    </div>
  );
}
