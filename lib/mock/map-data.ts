import {
  Truck,
  Tractor,
  HardHat,
  Hammer,
  Droplets,
  Grid3X3,
  Construction,
  Users,
  Wrench,
  Box
} from 'lucide-react';

export const MAP_KPIS = [
  { label: 'Online', value: '72', color: 'text-emerald-500' },
  { label: 'Em efetivo', value: '1', color: 'text-blue-500' },
  { label: 'Alarmes', value: '5', color: 'text-red-500' },
];

export const STATUS_CONFIG = {
  trabalhando: { label: 'Trabalhando', color: '#10b981', tailwind: 'bg-emerald-500', text: 'text-emerald-500' },
  deslocando: { label: 'Deslocando', color: '#fbbf24', tailwind: 'bg-amber-500', text: 'text-amber-500' },
  parada: { label: 'Parada', color: '#f97316', tailwind: 'bg-orange-500', text: 'text-orange-500' },
  alarme: { label: 'Alerta', color: '#ef4444', tailwind: 'bg-red-500', text: 'text-red-500' },
  manutencao: { label: 'Manutenção', color: '#a855f7', tailwind: 'bg-purple-500', text: 'text-purple-500' },
  offline: { label: 'Offline', color: '#6b7280', tailwind: 'bg-gray-500', text: 'text-gray-500' },
};

export const MACHINE_TYPES = {
  'CAMINHÃO': { label: 'CAMINHÃO', icon: Truck },
  'CAMINHÃO CANA': { label: 'CAMINHÃO CANA', icon: Truck },
  COLHEDORA: { label: 'COLHEDORA', icon: Tractor },
  TRANSBORDO: { label: 'TRANSBORDO', icon: Box },
  CARREGADEIRA: { label: 'CARREGADEIRA', icon: HardHat },
  TRATOR: { label: 'TRATOR', icon: Tractor },
  PULVERIZADOR: { label: 'PULVERIZADOR', icon: Droplets },
  PLANTADORA: { label: 'PLANTADORA', icon: Grid3X3 },
  COMBOIO: { label: 'COMBOIO', icon: Users },
  MOTONIVELADORA: { label: 'MOTONIVELADORA', icon: Construction },
  'PÁ CARREGADEIRA': { label: 'PÁ CARREGADEIRA', icon: Hammer },
  APOIO: { label: 'APOIO', icon: Users },
  OFICINA: { label: 'OFICINA', icon: Wrench },
};

export const FLEET_DATA = [
  {
    id: '601076',
    name: 'CAM PLANTIO',
    type: 'CAMINHÃO',
    operation: 'SEM OPERAÇÃO',
    status: 'deslocando',
    lastSignal: 'Agora',
    pos: [-12.5568, -55.7229] as [number, number],
    operator: 'Ricardo Silva',
    speed: '45 km/h',
    hourmeter: '1.240h',
    farm: 'Faz. Santa Clara',
    field: 'Talhão 12'
  },
  {
    id: '613020',
    name: 'CARREGADEIRA',
    type: 'CARREGADEIRA',
    operation: 'AGUARDANDO CAMINHÃO',
    status: 'parada',
    lastSignal: '2 min',
    pos: [-12.5590, -55.7210] as [number, number],
    operator: 'Marcos Souza',
    speed: '0 km/h',
    hourmeter: '850h',
    farm: 'Faz. Santa Clara',
    field: 'Talhão 14'
  },
  {
    id: '614004',
    name: 'CARREG BELL',
    type: 'CARREGADEIRA',
    operation: 'RPM MÁXIMA MOTOR',
    status: 'alarme',
    lastSignal: 'Agora',
    pos: [-12.5540, -55.7260] as [number, number],
    operator: 'Luiz Castro',
    speed: '12 km/h',
    hourmeter: '3.120h',
    farm: 'Frente 03',
    field: 'Talhão 05'
  },
  {
    id: '602073',
    name: 'TR TRANSBORDO',
    type: 'TRANSBORDO',
    operation: 'MANUTENÇÃO OFICINA',
    status: 'manutencao',
    lastSignal: '12 min',
    pos: [-12.5510, -55.7180] as [number, number],
    operator: 'Antônio M.',
    speed: '0 km/h',
    hourmeter: '2.450h',
    farm: 'Oficina Central',
    field: 'Setor A'
  },
  {
    id: '605112',
    name: 'COLHEDORA JD',
    type: 'COLHEDORA',
    operation: 'COLHEITA SOJA',
    status: 'trabalhando',
    lastSignal: 'Agora',
    pos: [-12.5620, -55.7280] as [number, number],
    operator: 'João P.',
    speed: '4.5 km/h',
    hourmeter: '4.890h',
    farm: 'Faz. Santa Clara',
    field: 'Talhão 12'
  },
  {
    id: '609001',
    name: 'TRATOR CASE',
    type: 'TRATOR',
    operation: 'OFFLINE',
    status: 'offline',
    lastSignal: '45 min',
    pos: [-12.5650, -55.7150] as [number, number],
    operator: 'Indisponível',
    speed: '0 km/h',
    hourmeter: '5.100h',
    farm: 'Faz. Santa Clara',
    field: 'Talhão 18'
  },
];
