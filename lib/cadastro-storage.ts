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

// ── Seed map — which INITIAL_* array to use for each entity ───────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const SEED_MAP: Record<string, any[]> = {
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
};

export const ALLOWED_ENTITIES = Object.keys(SEED_MAP);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

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

  private static readAll(tenantId: string, entity: string): AnyRecord[] {
    const file = this.getFile(tenantId, entity);
    if (!fs.existsSync(file)) {
      // Seed with INITIAL_* data (replace tenantId so isolation works)
      const seed = (SEED_MAP[entity] || []).map((item: AnyRecord) => ({
        ...item,
        tenantId,
      }));
      fs.writeFileSync(file, JSON.stringify(seed, null, 2));
      console.info('[storage-api] entity=' + entity + ' action=seed tenantId=' + tenantId + ' count=' + seed.length);
      return seed;
    }
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as AnyRecord[];
  }

  private static writeAll(tenantId: string, entity: string, data: AnyRecord[]): void {
    fs.writeFileSync(this.getFile(tenantId, entity), JSON.stringify(data, null, 2));
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  static getAll(tenantId: string, entity: string): AnyRecord[] {
    return this.readAll(tenantId, entity).filter(
      (item) => item.entityStatus !== 'ARQUIVADO' && !item.deletedAt
    );
  }

  static getById(tenantId: string, entity: string, id: string): AnyRecord | undefined {
    return this.readAll(tenantId, entity).find(
      (item) => item.id === id && item.tenantId === tenantId
    );
  }

  static create(tenantId: string, entity: string, body: AnyRecord): AnyRecord {
    const all   = this.readAll(tenantId, entity);
    const now   = new Date().toISOString();
    const newItem: AnyRecord = {
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

  static update(tenantId: string, entity: string, id: string, body: AnyRecord): AnyRecord | null {
    const all   = this.readAll(tenantId, entity);
    const index = all.findIndex((item) => item.id === id && item.tenantId === tenantId);
    if (index === -1) return null;

    const current = all[index];
    const now     = new Date().toISOString();
    const updated: AnyRecord = {
      ...current,
      ...body,
      id,
      tenantId,
      updatedAt: now,
      version:   (current.version || 1) + 1,
      history: [
        ...(current.history || []),
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
