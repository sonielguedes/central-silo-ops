import { z } from 'zod';
import { EQUIPMENT_ICON_TYPES } from '@/lib/equipment-icon-types';
import { normalizePort } from '@/lib/company-form';
import {
  FLEET_OPERATIONAL_GROUPS,
  FLEET_TYPE_CATEGORIES,
  PRIMARY_METRIC_OPTIONS,
} from '@/lib/fleet-type-catalog';

// --- ADMINISTRAÇÃO ---

export const companySchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  tradingName: z.string().min(2, 'Nome fantasia é obrigatório'),
  corporateName: z.string().min(2, 'Razão social é obrigatória'),
  cnpj: z.string().length(18, 'CNPJ deve ter 18 caracteres'),
  domain: z.string().optional().transform(value => {
    if (!value) return value;
    const trimmed = value.trim();
    const withoutProtocol = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    return withoutProtocol.split('/')[0].split(':')[0];
  }),
  portaApi: z.preprocess(
    (value) => normalizePort(value),
    z.number({
      required_error: 'Porta API obrigatoria',
      invalid_type_error: 'Porta API obrigatoria',
    })
      .int('Porta API deve ser inteira')
      .min(1, 'Porta API obrigatoria')
      .max(65535, 'Porta API invalida'),
  ),
  portaMqtt: z.preprocess(
    (value) => normalizePort(value),
    z.number({
      required_error: 'Porta MQTT obrigatoria',
      invalid_type_error: 'Porta MQTT obrigatoria',
    })
      .int('Porta MQTT deve ser inteira')
      .min(1, 'Porta MQTT obrigatoria')
      .max(65535, 'Porta MQTT invalida'),
  ),
  apiBaseUrl: z.string().optional(),
  mqttUrl: z.string().optional(),
  companyToken: z.string().optional(),
  plan: z.enum(['PILOTO', 'PRO', 'ENTERPRISE']),
  status: z.enum(['ATIVO', 'INATIVO']),
  observations: z.string().optional(),
  // Admin user — required only on creation; optional so editing doesn't break validation
  adminName: z.string().min(2, 'Nome do administrador obrigatorio').optional(),
  adminEmail: z.string().email('Email invalido').optional(),
});

export const regionalSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  name: z.string().min(2, 'Nome é obrigatório'),
  manager: z.string().optional(),
  status: z.enum(['ATIVO', 'INATIVO']),
});

export const unitSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  name: z.string().min(2, 'Nome é obrigatório'),
  companyId: z.string().min(1, 'Selecione uma empresa'),
  regionalId: z.string().min(1, 'Selecione uma regional'),
  manager: z.string().optional(),
  city: z.string().min(2, 'Cidade é obrigatória'),
  state: z.string().length(2, 'UF deve ter 2 caracteres'),
  timezone: z.string().min(1, 'Fuso horário é obrigatório'),
  operationalColor: z.string().min(4, 'Cor operacional é obrigatória'),
  isDaylightSavingTime: z.boolean().default(false),
  status: z.enum(['ATIVO', 'INATIVO']),
});

export const accessGroupSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  description: z.string().optional(),
  status: z.enum(['ATIVO', 'INATIVO']),
});

export const userSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  username: z.string().min(3, 'Usuário/Login é obrigatório'),
  email: z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional().or(z.literal('')),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  accessGroupId: z.string().min(1, 'Selecione um grupo de acesso'),
  unitId: z.string().optional(),
  isADValidated: z.boolean().default(false),
  tempPassword: z.string().optional(),
  requirePasswordChange: z.boolean().default(false),
  status: z.enum(['ATIVO', 'BLOQUEADO']),
});

// --- FROTA OPERACIONAL ---

export const equipmentTypeSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório').transform(v => v.trim().toUpperCase()),
  name: z.string().min(2, 'Nome é obrigatório'),
  description: z.string().optional(),
  category: z.enum(FLEET_TYPE_CATEGORIES),
  iconType: z.enum(EQUIPMENT_ICON_TYPES).default('PADRAO_GENERICO'),
  primaryMetric: z.enum(PRIMARY_METRIC_OPTIONS).default('HORIMETRO'),
  telemetryEnabledDefault: z.boolean().default(true),
  canEnabledDefault: z.boolean().default(true),
  mobileEnabledDefault: z.boolean().default(true),
  mapEnabled: z.boolean().default(true),
  operationalGroup: z.enum(FLEET_OPERATIONAL_GROUPS).default('OUTROS'),
  active: z.boolean().default(true),
  notes: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.primaryMetric) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unidade principal é obrigatória', path: ['primaryMetric'] });
  }
  if (!data.operationalGroup) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Grupo operacional é obrigatório', path: ['operationalGroup'] });
  }
});

export const equipmentModelSchema = z.object({
  // legados (compatibilidade)
  name:   z.string().min(1, 'Modelo é obrigatório'),
  brand:  z.string().min(1, 'Fabricante é obrigatório'),
  typeId: z.string().optional().default(''),
  iconType: z.string().min(1, 'Ícone é obrigatório').default('PADRAO_GENERICO'),
  // técnicos
  description:       z.string().optional(),
  manufacturer:      z.string().optional(),
  model:             z.string().optional(),
  operationalType:   z.string().optional(),
  category:          z.string().optional(),
  primaryMetric:     z.enum(['HORIMETRO', 'KM', 'HORAS', 'UNIDADE']).default('HORIMETRO'),
  nominalCapacity:   z.coerce.number().min(0).optional(),
  averageConsumption:z.coerce.number().min(0).optional(),
  workingWidth:      z.coerce.number().min(0).optional(),
  fuelType:          z.enum(['DIESEL', 'GASOLINA', 'ETANOL', 'FLEX', 'ELETRICO', 'NAO_APLICA']).optional(),
  telemetryEnabled:  z.boolean().default(false),
  canEnabled:        z.boolean().default(false),
  mobileEnabled:     z.boolean().default(true),
  notes:             z.string().optional(),
  active:            z.boolean().default(true),
});

export const equipmentGroupSchema = z.object({
  name: z.string().min(2, 'Nome do grupo é obrigatório'),
  description: z.string().optional(),
  color: z.string().optional(),
  status: z.enum(['ATIVO', 'INATIVO']),
});

export const equipmentProfileSchema = z.object({
  name: z.string().min(2, 'Nome do perfil é obrigatório'),
  description: z.string().optional(),
});

export const operationalStateSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  name: z.string().min(2, 'Nome é obrigatório'),
  abbreviation: z.string().min(1, 'Sigla é obrigatória'),
  color: z.string().min(4, 'Cor é obrigatória'),
  category: z.enum(['TRABALHO', 'TRANSPORTE', 'PARADA_PLANEJADA', 'PARADA_NAO_PLANEJADA', 'MANUTENCAO']),
  type: z.enum(['PRODUTIVO', 'IMPRODUTIVO', 'NEUTRO']),
  accountsProduction: z.boolean().default(false),
  accountsAvailability: z.boolean().default(false),
  accountsOperationalHourmeter: z.boolean().default(false),
  requiresStopReason: z.boolean().default(false),
  allowsMovement: z.boolean().default(false),
  order: z.coerce.number().default(0),
  description: z.string().optional(),
});

export const implementSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  name: z.string().min(2, 'Nome é obrigatório'),
  typeId: z.string().min(1, 'Tipo é obrigatório'),
  modelId: z.string().min(1, 'Modelo é obrigatório'),
  operationalWidth: z.coerce.number().min(0, 'Largura operacional não pode ser negativa'),
  totalSpacing: z.coerce.number().min(0, 'Espaçamento total não pode ser negativo'),
  centerSection: z.coerce.number().min(0, 'Seção centro não pode ser negativa'),
  generatesWorkedArea: z.boolean().default(false),
  isFixed: z.boolean().default(false),
  currentEquipmentId: z.string().optional(),
  allowedOperations: z.array(z.string()).min(1, 'Selecione pelo menos uma operação permitida'),
  status: z.enum(['DISPONIVEL', 'VINCULADO', 'MANUTENCAO', 'INATIVO', 'ARQUIVADO']),
  effectiveDate: z.string().min(1, 'Início de vigência é obrigatório'),
  observations: z.string().optional(),
}).refine((data) => {
  if (data.generatesWorkedArea && data.operationalWidth <= 0) return false;
  return true;
}, {
  message: 'Largura operacional deve ser maior que zero quando gera área trabalhada',
  path: ['operationalWidth'],
});

// --- OUTROS ---

export const stopReasonSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  description: z.string().min(3, 'Descrição obrigatória'),
  category: z.enum(['OPERACIONAL', 'MANUTENCAO', 'CLIMA', 'LOGISTICA', 'SEGURANCA', 'OUTROS']),
  type: z.enum(['PRODUTIVA', 'IMPRODUTIVA']),
  requiresObservation: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const equipmentSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  typeId: z.string().min(1, 'Tipo é obrigatório'),
  modelId: z.string().min(1, 'Modelo é obrigatório'),
  groupId: z.string().optional(),
  profileId: z.string().optional(),
  brand: z.string().min(1, 'Fabricante é obrigatório'),
  plateOrSerial: z.string().optional(),
  hourmeter: z.coerce.number().min(0, 'Horímetro não pode ser negativo'),
  status: z.enum(['ativo', 'inativo', 'trabalhando', 'deslocando', 'parada', 'alarme', 'manutencao', 'offline', 'ATIVO', 'INATIVO', 'MANUTENCAO']),
  observations: z.string().optional(),
  mobileEnabled: z.boolean().default(false),
});

export const operatorSchema = z.object({
  registration: z.string().min(1, 'Matrícula é obrigatória'),
  name: z.string().min(2, 'Nome é obrigatório'),
  phone: z.string().optional(),
  role: z.string().min(1, 'Função é obrigatória'),
  status: z.enum(['ATIVO', 'FERIAS', 'AFASTADO', 'INATIVO']),
  shift: z.string().min(1, 'Turno é obrigatório'),
  observations: z.string().optional(),
});

export const farmSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  name: z.string().min(2, 'Nome é obrigatório'),
  municipality: z.string().min(2, 'Município é obrigatório'),
  totalArea: z.coerce.number().min(0, 'Área não pode ser negativa'),
  status: z.enum(['ATIVO', 'INATIVO']),
});

export const fieldSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  farmId: z.string().min(1, 'Fazenda é obrigatória'),
  area: z.coerce.number().min(0, 'Área não pode ser negativa'),
  crop: z.string().min(1, 'Cultura é obrigatória'),
  coordinates: z.string().optional(),
  status: z.enum(['ATIVO', 'INATIVO']),
});

export const operationSchema = z.object({
  type: z.string().min(1, 'Tipo de operação é obrigatório'),
  equipmentId: z.string().min(1, 'Equipamento é obrigatório'),
  operatorId: z.string().min(1, 'Operador é obrigatório'),
  farmId: z.string().min(1, 'Fazenda é obrigatória'),
  fieldId: z.string().min(1, 'Talhão é obrigatório'),
  start: z.string().min(1, 'Data/Hora de início é obrigatória'),
  status: z.enum(['PLANEJADA', 'EM_CURSO', 'PAUSADA', 'FINALIZADA', 'CANCELADA']),
  observations: z.string().optional(),
});

export const supplySchema = z.object({
  equipmentId: z.string().min(1, 'Equipamento é obrigatório'),
  operatorId: z.string().min(1, 'Operador é obrigatório'),
  liters: z.coerce.number().positive('Volume deve ser maior que zero'),
  hourmeter: z.coerce.number().min(0, 'Horímetro não pode ser negativo'),
  timestamp: z.string().min(1, 'Data/Hora é obrigatória'),
  observations: z.string().optional(),
});

// --- FERRAMENTAS ---

export const operationalRecordSchema = z.object({
  equipmentId: z.string().min(1, 'Equipamento é obrigatório'),
  operatorId: z.string().min(1, 'Operador é obrigatório'),
  farmId: z.string().min(1, 'Fazenda é obrigatória'),
  fieldId: z.string().min(1, 'Talhão é obrigatório'),
  operationTypeId: z.string().min(1, 'Tipo de operação é obrigatório'),
  start: z.string().min(1, 'Início é obrigatório'),
  end: z.string().optional(),
  initialHourmeter: z.coerce.number().min(0, 'Horímetro não pode ser negativo'),
  finalHourmeter: z.coerce.number().min(0).optional(),
  justification: z.string().optional(),
}).refine(data => {
  if (data.finalHourmeter !== undefined && data.finalHourmeter < data.initialHourmeter) {
    return false;
  }
  return true;
}, {
  message: 'Horímetro final não pode ser menor que o inicial',
  path: ['finalHourmeter']
});

export const integrationConfigSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  type: z.enum(['REST', 'MQTT', 'SQL', 'SAP']),
  endpoint: z.string().min(5, 'Endpoint é obrigatório'),
  status: z.enum(['ATIVO', 'INATIVO']),
});

export const serviceOrderSchema = z.object({
  code: z.string().min(1, 'Código é obrigatório'),
  equipmentId: z.string().min(1, 'Equipamento é obrigatório'),
  type: z.enum(['PREVENTIVA', 'CORRETIVA', 'PREDITIVA', 'INSPECAO']),
  priority: z.enum(['BAIXA', 'MEDIA', 'ALTA', 'CRITICA']),
  description: z.string().min(5, 'Descrição é obrigatória'),
  status: z.enum(['ABERTA', 'EM_ANDAMENTO', 'PAUSADA', 'FINALIZADA', 'CANCELADA']),
});

// --- COMUNICAÇÃO ---

export const operationalMessageSchema = z.object({
  equipmentId: z.string().min(1, 'Selecione pelo menos um equipamento'),
  content: z.string().min(1, 'Mensagem não pode ser vazia').max(160, 'Limite de 160 caracteres excedido'),
  priority: z.enum(['NORMAL', 'ALTA', 'CRITICA']),
  requireConfirmation: z.boolean().default(false),
});

// --- P1: TELEMETRIA, CHECKLIST & TIMELINE ---

export const checklistQuestionSchema = z.object({
  id: z.string(),
  text: z.string().min(3, 'Pergunta muito curta'),
  type: z.enum(['YES_NO', 'NUMERIC', 'TEXT', 'PHOTO']),
  required: z.boolean().default(true),
  isCritical: z.boolean().default(false),
});

export const checklistModelSchema = z.object({
  name: z.string().min(3, 'Nome do modelo é obrigatório'),
  description: z.string().optional(),
  equipmentTypeId: z.string().min(1, 'Tipo de equipamento é obrigatório'),
  questions: z.array(checklistQuestionSchema).min(1, 'Mínimo 1 pergunta'),
  isActive: z.boolean().default(true),
});

export const checklistAnswerSchema = z.object({
  questionId: z.string(),
  value: z.union([z.string(), z.number(), z.boolean()]),
  isOk: z.boolean(),
  photoUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const checklistExecutionSchema = z.object({
  modelId: z.string(),
  equipmentId: z.string(),
  operatorId: z.string(),
  operationId: z.string().optional(),
  timestamp: z.string(),
  answers: z.array(checklistAnswerSchema),
  status: z.enum(['CONCLUIDO', 'PENDENTE', 'BLOQUEADO']),
  failureReason: z.string().optional(),
});

export const telemetrySchema = z.object({
  equipmentId: z.string(),
  timestamp: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  speed: z.number(),
  rpm: z.number(),
  fuelLevel: z.number().optional(),
  engineTemp: z.number().optional(),
  operationalStateId: z.string(),
  isOnline: z.boolean(),
  lastHeartbeat: z.string(),
});

export const timelineEventSchema = z.object({
  equipmentId: z.string(),
  operatorId: z.string(),
  operationId: z.string().optional(),
  timestamp: z.string(),
  type: z.enum(['STATUS_CHANGE', 'ALERT', 'RECORD', 'CHECKLIST', 'SUPPLY', 'SYNC']),
  title: z.string(),
  description: z.string(),
  severity: z.enum(['INFO', 'WARNING', 'CRITICAL']),
  metadata: z.record(z.any()).optional(),
});

export type CompanyFormData = z.infer<typeof companySchema>;
export type RegionalFormData = z.infer<typeof regionalSchema>;
export type UnitFormData = z.infer<typeof unitSchema>;
export type AccessGroupFormData = z.infer<typeof accessGroupSchema>;
export type UserFormData = z.infer<typeof userSchema>;
export type StopReasonFormData = z.infer<typeof stopReasonSchema>;
export type EquipmentTypeFormData = z.infer<typeof equipmentTypeSchema>;
export type EquipmentModelFormData = z.infer<typeof equipmentModelSchema>;
export type EquipmentGroupFormData = z.infer<typeof equipmentGroupSchema>;
export type EquipmentProfileFormData = z.infer<typeof equipmentProfileSchema>;
export type OperationalStateFormData = z.infer<typeof operationalStateSchema>;
export type ImplementFormData = z.infer<typeof implementSchema>;
export type EquipmentFormData = z.infer<typeof equipmentSchema>;
export type OperatorFormData = z.infer<typeof operatorSchema>;
export type FarmFormData = z.infer<typeof farmSchema>;
export type FieldFormData = z.infer<typeof fieldSchema>;
export type OperationFormData = z.infer<typeof operationSchema>;
export type SupplyFormData = z.infer<typeof supplySchema>;
export type OperationalRecordFormData = z.infer<typeof operationalRecordSchema>;
export type IntegrationConfigFormData = z.infer<typeof integrationConfigSchema>;
export type ServiceOrderFormData = z.infer<typeof serviceOrderSchema>;
export type OperationalMessageFormData = z.infer<typeof operationalMessageSchema>;

export type ChecklistModelFormData = z.infer<typeof checklistModelSchema>;
export type ChecklistExecutionFormData = z.infer<typeof checklistExecutionSchema>;
export type TelemetryFormData = z.infer<typeof telemetrySchema>;
export type TimelineEventFormData = z.infer<typeof timelineEventSchema>;
