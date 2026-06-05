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
  TimelineEvent
} from '../types';

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
    id: 'usr-admin',
    name: 'Admin Piloto',
    username: 'admin.piloto',
    email: 'admin@siloopsagro.com.br',
    accessGroupId: 'ag-admin',
    unitId: 'u-sorriso',
    isADValidated: false,
    requirePasswordChange: false,
    status: 'ATIVO'
  },
  {
    ...DEFAULT_AUDIT,
    id: 'usr-coa',
    name: 'Supervisor COA',
    username: 'coa.piloto',
    email: 'coa@siloopsagro.com.br',
    accessGroupId: 'ag-supervisor',
    unitId: 'u-sorriso',
    isADValidated: false,
    requirePasswordChange: false,
    status: 'ATIVO'
  },
  {
    ...DEFAULT_AUDIT,
    id: 'usr-viewer',
    name: 'Visualizador Piloto',
    username: 'view.piloto',
    email: 'viewer@siloopsagro.com.br',
    accessGroupId: 'ag-visualizador',
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
    userId: 'usr-admin',
    userName: 'Admin Piloto',
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

export const INITIAL_EQUIPMENT_TYPES: EquipmentType[] = [
  { ...DEFAULT_AUDIT, id: 'et-1', name: 'COLHEDORA', category: 'MOTORIZADO', icon: 'Tractor' },
  { ...DEFAULT_AUDIT, id: 'et-2', name: 'TRATOR', category: 'MOTORIZADO', icon: 'Tractor' },
  { ...DEFAULT_AUDIT, id: 'et-3', name: 'CAMINHÃO', category: 'MOTORIZADO', icon: 'Truck' },
  { ...DEFAULT_AUDIT, id: 'et-4', name: 'TRANSBORDO', category: 'IMPLEMENTO', icon: 'Zap' },
];

export const INITIAL_EQUIPMENT_MODELS: EquipmentModel[] = [
  { ...DEFAULT_AUDIT, id: 'em-1', name: 'S770', brand: 'John Deere', typeId: 'et-1' },
  { ...DEFAULT_AUDIT, id: 'em-2', name: 'R540', brand: 'Scania', typeId: 'et-3' },
  { ...DEFAULT_AUDIT, id: 'em-3', name: 'Magnum 340', brand: 'Case IH', typeId: 'et-2' },
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
  { ...DEFAULT_AUDIT, id: 'e-1', code: 'COL-101', typeId: 'et-1', modelId: 'em-1', groupId: 'eg-1', brand: 'John Deere', status: 'trabalhando', hourmeter: 4890, lastSignal: 'Agora' },
  { ...DEFAULT_AUDIT, id: 'e-2', code: 'COL-102', typeId: 'et-1', modelId: 'em-1', groupId: 'eg-1', brand: 'John Deere', status: 'trabalhando', hourmeter: 3200, lastSignal: 'Agora' },
  { ...DEFAULT_AUDIT, id: 'e-3', code: 'COL-201', typeId: 'et-1', modelId: 'em-1', groupId: 'eg-2', brand: 'John Deere', status: 'parada', hourmeter: 1500, lastSignal: '5 min' },
  { ...DEFAULT_AUDIT, id: 'e-4', code: 'TR-301', typeId: 'et-2', modelId: 'em-3', groupId: 'eg-1', brand: 'Case IH', status: 'deslocando', hourmeter: 2100, lastSignal: 'Agora' },
  { ...DEFAULT_AUDIT, id: 'e-5', code: 'TR-302', typeId: 'et-2', modelId: 'em-3', groupId: 'eg-2', brand: 'Case IH', status: 'trabalhando', hourmeter: 1800, lastSignal: 'Agora' },
  { ...DEFAULT_AUDIT, id: 'e-6', code: 'CAM-401', typeId: 'et-3', modelId: 'em-2', groupId: 'eg-3', brand: 'Scania', status: 'deslocando', hourmeter: 1240, lastSignal: '1 min' },
  { ...DEFAULT_AUDIT, id: 'e-7', code: 'CAM-402', typeId: 'et-3', modelId: 'em-2', groupId: 'eg-3', brand: 'Scania', status: 'parada', hourmeter: 980, lastSignal: '12 min' },
  { ...DEFAULT_AUDIT, id: 'e-8', code: 'COL-103', typeId: 'et-1', modelId: 'em-1', groupId: 'eg-1', brand: 'John Deere', status: 'alarme', hourmeter: 4500, lastSignal: 'Agora' },
  { ...DEFAULT_AUDIT, id: 'e-9', code: 'TR-303', typeId: 'et-2', modelId: 'em-3', groupId: 'eg-1', brand: 'Case IH', status: 'manutencao', hourmeter: 5100, lastSignal: '45 min' },
  { ...DEFAULT_AUDIT, id: 'e-10', code: 'CAM-403', typeId: 'et-3', modelId: 'em-2', groupId: 'eg-3', brand: 'Scania', status: 'offline', hourmeter: 2500, lastSignal: '2h' },
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
  {
    ...DEFAULT_AUDIT,
    id: 'tel-1',
    equipmentId: 'e-1',
    timestamp: new Date().toISOString(),
    latitude: -12.5568,
    longitude: -55.7229,
    speed: 4.5,
    rpm: 2100,
    operationalStateId: 'os-1',
    isOnline: true,
    lastHeartbeat: new Date().toISOString()
  }
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
  { ...DEFAULT_AUDIT, id: 'os-101', code: 'OS-2024-001', equipmentId: 'e-1', type: 'PREVENTIVA', priority: 'MEDIA', description: 'Troca de óleo e filtros de 500h', status: 'ABERTA', openedAt: new Date().toISOString() }
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
