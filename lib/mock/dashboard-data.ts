import {
  Truck,
  Play,
  AlertCircle,
  PauseCircle,
  Factory
} from 'lucide-react';

export const KPI_DATA = [
  {
    id: 'online-machines',
    title: 'Máquinas Online',
    value: '23',
    suffix: 'de 35',
    trend: '65% +',
    color: 'emerald',
    icon: Truck
  },
  {
    id: 'active-operations',
    title: 'Operações Ativas',
    value: '14',
    suffix: 'de 28',
    trend: '50% +',
    color: 'emerald',
    icon: Play
  },
  {
    id: 'critical-alerts',
    title: 'Alertas Críticos',
    value: '7',
    trend: '2',
    trendDown: true,
    color: 'red',
    icon: AlertCircle
  },
  {
    id: 'open-stops',
    title: 'Paradas Abertas',
    value: '9',
    trend: '1',
    color: 'amber',
    icon: PauseCircle
  },
  {
    id: 'day-production',
    title: 'Produção do Dia',
    value: '8.450',
    suffix: 't',
    trend: '12% +',
    color: 'emerald',
    icon: Factory
  }
];

export const EQUIPMENT_DATA = [
  { id: 'COL-01', model: 'John Deere S770', type: 'Colhedora', operation: 'Colheita Soja', status: 'Trabalhando', location: 'Faz. Santa Clara - Talhão 12', operator: 'Ricardo Silva', speed: '4.5 km/h', lastSignal: 'Agora' },
  { id: 'COL-02', model: 'John Deere S770', type: 'Colhedora', operation: 'Colheita Soja', status: 'Trabalhando', location: 'Faz. Santa Clara - Talhão 14', operator: 'Marcos Souza', speed: '4.2 km/h', lastSignal: 'Agora' },
  { id: 'COL-03', model: 'Case IH 8250', type: 'Colhedora', operation: '-', status: 'Offline', location: 'Sem comunicação', operator: 'Indisponível', speed: '0.0 km/h', lastSignal: '12 min' },
  { id: 'TRB-01', model: 'Case IH 8250', type: 'Transbordo', operation: 'Transbordo', status: 'Deslocando', location: 'A caminho do Talhão 14', operator: 'Luiz Castro', speed: '12.0 km/h', lastSignal: 'Agora' },
  { id: 'TRB-02', model: 'Case IH 8250', type: 'Transbordo', operation: 'Aguardando', status: 'Parada', location: 'Frente 03', operator: 'João P.', speed: '0.0 km/h', lastSignal: '2 min' },
  { id: 'CAM-12', model: 'Scania R540', type: 'Caminhão', operation: 'Transporte', status: 'Deslocando', location: 'BR-163 km 647', operator: 'Antônio M.', speed: '65.0 km/h', lastSignal: '1 min' },
  { id: 'CAM-08', model: 'Volvo FM 460', type: 'Caminhão', operation: 'Espera', status: 'Parada', location: 'Pátio Unidade Silo', operator: 'Pedro F.', speed: '0.0 km/h', lastSignal: '5 min' },
  { id: 'APO-01', model: 'Hilux 4x4', type: 'Apoio', operation: 'Manutenção', status: 'Alerta', location: 'Talhão 12', operator: 'Equipe Téc.', speed: '5.0 km/h', lastSignal: 'Agora' },
];

export const ALERTS_DATA = [
  { id: 1, title: 'Temperatura do motor acima do limite', equipment: 'COL-01', location: 'Faz. Santa Clara • Talhão 12', time: '2 min', type: 'Crítico', severity: 'error' },
  { id: 2, title: 'Parada não planejada detectada', equipment: 'CAM-08', location: 'Pátio Unidade Silo', time: '8 min', type: 'Atenção', severity: 'warning' },
  { id: 3, title: 'Abastecimento recomendado', equipment: 'COL-01', location: 'Faz. Santa Clara • Talhão 12', time: '15 min', type: 'Atenção', severity: 'warning' },
  { id: 4, title: 'Equipamento offline', equipment: 'COL-03', location: 'Sem comunicação', time: '22 min', type: 'Informativo', severity: 'info' },
];

export const PRODUCTIVITY_DATA = [
  { time: '00:00', value: 400 },
  { time: '04:00', value: 1200 },
  { time: '08:00', value: 3400 },
  { time: '12:00', value: 5800 },
  { time: '16:00', value: 8450 },
  { time: '20:00', value: null },
  { time: '23:59', value: null },
];

export const SYNC_DATA = {
  receivedEvents: 1248,
  receivedTrend: '18% ↑',
  pendingEvents: 27,
  pendingTrend: '5 ↑',
  lastSync: 'Hoje, 14:32:45',
  status: 'Conexão estável'
};
