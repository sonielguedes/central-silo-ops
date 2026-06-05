import {
  BarChart3,
  Truck,
  Users,
  PauseCircle,
  TrendingUp,
  Fuel,
  RefreshCw,
  ShieldCheck
} from 'lucide-react';

export const REPORT_CATEGORIES = [
  { id: 'operacional', title: 'Operacional Geral', desc: 'Visão macro de todas as operações em curso.', icon: BarChart3, color: 'text-emerald-500', href: '/relatorios/operacional' },
  { id: 'equipamentos', title: 'Equipamentos', desc: 'Análise de performance e telemetria da frota.', icon: Truck, color: 'text-blue-500', href: '/relatorios/equipamentos' },
  { id: 'operadores', title: 'Operadores', desc: 'Produtividade e jornada de trabalho dos colaboradores.', icon: Users, color: 'text-purple-500', href: '/relatorios/operadores' },
  { id: 'paradas', title: 'Paradas', desc: 'Relatório de indisponibilidade e motivos de parada.', icon: PauseCircle, color: 'text-orange-500', href: '/relatorios/paradas' },
  { id: 'produtividade', title: 'Produtividade', desc: 'Indicadores de produção por área e cultura.', icon: TrendingUp, color: 'text-primary', href: '/relatorios/produtividade' },
  { id: 'abastecimentos', title: 'Abastecimentos', desc: 'Controle de consumo de combustível e custos.', icon: Fuel, color: 'text-red-500', href: '/relatorios/abastecimentos' },
  { id: 'sincronizacao', title: 'Sincronização', desc: 'Auditoria de integridade e envio de dados.', icon: RefreshCw, color: 'text-cyan-500', href: '/relatorios/sincronizacao' },
  { id: 'auditoria', title: 'Auditoria', desc: 'Log de ações de usuários e alterações no sistema.', icon: ShieldCheck, color: 'text-gray-400', href: '/relatorios/auditoria' },
];

export const OPERATIONAL_REPORT_DATA = [
  { id: '1', farm: 'Faz. Santa Clara', field: 'Talhão 12', operation: 'Colheita Soja', start: '2024-06-04 07:00', end: '2024-06-04 17:00', duration: '10h 00m', production: '450 t', efficiency: '92%' },
  { id: '2', farm: 'Faz. Santa Clara', field: 'Talhão 14', operation: 'Colheita Soja', start: '2024-06-04 08:30', end: '2024-06-04 18:30', duration: '10h 00m', production: '420 t', efficiency: '88%' },
  { id: '3', farm: 'Faz. Rio Verde', field: 'Talhão 05', operation: 'Plantio Milho', start: '2024-06-04 06:00', end: '2024-06-04 16:00', duration: '10h 00m', production: '-', efficiency: '95%' },
];
