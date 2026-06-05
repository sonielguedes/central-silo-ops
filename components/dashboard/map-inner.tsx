"use client";

import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet with Next.js
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom icons for agricultural machines
const createMachineIcon = (color: string) => L.divIcon({
  className: 'custom-machine-icon',
  html: `<div style="background-color: ${color}; width: 32px; height: 32px; border-radius: 50%; border: 2px solid white; display: flex; items-center; justify-content: center; box-shadow: 0 0 10px rgba(0,0,0,0.5);"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 18h4"/><path d="M14 22h-4"/><path d="M16 6c0 1.1-.9 2-2 2h-4c-1.1 0-2-.9-2-2s.9-2 2-2h4c1.1 0 2 .9 2 2z"/><path d="M12 2v2"/><path d="M20 12c0 1.1-.9 2-2 2h-1c-1.1 0-2-.9-2-2V8h5v4z"/><path d="M4 12c0 1.1.9 2 2 2h1c1.1 0 2-.9 2-2V8H4v4z"/><path d="M15 14h-6v2c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-2z"/></svg></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const icons = {
  working: createMachineIcon('#10b981'),
  moving: createMachineIcon('#fbbf24'),
  stopped: createMachineIcon('#f97316'),
  alert: createMachineIcon('#ef4444'),
};

export default function MapInner() {
  // Coordenadas fictícias de uma fazenda (Região de Mato Grosso)
  const farmCenter: [number, number] = [-12.5568, -55.7229];

  const machines = [
    { id: 'COL-01', pos: [-12.5550, -55.7250] as [number, number], status: 'working' },
    { id: 'COL-02', pos: [-12.5580, -55.7210] as [number, number], status: 'working' },
    { id: 'TRB-01', pos: [-12.5595, -55.7280] as [number, number], status: 'moving' },
    { id: 'CAM-08', pos: [-12.5530, -55.7180] as [number, number], status: 'stopped' },
  ];

  const fieldBoundary: [number, number][] = [
    [-12.5510, -55.7300],
    [-12.5510, -55.7150],
    [-12.5650, -55.7150],
    [-12.5650, -55.7300],
    [-12.5510, -55.7300],
  ];

  return (
    <div className="w-full h-full min-h-[450px]">
      <MapContainer
        center={farmCenter}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        zoomControl={false}
      >
        {/* Camada de Satélite Grátis (Esri World Imagery) */}
        <TileLayer
          attribution='&copy; <a href="https://www.esri.com/">Esri</a>, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />

        {/* Camada de Rótulos (Opcional, para nomes de cidades/estradas) */}
        <TileLayer
          url="https://stamen-tiles-{s}.a.ssl.fastly.net/toner-labels/{z}/{y}/{x}.png"
          opacity={0.5}
        />

        {/* Polígono do Talhão */}
        <Polyline positions={fieldBoundary} color="#10b981" weight={2} dashArray="5, 10" />

        {/* Máquinas no Mapa */}
        {machines.map((m) => (
          <Marker
            key={m.id}
            position={m.pos}
            icon={icons[m.status as keyof typeof icons]}
          >
            <Popup className="custom-popup">
              <div className="text-xs font-sans">
                <p className="font-bold">{m.id}</p>
                <p className="text-muted-foreground uppercase text-[9px]">{m.status}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <style jsx global>{`
        .leaflet-container {
          background: #050812 !important;
        }
        .leaflet-bar {
          border: 1px solid #2d3647 !important;
          background: #0a0e27 !important;
        }
        .leaflet-bar a {
          background-color: #0a0e27 !important;
          color: white !important;
          border-bottom: 1px solid #2d3647 !important;
        }
        .leaflet-popup-content-wrapper {
          background: #0a0e27 !important;
          color: white !important;
          border: 1px solid #2d3647 !important;
          border-radius: 8px !important;
        }
        .leaflet-popup-tip {
          background: #0a0e27 !important;
          border: 1px solid #2d3647 !important;
        }
      `}</style>
    </div>
  );
}
