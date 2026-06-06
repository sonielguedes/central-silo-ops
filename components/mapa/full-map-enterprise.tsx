"use client";

import React, { useEffect, useState } from 'react';
import { LayersControl, MapContainer, Marker, Polygon, Popup, TileLayer, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Clock, Gauge, Hash, Loader2, Navigation, PauseCircle, Tractor, Truck, User, Zap } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import { EquipmentLiveState, EquipmentOperationalStatus } from '@/lib/types';

const NOT_INFORMED = 'Não informado';
const GPS_RECENT_MS = 15 * 60 * 1000;
const HEARTBEAT_RECENT_MS = 3 * 60 * 1000;

const STATUS_CONFIG: Record<Lowercase<EquipmentOperationalStatus>, { label: string; color: string; tailwind: string; text: string }> = {
  online: { label: 'Online', color: '#3b82f6', tailwind: 'bg-blue-500', text: 'text-blue-500' },
  operando: { label: 'Operando', color: '#10b981', tailwind: 'bg-emerald-500', text: 'text-emerald-500' },
  parado: { label: 'Parado', color: '#f97316', tailwind: 'bg-orange-500', text: 'text-orange-500' },
  finalizado: { label: 'Finalizado', color: '#6b7280', tailwind: 'bg-gray-500', text: 'text-gray-500' },
  offline: { label: 'Offline', color: '#6b7280', tailwind: 'bg-gray-500', text: 'text-gray-500' },
};

export type MapCounts = {
  online: number;
  operando: number;
  parado: number;
  offline: number;
  staleGps: number;
  staleHeartbeat: number;
};

export type LiveMapItem = EquipmentLiveState & {
  id: string;
  code: string;
  pos: [number, number] | null;
  typeIcon: 'Tractor' | 'Truck' | 'Zap' | 'Navigation';
  displayOperator: string;
  displayOperation: string;
};

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const hasValidPosition = (item: EquipmentLiveState): item is EquipmentLiveState & { latitude: number; longitude: number } =>
  Number.isFinite(item.latitude) && Number.isFinite(item.longitude);

const isRecent = (value: string | undefined, thresholdMs: number) => {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && Date.now() - time <= thresholdMs;
};

const formatDateTime = (value?: string) => {
  if (!value) return NOT_INFORMED;
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return NOT_INFORMED;
  return time.toLocaleString('pt-BR');
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return NOT_INFORMED;
  return String(value);
};

const getTypeIcon = (type?: string): LiveMapItem['typeIcon'] => {
  const normalized = (type || '').toUpperCase();
  if (normalized.includes('TRATOR') || normalized.includes('COLH')) return 'Tractor';
  if (normalized.includes('CAM') || normalized.includes('TRUCK')) return 'Truck';
  if (normalized.includes('CARREG') || normalized.includes('PA ')) return 'Zap';
  return 'Navigation';
};

const getStatus = (status: EquipmentOperationalStatus) => STATUS_CONFIG[status.toLowerCase() as Lowercase<EquipmentOperationalStatus>] || STATUS_CONFIG.offline;

const normalizeLiveItem = (item: EquipmentLiveState): LiveMapItem => ({
  ...item,
  id: item.equipmentId,
  code: item.fleetCode || item.equipmentId,
  pos: hasValidPosition(item) ? [item.latitude, item.longitude] : null,
  typeIcon: getTypeIcon(item.type),
  displayOperator: formatValue(item.currentOperator || item.operatorName),
  displayOperation: formatValue(item.currentOperation || item.operationName),
});

export const buildLiveMapCounts = (items: EquipmentLiveState[]): MapCounts => ({
  online: items.filter(i => i.status === 'ONLINE').length,
  operando: items.filter(i => i.status === 'OPERANDO').length,
  parado: items.filter(i => i.status === 'PARADO').length,
  offline: items.filter(i => i.status === 'OFFLINE' || i.status === 'FINALIZADO').length,
  staleGps: items.filter(i => !isRecent(i.lastGpsAt, GPS_RECENT_MS)).length,
  staleHeartbeat: items.filter(i => !isRecent(i.lastHeartbeatAt, HEARTBEAT_RECENT_MS)).length,
});

const createMachineIcon = (iconName: LiveMapItem['typeIcon'], statusKey: EquipmentOperationalStatus, id: string) => {
  const color = getStatus(statusKey).color;
  const TypeIcon = iconName === 'Tractor' ? Tractor : iconName === 'Truck' ? Truck : iconName === 'Zap' ? Zap : Navigation;
  const html = renderToString(
    <div className="relative flex flex-col items-center">
      <div className="relative w-12 h-14 flex items-center justify-center">
        <div className="absolute bottom-0 w-4 h-1.5 bg-black/40 rounded-full blur-[2px]"></div>
        <div className="absolute inset-0 flex items-center justify-center" style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.4))' }}>
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

export default function FullMapEnterprise({ onFleetUpdate }: { onFleetUpdate?: (data: { fleet: LiveMapItem[]; counts: MapCounts }) => void }) {
  const [fleet, setFleet] = useState<LiveMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const farmCenter: [number, number] = [-12.5568, -55.7229];

  const loadFleetData = React.useCallback(async () => {
    try {
      const response = await fetch('/api/equipamentos/status', { cache: 'no-store' });
      const liveFleet = response.ok ? await response.json() : [];
      const source = Array.isArray(liveFleet) ? liveFleet as EquipmentLiveState[] : [];
      const items = source.map(normalizeLiveItem);
      const markersCount = items.filter(item => item.pos !== null).length;
      const counts = buildLiveMapCounts(source);

      setFleet(items);
      onFleetUpdate?.({ fleet: items, counts });
      console.info(`[map-ui] fetched count=${source.length}`);
      console.info(`[map-ui] sidebar count=${items.length}`);
      console.info(`[map-ui] markers count=${markersCount}`);
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
    { name: 'Talhão 12', coords: [[-12.551, -55.730], [-12.551, -55.715], [-12.560, -55.715], [-12.560, -55.730]] as [number, number][] },
    { name: 'Talhão 14', coords: [[-12.561, -55.715], [-12.561, -55.730], [-12.570, -55.730], [-12.570, -55.715]] as [number, number][] },
  ];

  if (loading) return <div className="flex-1 bg-[#050812] flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={40} /></div>;

  return (
    <div className="w-full h-full relative">
      <MapContainer center={farmCenter} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true} zoomControl={false} className="z-0">
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Satélite">
            <TileLayer attribution='&copy; Esri' url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Operacional">
            <TileLayer attribution='&copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{y}/{x}{r}.png" />
          </LayersControl.BaseLayer>
          <LayersControl.Overlay checked name="Talhões">
            {fieldsPolygons.map(field => (
              <Polygon key={field.name} positions={field.coords} pathOptions={{ color: '#10b981', weight: 1.5, fillOpacity: 0.08, dashArray: '10, 10' }} />
            ))}
          </LayersControl.Overlay>
        </LayersControl>

        {fleet.filter(machine => machine.pos).map(machine => {
          const status = getStatus(machine.status);
          return (
            <Marker key={machine.id} position={machine.pos!} icon={createMachineIcon(machine.typeIcon, machine.status, machine.code)}>
              <Popup className="silo-enterprise-popup" minWidth={280}>
                <div className="bg-[#0a0e27] text-white p-4 rounded-xl border border-[#2d3647] font-sans shadow-2xl">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2d3647]/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: status.color }}>
                        {machine.typeIcon === 'Tractor' ? <Tractor size={20} /> : machine.typeIcon === 'Truck' ? <Truck size={20} /> : machine.typeIcon === 'Zap' ? <Zap size={20} /> : <Navigation size={20} />}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-base font-black italic tracking-tighter leading-none uppercase">{machine.code}</span>
                        <span className="text-[9px] uppercase text-muted-foreground font-bold tracking-widest">{formatValue(machine.type || machine.name)}</span>
                      </div>
                    </div>
                    <div className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase border" style={{ color: status.color, borderColor: `${status.color}40`, backgroundColor: `${status.color}10` }}>
                      {status.label}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-4">
                    <PopupDetail icon={<Hash size={12} />} label="Frota" value={machine.code} />
                    <PopupDetail icon={<Navigation size={12} />} label="Status" value={status.label} />
                    <PopupDetail icon={<Gauge size={12} />} label="Velocidade" value={machine.speed === undefined ? NOT_INFORMED : `${machine.speed} km/h`} />
                    <PopupDetail icon={<Clock size={12} />} label="Último GPS" value={formatDateTime(machine.lastGpsAt)} />
                    <PopupDetail icon={<Clock size={12} />} label="Último heartbeat" value={formatDateTime(machine.lastHeartbeatAt)} />
                    <PopupDetail icon={<Hash size={12} />} label="Journey ID" value={formatValue(machine.journeyId)} />
                    <PopupDetail icon={<User size={12} />} label="Operador" value={machine.displayOperator} />
                    <PopupDetail icon={<Zap size={12} />} label="Operação" value={machine.displayOperation} />
                    <PopupDetail icon={<Gauge size={12} />} label="Horímetro" value={machine.hourmeter === undefined ? NOT_INFORMED : `${machine.hourmeter}h`} />
                    <PopupDetail icon={<PauseCircle size={12} />} label="Parada" value={formatValue(machine.stopReason)} />
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}

        <ZoomControl position="bottomright" />
      </MapContainer>

      <style jsx global>{`
        .leaflet-container { background: #050812 !important; }
        .silo-enterprise-popup .leaflet-popup-content-wrapper { background: transparent !important; padding: 0 !important; box-shadow: none !important; }
        .silo-enterprise-popup .leaflet-popup-content { margin: 0 !important; }
        .silo-enterprise-popup .leaflet-popup-tip { background: #0a0e27 !important; border: 1px solid #2d3647 !important; }
        .leaflet-popup-close-button { color: #6b7280 !important; padding: 10px !important; z-index: 100; }
      `}</style>
    </div>
  );
}

function PopupDetail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-black uppercase tracking-tighter">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="text-[11px] font-bold text-white truncate max-w-[120px] uppercase">{value}</div>
    </div>
  );
}
