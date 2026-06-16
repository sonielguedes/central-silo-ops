import {
  EntityStatus,
  Company,
  Regional,
  Unit,
  AccessGroup,
  User,
  AuditLog,
  StopReason,
  Equipment,
  EquipmentType,
  EquipmentModel,
  EquipmentGroup,
  EquipmentProfile,
  OperationalState,
  Implement,
  FleetActivity,
  Operator,
  Farm,
  Field,
  Operation,
  Supply,
  SyncEvent,
  Alert,
  OperationalRecord,
  IntegrationConfig,
  ServiceOrder,
  OperationalMessage,
  TelemetryData,
  ChecklistModel,
  ChecklistExecution,
  TimelineEvent,
  CostCenter,
} from '../types';
import {
  FLEET_OPERATIONAL_GROUPS,
  FLEET_TYPE_CATEGORIES,
  PRIMARY_METRIC_OPTIONS,
} from '../fleet-type-catalog';

export * from '../types';


const DEFAULT_AUDIT = {
  tenantId: 'silo-ops-001',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  createdBy: 'SISTEMA',
  updatedBy: 'SISTEMA',
  entityStatus: 'ATIVO' as EntityStatus,
  version: 1,
  history: []
};

export const INITIAL_COMPANIES: Company[] = [
  {
    ...DEFAULT_AUDIT,
    id: 'silo-ops-001',
    code: 'FM001',
    tradingName: 'Fazenda Modelo',
    corporateName: 'Modelo Agropecuária LTDA',
    cnpj: '00.000.000/0001-91',
    domain: 'fazendamodelo.com',
    apiPort: 3001,
    mqttPort: 18831,
    apiBaseUrl: 'https://api.siloops.com.br:3001',
    mqttUrl: 'mqtt.siloops.com.br:18831',
    companyToken: 'CMP-SILO-OPS-001',
    plan: 'ENTERPRISE',
    status: 'ATIVO'
  },
  {
    ...DEFAULT_AUDIT,
    id: 'silo-demo',
    code: 'SILO-DEMO',
    tradingName: 'SILO OPS Demo',
    corporateName: 'SILO OPS Demo LTDA',
    cnpj: '00.000.000/9999-99',
    domain: 'demo.siloops.com.br',
    apiPort: 3999,
    mqttPort: 18999,
    apiBaseUrl: 'https://api.siloops.com.br:3999',
    mqttUrl: 'mqtt.siloops.com.br:18999',
    companyToken: 'CMP-SILO-DEMO-001',
    plan: 'ENTERPRISE',
    status: 'ATIVO'
  }
];

export const INITIAL_REGIONALS: Regional[] = [
  { ...DEFAULT_AUDIT, id: 'reg-1', code: 'MT-NORTE', name: 'Norte Mato-Grossense', manager: 'Carlos Alberto', status: 'ATIVO' },
  { ...DEFAULT_AUDIT, id: 'reg-2', code: 'GO-SUL', name: 'Sul Goiano', manager: 'Ana Paula', status: 'ATIVO' },
];

export const INITIAL_UNITS: Unit[] = [
  {
    ...DEFAULT_AUDIT,
    id: 'u-sorriso',
    code: 'UNIT-SOR',
    name: 'Unidade Sorriso',
    companyId: 'silo-ops-001',
    regionalId: 'reg-1',
    manager: 'Fernando Souza',
    city: 'Sorriso',
    state: 'MT',
    timezone: 'UTC-4',
    operationalColor: '#10b981',
    isDaylightSavingTime: false,
    status: 'ATIVO'
  }
];

export const INITIAL_ACCESS_GROUPS: AccessGroup[] = [
  {
    ...DEFAULT_AUDIT,
    id: 'role-super-admin-silo',
    name: 'Super Admin SILO',
    description: 'Acesso global à plataforma.',
    status: 'ATIVO',
    permissions: [
      { module: 'ALL', actions: ['visualizar', 'criar', 'editar', 'arquivar', 'exportar', 'aprovar', 'administrar'] }
    ]
  },
  {
    ...DEFAULT_AUDIT,
    id: 'role-admin-empresa',
    name: 'Admin Empresa',
    description: 'Gestão total do tenant da empresa.',
    status: 'ATIVO',
    permissions: [
      { module: 'ALL', actions: ['visualizar', 'criar', 'editar', 'arquivar', 'exportar', 'aprovar'] }
    ]
  },
  {
    ...DEFAULT_AUDIT,
    id: 'ag-admin',
    name: 'Administrador Full',
    description: 'Acesso total a todos os módulos e configurações.',
    status: 'ATIVO',
    permissions: [
      { module: 'ALL', actions: ['visualizar', 'criar', 'editar', 'arquivar', 'exportar', 'aprovar', 'administrar'] }
    ]
  },
  {
    ...DEFAULT_AUDIT,
    id: 'ag-supervisor',
    name: 'Supervisor COA',
    description: 'Monitoramento e gestão operacional de frentes.',
    status: 'ATIVO',
    permissions: [
      { module: 'MONITORAMENTO', actions: ['visualizar', 'exportar'] },
      { module: 'FROTA', actions: ['visualizar', 'editar'] },
      { module: 'OPERACIONAL', actions: ['visualizar', 'criar', 'editar', 'aprovar'] }
    ]
  },
  {
    ...DEFAULT_AUDIT,
    id: 'ag-visualizador',
    name: 'Visualizador',
    description: 'Acesso apenas para consulta de dashboards e mapas.',
    status: 'ATIVO',
    permissions: [
      { module: 'MONITORAMENTO', actions: ['visualizar'] }
    ]
  }
];

export const INITIAL_USERS: User[] = [
  {
    ...DEFAULT_AUDIT,
    id: 'usr-soniel',
    name: 'Soniel Guedes',
    username: 'soniel.guedes',
    email: 'sonieloficial@gmail.com',
    accessGroupId: 'role-super-admin-silo',
    scope: 'PLATFORM',
    defaultTenantId: 'silo-demo',
    passwordHash: '',
    mustChangePassword: true,
    jobTitle: 'Diretor de Operações',
    unitId: 'u-sorriso',
    isADValidated: false,
    requirePasswordChange: false,
    status: 'ATIVO'
  },
  {
    ...DEFAULT_AUDIT,
    id: 'usr-admin-oficial',
    name: 'Administrador SILO OPS',
    username: 'admin.siloops',
    email: 'admin@siloops.com.br',
    accessGroupId: 'role-admin-empresa',
    scope: 'TENANT',
    defaultTenantId: 'silo-ops-001',
    passwordHash: '',
    mustChangePassword: false,
    jobTitle: 'Gestor de TI',
    unitId: 'u-sorriso',
    isADValidated: false,
    requirePasswordChange: false,
    status: 'ATIVO'
  },
  {
    ...DEFAULT_AUDIT,
    id: 'usr-demo',
    name: 'Admin Demo',
    username: 'admin.demo',
    email: 'admin@silo.com',
    accessGroupId: 'role-admin-empresa',
    scope: 'TENANT',
    defaultTenantId: 'silo-demo',
    passwordHash: '',
    mustChangePassword: false,
    jobTitle: 'Acesso Demonstrativo',
    unitId: 'u-sorriso',
    isADValidated: false,
    requirePasswordChange: false,
    status: 'ATIVO'
  },
  {
    ...DEFAULT_AUDIT,
    id: 'usr-coa-oficial',
    name: 'Supervisor COA',
    username: 'coa.oficial',
    email: 'coa@siloops.com.br',
    accessGroupId: 'ag-supervisor',
    scope: 'TENANT',
    defaultTenantId: 'silo-ops-001',
    passwordHash: '',
    mustChangePassword: false,
    jobTitle: 'Coordenador Operacional',
    unitId: 'u-sorriso',
    isADValidated: false,
    requirePasswordChange: false,
    status: 'ATIVO'
  },
  {
    ...DEFAULT_AUDIT,
    id: 'usr-viewer-oficial',
    name: 'Visualizador',
    username: 'viewer.oficial',
    email: 'viewer@siloops.com.br',
    accessGroupId: 'ag-visualizador',
    scope: 'TENANT',
    defaultTenantId: 'silo-ops-001',
    passwordHash: '',
    mustChangePassword: false,
    jobTitle: 'Acesso Consulta',
    unitId: 'u-sorriso',
    isADValidated: false,
    requirePasswordChange: false,
    status: 'ATIVO'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    ...DEFAULT_AUDIT,
    id: 'audit-1',
    userId: 'usr-admin-oficial',
    userName: 'Administrador SILO OPS',
    module: 'SISTEMA',
    action: 'SEED',
    timestamp: new Date().toISOString(),
    ip: '127.0.0.1',
    origin: 'WEB'
  }
];

export const INITIAL_STOP_REASONS: StopReason[] = [
  { ...DEFAULT_AUDIT, id: 'sr-1', code: '101', description: 'Aguardando Caminhão', category: 'LOGISTICA', type: 'IMPRODUTIVA', requiresObservation: false, isActive: true },
  { ...DEFAULT_AUDIT, id: 'sr-2', code: '201', description: 'Chuva Intermitente', category: 'CLIMA', type: 'IMPRODUTIVA', requiresObservation: true, isActive: true },
];

function mkType(
  id: string,
  code: string,
  name: string,
  description: string,
  category: (typeof FLEET_TYPE_CATEGORIES)[number],
  iconType: string,
  primaryMetric: (typeof PRIMARY_METRIC_OPTIONS)[number],
  telemetryEnabledDefault: boolean,
  canEnabledDefault: boolean,
  mobileEnabledDefault: boolean,
  mapEnabled: boolean,
  operationalGroup: (typeof FLEET_OPERATIONAL_GROUPS)[number],
  active = true,
  notes = '',
): EquipmentType {
  return {
    ...DEFAULT_AUDIT,
    id,
    code,
    name,
    description,
    category,
    icon: iconType,
    iconType,
    primaryMetric,
    telemetryEnabledDefault,
    canEnabledDefault,
    mobileEnabledDefault,
    mapEnabled,
    operationalGroup,
    active,
    notes,
  };
}

export const INITIAL_EQUIPMENT_TYPES: EquipmentType[] = [
  mkType('et-1', 'TRATOR', 'Trator', 'Máquina agrícola de tração e operação de implementos', 'Agrícola', 'TRATOR', 'HORIMETRO', true, true, true, true, 'MAQUINA_AGRICOLA'),
  mkType('et-2', 'COLHEDORA', 'Colhedora', 'Máquina agrícola para colheita mecanizada', 'Agrícola', 'COLHEDORA', 'HORIMETRO', true, true, true, true, 'MAQUINA_AGRICOLA'),
  mkType('et-3', 'TRANSBORDO', 'Transbordo', 'Equipamento de apoio para transporte interno de carga agrícola', 'Agrícola', 'TRANSBORDO', 'HORIMETRO', true, true, true, true, 'APOIO_AGRICOLA'),
  mkType('et-4', 'PULVERIZADOR', 'Pulverizador', 'Equipamento para aplicação de defensivos e insumos líquidos', 'Agrícola', 'PULVERIZADOR', 'HORIMETRO', true, true, true, true, 'MAQUINA_AGRICOLA'),
  mkType('et-5', 'PLANTADEIRA', 'Plantadeira', 'Implemento ou conjunto para plantio mecanizado', 'Implemento', 'PLANTADEIRA', 'HORIMETRO', false, false, true, true, 'IMPLEMENTO'),
  mkType('et-6', 'GRADE', 'Grade / Implemento', 'Implemento de preparo de solo', 'Implemento', 'GRADE_IMPLEMENTO', 'HORIMETRO', false, false, true, true, 'IMPLEMENTO'),
  mkType('et-7', 'IMPLEMENTO', 'Implemento Genérico', 'Implemento agrícola sem classificação específica', 'Implemento', 'GRADE_IMPLEMENTO', 'HORIMETRO', false, false, true, true, 'IMPLEMENTO'),
  mkType('et-8', 'CAMINHAO', 'Caminhão', 'Veículo rodoviário ou interno para transporte', 'Rodoviário', 'CAMINHAO', 'KM', true, true, true, true, 'RODOVIARIO'),
  mkType('et-9', 'CAMINHAO_BASCULANTE', 'Caminhão Basculante', 'Caminhão com caçamba basculante para transporte de carga', 'Rodoviário', 'CAMINHAO_BASCULANTE', 'KM', true, true, true, true, 'RODOVIARIO'),
  mkType('et-10', 'CAMINHAO_PIPA', 'Caminhão Pipa', 'Veículo para transporte e aplicação de água', 'Rodoviário', 'CAMINHAO_PIPA', 'KM', true, true, true, true, 'RODOVIARIO'),
  mkType('et-11', 'COMBOIO', 'Comboio', 'Veículo de apoio para abastecimento/manutenção em campo', 'Apoio', 'COMBOIO', 'KM', true, true, true, true, 'APOIO'),
  mkType('et-12', 'BOMBA_COMBUSTIVEL', 'Bomba de Combustível', 'Ponto ou equipamento de abastecimento', 'Infraestrutura', 'BOMBA_COMBUSTIVEL', 'UNIDADE', false, false, false, true, 'INFRAESTRUTURA'),
  mkType('et-13', 'PA_CARREGADEIRA', 'Pá Carregadeira', 'Máquina de carregamento e movimentação de material', 'Construção', 'PA_CARREGADEIRA', 'HORIMETRO', true, true, true, true, 'MAQUINA_PESADA'),
  mkType('et-14', 'MOTONIVELADORA', 'Motoniveladora', 'Máquina para nivelamento e manutenção de estradas', 'Construção', 'MOTONIVELADORA', 'HORIMETRO', true, true, true, true, 'MAQUINA_PESADA'),
  mkType('et-15', 'ESCAVADEIRA', 'Escavadeira', 'Máquina para escavação e movimentação de solo', 'Construção', 'ESCAVADEIRA', 'HORIMETRO', true, true, true, true, 'MAQUINA_PESADA'),
  mkType('et-16', 'TRATOR_ESTEIRA', 'Trator de Esteira', 'Máquina pesada de esteira para preparo e movimentação', 'Construção', 'TRATOR_ESTEIRA', 'HORIMETRO', true, true, true, true, 'MAQUINA_PESADA'),
  mkType('et-17', 'CARRETA_PRANCHA', 'Carreta / Prancha', 'Equipamento para transporte de máquinas', 'Rodoviário', 'CARRETA_PRANCHA', 'KM', false, false, false, true, 'RODOVIARIO'),
  mkType('et-18', 'SILO', 'Silo', 'Estrutura de armazenamento agrícola', 'Infraestrutura', 'SILO', 'UNIDADE', false, false, false, true, 'INFRAESTRUTURA'),
  mkType('et-19', 'TORRE', 'Torre / Rádio', 'Infraestrutura de comunicação ou telemetria', 'Infraestrutura', 'TORRE', 'UNIDADE', true, false, false, true, 'INFRAESTRUTURA'),
  mkType('et-20', 'LEITOR_RFID', 'Leitor RFID', 'Dispositivo de identificação e controle operacional', 'Infraestrutura', 'LEITOR_RFID', 'UNIDADE', true, false, false, true, 'INFRAESTRUTURA'),
  mkType('et-21', 'MOBILE', 'Dispositivo Mobile', 'Tablet ou celular usado em campo', 'Tecnologia', 'MOBILE', 'UNIDADE', true, false, true, true, 'TECNOLOGIA'),
  mkType('et-22', 'VEICULO', 'Veículo Leve', 'Veículo de apoio operacional', 'Apoio', 'VEICULO', 'KM', true, true, true, true, 'APOIO'),
  mkType('et-23', 'MOTO', 'Moto', 'Motocicleta de apoio operacional', 'Apoio', 'MOTO', 'KM', true, false, true, true, 'APOIO'),
  mkType('et-24', 'PLUVIOMETRO', 'Pluviômetro', 'Dispositivo de medição de chuva', 'Infraestrutura', 'PLUVIOMETRO', 'UNIDADE', true, false, false, true, 'INFRAESTRUTURA'),
  mkType('et-25', 'PADRAO_GENERICO', 'Padrão / Genérico', 'Tipo genérico para equipamentos sem classificação', 'Outros', 'PADRAO_GENERICO', 'UNIDADE', false, false, false, true, 'OUTROS'),
];

function mkModel(
  id: string,
  brand: string,
  name: string,
  operationalType: string,
  iconType: string,
  category: string,
  primaryMetric: 'HORIMETRO' | 'KM',
): EquipmentModel {
  return {
    ...DEFAULT_AUDIT,
    id,
    brand,
    name,
    typeId: '',
    // aliases técnicos
    manufacturer: brand,
    model: name,
    operationalType,
    iconType,
    category,
    primaryMetric,
    active: true,
    telemetryEnabled: false,
    canEnabled: false,
    mobileEnabled: true,
  };
}

export const INITIAL_EQUIPMENT_MODELS: EquipmentModel[] = [
  // ── John Deere ─────────────────────────────────────────────────────────
  mkModel('em-001', 'John Deere', '7200J',           'TRATOR',      'TRATOR',             'Agrícola',    'HORIMETRO'),
  mkModel('em-002', 'John Deere', '7230J',           'TRATOR',      'TRATOR',             'Agrícola',    'HORIMETRO'),
  mkModel('em-003', 'John Deere', '8370R',           'TRATOR',      'TRATOR',             'Agrícola',    'HORIMETRO'),
  mkModel('em-004', 'John Deere', '3520',            'COLHEDORA',   'COLHEDORA',          'Agrícola',    'HORIMETRO'),
  mkModel('em-005', 'John Deere', 'CH570',           'COLHEDORA',   'COLHEDORA',          'Agrícola',    'HORIMETRO'),
  mkModel('em-006', 'John Deere', 'CH670',           'COLHEDORA',   'COLHEDORA',          'Agrícola',    'HORIMETRO'),
  // ── Case IH ────────────────────────────────────────────────────────────
  mkModel('em-007', 'Case IH',   'Magnum 340',       'TRATOR',      'TRATOR',             'Agrícola',    'HORIMETRO'),
  mkModel('em-008', 'Case IH',   'Magnum 380',       'TRATOR',      'TRATOR',             'Agrícola',    'HORIMETRO'),
  mkModel('em-009', 'Case IH',   'A8800',            'COLHEDORA',   'COLHEDORA',          'Agrícola',    'HORIMETRO'),
  mkModel('em-010', 'Case IH',   'A9900',            'COLHEDORA',   'COLHEDORA',          'Agrícola',    'HORIMETRO'),
  // ── New Holland ────────────────────────────────────────────────────────
  mkModel('em-011', 'New Holland','T7.245',           'TRATOR',      'TRATOR',             'Agrícola',    'HORIMETRO'),
  mkModel('em-012', 'New Holland','T8.385',           'TRATOR',      'TRATOR',             'Agrícola',    'HORIMETRO'),
  // ── Valtra ─────────────────────────────────────────────────────────────
  mkModel('em-013', 'Valtra',    'BH 194',           'TRATOR',      'TRATOR',             'Agrícola',    'HORIMETRO'),
  mkModel('em-014', 'Valtra',    'BH 224',           'TRATOR',      'TRATOR',             'Agrícola',    'HORIMETRO'),
  // ── Massey Ferguson ────────────────────────────────────────────────────
  mkModel('em-015', 'Massey Ferguson','MF 6713',      'TRATOR',      'TRATOR',             'Agrícola',    'HORIMETRO'),
  mkModel('em-016', 'Massey Ferguson','MF 7725',      'TRATOR',      'TRATOR',             'Agrícola',    'HORIMETRO'),
  // ── Jacto ──────────────────────────────────────────────────────────────
  mkModel('em-017', 'Jacto',     'Uniport 3030',     'PULVERIZADOR','PULVERIZADOR',        'Agrícola',    'HORIMETRO'),
  mkModel('em-018', 'Jacto',     'Uniport 4530',     'PULVERIZADOR','PULVERIZADOR',        'Agrícola',    'HORIMETRO'),
  // ── Stara ──────────────────────────────────────────────────────────────
  mkModel('em-019', 'Stara',     'Imperador 3.0',    'PULVERIZADOR','PULVERIZADOR',        'Agrícola',    'HORIMETRO'),
  mkModel('em-020', 'Stara',     'Absoluta',         'PLANTADEIRA', 'PLANTADEIRA',         'Implemento',  'HORIMETRO'),
  // ── Baldan ─────────────────────────────────────────────────────────────
  mkModel('em-021', 'Baldan',    'PPSO',             'PLANTADEIRA', 'PLANTADEIRA',         'Implemento',  'HORIMETRO'),
  mkModel('em-022', 'Baldan',    'GACR',             'GRADE',       'GRADE_IMPLEMENTO',    'Implemento',  'HORIMETRO'),
  // ── Tatu Marchesan ────────────────────────────────────────────────────
  mkModel('em-023', 'Tatu Marchesan','GATCR',        'GRADE',       'GRADE_IMPLEMENTO',    'Implemento',  'HORIMETRO'),
  // ── Civemasa ──────────────────────────────────────────────────────────
  mkModel('em-024', 'Civemasa',  'GICR',             'GRADE',       'GRADE_IMPLEMENTO',    'Implemento',  'HORIMETRO'),
  // ── Santal ────────────────────────────────────────────────────────────
  mkModel('em-025', 'Santal',    'VT10000',          'TRANSBORDO',  'TRANSBORDO',          'Agrícola',    'HORIMETRO'),
  mkModel('em-026', 'Santal',    'VT12000',          'TRANSBORDO',  'TRANSBORDO',          'Agrícola',    'HORIMETRO'),
  // ── Antoniosi ────────────────────────────────────────────────────────
  mkModel('em-027', 'Antoniosi', 'VT 12.000',        'TRANSBORDO',  'TRANSBORDO',          'Agrícola',    'HORIMETRO'),
  mkModel('em-028', 'Antoniosi', 'VT 14.000',        'TRANSBORDO',  'TRANSBORDO',          'Agrícola',    'HORIMETRO'),
  // ── Grunner ──────────────────────────────────────────────────────────
  mkModel('em-029', 'Grunner',   'Smart Machine 4.0','TRANSBORDO',  'TRANSBORDO',          'Agrícola',    'HORIMETRO'),
  mkModel('em-030', 'Grunner',   'Smart Machine 5.0','TRANSBORDO',  'TRANSBORDO',          'Agrícola',    'HORIMETRO'),
  // ── Mercedes-Benz ────────────────────────────────────────────────────
  mkModel('em-031', 'Mercedes-Benz','Atego 2730',    'CAMINHAO',    'CAMINHAO',            'Rodoviário',  'KM'),
  mkModel('em-032', 'Mercedes-Benz','Arocs 3348',    'CAMINHAO_BASCULANTE','CAMINHAO_BASCULANTE','Rodoviário','KM'),
  // ── Volkswagen ───────────────────────────────────────────────────────
  mkModel('em-033', 'Volkswagen','Constellation 31.330','CAMINHAO', 'CAMINHAO',            'Rodoviário',  'KM'),
  mkModel('em-034', 'Volkswagen','Constellation 32.360','CAMINHAO_BASCULANTE','CAMINHAO_BASCULANTE','Rodoviário','KM'),
  // ── Volvo ────────────────────────────────────────────────────────────
  mkModel('em-035', 'Volvo',     'VM 330',           'CAMINHAO',    'CAMINHAO',            'Rodoviário',  'KM'),
  mkModel('em-036', 'Volvo',     'FH 540',           'CAMINHAO',    'CAMINHAO',            'Rodoviário',  'KM'),
  // ── Scania ───────────────────────────────────────────────────────────
  mkModel('em-037', 'Scania',    'R 450',            'CAMINHAO',    'CAMINHAO',            'Rodoviário',  'KM'),
  mkModel('em-038', 'Scania',    'P 360',            'CAMINHAO_BASCULANTE','CAMINHAO_BASCULANTE','Rodoviário','KM'),
  // ── Caterpillar ──────────────────────────────────────────────────────
  mkModel('em-039', 'Caterpillar','320D',            'ESCAVADEIRA', 'ESCAVADEIRA',         'Construção',  'HORIMETRO'),
  mkModel('em-040', 'Caterpillar','D6T',             'TRATOR_ESTEIRA','TRATOR_ESTEIRA',    'Construção',  'HORIMETRO'),
  mkModel('em-041', 'Caterpillar','924K',            'PA_CARREGADEIRA','PA_CARREGADEIRA',  'Construção',  'HORIMETRO'),
  mkModel('em-042', 'Caterpillar','120K',            'MOTONIVELADORA','MOTONIVELADORA',    'Construção',  'HORIMETRO'),
  // ── Komatsu ──────────────────────────────────────────────────────────
  mkModel('em-043', 'Komatsu',   'PC200',            'ESCAVADEIRA', 'ESCAVADEIRA',         'Construção',  'HORIMETRO'),
  mkModel('em-044', 'Komatsu',   'D61EX',            'TRATOR_ESTEIRA','TRATOR_ESTEIRA',    'Construção',  'HORIMETRO'),
  mkModel('em-045', 'Komatsu',   'WA200',            'PA_CARREGADEIRA','PA_CARREGADEIRA',  'Construção',  'HORIMETRO'),
  // ── Apoio ────────────────────────────────────────────────────────────
  mkModel('em-046', 'Toyota',    'Hilux',            'VEICULO',     'VEICULO',             'Apoio',       'KM'),
  mkModel('em-047', 'Chevrolet', 'S10',              'VEICULO',     'VEICULO',             'Apoio',       'KM'),
  mkModel('em-048', 'Fiat',      'Strada',           'VEICULO',     'VEICULO',             'Apoio',       'KM'),
  mkModel('em-049', 'Honda',     'Bros 160',         'MOTO',        'MOTO',                'Apoio',       'KM'),
  mkModel('em-050', 'Yamaha',    'Factor 150',       'MOTO',        'MOTO',                'Apoio',       'KM'),
  // ── Legados (IDs originais mantidos) ─────────────────────────────────
  mkModel('em-1',   'John Deere','S770',             'COLHEDORA',   'COLHEDORA',           'Agrícola',    'HORIMETRO'),
  mkModel('em-2',   'Scania',    'R540',             'CAMINHAO',    'CAMINHAO',            'Rodoviário',  'KM'),
  mkModel('em-3',   'Case IH',   'Magnum 340 (Legado)','TRATOR',   'TRATOR',              'Agrícola',    'HORIMETRO'),
];

export const INITIAL_EQUIPMENT_GROUPS: EquipmentGroup[] = [
  { ...DEFAULT_AUDIT, id: 'eg-1', name: 'FRENTE 01 - COLHEITA', description: 'Equipamentos da Frente 01', color: '#10b981', status: 'ATIVO' },
  { ...DEFAULT_AUDIT, id: 'eg-2', name: 'FRENTE 02 - COLHEITA', description: 'Equipamentos da Frente 02', color: '#3b82f6', status: 'ATIVO' },
  { ...DEFAULT_AUDIT, id: 'eg-3', name: 'FRENTE 03 - LOGÍSTICA', description: 'Equipamentos de Apoio', color: '#f59e0b', status: 'ATIVO' },
];

export const INITIAL_EQUIPMENT_PROFILES: EquipmentProfile[] = [
  { ...DEFAULT_AUDIT, id: 'ep-1', name: 'PERFIL COLHEITA PADRÃO', description: 'Configurações para colhedoras de grãos' },
];

export const INITIAL_OPERATIONAL_STATES: OperationalState[] = [
  {
    ...DEFAULT_AUDIT,
    id: 'os-1',
    code: '10',
    name: 'TRABALHANDO',
    abbreviation: 'EF',
    color: '#10b981',
    category: 'TRABALHO',
    type: 'PRODUTIVO',
    accountsProduction: true,
    accountsAvailability: true,
    accountsOperationalHourmeter: true,
    requiresStopReason: false,
    allowsMovement: true,
    order: 10
  },
  {
    ...DEFAULT_AUDIT,
    id: 'os-2',
    code: '11',
    name: 'MANOBRA',
    abbreviation: 'MN',
    color: '#34d399',
    category: 'TRABALHO',
    type: 'PRODUTIVO',
    accountsProduction: false,
    accountsAvailability: true,
    accountsOperationalHourmeter: true,
    requiresStopReason: false,
    allowsMovement: true,
    order: 11
  },
  {
    ...DEFAULT_AUDIT,
    id: 'os-3',
    code: '20',
    name: 'DESLOCAMENTO',
    abbreviation: 'DESL',
    color: '#fbbf24',
    category: 'TRANSPORTE',
    type: 'IMPRODUTIVO',
    accountsProduction: false,
    accountsAvailability: true,
    accountsOperationalHourmeter: true,
    requiresStopReason: false,
    allowsMovement: true,
    order: 20
  },
  {
    ...DEFAULT_AUDIT,
    id: 'os-4',
    code: '30',
    name: 'MANUTENÇÃO CORRETIVA',
    abbreviation: 'MCOR',
    color: '#ef4444',
    category: 'MANUTENCAO',
    type: 'IMPRODUTIVO',
    accountsProduction: false,
    accountsAvailability: false,
    accountsOperationalHourmeter: true,
    requiresStopReason: true,
    allowsMovement: false,
    order: 30
  },
  {
    ...DEFAULT_AUDIT,
    id: 'os-5',
    code: '40',
    name: 'AGUARDANDO CAMINHÃO',
    abbreviation: 'ACAM',
    color: '#f97316',
    category: 'PARADA_PLANEJADA',
    type: 'IMPRODUTIVO',
    accountsProduction: false,
    accountsAvailability: true,
    accountsOperationalHourmeter: true,
    requiresStopReason: true,
    allowsMovement: false,
    order: 40
  },
  {
    ...DEFAULT_AUDIT,
    id: 'os-6',
    code: '50',
    name: 'REFEIÇÃO',
    abbreviation: 'REF',
    color: '#6b7280',
    category: 'PARADA_PLANEJADA',
    type: 'NEUTRO',
    accountsProduction: false,
    accountsAvailability: false,
    accountsOperationalHourmeter: false,
    requiresStopReason: false,
    allowsMovement: false,
    order: 50
  },
];

export const INITIAL_IMPLEMENTS: Implement[] = [
  {
    ...DEFAULT_AUDIT,
    id: 'i-1',
    code: 'IMP-001',
    name: 'PLATAFORMA 35FT',
    typeId: 'et-4',
    modelId: 'em-1',
    status: 'DISPONIVEL',
    operationalWidth: 10.5,
    totalSpacing: 0,
    centerSection: 0,
    generatesWorkedArea: true,
    isFixed: false,
    allowedOperations: ['COLHEITA'],
    effectiveDate: new Date().toISOString()
  },
];

export const INITIAL_FLEET_ACTIVITIES: FleetActivity[] = [];

export const INITIAL_EQUIPMENT: Equipment[] = [
  { ...DEFAULT_AUDIT, id: 'e-1', code: 'COL-101', typeId: 'et-1', modelId: 'em-1', groupId: 'eg-1', brand: 'John Deere', status: 'trabalhando', hourmeter: 4890, lastSignal: 'Agora', mobileEnabled: true, mobileToken: 'TK-COL101' },
  { ...DEFAULT_AUDIT, id: 'e-2', code: 'COL-102', typeId: 'et-1', modelId: 'em-1', groupId: 'eg-1', brand: 'John Deere', status: 'trabalhando', hourmeter: 3200, lastSignal: 'Agora', mobileEnabled: true, mobileToken: 'TK-COL102' },
  { ...DEFAULT_AUDIT, id: 'e-3', code: 'COL-201', typeId: 'et-1', modelId: 'em-1', groupId: 'eg-2', brand: 'John Deere', status: 'parada', hourmeter: 1500, lastSignal: '5 min', mobileEnabled: false },
  { ...DEFAULT_AUDIT, id: 'e-4', code: 'TR-301', typeId: 'et-2', modelId: 'em-3', groupId: 'eg-1', brand: 'Case IH', status: 'deslocando', hourmeter: 2100, lastSignal: 'Agora', mobileEnabled: true, mobileToken: 'TK-TR301' },
  { ...DEFAULT_AUDIT, id: 'e-5', code: 'TR-302', typeId: 'et-2', modelId: 'em-3', groupId: 'eg-2', brand: 'Case IH', status: 'trabalhando', hourmeter: 1800, lastSignal: 'Agora', mobileEnabled: true, mobileToken: 'TK-TR302' },
  { ...DEFAULT_AUDIT, id: 'e-6', code: 'CAM-401', typeId: 'et-3', modelId: 'em-2', groupId: 'eg-3', brand: 'Scania', status: 'deslocando', hourmeter: 1240, lastSignal: '1 min', mobileEnabled: true, mobileToken: 'TK-CAM401' },
  { ...DEFAULT_AUDIT, id: 'e-7', code: 'CAM-402', typeId: 'et-3', modelId: 'em-2', groupId: 'eg-3', brand: 'Scania', status: 'parada', hourmeter: 980, lastSignal: '12 min', mobileEnabled: false },
  { ...DEFAULT_AUDIT, id: 'e-8', code: 'COL-103', typeId: 'et-1', modelId: 'em-1', groupId: 'eg-1', brand: 'John Deere', status: 'alarme', hourmeter: 4500, lastSignal: 'Agora', mobileEnabled: true, mobileToken: 'TK-COL103' },
  { ...DEFAULT_AUDIT, id: 'e-9', code: 'TR-303', typeId: 'et-2', modelId: 'em-3', groupId: 'eg-1', brand: 'Case IH', status: 'manutencao', hourmeter: 5100, lastSignal: '45 min', mobileEnabled: false },
  { ...DEFAULT_AUDIT, id: 'e-10', code: 'CAM-403', typeId: 'et-3', modelId: 'em-2', groupId: 'eg-3', brand: 'Scania', status: 'offline', hourmeter: 2500, lastSignal: '2h', mobileEnabled: false },
];

export const INITIAL_OPERATORS: Operator[] = [
  { ...DEFAULT_AUDIT, id: 'op-1', registration: '1001', name: 'Ricardo Silva', role: 'Motorista', status: 'ATIVO', shift: 'Turno A' },
  { ...DEFAULT_AUDIT, id: 'op-2', registration: '1002', name: 'Marcos Souza', role: 'Operador Máquina', status: 'ATIVO', shift: 'Turno A' },
  { ...DEFAULT_AUDIT, id: 'op-3', registration: '1003', name: 'Luiz Castro', role: 'Operador Máquina', status: 'ATIVO', shift: 'Turno B' },
  { ...DEFAULT_AUDIT, id: 'op-4', registration: '1004', name: 'João P.', role: 'Motorista', status: 'ATIVO', shift: 'Turno B' },
  { ...DEFAULT_AUDIT, id: 'op-5', registration: '1005', name: 'Antônio M.', role: 'Operador Máquina', status: 'ATIVO', shift: 'Turno A' },
  { ...DEFAULT_AUDIT, id: 'op-6', registration: '1006', name: 'Pedro F.', role: 'Motorista', status: 'ATIVO', shift: 'Turno C' },
  { ...DEFAULT_AUDIT, id: 'op-7', registration: '1007', name: 'Maria S.', role: 'Operador Máquina', status: 'ATIVO', shift: 'Turno B' },
  { ...DEFAULT_AUDIT, id: 'op-8', registration: '1008', name: 'José R.', role: 'Apoio', status: 'ATIVO', shift: 'Turno A' },
  { ...DEFAULT_AUDIT, id: 'op-9', registration: '1009', name: 'Carlos D.', role: 'Mecânico', status: 'ATIVO', shift: 'Turno A' },
  { ...DEFAULT_AUDIT, id: 'op-10', registration: '1010', name: 'Fernanda L.', role: 'Operador Máquina', status: 'ATIVO', shift: 'Turno C' },
];

export const INITIAL_FARMS: Farm[] = [
  { ...DEFAULT_AUDIT, id: 'f-1', code: 'FAZ-01', name: 'Fazenda Santa Clara', municipality: 'Sorriso/MT', totalArea: 12500, status: 'ATIVO' },
];

export const INITIAL_FIELDS: Field[] = [
  { ...DEFAULT_AUDIT, id: 'fi-1', farmId: 'f-1', code: 'TAL-12', area: 450, crop: 'Soja', status: 'ATIVO' },
  { ...DEFAULT_AUDIT, id: 'fi-2', farmId: 'f-1', code: 'TAL-14', area: 380, crop: 'Milho', status: 'ATIVO' },
];

export const INITIAL_OPERATIONS: Operation[] = [
  { ...DEFAULT_AUDIT, id: 'o-1', type: 'COLHEITA', equipmentId: 'e-1', operatorId: 'op-2', farmId: 'f-1', fieldId: 'fi-1', start: new Date().toISOString(), status: 'EM_CURSO' },
];

export const INITIAL_SUPPLIES: Supply[] = [];
export const INITIAL_SYNC_EVENTS: SyncEvent[] = [];
export const INITIAL_ALERTS: Alert[] = [
  { ...DEFAULT_AUDIT, id: 'a-1', title: 'RPM Máxima Motor', description: 'O equipamento excedeu o limite de RPM definido.', severity: 'CRITICAL', status: 'ATIVO', equipmentId: 'e-1', timestamp: new Date().toISOString() },
];

export const INITIAL_TELEMETRY: TelemetryData[] = [
  { ...DEFAULT_AUDIT, id: 'tel-1', equipmentId: 'e-1', timestamp: new Date().toISOString(), latitude: -12.5550, longitude: -55.7220, speed: 4.5, rpm: 2100, operationalStateId: 'os-1', isOnline: true, lastHeartbeat: new Date().toISOString() },
  { ...DEFAULT_AUDIT, id: 'tel-2', equipmentId: 'e-2', timestamp: new Date().toISOString(), latitude: -12.5560, longitude: -55.7240, speed: 5.2, rpm: 2150, operationalStateId: 'os-1', isOnline: true, lastHeartbeat: new Date().toISOString() },
  { ...DEFAULT_AUDIT, id: 'tel-3', equipmentId: 'e-3', timestamp: new Date().toISOString(), latitude: -12.5580, longitude: -55.7210, speed: 0.0, rpm: 800, operationalStateId: 'os-5', isOnline: true, lastHeartbeat: new Date().toISOString() },
  { ...DEFAULT_AUDIT, id: 'tel-4', equipmentId: 'e-4', timestamp: new Date().toISOString(), latitude: -12.5600, longitude: -55.7250, speed: 12.0, rpm: 1800, operationalStateId: 'os-3', isOnline: true, lastHeartbeat: new Date().toISOString() },
  { ...DEFAULT_AUDIT, id: 'tel-5', equipmentId: 'e-5', timestamp: new Date().toISOString(), latitude: -12.5520, longitude: -55.7280, speed: 4.8, rpm: 2120, operationalStateId: 'os-1', isOnline: true, lastHeartbeat: new Date().toISOString() },
  { ...DEFAULT_AUDIT, id: 'tel-6', equipmentId: 'e-6', timestamp: new Date().toISOString(), latitude: -12.5650, longitude: -55.7200, speed: 45.0, rpm: 1500, operationalStateId: 'os-3', isOnline: true, lastHeartbeat: new Date().toISOString() },
  { ...DEFAULT_AUDIT, id: 'tel-7', equipmentId: 'e-7', timestamp: new Date().toISOString(), latitude: -12.5680, longitude: -55.7230, speed: 0.0, rpm: 0, operationalStateId: 'os-6', isOnline: true, lastHeartbeat: new Date().toISOString() },
  { ...DEFAULT_AUDIT, id: 'tel-8', equipmentId: 'e-8', timestamp: new Date().toISOString(), latitude: -12.5540, longitude: -55.7180, speed: 3.2, rpm: 2300, operationalStateId: 'os-1', isOnline: true, lastHeartbeat: new Date().toISOString() },
  { ...DEFAULT_AUDIT, id: 'tel-9', equipmentId: 'e-9', timestamp: new Date().toISOString(), latitude: -12.5590, longitude: -55.7270, speed: 0.0, rpm: 0, operationalStateId: 'os-4', isOnline: true, lastHeartbeat: new Date().toISOString() },
  { ...DEFAULT_AUDIT, id: 'tel-10', equipmentId: 'e-10', timestamp: new Date().toISOString(), latitude: -12.5720, longitude: -55.7150, speed: 0.0, rpm: 0, operationalStateId: 'os-6', isOnline: false, lastHeartbeat: new Date(Date.now() - 7200000).toISOString() },
];

export const INITIAL_CHECKLIST_MODELS: ChecklistModel[] = [
  {
    ...DEFAULT_AUDIT,
    id: 'cm-1',
    name: 'CHECKLIST PRÉ-OPERACIONAL COLHEITA',
    equipmentTypeId: 'et-1',
    isActive: true,
    questions: [
      { id: 'q1', text: 'Nível de óleo do motor', type: 'YES_NO', required: true, isCritical: true },
      { id: 'q2', text: 'Estado das facas da plataforma', type: 'YES_NO', required: true, isCritical: false },
      { id: 'q3', text: 'Pressão dos pneus (PSI)', type: 'NUMERIC', required: true, isCritical: false },
    ]
  }
];

export const INITIAL_CHECKLIST_EXECUTIONS: ChecklistExecution[] = [];

export const INITIAL_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    ...DEFAULT_AUDIT,
    id: 'evt-1',
    equipmentId: 'e-1',
    operatorId: 'op-2',
    timestamp: new Date().toISOString(),
    type: 'STATUS_CHANGE',
    title: 'Início de Colheita',
    description: 'Equipamento iniciou operação efetiva.',
    severity: 'INFO'
  }
];

export const INITIAL_OPERATIONAL_RECORDS: OperationalRecord[] = [
  {
    ...DEFAULT_AUDIT,
    id: 'rec-1',
    eventId: 'evt-1001',
    equipmentId: 'e-1',
    operatorId: 'op-1',
    farmId: 'f-1',
    fieldId: 'fi-1',
    operationTypeId: 'os-1',
    start: '2024-06-04T08:00:00Z',
    end: '2024-06-04T12:00:00Z',
    initialHourmeter: 4500.5,
    finalHourmeter: 4504.5,
    status: 'PENDENTE',
    origin: 'APK',
    inconsistencies: []
  },
  {
    ...DEFAULT_AUDIT,
    id: 'rec-2',
    eventId: 'evt-1002',
    equipmentId: 'e-2',
    operatorId: 'op-2',
    farmId: 'f-1',
    fieldId: 'fi-2',
    operationTypeId: 'os-3',
    start: '2024-06-04T09:00:00Z',
    end: '2024-06-04T10:00:00Z',
    initialHourmeter: 1240.0,
    finalHourmeter: 1239.0, // Inconsistency: final < initial
    status: 'PENDENTE',
    origin: 'MQTT',
    inconsistencies: ['Horímetro final menor que inicial']
  }
];

export const INITIAL_INTEGRATIONS: IntegrationConfig[] = [
  { ...DEFAULT_AUDIT, id: 'int-1', name: 'SAP S/4HANA', type: 'SAP', endpoint: 'https://api.sap.com/records', status: 'ATIVO' },
  { ...DEFAULT_AUDIT, id: 'int-2', name: 'MQTT Broker Central', type: 'MQTT', endpoint: 'mqtt://broker.siloops.com', status: 'ATIVO' }
];

export const INITIAL_SERVICE_ORDERS: ServiceOrder[] = [
  {
    ...DEFAULT_AUDIT,
    id: 'os-101',
    code: 'OS-2026-001',
    description: 'Colheita Soja — Safra 2026/27',
    type: 'PREVENTIVA',
    priority: 'ALTA',
    status: 'ABERTA',
    equipmentId: 'e-1',
    operatorId: 'op-1',
    farmId: 'f-1',
    fieldId: 'tl-1',
    costCenterId: 'cc-1',
    operationId: 'op-colheita-1',
    shift: 'DIURNO',
    openedAt: new Date().toISOString(),
    plannedAt: new Date(Date.now() + 86_400_000).toISOString(),
    observations: 'Checar horímetro antes de iniciar.',
  },
  {
    ...DEFAULT_AUDIT,
    id: 'os-102',
    code: 'OS-2026-002',
    description: 'Plantio Milho — Talhão 03',
    type: 'PREVENTIVA',
    priority: 'MEDIA',
    status: 'ABERTA',
    equipmentId: 'e-4',
    operatorId: 'op-2',
    farmId: 'f-1',
    fieldId: 'tl-2',
    costCenterId: 'cc-2',
    operationId: 'op-plantio-1',
    implementId: 'impl-1',
    shift: 'DIURNO',
    openedAt: new Date().toISOString(),
    plannedAt: new Date(Date.now() + 172_800_000).toISOString(),
  },
  {
    ...DEFAULT_AUDIT,
    id: 'os-103',
    code: 'OS-2026-003',
    description: 'Aplicação de Defensivos — Área Norte',
    type: 'CORRETIVA',
    priority: 'ALTA',
    status: 'ABERTA',
    equipmentId: 'e-5',
    costCenterId: 'cc-5',
    shift: 'DIURNO',
    openedAt: new Date().toISOString(),
  },
];

export const INITIAL_COST_CENTERS: CostCenter[] = [
  { ...DEFAULT_AUDIT, id: 'cc-1', code: 'CC-AGR-01', name: 'Colheita Soja', description: 'Centro de custo para operações de colheita de soja', status: 'ATIVO' },
  { ...DEFAULT_AUDIT, id: 'cc-2', code: 'CC-AGR-02', name: 'Plantio Milho', description: 'Centro de custo para operações de plantio de milho', status: 'ATIVO' },
  { ...DEFAULT_AUDIT, id: 'cc-3', code: 'CC-MAN-01', name: 'Manutenção Frota', description: 'Centro de custo para manutenção de equipamentos', status: 'ATIVO' },
  { ...DEFAULT_AUDIT, id: 'cc-4', code: 'CC-LOG-01', name: 'Logística Interna', description: 'Centro de custo para transporte e logística interna', status: 'ATIVO' },
  { ...DEFAULT_AUDIT, id: 'cc-5', code: 'CC-AGR-03', name: 'Aplicação Defensivos', description: 'Centro de custo para pulverização e aplicação', status: 'ATIVO' },
];

export const INITIAL_OPERATIONAL_MESSAGES: OperationalMessage[] = [
  {
    ...DEFAULT_AUDIT,
    id: 'msg-1',
    equipmentId: 'e-1',
    operatorId: 'op-1',
    content: 'Favor retornar ao pátio para abastecimento.',
    priority: 'NORMAL',
    requireConfirmation: true,
    status: 'LIDA',
    sentAt: new Date().toISOString(),
    readAt: new Date().toISOString(),
    retryCount: 0
  }
];
