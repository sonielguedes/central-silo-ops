
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

/**
 * Status de assinatura / acesso da empresa.
 * - ATIVO:     acesso permitido normalmente.
 * - EXPIRANDO: acesso permitido com aviso (≤ 7 dias para vencer).
 * - EXPIRADO:  acesso bloqueado — clientes comuns não entram.
 * - SUSPENSO:  acesso bloqueado manualmente pelo admin da plataforma.
 * - CANCELADO: acesso encerrado definitivamente.
 */
export type SubscriptionStatus =
  | 'ATIVO'
  | 'EXPIRANDO'
  | 'EXPIRADO'
  | 'SUSPENSO'
  | 'CANCELADO';

/** Ciclo de cobrança para plano PRO. */
export type BillingCycle = 'MENSAL' | 'TRIMESTRAL' | 'ANUAL';

export interface Company extends BaseEntity {
  code: string;
  tradingName: string;
  corporateName: string;
  cnpj: string;
  domain?: string;
  apiPort?: number;
  mqttPort?: number;
  apiBaseUrl?: string;
  mqttUrl?: string;
  companyToken?: string;
  /** Aliases gravados em sincronia com companyToken para compatibilidade com APK */
  mobileToken?: string;
  apiToken?: string;
  token?: string;
  /**
   * Habilita/desabilita o acesso do APK mobile sem destruir o token.
   * Quando false, a rota /api/mobile/company/validate recusa o dispositivo,
   * mas o companyToken e preservado para reativacao futura.
   * undefined e tratado como habilitado (compatibilidade com registros antigos).
   */
  mobileEnabled?: boolean;
  plan: CompanyPlan;
  status: 'ATIVO' | 'INATIVO';
  observations?: string;

  // ── Campos de assinatura / plano de serviço ──────────────────────────────

  /** Status calculado da assinatura (ATIVO, EXPIRANDO, EXPIRADO, SUSPENSO, CANCELADO). */
  subscriptionStatus?: SubscriptionStatus;

  // PILOTO
  /** Dias de teste: 15 ou 30. Padrão: 30. */
  trialDays?: 15 | 30;
  /** ISO — data em que o período de teste começou. */
  trialStartedAt?: string;
  /** ISO — data em que o período de teste termina. */
  trialEndsAt?: string;

  // PRO
  /** Ciclo de cobrança (MENSAL = 30d, TRIMESTRAL = 90d, ANUAL = 365d). */
  billingCycle?: BillingCycle;
  /** ISO — início da assinatura PRO. */
  subscriptionStartedAt?: string;
  /** ISO — vencimento da assinatura PRO. */
  subscriptionEndsAt?: string;

  // ENTERPRISE
  /** ISO — início do contrato ENTERPRISE. */
  contractStartedAt?: string;
  /** ISO — fim do contrato ENTERPRISE (opcional). */
  contractEndsAt?: string;

  // Campos comuns pós-ativação
  /** ISO — data da última renovação (qualquer plano). */
  lastRenewedAt?: string;
  /** Dias restantes calculados em tempo real (não persistido, derivado). */
  daysRemaining?: number | null;
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
  scope?: 'PLATFORM' | 'TENANT';
  defaultTenantId?: string;
  isADValidated: boolean;
  password?: string;
  passwordHash?: string;
  tempPassword?: string;
  requirePasswordChange: boolean;
  mustChangePassword?: boolean;
  resetPasswordTokenHash?: string;
  resetPasswordExpiresAt?: string;
  resetPasswordUsedAt?: string;
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
  iconType?: string;
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

export type PrimaryMetric = 'HORIMETRO' | 'KM' | 'HORAS' | 'UNIDADE';
export type FleetTypeCategory = 'Agrícola' | 'Implemento' | 'Rodoviário' | 'Apoio' | 'Infraestrutura' | 'Construção' | 'Tecnologia' | 'Outros';
export type FleetOperationalGroup = 'MAQUINA_AGRICOLA' | 'APOIO_AGRICOLA' | 'IMPLEMENTO' | 'RODOVIARIO' | 'APOIO' | 'INFRAESTRUTURA' | 'MAQUINA_PESADA' | 'TECNOLOGIA' | 'OUTROS';

export interface EquipmentType extends BaseEntity {
  code: string;
  name: string;
  description?: string;
  category: FleetTypeCategory;
  icon?: string;
  iconType: string;
  primaryMetric: PrimaryMetric;
  telemetryEnabledDefault: boolean;
  canEnabledDefault: boolean;
  mobileEnabledDefault: boolean;
  mapEnabled: boolean;
  operationalGroup: FleetOperationalGroup;
  active: boolean;
  notes?: string;
}

export type FuelType = 'DIESEL' | 'GASOLINA' | 'ETANOL' | 'FLEX' | 'ELETRICO' | 'NAO_APLICA';
export type ModelCategory = FleetTypeCategory;

export interface EquipmentModel extends BaseEntity {
  // campos legados (mantidos para compatibilidade)
  name: string;
  brand: string;
  typeId: string;
  iconType?: string;
  technicalSpecs?: Record<string, string>;
  // campos técnicos novos
  description?: string;
  manufacturer?: string;  // alias de brand (fallback mútuo)
  model?: string;         // alias de name  (fallback mútuo)
  operationalType?: string;
  category?: ModelCategory | string;
  primaryMetric?: PrimaryMetric;
  nominalCapacity?: number;
  averageConsumption?: number;
  workingWidth?: number;
  fuelType?: FuelType;
  telemetryEnabled?: boolean;
  canEnabled?: boolean;
  mobileEnabled?: boolean;
  notes?: string;
  active?: boolean;
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

export interface MobileSyncEventPayload {
  fleetCode: string;
  mobileToken: string;
  [key: string]: any;
}

export interface MobileSyncEventInput extends Omit<SyncEvent, keyof BaseEntity | 'payload'> {
  payload: MobileSyncEventPayload;
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

export type ServiceOrderStatus =
  | 'ABERTA'
  | 'EM_ANDAMENTO'
  | 'PAUSADA'
  | 'FINALIZADA'
  | 'CANCELADA';

export type ServiceOrderType = 'PREVENTIVA' | 'CORRETIVA' | 'PREDITIVA' | 'INSPECAO';
export type ServiceOrderPriority = 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';

export interface ServiceOrder extends BaseEntity {
  // Identidade
  code: string;
  description: string;
  type: ServiceOrderType;
  priority: ServiceOrderPriority;
  status: ServiceOrderStatus;

  // Vínculos obrigatórios
  equipmentId: string;           // Frota / Equipamento
  operatorId?: string;           // Operador permitido
  farmId?: string;               // Fazenda
  fieldId?: string;              // Talhão
  costCenterId?: string;         // Centro de Custo
  operationId?: string;          // Operação cadastrada

  // Vínculos opcionais
  implementId?: string;          // Implemento (opcional)
  activityId?: string;           // Atividade
  shift?: 'DIURNO' | 'NOTURNO' | 'INTEGRAL';

  // Datas
  openedAt: string;              // Data/hora de abertura
  plannedAt?: string;            // Data/hora planejada de início
  startedAt?: string;            // Data/hora efetiva de início
  pausedAt?: string;             // Data/hora da pausa
  closedAt?: string;             // Data/hora de encerramento

  // Extras
  observations?: string;
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

// --- Trail ---
export type TrailPointQualityStatus =
  | 'VALID'
  | 'LOW_ACCURACY'
  | 'DUPLICATE'
  | 'OUTLIER'
  | 'INVALID_COORDINATE';

export interface TrailPoint {
  tenantId: string;
  fleetCode: string;
  equipmentId: string;
  journeyId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  /** Velocidade em km/h */
  speedKmh?: number;
  /** Rotações por minuto do motor */
  rpm?: number;
  accuracy?: number;
  timestamp: string;
  status?: string;
  operatorRegistration?: string;
  operationCode?: string;
  /** Horímetro no instante do ponto (quando disponível) */
  hourmeterCurrent?: number;
  /** ID único do evento (offlineId do APK) para deduplicação */
  eventId?: string;
  /** Qualidade do ponto GPS */
  qualityStatus?: TrailPointQualityStatus;
}

// --- Live Fleet State ---

export type EquipmentOperationalStatus = 'ONLINE' | 'OPERANDO' | 'PARADO' | 'FINALIZADO' | 'OFFLINE';
export type EquipmentLiveStatus = EquipmentOperationalStatus;

export interface EquipmentLiveState {
  equipmentId: string;
  fleetCode: string;
  tenantId: string;
  status: EquipmentOperationalStatus;
  latitude?: number;
  longitude?: number;
  /** Velocidade em m/s (campo interno — use speedKmh para exibição) */
  speed?: number;
  /** Velocidade em km/h (alias calculado a partir de speed × 3.6) */
  speedKmh?: number;
  /** Rotações por minuto do motor (se disponível via CAN ou APK) */
  rpm?: number;
  accuracy?: number;
  lastGpsAt?: string;
  lastHeartbeatAt?: string;
  journeyId?: string;
  currentOperation?: string;
  currentOperator?: string;
  operationName?: string;
  operatorName?: string;
  /** Matrícula do operador */
  registration?: string;
  /** Matrícula do operador (campo canônico da API) */
  operatorRegistration?: string;
  /** ID interno do operador (nunca usar como matrícula) */
  operatorId?: string;
  /** Código da operação atual */
  operationCode?: string;
  /** Código do centro de custo */
  costCenterCode?: string;
  /** Nome do centro de custo */
  costCenterName?: string;
  /** Centro de custo */
  costCenter?: string;
  /** Ordem de serviço */
  workOrder?: string;
  /** Código do implemento acoplado */
  implementCode?: string;
  /** ID interno do implemento */
  implementId?: string;
  /** Nome do implemento acoplado */
  implementName?: string;

  hourmeter?: number;
  /** Horimetro no inicio da jornada */
  hourmeterInitial?: number;
  /** Horimetro inicial (campo canonico da API) */
  hourmeterStart?: number;
  /** Horimetro atual (campo canonico da API) */
  hourmeterCurrent?: number;
  /** Origem do horimetro: MANUAL, CAN ou CELULAR */
  hourmeterSource?: 'MANUAL' | 'CAN' | 'CELULAR' | string;
  /** Horimetro ao final da jornada */
  hourmeterFinal?: number;
  /** Horimetro final (campo canonico da API) */
  hourmeterEnd?: number;
  /** Diferenca total de horimetro na jornada */
  totalHourmeter?: number;
  /** Sinaliza inconsistencia recebida no fechamento */
  hourmeterInconsistent?: boolean;
  hourmeterInconsistencyReason?: string;
  stopReason?: string;
  /** Descricao da parada (campo canonico da API) */
  stopDescription?: string;
  /** Codigo da parada atual (ex: PAR-01) */
  stopCode?: string;
  /** Timestamp de inicio da parada atual */
  stopStartedAt?: string;
  /** Duracao da parada em segundos */
  stopDurationSeconds?: number;
  /** Timestamp de encerramento da parada (preenchido no JOURNEY_END) */
  stopEndedAt?: string;
  /** Timestamp de inicio do status atual */
  statusStartedAt?: string;
  /** Duracao do status atual em segundos */
  statusDurationSeconds?: number;
  /** Timestamp de encerramento da jornada */
  endedAt?: string;
  type?: string;
  name?: string;
  updatedAt: string;
}

// --- Mobile Bootstrap ---

/**
 * Centro de Custo — entidade cadastral usada pelo APK para categorizar jornadas.
 * Sincronizado via GET /api/mobile/bootstrap.
 */
export interface CostCenter extends BaseEntity {
  code: string;
  name: string;
  description?: string;
  status: 'ATIVO' | 'INATIVO';
}

/**
 * Pacote de dados retornado pelo endpoint GET /api/mobile/bootstrap.
 * O APK armazena este pacote em Room e usa offline-first.
 */
export interface BootstrapPackage {
  tenantId: string;
  operatorId?: string;
  equipments: Equipment[];
  workOrders: ServiceOrder[];
  costCenters: CostCenter[];
  implementsList: Implement[];
  operations: Operation[];
  updatedAt: string;
  version: string;
}
