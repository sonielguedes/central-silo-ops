export const EQUIPMENT_ICON_TYPES = [
  'TRATOR',
  'COLHEDORA',
  'TRANSBORDO',
  'CAMINHAO',
  'CAMINHAO_BASCULANTE',
  'CAMINHAO_PIPA',
  'PLANTADEIRA',
  'PULVERIZADOR',
  'PA_CARREGADEIRA',
  'MOTONIVELADORA',
  'ESCAVADEIRA',
  'TRATOR_ESTEIRA',
  'COMBOIO',
  'BOMBA_COMBUSTIVEL',
  'CARRETA_PRANCHA',
  'GRADE_IMPLEMENTO',
  'SULCADOR',
  'IMPLEMENTO',
  'SILO',
  'TORRE',
  'LEITOR_RFID',
  'MOBILE',
  'VEICULO',
  'MOTO',
  'PLUVIOMETRO',
  'PADRAO_GENERICO',
] as const;

export type EquipmentIconType = (typeof EQUIPMENT_ICON_TYPES)[number];

export const EQUIPMENT_ICON_LABELS: Record<EquipmentIconType, string> = {
  TRATOR:              'Trator',
  COLHEDORA:           'Colhedora',
  TRANSBORDO:          'Transbordo',
  CAMINHAO:            'Caminhão',
  CAMINHAO_BASCULANTE: 'Caminhão Basculante',
  CAMINHAO_PIPA:       'Caminhão Pipa',
  PLANTADEIRA:         'Plantadeira',
  PULVERIZADOR:        'Pulverizador',
  PA_CARREGADEIRA:     'Pá Carregadeira',
  MOTONIVELADORA:      'Motoniveladora',
  ESCAVADEIRA:         'Escavadeira',
  TRATOR_ESTEIRA:      'Trator de Esteira',
  COMBOIO:             'Comboio',
  BOMBA_COMBUSTIVEL:   'Bomba Combustível',
  CARRETA_PRANCHA:     'Carreta / Prancha',
  GRADE_IMPLEMENTO:    'Grade / Implemento',
  SULCADOR:            'Sulcador',
  IMPLEMENTO:          'Implemento',
  SILO:                'Silo',
  TORRE:               'Torre',
  LEITOR_RFID:         'Leitor RFID',
  MOBILE:              'Mobile',
  VEICULO:             'Veículo',
  MOTO:                'Moto',
  PLUVIOMETRO:         'Pluviômetro',
  PADRAO_GENERICO:     'Padrão / Genérico',
};

export const EQUIPMENT_ICON_CATEGORIES: Record<string, EquipmentIconType[]> = {
  Agrícola:      ['TRATOR', 'COLHEDORA', 'TRANSBORDO', 'PLANTADEIRA', 'PULVERIZADOR', 'IMPLEMENTO', 'GRADE_IMPLEMENTO', 'SULCADOR', 'COMBOIO', 'BOMBA_COMBUSTIVEL'],
  Transporte:    ['CAMINHAO', 'CAMINHAO_BASCULANTE', 'CAMINHAO_PIPA', 'CARRETA_PRANCHA', 'VEICULO', 'MOTO'],
  Construção:    ['PA_CARREGADEIRA', 'MOTONIVELADORA', 'ESCAVADEIRA', 'TRATOR_ESTEIRA'],
  Infraestrutura:['SILO', 'TORRE', 'LEITOR_RFID', 'MOBILE', 'PLUVIOMETRO', 'PADRAO_GENERICO'],
  Outros:        [],
};

export const EQUIPMENT_OPERATIONAL_STATUSES = [
  'OPERANDO',
  'MOVIMENTO',
  'DESLOCANDO',
  'PARADO',
  'ALERTA',
  'ALARME',
  'FALHA',
  'SEM_HEARTBEAT',
  'OFFLINE',
  'MANUTENCAO',
  'ABASTECIMENTO',
  'INCONSISTENTE',
] as const;

export type EquipmentMapStatus = (typeof EQUIPMENT_OPERATIONAL_STATUSES)[number];

export const STATUS_COLORS: Record<EquipmentMapStatus, { ring: string; bg: string; label: string }> = {
  OPERANDO:      { ring: '#22c55e', bg: '#0f172a', label: 'Operando' },
  MOVIMENTO:     { ring: '#22c55e', bg: '#0f172a', label: 'Movimento' },
  DESLOCANDO:    { ring: '#3b82f6', bg: '#0f172a', label: 'Deslocando' },
  PARADO:        { ring: '#f59e0b', bg: '#111827', label: 'Parado' },
  ALERTA:        { ring: '#ef4444', bg: '#111827', label: 'Alerta' },
  ALARME:        { ring: '#ef4444', bg: '#111827', label: 'Alarme' },
  FALHA:         { ring: '#ef4444', bg: '#111827', label: 'Falha' },
  SEM_HEARTBEAT: { ring: '#ef4444', bg: '#111827', label: 'Sem heartbeat' },
  OFFLINE:       { ring: '#64748b', bg: '#0f172a', label: 'Offline' },
  MANUTENCAO:    { ring: '#a855f7', bg: '#111827', label: 'Manutenção' },
  ABASTECIMENTO: { ring: '#06b6d4', bg: '#0f172a', label: 'Abastecimento' },
  INCONSISTENTE: { ring: '#f97316', bg: '#111827', label: 'Inconsistente' },
};

const normalize = (value: string): string =>
  value
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-\/]+/g, '_');

export function resolveIconType(value: string | null | undefined): EquipmentIconType {
  if (!value) return 'PADRAO_GENERICO';
  const upper = normalize(value) as EquipmentIconType;
  if ((EQUIPMENT_ICON_TYPES as readonly string[]).includes(upper)) return upper;
  return 'PADRAO_GENERICO';
}

export function resolveMapStatus(status: string | null | undefined): EquipmentMapStatus {
  if (!status) return 'OFFLINE';
  const s = normalize(status);
  if (s === 'OPERANDO' || s === 'TRABALHANDO' || s === 'ONLINE' || s === 'MOVIMENTO') return 'OPERANDO';
  if (s === 'DESLOCANDO') return 'DESLOCANDO';
  if (s === 'PARADO' || s === 'FINALIZADO') return 'PARADO';
  if (s === 'ALERTA') return 'ALERTA';
  if (s === 'ALARME') return 'ALARME';
  if (s === 'FALHA') return 'FALHA';
  if (s === 'SEM_HEARTBEAT' || s === 'SEMHEARTBEAT') return 'SEM_HEARTBEAT';
  if (s === 'MANUTENCAO') return 'MANUTENCAO';
  if (s === 'ABASTECIMENTO') return 'ABASTECIMENTO';
  if (s === 'INCONSISTENTE' || s === 'PARADA_INCONSISTENTE') return 'INCONSISTENTE';
  if (s === 'OFFLINE' || s === 'INATIVO') return 'OFFLINE';
  return 'OFFLINE';
}
