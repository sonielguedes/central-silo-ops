import fs from 'fs';
import path from 'path';
import {
  INITIAL_EQUIPMENT,
  INITIAL_OPERATORS,
  INITIAL_FARMS,
  INITIAL_FIELDS,
  INITIAL_OPERATIONS,
  INITIAL_STOP_REASONS,
  INITIAL_IMPLEMENTS,
  INITIAL_EQUIPMENT_TYPES,
  INITIAL_EQUIPMENT_MODELS,
  INITIAL_EQUIPMENT_GROUPS,
  INITIAL_EQUIPMENT_PROFILES,
  INITIAL_OPERATIONAL_STATES,
  INITIAL_ALERTS,
  INITIAL_TELEMETRY,
  INITIAL_CHECKLIST_MODELS,
  INITIAL_USERS,
  INITIAL_ACCESS_GROUPS,
  INITIAL_UNITS,
  INITIAL_TIMELINE_EVENTS,
  INITIAL_FLEET_ACTIVITIES,
} from '@/lib/mock/master-data';

// ── Storage root (same resolver as ServerStorage) ─────────────────────────────
const resolveStorageDir = () => {
  const dir =
    process.env.SILO_STORAGE_DIR ||
    process.env.SILO_DATA_DIR ||
    (process.env.NODE_ENV === 'production' ? '/app/data' : './data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const DATA_ROOT = resolveStorageDir();

// ── Seed map — unknown[] keeps heterogeneous entity arrays typed safely
const SEED_MAP: Record<string, unknown[]> = {
  equipamentos: INITIAL_EQUIPMENT,
  operadores:   INITIAL_OPERATORS,
  fazendas:     INITIAL_FARMS,
  talhoes:      INITIAL_FIELDS,
  operacoes:    INITIAL_OPERATIONS,
  paradas:      INITIAL_STOP_REASONS,
  implementos:  INITIAL_IMPLEMENTS,
  tipos:        INITIAL_EQUIPMENT_TYPES,
  modelos:      INITIAL_EQUIPMENT_MODELS,
  grupos:       INITIAL_EQUIPMENT_GROUPS,
  perfis:       INITIAL_EQUIPMENT_PROFILES,
  estados:      INITIAL_OPERATIONAL_STATES,
  alerts:       INITIAL_ALERTS,
  telemetry:    INITIAL_TELEMETRY,
  'checklist-models': INITIAL_CHECKLIST_MODELS,
  users:        INITIAL_USERS,
  'access-groups': INITIAL_ACCESS_GROUPS,
  units:        INITIAL_UNITS,
  timeline:     INITIAL_TIMELINE_EVENTS,
  'fleet-activities': INITIAL_FLEET_ACTIVITIES,
};

export const ALLOWED_ENTITIES = Object.keys(SEED_MAP);

// ── StorageItem: typed base with index signature for entity-specific fields ───
interface StorageItem {
  id?: string;
  tenantId?: string;
  entityStatus?: string;
  deletedAt?: string;
  version?: number;
  history?: Array<{ timestamp: string; action: string }>;
  [key: string]: unknown;
}

// ── CadastroStorage ───────────────────────────────────────────────────────────
export class CadastroStorage {
  private static getDir(tenantId: string): string {
    const dir = path.join(DATA_ROOT, tenantId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private static getFile(tenantId: string, entity: string): string {
    return path.join(this.getDir(tenantId), 'cadastro-' + entity + '.json');
  }

  private static readAll(tenantId: string, entity: string): StorageItem[] {
    const file = this.getFile(tenantId, entity);
    if (!fs.existsSync(file)) {
      const seed = (SEED_MAP[entity] || []).map((item) => ({
        ...(item as StorageItem),
        tenantId,
      }));
      fs.writeFileSync(file, JSON.stringify(seed, null, 2));
      console.info('[storage-api] entity=' + entity + ' action=seed tenantId=' + tenantId + ' count=' + seed.length);
      return seed;
    }
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as StorageItem[];
  }

  private static writeAll(tenantId: string, entity: string, data: StorageItem[]): void {
    fs.writeFileSync(this.getFile(tenantId, entity), JSON.stringify(data, null, 2));
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  static getAll(tenantId: string, entity: string): StorageItem[] {
    return this.readAll(tenantId, entity).filter(
      (item) => item.entityStatus !== 'ARQUIVADO' && !item.deletedAt
    );
  }

  static getById(tenantId: string, entity: string, id: string): StorageItem | undefined {
    return this.readAll(tenantId, entity).find(
      (item) => item.id === id && item.tenantId === tenantId
    );
  }

  static create(tenantId: string, entity: string, body: StorageItem): StorageItem {
    const all = this.readAll(tenantId, entity);
    const now = new Date().toISOString();
    const newItem: StorageItem = {
      ...body,
      id:           Math.random().toString(36).substring(2, 11),
      tenantId,
      createdAt:    now,
      updatedAt:    now,
      entityStatus: 'ATIVO',
      version:      1,
      history:      [{ timestamp: now, action: 'CRIACAO' }],
    };
    all.push(newItem);
    this.writeAll(tenantId, entity, all);
    console.info('[storage-api] entity=' + entity + ' action=create tenantId=' + tenantId + ' id=' + newItem.id);
    return newItem;
  }

  static update(tenantId: string, entity: string, id: string, body: StorageItem): StorageItem | null {
    const all   = this.readAll(tenantId, entity);
    const index = all.findIndex((item) => item.id === id && item.tenantId === tenantId);
    if (index === -1) return null;

    const current = all[index];
    const now     = new Date().toISOString();
    const updated: StorageItem = {
      ...current,
      ...body,
      id,
      tenantId,
      updatedAt: now,
      version:   (current.version ?? 0) + 1,
      history: [
        ...(current.history ?? []),
        { timestamp: now, action: 'ATUALIZACAO' },
      ],
    };
    all[index] = updated;
    this.writeAll(tenantId, entity, all);
    console.info('[storage-api] entity=' + entity + ' action=update tenantId=' + tenantId + ' id=' + id);
    return updated;
  }

  static archive(tenantId: string, entity: string, id: string): boolean {
    const result = this.update(tenantId, entity, id, {
      entityStatus: 'ARQUIVADO',
      deletedAt:    new Date().toISOString(),
    });
    if (result) {
      console.info('[storage-api] entity=' + entity + ' action=archive tenantId=' + tenantId + ' id=' + id);
      return true;
    }
    return false;
  }
}
