import type {
  Alert,
  AccessGroup,
  ChecklistModel,
  Equipment,
  EquipmentGroup,
  EquipmentModel,
  EquipmentProfile,
  EquipmentType,
  Farm,
  Field,
  FleetActivity,
  Implement,
  Operation,
  OperationalState,
  Operator,
  StopReason,
  TelemetryData,
  TimelineEvent,
  Unit,
  User,
} from '@/lib/types';

const TENANT_ID =
  process.env.NEXT_PUBLIC_SILO_TENANT_ID ||
  process.env.NEXT_PUBLIC_TENANT_ID ||
  'silo-ops-001';

/** Map accessGroupId → SystemRole (same mapping as auth-context) */
function resolveRoleFromAccessGroup(accessGroupId: string | undefined): string {
  if (!accessGroupId) return 'CONSULTA';
  const map: Record<string, string> = {
    'role-super-admin': 'SUPER_ADMIN',
    'ag-admin': 'SUPER_ADMIN',
    'role-admin-empresa': 'ADMIN_EMPRESA',
    'ag-admin-empresa': 'ADMIN_EMPRESA',
    'role-gestor': 'GESTOR',
    'ag-gestor': 'GESTOR',
    'role-coa': 'COA',
    'ag-coa': 'COA',
    'role-consulta': 'CONSULTA',
    'ag-consulta': 'CONSULTA',
    'role-auditor': 'AUDITOR',
    'ag-auditor': 'AUDITOR',
  };
  return map[accessGroupId] || 'CONSULTA';
}

/** Build headers with session info from localStorage */
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Silo-Tenant': TENANT_ID,
  };

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('silo_auth_user');
      if (raw) {
        const u = JSON.parse(raw);
        if (u.id) headers['x-silo-user-id'] = u.id;
        if (u.name) headers['x-silo-user-name'] = u.name;
        if (u.email) headers['x-silo-user-email'] = u.email;
        headers['x-silo-user-role'] =
          u.role || resolveRoleFromAccessGroup(u.accessGroupId);
        if (u.tenantId) headers['X-Silo-Tenant'] = u.tenantId;
      }
    } catch {
      // localStorage parse failed — send without session headers
    }
  }

  return headers;
}

type ApiRecord = { id: string };
type JsonBody<T extends ApiRecord> = Partial<T> | Record<string, unknown>;

function makeService<T extends ApiRecord>(entity: string) {
  const base = '/api/cadastro/' + entity;
  return {
    async getAll(): Promise<T[]> {
      try {
        const res = await fetch(base, { cache: 'no-store', headers: getHeaders() });
        return res.ok ? res.json() : [];
      } catch { return []; }
    },
    async getById(id: string): Promise<T | undefined> {
      try {
        const res = await fetch(base + '/' + id, { cache: 'no-store', headers: getHeaders() });
        return res.ok ? res.json() : undefined;
      } catch { return undefined; }
    },
    async create(data: JsonBody<T>): Promise<T> {
      const res = await fetch(base, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Create failed' })) as { error?: string };
        throw new Error(err.error ?? 'Create failed');
      }
      return res.json();
    },
    async update(id: string, data: JsonBody<T>): Promise<T | undefined> {
      const res = await fetch(base + '/' + id, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Update failed' })) as { error?: string };
        throw new Error(err.error ?? 'Update failed');
      }
      return res.json();
    },
    async archive(id: string): Promise<boolean> {
      try {
        const res = await fetch(base + '/' + id, { method: 'DELETE', headers: getHeaders() });
        return res.ok;
      } catch { return false; }
    },
    async delete(id: string): Promise<boolean> { return this.archive(id); },
  };
}

export const EquipmentService        = makeService<Equipment>('equipamentos');
export const OperatorService         = makeService<Operator>('operadores');
export const FarmService             = makeService<Farm>('fazendas');
export const FieldService            = makeService<Field>('talhoes');
export const StopReasonService       = makeService<StopReason>('paradas');
export const ImplementService        = makeService<Implement>('implementos');
export const EquipmentTypeService    = makeService<EquipmentType>('tipos');
export const EquipmentModelService   = makeService<EquipmentModel>('modelos');
export const EquipmentGroupService   = makeService<EquipmentGroup>('grupos');
export const EquipmentProfileService = makeService<EquipmentProfile>('perfis');
export const OperationalStateService = makeService<OperationalState>('estados');
export const OperationService        = {
  ...makeService<Operation>('operacoes'),
  async startOperation(id: string): Promise<Operation | undefined> {
    return this.update(id, { status: 'EM_CURSO' });
  },
  async finishOperation(id: string): Promise<Operation | undefined> {
    return this.update(id, { status: 'FINALIZADA', end: new Date().toISOString() });
  },
};
export const AlertService            = makeService<Alert>('alerts');
export const ChecklistModelService   = makeService<ChecklistModel>('checklist-models');
export const UserService             = makeService<User>('users');
export const AccessGroupService      = makeService<AccessGroup>('access-groups');
export const UnitService             = makeService<Unit>('units');
export const TimelineService         = makeService<TimelineEvent>('timeline');
export const FleetActivityService    = makeService<FleetActivity>('fleet-activities');
export const TelemetryService        = {
  ...makeService<TelemetryData>('telemetry'),
  async getLatestByEquipment(equipmentId: string): Promise<TelemetryData | undefined> {
    const all = await this.getAll();
    return all
      .filter(item => item.equipmentId === equipmentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  },
};
