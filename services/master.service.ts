import {
  Equipment,
  Operator,
  Farm,
  Field,
  Operation,
  Company,
  User,
  StopReason,
  Supply,
  SyncEvent,
  Alert,
  INITIAL_EQUIPMENT,
  INITIAL_OPERATORS,
  INITIAL_FARMS,
  INITIAL_FIELDS,
  INITIAL_OPERATIONS,
  INITIAL_COMPANIES,
  INITIAL_ACCESS_GROUPS,
  INITIAL_USERS,
  INITIAL_STOP_REASONS,
  INITIAL_SUPPLIES,
  INITIAL_SYNC_EVENTS,
  INITIAL_ALERTS,
  INITIAL_EQUIPMENT_TYPES,
  INITIAL_EQUIPMENT_MODELS,
  INITIAL_EQUIPMENT_GROUPS,
  INITIAL_EQUIPMENT_PROFILES,
  INITIAL_OPERATIONAL_STATES,
  INITIAL_IMPLEMENTS,
  INITIAL_FLEET_ACTIVITIES,
  INITIAL_REGIONALS,
  INITIAL_UNITS,
  INITIAL_AUDIT_LOGS,
  INITIAL_OPERATIONAL_RECORDS,
  INITIAL_INTEGRATIONS,
  INITIAL_SERVICE_ORDERS,
  INITIAL_TELEMETRY,
  INITIAL_CHECKLIST_MODELS,
  INITIAL_CHECKLIST_EXECUTIONS,
  INITIAL_TIMELINE_EVENTS,
  EquipmentType,
  EquipmentModel,
  EquipmentGroup,
  EquipmentProfile,
  OperationalState,
  Implement,
  FleetActivity,
  Regional,
  Unit,
  AccessGroup,
  AuditLog,
  OperationalRecord,
  IntegrationConfig,
  ServiceOrder,
  TelemetryData,
  ChecklistModel,
  ChecklistExecution,
  TimelineEvent
} from '@/lib/mock/master-data';
import type { MobileSyncEventInput } from '@/lib/types';
import { BaseService } from './base.service';
import { normalizeCompanyPortPayload } from '@/lib/company-form';
import { getCsrfTokenFromDocument } from '@/lib/auth/csrf-client';

// --- Services ---

export { BaseService };

export const CompanyService = new (class extends BaseService<Company> {
  async getAllGlobal(): Promise<Company[]> {
    return this.data.filter(c => c.entityStatus !== 'ARQUIVADO');
  }

  private generateCompanyToken(): string {
    const bytes = new Uint8Array(18);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      bytes.forEach((_, index) => {
        bytes[index] = Math.floor(Math.random() * 256);
      });
    }
    return `CTK-${Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  }

  private async getUniqueCompanyToken(currentId?: string, preferredToken?: string): Promise<string> {
    const all = await this.getAllGlobal();
    if (preferredToken && !all.some(c => c.id !== currentId && c.companyToken === preferredToken)) {
      return preferredToken;
    }

    let token = this.generateCompanyToken();
    while (all.some(c => c.id !== currentId && c.companyToken === token)) {
      token = this.generateCompanyToken();
    }
    return token;
  }

  private withGeneratedUrls<T extends Partial<Company>>(item: T): T {
    const normalized = normalizeCompanyPortPayload(item);
    const apiPort = normalized.apiPort;
    const mqttPort = normalized.mqttPort;
    const domain = item.domain
      ? item.domain.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0].split(':')[0]
      : item.domain;

    return {
      ...item,
      domain,
      apiPort,
      mqttPort,
      apiBaseUrl: normalized.apiBaseUrl || item.apiBaseUrl,
      mqttUrl: normalized.mqttUrl || item.mqttUrl,
    };
  }

  async assertUniqueInstanceConfig(item: Partial<Company>, currentId?: string) {
    const all = await this.getAllGlobal();
    const active = all.filter(c => c.id !== currentId && c.entityStatus !== 'ARQUIVADO');

    if (item.code && active.some(c => c.code.toLowerCase() === item.code!.toLowerCase())) {
      throw new Error('Código interno já cadastrado para outra instância.');
    }

    if (item.apiPort && active.some(c => c.apiPort === item.apiPort)) {
      throw new Error('Porta API já cadastrada para outra instância.');
    }

    if (item.mqttPort && active.some(c => c.mqttPort === item.mqttPort)) {
      throw new Error('Porta MQTT já cadastrada para outra instância.');
    }
  }

  private async assertUniqueCompanyToken(item: Partial<Company>, currentId?: string) {
    if (!item.companyToken) return;

    const all = await this.getAllGlobal();
    if (all.some(c => c.id !== currentId && c.entityStatus !== 'ARQUIVADO' && c.companyToken === item.companyToken)) {
      throw new Error('Token da empresa ja cadastrado para outra instancia.');
    }
  }

  private async assertUniquePorts(item: Partial<Company>, currentId?: string) {
    const all = await this.getAllGlobal();
    const active = all.filter(c => c.id !== currentId && c.entityStatus !== 'ARQUIVADO');
    const apiPort = item.apiPort ? Number(item.apiPort) : undefined;
    const mqttPort = item.mqttPort ? Number(item.mqttPort) : undefined;

    if (!apiPort || apiPort < 1 || apiPort > 65535) throw new Error('Porta API invalida.');
    if (!mqttPort || mqttPort < 1 || mqttPort > 65535) throw new Error('Porta MQTT invalida.');
    if (active.some(c => Number(c.apiPort) === apiPort)) throw new Error('Porta API já está em uso por outra empresa.');
    if (active.some(c => Number(c.mqttPort) === mqttPort)) throw new Error('Porta MQTT já está em uso por outra empresa.');
  }

  private async syncCompanyStorage(company: Company) {
    if (typeof window === 'undefined') return;

    const response = await fetch('/api/mobile/company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(company),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Falha ao sincronizar Company no storage mobile.' }));
      throw new Error(body.error || 'Falha ao sincronizar Company no storage mobile.');
    }
  }

  async create(item: Omit<Company, keyof import('@/lib/types').BaseEntity>): Promise<Company> {
    const itemWithToken = {
      ...item,
      companyToken: await this.getUniqueCompanyToken(undefined, item.companyToken),
    };

    await this.assertUniquePorts(itemWithToken);
    await this.assertUniqueCompanyToken(itemWithToken);
    const created = await super.create(this.withGeneratedUrls(itemWithToken));
    try {
      await this.syncCompanyStorage(created);
    } catch (error) {
      await super.archive(created.id);
      throw error;
    }
    return created;
  }

  async update(id: string, updateData: Partial<Company>): Promise<Company | undefined> {
    const current = (await this.getAllGlobal()).find(c => c.id === id);
    if (!current) throw new Error('Registro nao encontrado');

    const nextData = this.withGeneratedUrls({
      ...updateData,
      companyToken: await this.getUniqueCompanyToken(id, updateData.companyToken || current.companyToken),
    });

    await this.assertUniquePorts({ ...current, ...nextData }, id);
    await this.assertUniqueCompanyToken(nextData, id);
    await this.syncCompanyStorage({ ...current, ...nextData });
    return super.update(id, nextData);
  }

  async regenerateCompanyToken(id: string): Promise<Company | undefined> {
    const current = (await this.getAllGlobal()).find(c => c.id === id);
    if (!current) throw new Error('Registro nao encontrado');

    if (typeof window !== 'undefined') {
      const persisted = await this.persistCompanyTokenOnServer(current, true);
      await super.update(id, persisted);
      return persisted;
    }

    const companyToken = await this.getUniqueCompanyToken(id);
    return this.update(id, { companyToken });
  }

  async generateMissingCompanyToken(companyOrId: string | Company): Promise<Company | undefined> {
    const incoming = typeof companyOrId === 'string' ? undefined : companyOrId;
    const id = typeof companyOrId === 'string' ? companyOrId : companyOrId.id;
    const current = incoming || (await this.getAllGlobal()).find(c => c.id === id);
    if (!current) throw new Error('Registro nao encontrado');
    if (current.companyToken) return current;
    if (!Number(current.apiPort)) throw new Error('apiPort is required');
    await this.assertUniquePorts(current, id);

    if (typeof window !== 'undefined') {
      const persisted = await this.persistCompanyTokenOnServer(current, false);
      await super.update(id, persisted);
      return persisted;
    }

    const companyToken = await this.getUniqueCompanyToken(id);
    return this.update(id, {
      ...current,
      apiPort: Number(current.apiPort),
      mqttPort: current.mqttPort ? Number(current.mqttPort) : current.mqttPort,
      companyToken,
    });
  }

  private async persistCompanyTokenOnServer(company: Company, regenerate: boolean): Promise<Company> {
    const csrfToken = getCsrfTokenFromDocument();
    const response = await fetch('/api/admin/companies/token', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}),
      },
      body: JSON.stringify({
        regenerate,
        company: {
          ...company,
          tenantId: company.tenantId || company.id,
          apiPort: Number(company.apiPort),
          mqttPort: Number(company.mqttPort),
          status: company.status || 'ATIVO',
          apiBaseUrl: company.apiPort ? `https://api.siloops.com.br:${Number(company.apiPort)}` : company.apiBaseUrl,
          mqttUrl: company.mqttPort ? `mqtt.siloops.com.br:${Number(company.mqttPort)}` : company.mqttUrl,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Falha ao persistir token no servidor.' }));
      throw new Error(body.error || 'Falha ao persistir token no servidor.');
    }

    const body = await response.json() as { company: Company };
    return body.company;
  }
})('companies', INITIAL_COMPANIES);

export const RegionalService = new BaseService<Regional>('regionals', INITIAL_REGIONALS);
export const UnitService = new BaseService<Unit>('units', INITIAL_UNITS);

export const AccessGroupService = new BaseService<AccessGroup>('access-groups', INITIAL_ACCESS_GROUPS);

export const UserService = new (class extends BaseService<User> {
  async create(item: Omit<User, keyof import('@/lib/types').BaseEntity>): Promise<User> {
    const users = await this.getAll();
    if (users.some(u => u.email.toLowerCase() === item.email.toLowerCase())) {
      throw new Error('Já existe um usuário cadastrado com este e-mail.');
    }
    return super.create(item);
  }
})('users', INITIAL_USERS);

export const AuditService = new BaseService<AuditLog>('audit-logs', INITIAL_AUDIT_LOGS);

export const OperationalRecordService = new (class extends BaseService<OperationalRecord> {
  async validateRecord(id: string): Promise<OperationalRecord | undefined> {
    const record = await this.getById(id);
    if (!record) return undefined;

    const inconsistencies: string[] = [];

    // Check initial/final hourmeter
    if (record.finalHourmeter && record.finalHourmeter < record.initialHourmeter) {
      inconsistencies.push('Horímetro final menor que inicial');
    }

    return this.update(id, { inconsistencies, status: inconsistencies.length === 0 ? 'VALIDADO' : 'PENDENTE' });
  }

  async integrateBatch(ids: string[]): Promise<void> {
    for (const id of ids) {
      const record = await this.getById(id);
      if (record && record.status === 'VALIDADO') {
        await this.update(id, { status: 'INTEGRADO', integratedAt: new Date().toISOString() });
      }
    }
  }
})('operational-records', INITIAL_OPERATIONAL_RECORDS);

export const IntegrationService = new BaseService<IntegrationConfig>('integrations', INITIAL_INTEGRATIONS);
export const ServiceOrderService = new BaseService<ServiceOrder>('service-orders', INITIAL_SERVICE_ORDERS);

// --- Old Services Compatibility ---

// --- Old Services Compatibility ---
export const ProfileService = AccessGroupService;

export const StopReasonService = new BaseService<StopReason>('stop-reasons', INITIAL_STOP_REASONS);

export const EquipmentTypeService = new BaseService<EquipmentType>('equipment-types', INITIAL_EQUIPMENT_TYPES);
export const EquipmentModelService = new BaseService<EquipmentModel>('equipment-models', INITIAL_EQUIPMENT_MODELS);
export const EquipmentGroupService = new BaseService<EquipmentGroup>('equipment-groups', INITIAL_EQUIPMENT_GROUPS);
export const EquipmentProfileService = new BaseService<EquipmentProfile>('equipment-profiles', INITIAL_EQUIPMENT_PROFILES);
export const OperationalStateService = new BaseService<OperationalState>('operational-states', INITIAL_OPERATIONAL_STATES);
export const ImplementService = new BaseService<Implement>('implements', INITIAL_IMPLEMENTS);
export const FleetActivityService = new BaseService<FleetActivity>('fleet-activities', INITIAL_FLEET_ACTIVITIES);

export const EquipmentService = new (class extends BaseService<Equipment> {
  private async syncMobileStorage(equipment: Equipment): Promise<void> {
    if (typeof window === 'undefined') return;

    const payload = {
      ...equipment,
      equipmentId: equipment.id,
      fleetCode: equipment.code,
      name: `${equipment.brand} ${equipment.code}`,
      type: equipment.typeId,
      tenantId: equipment.tenantId,
      status: equipment.status,
      mobileEnabled: equipment.mobileEnabled,
      mobileToken: equipment.mobileToken,
    };

    const response = await fetch('/api/mobile/equipment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Silo-Tenant': equipment.tenantId,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Falha ao sincronizar storage mobile.' }));
      throw new Error(body.error || 'Falha ao sincronizar storage mobile.');
    }
  }

  async create(item: Omit<Equipment, keyof import('@/lib/types').BaseEntity>): Promise<Equipment> {
    const all = await this.getAll(true);
    if (all.some(e => e.code === item.code && e.entityStatus !== 'ARQUIVADO')) {
      throw new Error('Código da frota já cadastrado e ativo.');
    }

    // Generate Mobile Token if enabled
    if (item.mobileEnabled) {
      (item as any).mobileToken = Math.random().toString(36).substring(2, 15).toUpperCase();
    }

    const created = await super.create(item);
    try {
      await this.syncMobileStorage(created);
    } catch (error) {
      await super.archive(created.id);
      throw error;
    }
    return created;
  }

  async update(id: string, updateData: Partial<Equipment>): Promise<Equipment | undefined> {
    const all = await this.getAll(true);
    if (updateData.code && all.some(e => e.code === updateData.code && e.id !== id && e.entityStatus !== 'ARQUIVADO')) {
      throw new Error('Código da frota já cadastrado para outro equipamento ativo.');
    }

    // Handle token generation if it was just enabled
    if (updateData.mobileEnabled) {
      const current = await this.getById(id);
      if (current && !current.mobileToken) {
        updateData.mobileToken = Math.random().toString(36).substring(2, 15).toUpperCase();
      }
    }

    const current = await this.getById(id);
    if (!current) throw new Error('Registro nÃ£o encontrado');

    await this.syncMobileStorage({ ...current, ...updateData });
    const updated = await super.update(id, updateData);
    return updated;
  }

  async archive(id: string): Promise<boolean> {
    const activeOperations = await OperationService.getAll();
    if (activeOperations.some(op => op.equipmentId === id && ['EM_CURSO', 'PAUSADA'].includes(op.status))) {
      throw new Error('Não é possível arquivar um equipamento com operação ativa.');
    }
    return super.archive(id);
  }
})('equipment', INITIAL_EQUIPMENT);

export const OperatorService = new (class extends BaseService<Operator> {
  async create(item: Omit<Operator, keyof import('@/lib/types').BaseEntity>): Promise<Operator> {
    const all = await this.getAll(true);
    if (all.some(op => op.registration === item.registration && op.entityStatus !== 'ARQUIVADO')) {
      throw new Error('Matrícula já cadastrada para outro operador ativo.');
    }
    return super.create(item);
  }

  async archive(id: string): Promise<boolean> {
    const activeOperations = await OperationService.getAll();
    if (activeOperations.some(op => op.operatorId === id && ['EM_CURSO', 'PAUSADA'].includes(op.status))) {
      throw new Error('Não é possível arquivar um operador com operação ativa.');
    }
    return super.archive(id);
  }
})('operators', INITIAL_OPERATORS);

export const FarmService = new BaseService<Farm>('farms', INITIAL_FARMS);
export const FieldService = new BaseService<Field>('fields', INITIAL_FIELDS);

export const OperationService = new (class extends BaseService<Operation> {
  async create(item: Omit<Operation, keyof import('@/lib/types').BaseEntity>): Promise<Operation> {
    const active = await this.getAll();
    if (active.some(op => op.equipmentId === item.equipmentId && ['EM_CURSO', 'PAUSADA', 'PLANEJADA'].includes(op.status))) {
      throw new Error('Este equipamento já possui uma operação ativa ou planejada.');
    }
    return super.create(item);
  }

  async startOperation(id: string): Promise<Operation | undefined> {
    return this.update(id, { status: 'EM_CURSO', start: new Date().toISOString() });
  }

  async finishOperation(id: string): Promise<Operation | undefined> {
    return this.update(id, { status: 'FINALIZADA', end: new Date().toISOString() });
  }
})('operations', INITIAL_OPERATIONS);

export const SupplyService = new BaseService<Supply>('supplies', INITIAL_SUPPLIES);
class MobileEventValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = 'MobileEventValidationError';
    this.statusCode = statusCode;
  }
}

export const SyncService = new (class extends BaseService<SyncEvent> {
  async create(item: Omit<SyncEvent, keyof import('@/lib/types').BaseEntity>): Promise<SyncEvent> {
    if (item.origin === 'APK') {
      return this.createMobileEvent(item as MobileSyncEventInput);
    }

    return super.create(item);
  }

  async createMobileEvent(item: MobileSyncEventInput): Promise<SyncEvent> {
    const fleetCode = item.payload?.fleetCode?.trim();
    const mobileToken = item.payload?.mobileToken?.trim();

    if (!fleetCode || !mobileToken) {
      throw new MobileEventValidationError('Payload mobile inválido: fleetCode e mobileToken são obrigatórios.', 400);
    }

    const equipment = (await EquipmentService.getAll(true)).find(e => e.code === fleetCode);

    if (!equipment) {
      throw new MobileEventValidationError('Frota não encontrada.', 404);
    }

    const isActiveEquipment = equipment.entityStatus === 'ATIVO' && ['ATIVO', 'ativo'].includes(equipment.status);
    if (!isActiveEquipment || !equipment.mobileEnabled) {
      throw new MobileEventValidationError('Frota inativa ou sem mobileEnabled.', 403);
    }

    if (!equipment.mobileToken || equipment.mobileToken !== mobileToken) {
      throw new MobileEventValidationError('mobileToken inválido.', 403);
    }

    return super.create(item);
  }
})('sync_events', INITIAL_SYNC_EVENTS);
export const AlertService = new BaseService<Alert>('alerts', INITIAL_ALERTS);

// --- P1 Services ---

export const TelemetryService = new (class extends BaseService<TelemetryData> {
  async getLatestByEquipment(equipmentId: string): Promise<TelemetryData | undefined> {
    const data = await this.getAll();
    return data.filter(t => t.equipmentId === equipmentId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  }
})('telemetry', INITIAL_TELEMETRY);

export const ChecklistModelService = new BaseService<ChecklistModel>('checklist-models', INITIAL_CHECKLIST_MODELS);

export const ChecklistExecutionService = new (class extends BaseService<ChecklistExecution> {
  async create(item: Omit<ChecklistExecution, keyof import('@/lib/types').BaseEntity>): Promise<ChecklistExecution> {
    // Business Rule: Check if critical items failed
    const hasCriticalFailure = item.answers.some(ans => {
      const model = INITIAL_CHECKLIST_MODELS.find(m => m.id === item.modelId);
      const question = model?.questions.find(q => q.id === ans.questionId);
      return question?.isCritical && !ans.isOk;
    });

    if (hasCriticalFailure) {
      item.status = 'BLOQUEADO';
      item.failureReason = 'Falha em item crítico do checklist.';
    }

    const execution = await super.create(item);

    // Create Timeline Event
    await TimelineService.create({
      equipmentId: execution.equipmentId,
      operatorId: execution.operatorId,
      operationId: execution.operationId,
      timestamp: execution.timestamp,
      type: 'CHECKLIST',
      title: 'Checklist Executado',
      description: `Status: ${execution.status}. ${execution.failureReason || ''}`,
      severity: execution.status === 'BLOQUEADO' ? 'CRITICAL' : 'INFO'
    });

    return execution;
  }
})('checklist-executions', INITIAL_CHECKLIST_EXECUTIONS);

export const TimelineService = new BaseService<TimelineEvent>('timeline', INITIAL_TIMELINE_EVENTS);

// Backwards compatibility
export const FarmFieldService = FarmService;

