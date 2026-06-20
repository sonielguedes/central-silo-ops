"use client";

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Tractor, Truck, Navigation, MapPin, Clock, User, Zap } from 'lucide-react';
import { renderToString } from 'react-dom/server';

// Fix for default marker icons
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Custom Marker Creator
const createCustomIcon = (type: string, color: string, id: string) => {
  const IconComponent = type === 'Colhedora' ? Tractor : type === 'Caminhão' ? Truck : Navigation;

  const html = renderToString(
    <div className="relative flex flex-col items-center">
      <div className={`w-10 h-10 rounded-full border-2 border-white/40 flex items-center justify-center shadow-2xl transition-all duration-300 bg-[${color}]`} style={{ backgroundColor: color }}>
        <div className="text-white">
          <IconComponent size={20} />
        </div>
      </div>
      <div className="mt-1 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded border border-white/20">
        <span className="text-[9px] font-black text-white italic tracking-tighter uppercase">{id}</span>
      </div>
    </div>
  );

  return L.divIcon({
    className: 'custom-machine-marker',
    html: html,
    iconSize: [40, 60],
    iconAnchor: [20, 50],
  });
};

const MACHINE_DATA = [
  { id: 'COL-01', type: 'Colhedora', pos: [-12.5568, -55.7229] as [number, number], status: 'working', color: '#10b981', op: 'Colheita Soja', speed: '4.5 km/h', operator: 'Ricardo Silva' },
  { id: 'COL-02', type: 'Colhedora', pos: [-12.5590, -55.7210] as [number, number], status: 'working', color: '#10b981', op: 'Colheita Soja', speed: '4.2 km/h', operator: 'Marcos Souza' },
  { id: 'TRB-01', type: 'Transbordo', pos: [-12.5540, -55.7260] as [number, number], status: 'moving', color: '#fbbf24', op: 'Aguardando', speed: '12.0 km/h', operator: 'Luiz Castro' },
  { id: 'CAM-12', type: 'Caminhão', pos: [-12.5510, -55.7180] as [number, number], status: 'moving', color: '#fbbf24', op: 'Em Rota', speed: '65.0 km/h', operator: 'Antônio M.' },
];

export default function FullMap() {
  const farmCenter: [number, number] = [-12.5568, -55.7229];

  return (
    <div className="w-full h-full">
      <MapContainer
        center={farmCenter}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl={false}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/only_labels/{z}/{y}/{x}.png"
          opacity={0.7}
        />

        {MACHINE_DATA.map((m) => (
          <Marker
            key={m.id}
            position={m.pos}
            icon={createCustomIcon(m.type, m.color, m.id)}
          >
            <Popup className="silo-popup" minWidth={220}>
              <div className="bg-[#0a0e27] text-white p-3 rounded-xl border border-[#2d3647] font-sans">
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2d3647]/50">
                  <div className="flex flex-col">
                    <span className="text-sm font-black italic tracking-tighter text-white">{m.id}</span>
                    <span className="text-[8px] uppercase text-primary font-bold">{m.type}</span>
                  </div>
                  <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border`} style={{ color: m.color, borderColor: `${m.color}40`, backgroundColor: `${m.color}10` }}>
                    {m.status}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <PopupInfo icon={<Zap size={10} />} label="Operação" value={m.op} />
                  <PopupInfo icon={<Navigation size={10} />} label="Velocidade" value={m.speed} />
                  <PopupInfo icon={<User size={10} />} label="Operador" value={m.operator} />
                  <PopupInfo icon={<Clock size={10} />} label="Último Sinal" value="Agora" />
                </div>

                <div className="pt-2 border-t border-[#2d3647]/50">
                  <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                    <MapPin size={10} className="text-primary" />
                    <span>Faz. Santa Clara • Talhão 12</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        <ZoomControl position="bottomleft" />
      </MapContainer>

      <style jsx global>{`
        .leaflet-container {
          background: #050812 !important;
        }
        .silo-popup .leaflet-popup-content-wrapper {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border: none !important;
        }
        .silo-popup .leaflet-popup-content {
          margin: 0 !important;
        }
        .silo-popup .leaflet-popup-tip {
          background: #0a0e27 !important;
          border: 1px solid #2d3647 !important;
        }
        .leaflet-popup-close-button {
          color: #6b7280 !important;
          padding: 8px !important;
        }
      `}</style>
    </div>
  );
}

function PopupInfo({ icon, label, value }: any) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tight flex items-center gap-1">
        {icon} {label}
      </span>
      <span className="text-[10px] font-bold text-white truncate">{value}</span>
    </div>
  );
}
