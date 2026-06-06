import type {
  Alert,
  Equipment,
  EquipmentGroup,
  EquipmentModel,
  EquipmentProfile,
  EquipmentType,
  Farm,
  Field,
  Implement,
  Operation,
  OperationalState,
  Operator,
  StopReason,
  TelemetryData,
} from '@/lib/types';

const TENANT_ID =
  process.env.NEXT_PUBLIC_SILO_TENANT_ID ||
  process.env.NEXT_PUBLIC_TENANT_ID ||
  'silo-ops-001';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'X-Silo-Tenant': TENANT_ID,
};

type ApiRecord = { id: string };
type JsonBody<T extends ApiRecord> = Partial<T> | Record<string, unknown>;

function makeService<T extends ApiRecord>(entity: string) {
  const base = '/api/cadastro/' + entity;
  return {
    async getAll(): Promise<T[]> {
      try {
        const res = await fetch(base, { cache: 'no-store', headers: JSON_HEADERS });
        return res.ok ? res.json() : [];
      } catch { return []; }
    },
    async getById(id: string): Promise<T | undefined> {
      try {
        const res = await fetch(base + '/' + id, { cache: 'no-store', headers: JSON_HEADERS });
        return res.ok ? res.json() : undefined;
      } catch { return undefined; }
    },
    async create(data: JsonBody<T>): Promise<T> {
      const res = await fetch(base, {
        method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Create failed' })) as { error?: string };
        throw new Error(err.error ?? 'Create failed');
      }
      return res.json();
    },
    async update(id: string, data: JsonBody<T>): Promise<T | undefined> {
      try {
        const res = await fetch(base + '/' + id, {
          method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(data),
        });
        return res.ok ? res.json() : undefined;
      } catch { return undefined; }
    },
    async archive(id: string): Promise<boolean> {
      try {
        const res = await fetch(base + '/' + id, { method: 'DELETE' });
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
export const TelemetryService        = {
  ...makeService<TelemetryData>('telemetry'),
  async getLatestByEquipment(equipmentId: string): Promise<TelemetryData | undefined> {
    const all = await this.getAll();
    return all
      .filter(item => item.equipmentId === equipmentId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
  },
};
