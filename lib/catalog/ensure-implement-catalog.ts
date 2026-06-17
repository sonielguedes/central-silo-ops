/**
 * ensure-implement-catalog.ts
 *
 * Active upsert of implement types and models for any tenant.
 * Called before serving /api/cadastro/tipos so the data is always present
 * regardless of whether shouldSeedDemoData() is true (it is false in production).
 *
 * Safe to call multiple times — idempotent by design:
 *  - Matches existing types by code (slug) OR name (case-insensitive).
 *  - Matches existing models by name AND typeId.
 *  - Never deletes or overwrites existing records.
 */

import fs from 'fs';
import path from 'path';

// ── Storage path (mirrors CadastroStorage internals) ─────────────────────────

function getStorageDir(): string {
  return (
    process.env.SILO_STORAGE_DIR ??
    process.env.SILO_DATA_DIR ??
    (process.env.NODE_ENV === 'production' ? '/app/data' : './data')
  );
}

function getCatalogFilePath(tenantId: string, entity: string): string {
  const dir = path.join(getStorageDir(), tenantId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `cadastro-${entity}.json`);
}

type JsonRecord = Record<string, unknown>;

function readJson(filePath: string): JsonRecord[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as unknown;
    return Array.isArray(parsed) ? (parsed as JsonRecord[]) : [];
  } catch {
    return [];
  }
}

function writeJson(filePath: string, data: JsonRecord[]): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

const norm = (s: string) => String(s).trim().toLowerCase();

// Deterministic, stable IDs so models always reference the correct typeId
// even across multiple runs.
function stableTypeId(slug: string): string {
  return `impl-type-${slug.toLowerCase().replace(/_/g, '-')}`;
}
function stableModelId(typeSlug: string, modelName: string): string {
  const safeModel = modelName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // strip accents
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `impl-model-${typeSlug.toLowerCase()}-${safeModel}`;
}

// ── Catalog definition ────────────────────────────────────────────────────────

interface ImplTypeDef {
  slug: string;
  name: string;
}

interface ImplModelDef {
  typeSlug: string;
  name: string;
}

const IMPL_TYPES: ImplTypeDef[] = [
  { slug: 'SULCADOR',      name: 'Sulcador' },
  { slug: 'GRADE_ARADORA', name: 'Grade Aradora' },
  { slug: 'GRADE_NIVEL',   name: 'Grade Niveladora' },
  { slug: 'SUBSOLADOR',    name: 'Subsolador' },
  { slug: 'PLANTADEIRA',   name: 'Plantadeira' },
  { slug: 'PULVERIZADOR',  name: 'Pulverizador' },
  { slug: 'DIST_CALCARIO', name: 'Distribuidor de Calcario' },
  { slug: 'DIST_ADUBO',    name: 'Distribuidor de Adubo' },
  { slug: 'TRANSBORDO',    name: 'Transbordo' },
  { slug: 'PLATAFORMA',    name: 'Plataforma de Corte' },
  { slug: 'CARRETA_AGRIC', name: 'Carreta Agricola' },
  { slug: 'ROCADEIRA',     name: 'Rocadeira' },
  { slug: 'ENLEIRADOR',    name: 'Enleirador' },
  { slug: 'PA_CONCHA',     name: 'Pa Concha' },
  { slug: 'OUTROS_IMPL',   name: 'Outros' },
];

const IMPL_MODELS: ImplModelDef[] = [
  { typeSlug: 'SULCADOR',      name: 'Sulcador 2 Linhas' },
  { typeSlug: 'SULCADOR',      name: 'Sulcador 3 Linhas' },
  { typeSlug: 'SULCADOR',      name: 'Sulcador 5 Linhas' },
  { typeSlug: 'GRADE_ARADORA', name: 'Grade 14 Discos' },
  { typeSlug: 'GRADE_ARADORA', name: 'Grade 18 Discos' },
  { typeSlug: 'GRADE_ARADORA', name: 'Grade 24 Discos' },
  { typeSlug: 'GRADE_NIVEL',   name: 'Niveladora 28 Discos' },
  { typeSlug: 'GRADE_NIVEL',   name: 'Niveladora 32 Discos' },
  { typeSlug: 'GRADE_NIVEL',   name: 'Niveladora 36 Discos' },
  { typeSlug: 'SUBSOLADOR',    name: 'Subsolador 5 Hastes' },
  { typeSlug: 'SUBSOLADOR',    name: 'Subsolador 7 Hastes' },
  { typeSlug: 'SUBSOLADOR',    name: 'Subsolador 9 Hastes' },
  { typeSlug: 'PLANTADEIRA',   name: 'Plantadeira 9 Linhas' },
  { typeSlug: 'PLANTADEIRA',   name: 'Plantadeira 11 Linhas' },
  { typeSlug: 'PLANTADEIRA',   name: 'Plantadeira 13 Linhas' },
  { typeSlug: 'PULVERIZADOR',  name: 'Barra 18m' },
  { typeSlug: 'PULVERIZADOR',  name: 'Barra 24m' },
  { typeSlug: 'PULVERIZADOR',  name: 'Barra 30m' },
  { typeSlug: 'TRANSBORDO',    name: 'Transbordo 10T' },
  { typeSlug: 'TRANSBORDO',    name: 'Transbordo 12T' },
  { typeSlug: 'TRANSBORDO',    name: 'Transbordo 15T' },
  { typeSlug: 'PLATAFORMA',    name: 'Plataforma 20 pes' },
  { typeSlug: 'PLATAFORMA',    name: 'Plataforma 25 pes' },
  { typeSlug: 'PLATAFORMA',    name: 'Plataforma 30 pes' },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Ensures all required implement types and models exist for the given tenant.
 * Safe to call on every request — exits immediately if catalog is already present.
 *
 * @param tenantId - The tenant to guarantee the catalog for.
 */
export function ensureImplementCatalogForTenant(tenantId: string): void {
  const now = new Date().toISOString();

  // ── 1. Types ──────────────────────────────────────────────────────────────
  const typesFile = getCatalogFilePath(tenantId, 'tipos');
  const existingTypes = readJson(typesFile);

  // Build slug→id map from whatever is already there
  const slugToId: Record<string, string> = {};
  for (const existing of existingTypes) {
    const existingCode = String(existing.code ?? '').toUpperCase();
    const existingName = norm(String(existing.name ?? ''));
    for (const def of IMPL_TYPES) {
      if (existingCode === def.slug || existingName === norm(def.name)) {
        slugToId[def.slug] = String(existing.id);
        break;
      }
    }
  }

  // Identify and build missing types
  const newTypes: JsonRecord[] = [];
  for (const def of IMPL_TYPES) {
    if (!slugToId[def.slug]) {
      const id = stableTypeId(def.slug);
      slugToId[def.slug] = id;
      newTypes.push({
        id,
        tenantId,
        code:                    def.slug,
        name:                    def.name,
        description:             def.name,
        category:                'Implemento',
        iconType:                'GRADE_IMPLEMENTO',
        primaryMetric:           'HORIMETRO',
        telemetryEnabledDefault: false,
        canEnabledDefault:       false,
        mobileEnabledDefault:    true,
        mapEnabled:              false,
        operationalGroup:        'IMPLEMENTO',
        active:                  true,
        entityStatus:            'ATIVO',
        status:                  'ATIVO',
        createdAt:               now,
        updatedAt:               now,
        createdBy:               'SISTEMA',
        updatedBy:               'SISTEMA',
        version:                 1,
        history:                 [{ timestamp: now, action: 'CRIACAO' }],
      });
    }
  }

  if (newTypes.length > 0) {
    writeJson(typesFile, [...existingTypes, ...newTypes]);
    console.info(
      `[ensure-impl-catalog] tenantId=${tenantId} tipos_inserted=${newTypes.length}`
    );
  }

  // ── 2. Models ─────────────────────────────────────────────────────────────
  const modelsFile = getCatalogFilePath(tenantId, 'modelos');
  const existingModels = readJson(modelsFile);

  // Build set of (typeId + normalizedName) that already exist
  const existingModelKeys = new Set<string>(
    existingModels.map(m => `${String(m.typeId ?? '')}::${norm(String(m.name ?? m.model ?? ''))}`)
  );

  const newModels: JsonRecord[] = [];
  for (const def of IMPL_MODELS) {
    const resolvedTypeId = slugToId[def.typeSlug];
    if (!resolvedTypeId) continue; // type wasn't found or created — skip
    const key = `${resolvedTypeId}::${norm(def.name)}`;
    if (!existingModelKeys.has(key)) {
      existingModelKeys.add(key);
      newModels.push({
        id:            stableModelId(def.typeSlug, def.name),
        tenantId,
        name:          def.name,
        model:         def.name,
        brand:         '',
        manufacturer:  '',
        typeId:        resolvedTypeId,
        operationalType:  'IMPLEMENTO',
        iconType:         'GRADE_IMPLEMENTO',
        category:         'Implemento',
        primaryMetric:    'HORIMETRO',
        active:           true,
        mobileEnabled:    true,
        telemetryEnabled: false,
        canEnabled:       false,
        entityStatus:     'ATIVO',
        status:           'ATIVO',
        createdAt:        now,
        updatedAt:        now,
        createdBy:        'SISTEMA',
        updatedBy:        'SISTEMA',
        version:          1,
        history:          [{ timestamp: now, action: 'CRIACAO' }],
      });
    }
  }

  if (newModels.length > 0) {
    writeJson(modelsFile, [...existingModels, ...newModels]);
    console.info(
      `[ensure-impl-catalog] tenantId=${tenantId} modelos_inserted=${newModels.length}`
    );
  }
}
