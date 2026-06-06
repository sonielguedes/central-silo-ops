"use client";

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, ZoomControl, LayersControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Clock, User, MapPin, Gauge, Zap, Tractor, Truck, Loader2 } from 'lucide-react';
import { renderToString } from 'react-dom/server';
import { STATUS_CONFIG } from '@/lib/mock/map-data';
import { EquipmentService, EquipmentTypeService, OperationService, OperatorService, FarmService, FieldService } from '@/services/master.service';
import { cn } from '@/lib/utils';
import { EquipmentLiveState } from '@/lib/types';

// Fix for default marker icons
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

const createMachineIcon = (iconName: string, statusKey: string, id: string) => {
  const color = (STATUS_CONFIG as any)[statusKey.toLowerCase()]?.color || '#6b7280';

  const TypeIcon = iconName === 'Tractor' ? Tractor :
                   iconName === 'Truck' ? Truck :
                   iconName === 'Zap' ? Zap : Navigation;

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

  return L.divIcon({
    className: 'silo-machine-icon',
    html: html,
    iconSize: [48, 64],
    iconAnchor: [24, 56],
  });
};

export default function FullMapEnterprise() {
  const [fleet, setFleet] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const farmCenter: [number, number] = [-12.5568, -55.7229];

  async function loadFleetData() {
    try {
      const [eqs, types, ops, oprs, farms, fields, resLive] = await Promise.all([
        EquipmentService.getAll(),
        EquipmentTypeService.getAll(),
        OperationService.getAll(),
        OperatorService.getAll(),
        FarmService.getAll(),
        FieldService.getAll(),
        fetch('/api/equipamentos/status').then(r => r.json()).catch(() => [])
      ]);

      const liveMap = new Map((resLive as EquipmentLiveState[]).map(s => [s.equipmentId, s]));

      const items = eqs.map((eq) => {
        const live = liveMap.get(eq.id);
        const type = types.find(t => t.id === eq.typeId);
        const op = ops.find(o => o.equipmentId === eq.id && o.status === 'EM_CURSO');
        const opr = oprs.find(o => o.id === (op?.operatorId || eq.currentOperatorId));
        const farm = farms.find(f => f.id === op?.farmId);
        const field = fields.find(f => f.id === op?.fieldId);

        const status = live?.status || eq.status;
        const lat = live?.latitude;
        const lng = live?.longitude;

        return {
          ...eq,
          status,
          typeIcon: type?.icon,
          typeName: type?.name,
          operatorName: live?.currentOperator || opr?.name || 'Não Identificado',
          operationName: live?.currentOperation || op?.type || 'Sem Operação',
          farmName: farm?.name || '-',
          fieldName: field?.code || '-',
          speed: live?.speed || 0,
          pos: (lat && lng) ? [lat, lng] : null,
          isOnline: status !== 'OFFLINE' && status !== 'FINALIZADO',
          lastSignal: live?.lastGpsAt || live?.lastHeartbeatAt || eq.lastSignal,
          lastGpsAt: live?.lastGpsAt,
          lastHeartbeatAt: live?.lastHeartbeatAt
        };
      }).filter(item => item.pos !== null); // Requirement: if no lat/lng, don't render

      setFleet(items);
      setLoading(false);
    } catch (e) {
      console.error('Failed to load fleet data', e);
    }
  }

  useEffect(() => {
    loadFleetData();
    const interval = setInterval(loadFleetData, 10000);
    return () => clearInterval(interval);
  }, []);

  const fieldsPolygons = [
    { name: 'Talhão 12', coords: [[-12.551, -55.730], [-12.551, -55.715], [-12.560, -55.715], [-12.560, -55.730]] as [number, number][] },
    { name: 'Talhão 14', coords: [[-12.561, -55.715], [-12.561, -55.730], [-12.570, -55.730], [-12.570, -55.715]] as [number, number][] }
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
             {fieldsPolygons.map((f) => (
                <Polygon key={f.name} positions={f.coords} pathOptions={{ color: '#10b981', weight: 1.5, fillOpacity: 0.08, dashArray: '10, 10' }} />
             ))}
          </LayersControl.Overlay>
        </LayersControl>

        {fleet.map((machine) => (
          <Marker key={machine.id} position={machine.pos} icon={createMachineIcon(machine.typeIcon, machine.status, machine.code)}>
            <Popup className="silo-enterprise-popup" minWidth={260}>
              <div className="bg-[#0a0e27] text-white p-4 rounded-xl border border-[#2d3647] font-sans shadow-2xl">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2d3647]/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: ((STATUS_CONFIG as any)[machine.status.toLowerCase()] || STATUS_CONFIG.offline).color }}>
                      {machine.typeIcon === 'Tractor' ? <Tractor size={20} /> : machine.typeIcon === 'Truck' ? <Truck size={20} /> : <Zap size={20} />}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-base font-black italic tracking-tighter leading-none uppercase">{machine.code}</span>
                      <span className="text-[9px] uppercase text-muted-foreground font-bold tracking-widest">{machine.typeName}</span>
                    </div>
                  </div>
                  <div className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase border" style={{ color: ((STATUS_CONFIG as any)[machine.status.toLowerCase()] || STATUS_CONFIG.offline).color, borderColor: `${((STATUS_CONFIG as any)[machine.status.toLowerCase()] || STATUS_CONFIG.offline).color}40`, backgroundColor: `${((STATUS_CONFIG as any)[machine.status.toLowerCase()] || STATUS_CONFIG.offline).color}10` }}>
                    {((STATUS_CONFIG as any)[machine.status.toLowerCase()] || STATUS_CONFIG.offline).label}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-4">
                  <PopupDetail icon={<User size={12} />} label="Operador" value={machine.operatorName} />
                  <PopupDetail icon={<Zap size={12} />} label="Operação" value={machine.operationName} />
                  <PopupDetail icon={<Gauge size={12} />} label="Velocidade" value={`${machine.speed || 0} km/h`} />
                  <PopupDetail icon={<Clock size={12} />} label="Horímetro" value={`${machine.hourmeter}h`} />
                  <PopupDetail icon={<MapPin size={12} />} label="Fazenda" value={machine.farmName} />
                  <PopupDetail icon={<Navigation size={12} />} label="Talhão" value={machine.fieldName} />
                </div>

                <div className="pt-3 border-t border-[#2d3647]/50 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full", machine.isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]")}></div>
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Último GPS</span>
                    </div>
                    <span className="text-[9px] text-white font-black uppercase">{machine.lastGpsAt ? new Date(machine.lastGpsAt).toLocaleTimeString() : '-'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-1.5 h-1.5 rounded-full", machine.isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]")}></div>
                      <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">Último Heartbeat</span>
                    </div>
                    <span className="text-[9px] text-white font-black uppercase">{machine.lastHeartbeatAt ? new Date(machine.lastHeartbeatAt).toLocaleTimeString() : '-'}</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

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

function PopupDetail({ icon, label, value }: any) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground font-black uppercase tracking-tighter">
        <span className="text-primary">{icon}</span>
        {label}
      </div>
      <div className="text-[11px] font-bold text-white truncate max-w-[100px] uppercase">{value}</div>
    </div>
  );
}
