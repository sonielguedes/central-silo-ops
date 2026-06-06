"use client";

import React, { useEffect, useState } from 'react';
import {
  LayersControl, MapContainer, Marker, Polygon,
  Popup, TileLayer, ZoomControl, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Activity, AlertTriangle, CheckCircle2, Clock,
  Gauge, Hash, Loader2, MapPin, Navigation,
  PauseCircle, Tractor, Truck, User, Zap,
} from 'lucide-react';
import { renderToString } from 'react-dom/server';
import type { LucideIcon } from 'lucide-react';
import { EquipmentLiveState, EquipmentOperationalStatus } from '@/lib/types';

// ── CSS overrides (string concat avoids JSX template-literal parser issues) ─
const LEAFLET_CSS = (
  '.leaflet-container{background:#050812!important}' +
  '.silo-enterprise-popup .leaflet-popup-content-wrapper{background:transparent!important;padding:0!important;box-shadow:none!important;border:none!important}' +
  '.silo-enterprise-popup .leaflet-popup-content{margin:0!important}' +
  '.silo-enterprise-popup .leaflet-popup-tip{background:#0a0e27!important;border:1px solid #2d3647!important}' +
  '.silo-enterprise-popup .leaflet-popup-tip-container{display:none}' +
  '.leaflet-popup-close-button{color:#6b7280!important;padding:10px!important;z-index:100}'
);

// ── Thresholds ───────────────────────────────────────────────────────────────
const GPS_RECENT_MS       = 15 * 60 * 1000;
const HEARTBEAT_RECENT_MS =  3 * 60 * 1000;
const GPS_ALERT_MS        =      120 * 1000;
const HB_ALERT_MS         =      120 * 1000;
const GPS_FRESH_MS        =       60 * 1000;
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

// ── Exported types ───────────────────────────────────────────────────────────
export type MapCounts = {
  online: number; operando: number; parado: number;
  offline: number; staleGps: number; staleHeartbeat: number;
};

export type LiveMapItem = EquipmentLiveState & {
  id: string;
  code: string;
  pos: [number, number] | null;
  typeIcon: 'Tractor' | 'Truck' | 'Zap' | 'Navigation';
  displayOperator: string;
  displayOperation: string;
};

// ── Leaflet default icon ─────────────────────────────────────────────────────
const DefaultIcon = L.icon({
  iconUrl:    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize:   [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// ── Helpers ──────────────────────────────────────────────────────────────────
const hasValidPosition = (
  item: EquipmentLiveState
): item is EquipmentLiveState & { latitude: number; longitude: number } =>
  Number.isFinite(item.latitude) && Number.isFinite(item.longitude);

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
  if (s < 60)  return 'ha ' + s + 's';
  const m = Math.floor(s / 60);
  if (m < 60)  return 'ha ' + m + 'min';
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

// ── Machine marker icon ───────────────────────────────────────────────────────
const createMachineIcon = (
  iconName: LiveMapItem['typeIcon'],
  statusKey: EquipmentOperationalStatus,
  id: string
) => {
  const color = getStatus(statusKey).color;
  const TypeIcon =
    iconName === 'Tractor' ? Tractor :
    iconName === 'Truck'   ? Truck   :
    iconName === 'Zap'     ? Zap     : Navigation;

  const html = renderToString(
    <div className="relative flex flex-col items-center">
      <div className="relative w-12 h-14 flex items-center justify-center">
        <div className="absolute bottom-0 w-4 h-1.5 bg-black/40 rounded-full blur-[2px]" />
        <div className="absolute inset-0 flex items-center justify-center"
          style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }}>
          <svg width="48" height="56" viewBox="0 0 48 56" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 56C24 56 48 36.4 48 24C48 10.7452 37.2548 0 24 0C10.7452 0 0 10.7452 0 24C0 36.4 24 56 24 56Z" fill={color} />
            <circle cx="24" cy="24" r="21" fill="black" fillOpacity="0.1" />
            <circle cx="24" cy="24" r="20" stroke="white" strokeOpacity="0.2" strokeWidth="1" />
          </svg>
        </div>
        <div className="relative z-10 mb-3 text-white flex items-center justify-center">
          <TypeIcon size={24} strokeWidth={2.5} />
        </div>
      </div>
      <div className="mt-[-8px] bg-[#0a0e27]/90 backdrop-blur-md px-1.5 py-0.5 rounded border border-white/20 shadow-lg relative z-20">
        <span className="text-[9px] font-black text-white italic tracking-tighter uppercase">{id}</span>
      </div>
    </div>
  );
  return L.divIcon({ className: 'silo-machine-icon', html, iconSize: [48, 64], iconAnchor: [24, 56] });
};

// ── MapController: flyTo + openPopup on selectedId change ────────────────────
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
  const prevId = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!selectedId || selectedId === prevId.current) return;
    prevId.current = selectedId;

    const machine = fleet.find(m => m.id === selectedId);
    if (!machine) return;

    if (!machine.pos) {
      console.info('[map-ui] sidebar click fleetCode=' + machine.code + ' (no GPS)');
      return;
    }

    console.info('[map-ui] flyTo fleetCode=' + machine.code + ' lat=' + machine.pos[0] + ' lng=' + machine.pos[1]);
    map.flyTo(machine.pos, 17, { animate: true, duration: 0.8 });

    const openAfterFly = () => {
      const marker = markerRefs.current[selectedId];
      if (marker) {
        marker.openPopup();
        console.info('[map-ui] popup opened fleetCode=' + machine.code);
      }
    };
    map.once('moveend', openAfterFly);
    return () => { map.off('moveend', openAfterFly); };
  }, [selectedId, fleet, map, markerRefs]);

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FullMapEnterprise({
  onFleetUpdate,
  selectedId,
}: {
  onFleetUpdate?: (data: { fleet: LiveMapItem[]; counts: MapCounts }) => void;
  selectedId?: string | null;
}) {
  const [fleet, setFleet]     = useState<LiveMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const farmCenter: [number, number] = [-12.5568, -55.7229];
  const markerRefs = React.useRef<Record<string, L.Marker>>({});

  const logPopupOpen = React.useCallback((item: LiveMapItem) => {
    const keys = (Object.keys(item) as (keyof LiveMapItem)[])
      .filter(k => item[k] !== undefined).join(', ');
    console.info('[map-popup] opened fleetCode=' + item.code);
    console.info('[map-popup] data keys=' + keys);
  }, []);

  const loadFleetData = React.useCallback(async () => {
    try {
      const response  = await fetch('/api/equipamentos/status', { cache: 'no-store' });
      const liveFleet = response.ok ? await response.json() : [];
      const source    = Array.isArray(liveFleet) ? (liveFleet as EquipmentLiveState[]) : [];
      const items     = source.map(normalizeLiveItem);
      const counts    = buildLiveMapCounts(source);
      setFleet(items);
      onFleetUpdate?.({ fleet: items, counts });
      console.info('[map-ui] fetched count=' + source.length);
      console.info('[map-ui] sidebar count=' + items.length);
      console.info('[map-ui] markers count=' + items.filter(i => i.pos !== null).length);
    } catch (error) {
      console.error('[map-ui] failed to fetch live fleet', error);
      setFleet([]);
      onFleetUpdate?.({ fleet: [], counts: buildLiveMapCounts([]) });
    } finally {
      setLoading(false);
    }
  }, [onFleetUpdate]);

  useEffect(() => {
    loadFleetData();
    const interval = setInterval(loadFleetData, 10000);
    return () => clearInterval(interval);
  }, [loadFleetData]);

  const fieldsPolygons = [
    { name: 'T12', coords: [[-12.551,-55.730],[-12.551,-55.715],[-12.560,-55.715],[-12.560,-55.730]] as [number,number][] },
    { name: 'T14', coords: [[-12.561,-55.715],[-12.561,-55.730],[-12.570,-55.730],[-12.570,-55.715]] as [number,number][] },
  ];

  if (loading) {
    return (
      <div className="flex-1 bg-[#050812] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <MapContainer center={farmCenter} zoom={14}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom zoomControl={false} className="z-0">

        <MapController selectedId={selectedId} fleet={fleet} markerRefs={markerRefs} />

        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satelite">
            <TileLayer attribution="Esri"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Operacional">
            <TileLayer attribution="CARTO"
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{y}/{x}{r}.png" />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay checked name="Talhoes">
            {fieldsPolygons.map(f => (
              <Polygon key={f.name} positions={f.coords}
                pathOptions={{ color: '#10b981', weight: 1.5, fillOpacity: 0.08, dashArray: '10, 10' }} />
            ))}
          </LayersControl.Overlay>
        </LayersControl>

        {fleet.filter(m => m.pos !== null).map(machine => {
          const sCfg = getStatus(machine.status);
          return (
            <Marker key={machine.id} position={machine.pos!}
              icon={createMachineIcon(machine.typeIcon, machine.status, machine.code)}
              eventHandlers={{
                add:      (e) => { markerRefs.current[machine.id] = e.target as L.Marker; },
                remove:   ()  => { delete markerRefs.current[machine.id]; },
                popupopen: () => logPopupOpen(machine),
              }}>
              <Popup className="silo-enterprise-popup" minWidth={300}>
                <OperationalPopup machine={machine} statusCfg={sCfg} />
              </Popup>
            </Marker>
          );
        })}

        <ZoomControl position="bottomright" />
      </MapContainer>
      <style dangerouslySetInnerHTML={{ __html: LEAFLET_CSS }} />
    </div>
  );
}

// ── Popup types ───────────────────────────────────────────────────────────────
type StatusCfg = { label: string; color: string };
type IconType  = LucideIcon;

// ── Operational Popup ─────────────────────────────────────────────────────────
function OperationalPopup({ machine, statusCfg }: { machine: LiveMapItem; statusCfg: StatusCfg }) {
  const TypeIcon: IconType =
    machine.typeIcon === 'Tractor' ? Tractor :
    machine.typeIcon === 'Truck'   ? Truck   :
    machine.typeIcon === 'Zap'     ? Zap     : Navigation;

  const gpsAge   = ageMs(machine.lastGpsAt);
  const hbAge    = ageMs(machine.lastHeartbeatAt);
  const gpsStale = gpsAge > GPS_ALERT_MS;
  const hbStale  = hbAge  > HB_ALERT_MS;
  const gpsFresh = gpsAge <= GPS_FRESH_MS;
  const anyAlert = gpsStale || hbStale;

  // Prefer canonical API field names; fall back to legacy
  const registration = machine.operatorRegistration ?? machine.registration;
  const hStart   = machine.hourmeterStart   ?? machine.hourmeterInitial;
  const hCurrent = machine.hourmeterCurrent ?? machine.hourmeter;
  const hEnd     = machine.hourmeterEnd     ?? machine.hourmeterFinal;
  const stopDesc = machine.stopDescription  ?? machine.stopReason;

  return (
    <div className="bg-[#0a0e27] text-white rounded-xl border border-[#2d3647] font-sans shadow-2xl overflow-hidden"
      style={{ width: 300 }}>

      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-[#2d3647]/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg shrink-0"
            style={{ backgroundColor: statusCfg.color }}>
            <TypeIcon size={20} />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-base font-black italic tracking-tighter leading-none uppercase truncate">{machine.code}</span>
            <span className="text-[9px] uppercase text-muted-foreground font-bold tracking-widest truncate">
              {formatValue(machine.type || machine.name)}
            </span>
          </div>
        </div>
        <div className="shrink-0 px-2.5 py-1 rounded-full text-[9px] font-black uppercase border"
          style={{ color: statusCfg.color, borderColor: statusCfg.color + '40', backgroundColor: statusCfg.color + '15' }}>
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
            <PField icon={<Gauge    size={11} />} label="Velocidade"    value={formatSpeed(machine.speed)} />
            <PField icon={<MapPin   size={11} />} label="Precisao GPS"  value={formatAccuracy(machine.accuracy)} />
            <PField icon={<Clock    size={11} />} label="Ultimo GPS"    value={formatDateTime(machine.lastGpsAt)}       alert={gpsStale} />
            <PField icon={<Activity size={11} />} label="Ult.heartbeat" value={formatDateTime(machine.lastHeartbeatAt)} alert={hbStale} />
          </div>
        </PSection>

        <PSection label="Operacao">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            <PField icon={<Hash size={11} />} label="Jornada ID"  value={formatValue(machine.journeyId)} />
            <PField icon={<User size={11} />} label="Operador"    value={machine.displayOperator} />
            <PField icon={<Hash size={11} />} label="Matricula"   value={formatValue(registration)} />
            <PField icon={<Zap  size={11} />} label="Operacao"    value={machine.displayOperation} />
            <PField icon={<Hash size={11} />} label="Cod.Operacao" value={formatValue(machine.operationCode)} />
            <PField icon={<Hash size={11} />} label="Implemento"  value={formatValue(machine.implementCode)} />
          </div>
        </PSection>

        <PSection label="Horimetro">
          <div className="grid grid-cols-3 gap-x-4 gap-y-2.5">
            <PField icon={<Clock size={11} />} label="Inicial" value={formatHourmeter(hStart)} />
            <PField icon={<Clock size={11} />} label="Atual"   value={formatHourmeter(hCurrent)} />
            <PField icon={<Clock size={11} />} label="Final"   value={formatHourmeter(hEnd)} />
          </div>
        </PSection>

        <PSection label="Parada">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
            <PField icon={<PauseCircle size={11} />} label="Motivo" value={formatValue(stopDesc)} />
            <PField icon={<Hash       size={11} />} label="Codigo"  value={formatValue(machine.stopCode)} />
          </div>
        </PSection>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
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
