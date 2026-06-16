import type {
  Alert,
  AccessGroup,
  ChecklistModel,
  CostCenter,
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
import { getCsrfTokenFromDocument } from '@/lib/auth/csrf-client';

/**
 * Build request headers for API calls.
 *
 * Security rules:
 *  - NEVER send X-Silo-Tenant: the server resolves tenantId exclusively from
 *    the signed session cookie. A stale localStorage value would diverge from
 *    the session and trigger a 403 from requireTenant() for TENANT-scope users.
 *  - Always include x-csrf-token (read from silo_csrf cookie) so mutations
 *    pass the requireCsrf() double-submit check.
 *  - x-silo-user-id is forwarded only in dev (SILO_ALLOW_HEADER_SESSION=true)
 *    environments; production ignores it.
 */
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (typeof window !== 'undefined') {
    // CSRF double-submit: read silo_csrf cookie and mirror it as a header.
    // requireCsrf() on the server validates that both match.
    const csrf = getCsrfTokenFromDocument();
    if (csrf) headers['x-csrf-token'] = csrf;

    try {
      const raw = localStorage.getItem('silo_auth_user');
      if (raw) {
        const u = JSON.parse(raw) as {
          id?: string;
          name?: string;
          email?: string;
          role?: string;
          accessGroupId?: string;
        };
        // Forward user-id hint for dev header-session mode only.
        // Production ignores these; session cookie is authoritative.
        if (u.id)    headers['x-silo-user-id']    = u.id;
        if (u.name)  headers['x-silo-user-name']  = u.name;
        if (u.email) headers['x-silo-user-email'] = u.email;
        // NOTE: X-Silo-Tenant is intentionally NOT sent.
        // tenantId is resolved server-side from session.activeTenantId ?? session.tenantId.
      }
    } catch {
      // localStorage parse failed — proceed without optional headers
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
        const res = await fetch(base, { cache: 'no-store', credentials: 'include', headers: getHeaders() });
        return res.ok ? res.json() : [];
      } catch { return []; }
    },
    async getById(id: string): Promise<T | undefined> {
      try {
        const res = await fetch(base + '/' + id, { cache: 'no-store', credentials: 'include', headers: getHeaders() });
        return res.ok ? res.json() : undefined;
      } catch { return undefined; }
    },
    async create(data: JsonBody<T>): Promise<T> {
      const res = await fetch(base, {
        method: 'POST', credentials: 'include', headers: getHeaders(), body: JSON.stringify(data),
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
        credentials: 'include',
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
        const res = await fetch(base + '/' + id, { method: 'DELETE', credentials: 'include', headers: getHeaders() });
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

// CostCenterService usa rotas dedicadas /api/centros-custo (valida unicidade de código)
export const CostCenterService = {
  async getAll(): Promise<CostCenter[]> {
    try {
      const res = await fetch('/api/centros-custo', { cache: 'no-store', credentials: 'include', headers: getHeaders() });
      return res.ok ? res.json() : [];
    } catch { return []; }
  },
  async create(data: Partial<CostCenter>): Promise<CostCenter> {
    const res = await fetch('/api/centros-custo', {
      method: 'POST', credentials: 'include', headers: getHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao criar' })) as { error?: string };
      throw new Error(err.error ?? 'Falha ao criar');
    }
    return res.json();
  },
  async update(id: string, data: Partial<CostCenter>): Promise<CostCenter | undefined> {
    const res = await fetch(`/api/centros-custo/${id}`, {
      method: 'PUT', credentials: 'include', headers: getHeaders(), body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Falha ao atualizar' })) as { error?: string };
      throw new Error(err.error ?? 'Falha ao atualizar');
    }
    return res.json();
  },
  async archive(id: string): Promise<boolean> {
    try {
      const res = await fetch(`/api/centros-custo/${id}`, { method: 'DELETE', credentials: 'include', headers: getHeaders() });
      return res.ok;
    } catch { return false; }
  },
};
export const TelemetryService        = {
  ...makeService<TelemetryData>('telemetry'),
  async getLatestByEquipment(equipmentId: string): Promise<TelemetryData | undefined> {
    const all = await this.getAll();
    return all
      .filter(item => item.equipmentId === equipmentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  },
};
