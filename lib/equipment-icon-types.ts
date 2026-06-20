/* ─────────────────────────────────────────────────────────────────────────────
 * SILO OPS — Equipment Icon Types
 * Tipagem central para ícones operacionais de equipamento.
 * ────────────────────────────────────────────────────────────────────────── */

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

/* Categorias para filtro no picker */
export const EQUIPMENT_ICON_CATEGORIES: Record<string, EquipmentIconType[]> = {
  'Agrícola':      ['TRATOR', 'COLHEDORA', 'TRANSBORDO', 'PLANTADEIRA', 'PULVERIZADOR',
                    'IMPLEMENTO', 'GRADE_IMPLEMENTO', 'SULCADOR', 'COMBOIO', 'BOMBA_COMBUSTIVEL'],
  'Transporte':    ['CAMINHAO', 'CAMINHAO_BASCULANTE', 'CAMINHAO_PIPA', 'CARRETA_PRANCHA', 'VEICULO', 'MOTO'],
  'Construção':    ['PA_CARREGADEIRA', 'MOTONIVELADORA', 'ESCAVADEIRA', 'TRATOR_ESTEIRA'],
  'Infraestrutura':['SILO', 'TORRE', 'LEITOR_RFID', 'MOBILE', 'PLUVIOMETRO', 'PADRAO_GENERICO'],
  'Outros':        [],
};

/* ── Status operacional no mapa ─────────────────────────────────────────── */

export const EQUIPMENT_OPERATIONAL_STATUSES = [
  'OPERANDO',
  'PARADO',
  'ALERTA',
  'OFFLINE',
  'MANUTENCAO',
  'ABASTECIMENTO',
] as const;

export type EquipmentMapStatus = (typeof EQUIPMENT_OPERATIONAL_STATUSES)[number];

export const STATUS_COLORS: Record<EquipmentMapStatus, { ring: string; bg: string; label: string }> = {
  OPERANDO:      { ring: '#22c55e', bg: '#16a34a', label: 'Operando'      },
  PARADO:        { ring: '#f59e0b', bg: '#d97706', label: 'Parado'        },
  ALERTA:        { ring: '#ef4444', bg: '#dc2626', label: 'Alerta'        },
  OFFLINE:       { ring: '#6b7280', bg: '#4b5563', label: 'Offline'       },
  MANUTENCAO:    { ring: '#a855f7', bg: '#9333ea', label: 'Manutenção'    },
  ABASTECIMENTO: { ring: '#06b6d4', bg: '#0891b2', label: 'Abastecimento' },
};

/** Resolve iconType com fallback seguro */
export function resolveIconType(value: string | null | undefined): EquipmentIconType {
  if (!value) return 'PADRAO_GENERICO';
  const upper = value.toUpperCase().replace(/[\s\-\/]/g, '_') as EquipmentIconType;
  if ((EQUIPMENT_ICON_TYPES as readonly string[]).includes(upper)) return upper;
  return 'PADRAO_GENERICO';
}

/** Mapeia status legado do sistema para EquipmentMapStatus */
export function resolveMapStatus(status: string | null | undefined): EquipmentMapStatus {
  if (!status) return 'OFFLINE';
  const s = status.toUpperCase();
  if (s === 'OPERANDO' || s === 'TRABALHANDO' || s === 'ONLINE') return 'OPERANDO';
  if (s === 'PARADO' || s === 'DESLOCANDO' || s === 'FINALIZADO') return 'PARADO';
  if (s === 'ALARME' || s === 'ALERTA') return 'ALERTA';
  if (s === 'MANUTENCAO' || s === 'MANUTENÇÃO') return 'MANUTENCAO';
  if (s === 'ABASTECIMENTO') return 'ABASTECIMENTO';
  if (s === 'OFFLINE' || s === 'INATIVO') return 'OFFLINE';
  return 'OFFLINE';
}
