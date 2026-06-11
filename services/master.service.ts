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

// ── Explicit result types (consumed by the UI layer) ────────────────────────
export type CompanyCreateResult = { company: Company; provisioningToken: string };
export type CompanyTokenRotateResult = { company: Company; newToken: string };

export const CompanyService = new (class extends BaseService<Company> {
  async getAllGlobal(): Promise<Company[]> {
    try {
      const res = await fetch('/api/admin/companies', { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return (json.companies as Company[]) ?? [];
    } catch (err) {
      console.error('[CompanyService.getAllGlobal] API fetch failed, returning empty list', err);
      return [];
    }
  }

  private withGeneratedUrls<T extends Partial<Company>>(item: T): T {
    const normalized = normalizeCompanyPortPayload(item);
    const apiPort = normalized.apiPort;
    const mqttPort = normalized.mqttPort;
    const domain = item.domain
      ? item.domain.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0].split(':')[0]
      : item.domain;
    return { ...item, domain, apiPort, mqttPort, apiBaseUrl: normalized.apiBaseUrl || item.apiBaseUrl, mqttUrl: normalized.mqttUrl || item.mqttUrl };
  }

  /**
   * Create a new company via POST /api/admin/companies (PLATFORM scope only).
   *
   * Returns CompanyCreateResult:
   *   - company:          public fields from server (no secret tokens)
   *   - provisioningToken: the FULL token, shown once — UI must display it
   *                        immediately; subsequent GETs only show tokenPreview.
   *
   * No token is generated client-side.
   */
  /**
   * Provision a new company via POST /api/admin/companies (PLATFORM scope only).
   *
   * Uses a separate method name so the return type CompanyCreateResult does not
   * conflict with BaseService<Company>.create() → Promise<Company>.
   *
   * Returns CompanyCreateResult:
   *   - company:           public fields from server (no secret tokens)
   *   - provisioningToken: the FULL token, shown once — UI must capture and display it
   */
  async provision(item: Omit<Company, keyof import('@/lib/types').BaseEntity>): Promise<CompanyCreateResult> {
    if (typeof window === 'undefined') {
      // SSR — not expected in normal UI flow; surface a clear error
      throw new Error('provision() requires a browser session.');
    }

    const withUrls = this.withGeneratedUrls(item);
    const csrfToken = getCsrfTokenFromDocument();

    const response = await fetch('/api/admin/companies', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
      body: JSON.stringify(withUrls),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Falha ao provisionar empresa.' }));
      throw new Error(body.error || `Falha ao provisionar empresa (HTTP ${response.status}).`);
    }

    const body = await response.json() as { company: Company; provisioningToken: string };

    // Persist to local state AFTER server confirms 201.
    // The company stored locally has no raw token — only the public shape returned by GET.
    await super.create(body.company as Omit<Company, keyof import('@/lib/types').BaseEntity>);

    return {
      company: body.company,
      provisioningToken: body.provisioningToken,
    };
  }

  /**
   * Update a company via PATCH /api/admin/companies/[id].
   * Token, tenantId, and createdAt are immutable — never sent in the request.
   */
  async update(id: string, updateData: Partial<Company>): Promise<Company | undefined> {
    if (typeof window === 'undefined') {
      return super.update(id, updateData);
    }

    // Strip any token/identity fields the caller may have accidentally included
    const { companyToken: _ct, mobileToken: _mt, apiToken: _at, token: _t, tenantId: _tid, createdAt: _ca, ...safeData } = updateData as Record<string, unknown>;
    void _ct; void _mt; void _at; void _t; void _tid; void _ca;

    const withUrls = this.withGeneratedUrls(safeData as Partial<Company>);
    const csrfToken = getCsrfTokenFromDocument();

    const response = await fetch(`/api/admin/companies/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
      body: JSON.stringify(withUrls),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Falha ao atualizar empresa.' }));
      throw new Error(body.error || `Falha ao atualizar empresa (HTTP ${response.status}).`);
    }

    const body = await response.json() as { company: Company };
    return super.update(id, body.company);
  }

  /**
   * Rotate token via POST /api/admin/companies/[id]/token.
   *
   * Returns CompanyTokenRotateResult:
   *   - company: updated public record (tokenPreview only, no raw token)
   *   - newToken: the FULL new token, shown once
   *
   * No token is generated client-side.
   */
  async regenerateCompanyToken(id: string): Promise<CompanyTokenRotateResult> {
    if (typeof window === 'undefined') {
      throw new Error('Token rotation requires a browser session.');
    }

    const csrfToken = getCsrfTokenFromDocument();
    const response = await fetch(`/api/admin/companies/${id}/token`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Falha ao rotacionar token.' }));
      throw new Error(body.error || `Falha ao rotacionar token (HTTP ${response.status}).`);
    }

    const body = await response.json() as { companyId: string; newToken: string; tokenPreview: string };

    // Refresh local state with updated company from the listing
    const all = await this.getAllGlobal();
    const company = all.find(c => c.id === id) ?? ({ id } as Company);

    return { company, newToken: body.newToken };
  }

  async generateMissingCompanyToken(companyOrId: string | Company): Promise<CompanyTokenRotateResult> {
    const id = typeof companyOrId === 'string' ? companyOrId : companyOrId.id;
    const current = typeof companyOrId === 'string'
      ? (await this.getAllGlobal()).find(c => c.id === id)
      : companyOrId;
    if (!current) throw new Error('Registro nao encontrado');
    // No token yet — rotate to generate one
    return this.regenerateCompanyToken(id);
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

