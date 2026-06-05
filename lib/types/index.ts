
export type EntityStatus = 'ATIVO' | 'INATIVO' | 'ARQUIVADO';

export interface HistoryEntry {
  timestamp: string;
  user: string;
  action: string;
  changes?: Record<string, { old: any; new: any }>;
}

export interface BaseEntity {
  id: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  createdBy: string;
  updatedBy: string;
  entityStatus: EntityStatus;
  version: number;
  history: HistoryEntry[];
}

// --- Multi-tenancy & Admin ---
export type CompanyPlan = 'PILOTO' | 'PRO' | 'ENTERPRISE';

export interface Company extends BaseEntity {
  code: string;
  tradingName: string;
  corporateName: string;
  cnpj: string;
  domain?: string;
  plan: CompanyPlan;
  status: 'ATIVO' | 'INATIVO';
  observations?: string;
}

export interface Regional extends BaseEntity {
  code: string;
  name: string;
  manager?: string;
  status: 'ATIVO' | 'INATIVO';
}

export interface Unit extends BaseEntity {
  code: string;
  name: string;
  companyId: string;
  regionalId: string;
  manager?: string;
  city: string;
  state: string; // UF
  timezone: string;
  operationalColor: string;
  isDaylightSavingTime: boolean;
  status: 'ATIVO' | 'INATIVO';
}

// --- Auth & RBAC ---
export type PermissionAction =
  | 'visualizar'
  | 'criar'
  | 'editar'
  | 'arquivar'
  | 'exportar'
  | 'aprovar'
  | 'administrar';

export interface ModulePermission {
  module: string;
  actions: PermissionAction[];
}

export interface AccessGroup extends BaseEntity {
  name: string;
  description?: string;
  permissions: ModulePermission[];
  status: 'ATIVO' | 'INATIVO';
}

export interface User extends BaseEntity {
  name: string;
  username: string;
  email: string;
  phone?: string;
  jobTitle?: string; // Cargo
  accessGroupId: string;
  unitId?: string;
  isADValidated: boolean;
  password?: string;
  tempPassword?: string;
  requirePasswordChange: boolean;
  status: 'ATIVO' | 'BLOQUEADO';
}

export interface AuditLog extends BaseEntity {
  userId: string;
  userName: string;
  module: string;
  action: string;
  timestamp: string;
  ip: string;
  before?: any;
  after?: any;
  origin: 'WEB' | 'APK' | 'API' | 'MQTT';
}

// --- Operational Masters ---
export type StopCategory = 'OPERACIONAL' | 'MANUTENCAO' | 'CLIMA' | 'LOGISTICA' | 'SEGURANCA' | 'OUTROS';
export type StopType = 'PRODUTIVA' | 'IMPRODUTIVA';

export interface StopReason extends BaseEntity {
  code: string;
  description: string;
  category: StopCategory;
  type: StopType;
  requiresObservation: boolean;
  isActive: boolean;
}

export type EquipmentStatus = 'ativo' | 'inativo' | 'trabalhando' | 'deslocando' | 'parada' | 'alarme' | 'manutencao' | 'offline' | 'ATIVO' | 'INATIVO' | 'MANUTENCAO';

export interface Equipment extends BaseEntity {
  code: string;
  typeId: string; // Relacionado a EquipmentType
  modelId: string; // Relacionado a EquipmentModel
  groupId?: string; // Relacionado a EquipmentGroup
  profileId?: string; // Relacionado a EquipmentProfile
  brand: string;
  plateOrSerial?: string;
  status: EquipmentStatus;
  currentOperatorId?: string;
  hourmeter: number;
  lastSignal: string;
  observations?: string;
  icon?: string;
  // APK Integration Fields
  mobileEnabled: boolean;
  mobileToken?: string;
  lastHeartbeat?: string;
  lastLocation?: {
    latitude: number;
    longitude: number;
  };
  activeShiftId?: string;
}

// --- Fleet Module Masters ---

export interface EquipmentType extends BaseEntity {
  name: string;
  description?: string;
  category: 'MOTORIZADO' | 'IMPLEMENTO' | 'ESTATICO' | 'OUTROS';
  icon?: string;
}

export interface EquipmentModel extends BaseEntity {
  name: string;
  brand: string;
  typeId: string;
  technicalSpecs?: Record<string, string>;
}

export interface EquipmentGroup extends BaseEntity {
  name: string;
  description?: string;
  color?: string;
  status: 'ATIVO' | 'INATIVO';
}

export interface EquipmentProfile extends BaseEntity {
  name: string;
  description?: string;
  telemetryConfig?: {
    idleRpm?: number;
    maxRpm?: number;
    workingSpeedRange?: [number, number];
  };
}

// --- Telemetry ---
export interface TelemetryData extends BaseEntity {
  equipmentId: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  speed: number;
  rpm: number;
  fuelLevel?: number;
  engineTemp?: number;
  operationalStateId: string;
  isOnline: boolean;
  lastHeartbeat: string;
}

// --- Checklist ---
export type ChecklistQuestionType = 'YES_NO' | 'NUMERIC' | 'TEXT' | 'PHOTO';

export interface ChecklistQuestion {
  id: string;
  text: string;
  type: ChecklistQuestionType;
  required: boolean;
  isCritical: boolean; // P1 requirement: block if critical item fails
}

export interface ChecklistModel extends BaseEntity {
  name: string;
  description?: string;
  equipmentTypeId: string;
  questions: ChecklistQuestion[];
  isActive: boolean;
}

export interface ChecklistAnswer {
  questionId: string;
  value: string | number | boolean;
  isOk: boolean;
  photoUrl?: string;
  notes?: string;
}

export interface ChecklistExecution extends BaseEntity {
  modelId: string;
  equipmentId: string;
  operatorId: string;
  operationId?: string;
  timestamp: string;
  answers: ChecklistAnswer[];
  status: 'CONCLUIDO' | 'PENDENTE' | 'BLOQUEADO'; // BLOQUEADO if critical fails
  failureReason?: string;
}

// --- Operational Timeline ---
export type TimelineEventType =
  | 'STATUS_CHANGE'
  | 'ALERT'
  | 'RECORD'
  | 'CHECKLIST'
  | 'SUPPLY'
  | 'SYNC';

export interface TimelineEvent extends BaseEntity {
  equipmentId: string;
  operatorId: string;
  operationId?: string;
  timestamp: string;
  type: TimelineEventType;
  title: string;
  description: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  metadata?: Record<string, any>;
}

export interface OperationalState extends BaseEntity {
  code: string;
  name: string;
  abbreviation: string;
  color: string;
  category: 'TRABALHO' | 'TRANSPORTE' | 'PARADA_PLANEJADA' | 'PARADA_NAO_PLANEJADA' | 'MANUTENCAO';
  type: 'PRODUTIVO' | 'IMPRODUTIVO' | 'NEUTRO';
  accountsProduction: boolean;
  accountsAvailability: boolean;
  accountsOperationalHourmeter: boolean;
  requiresStopReason: boolean;
  allowsMovement: boolean;
  order: number;
  description?: string;
}

export type ImplementStatus = 'DISPONIVEL' | 'VINCULADO' | 'MANUTENCAO' | 'INATIVO' | 'ARQUIVADO';

export interface Implement extends BaseEntity {
  code: string;
  name: string;
  typeId: string;
  modelId: string;
  operationalWidth: number;
  totalSpacing: number;
  centerSection: number;
  generatesWorkedArea: boolean;
  isFixed: boolean;
  currentEquipmentId?: string;
  allowedOperations: string[];
  status: ImplementStatus;
  effectiveDate: string;
  observations?: string;
}

export interface FleetActivity extends BaseEntity {
  equipmentId: string;
  operatorId?: string;
  stateId: string;
  start: string;
  end?: string;
  durationMinutes?: number;
  location?: string;
  observations?: string;
}

export type OperatorStatus = 'ATIVO' | 'FERIAS' | 'AFASTADO' | 'INATIVO';

export interface Operator extends BaseEntity {
  registration: string; // Matrícula
  name: string;
  phone?: string;
  role: string; // Função
  status: OperatorStatus;
  shift: string; // Turno
  observations?: string;
}

export interface Farm extends BaseEntity {
  code: string;
  name: string;
  municipality: string;
  totalArea: number;
  status: 'ATIVO' | 'INATIVO';
}

export interface Field extends BaseEntity {
  code: string;
  farmId: string;
  area: number;
  crop: string; // Cultura
  coordinates?: string;
  status: 'ATIVO' | 'INATIVO';
}

// --- Operations ---
export type OperationStatus = 'PLANEJADA' | 'EM_CURSO' | 'PAUSADA' | 'FINALIZADA' | 'CANCELADA';

export interface Operation extends BaseEntity {
  type: string;
  equipmentId: string;
  operatorId: string;
  farmId: string;
  fieldId: string;
  start: string;
  end?: string;
  status: OperationStatus;
  observations?: string;
}

// --- Supply (Abastecimento) ---
export interface Supply extends BaseEntity {
  equipmentId: string;
  operatorId: string;
  liters: number;
  hourmeter: number;
  timestamp: string;
  observations?: string;
}

// --- Sync ---
export type SyncOrigin = 'APK' | 'CENTRAL' | 'MQTT' | 'API';
export type SyncStatus = 'PENDENTE' | 'SINCRONIZADO' | 'ERRO';

export interface SyncEvent extends BaseEntity {
  type: string;
  payload: any;
  status: SyncStatus;
  origin: SyncOrigin;
  errorMessage?: string;
  attempts: number;
  lastAttempt?: string;
}

// --- Alerts ---
export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type AlertStatus = 'ATIVO' | 'RESOLVIDO' | 'LIDO';

export interface Alert extends BaseEntity {
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  equipmentId?: string;
  timestamp: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

// --- Ferramentas ---

export type OperationalRecordStatus = 'PENDENTE' | 'VALIDADO' | 'INTEGRADO' | 'REJEITADO' | 'CORRIGIDO';

export interface OperationalRecord extends BaseEntity {
  eventId: string; // Idempotency key
  equipmentId: string;
  operatorId: string;
  farmId: string;
  fieldId: string;
  operationTypeId: string;
  start: string;
  end?: string;
  initialHourmeter: number;
  finalHourmeter?: number;
  status: OperationalRecordStatus;
  origin: 'APK' | 'PLANILHA' | 'API' | 'MQTT' | 'PIMS';
  inconsistencies: string[];
  justification?: string;
  integratedAt?: string;
  integratedBy?: string;
}

export interface IntegrationConfig extends BaseEntity {
  name: string;
  type: 'REST' | 'MQTT' | 'SQL' | 'SAP';
  endpoint: string;
  status: 'ATIVO' | 'INATIVO';
  lastSync?: string;
}

export interface ServiceOrder extends BaseEntity {
  code: string;
  equipmentId: string;
  type: 'PREVENTIVA' | 'CORRETIVA' | 'PREDITIVA';
  priority: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  description: string;
  status: 'ABERTA' | 'EM_EXECUCAO' | 'AGUARDANDO_PECA' | 'CONCLUIDA' | 'CANCELADA';
  openedAt: string;
  closedAt?: string;
}

// --- Comunicação Operacional ---

export type MessagePriority = 'NORMAL' | 'ALTA' | 'CRITICA';
export type MessageStatus = 'ENVIADA' | 'ENTREGUE' | 'LIDA' | 'ERRO' | 'EXPIRADA';

export interface OperationalMessage extends BaseEntity {
  equipmentId: string;
  operatorId?: string;
  content: string;
  priority: MessagePriority;
  requireConfirmation: boolean;
  status: MessageStatus;
  sentAt: string;
  deliveredAt?: string;
  readAt?: string;
  errorAt?: string;
  errorMessage?: string;
  retryCount: number;
}


