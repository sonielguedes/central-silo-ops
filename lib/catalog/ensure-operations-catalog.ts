/**
 * ensure-operations-catalog.ts
 *
 * Active upsert of master agricultural operation types for any tenant.
 * Called before serving /api/cadastro/operacoes so catalog types are always
 * present regardless of shouldSeedDemoData() (false in production).
 *
 * Records are stored in the 'operacoes' entity with isMasterCatalog:true
 * to distinguish them from active operation records (which have equipmentId).
 *
 * Safe to call multiple times — idempotent:
 *  - Matches existing records by code OR name (case-insensitive).
 *  - Never deletes or overwrites existing records.
 *  - Never duplicates.
 */

import fs from 'fs';
import path from 'path';

// ── Storage path (mirrors CadastroStorage internals) ─────────────────────────

function getStorageDir(): string {
  return (
    process.env.SILO_STORAGE_DIR ||
    process.env.SILO_DATA_DIR ||
    (process.env.NODE_ENV === 'production' ? '/app/data' : './data')
  );
}

function getCatalogFilePath(tenantId: string): string {
  return path.join(getStorageDir(), tenantId, 'cadastro-operacoes.json');
}

type JsonRecord = Record<string, unknown>;

function readJson(filePath: string): JsonRecord[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf-8').trim();
    if (!raw || raw === 'null') return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJson(filePath: string, data: JsonRecord[]): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

// ── Stable ID helper ──────────────────────────────────────────────────────────

function stableOpId(code: string): string {
  return 'op-type-' + code.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

// ── Master catalog definitions ────────────────────────────────────────────────

interface OpTypeDef {
  code: string;    // numeric code, e.g. "1001"
  name: string;    // display name, e.g. "Preparo de Solo"
  type: string;    // type key sent by APK, e.g. "PREPARO_SOLO"
  description: string;
}

const OP_TYPES: OpTypeDef[] = [
  { code: '3030', name: 'Operacao Teste',            type: 'OPERACAO_TESTE',   description: 'Operacao de teste para validacao do sistema' },
  { code: '1001', name: 'Preparo de Solo',            type: 'PREPARO_SOLO',    description: 'Aração, gradagem, subsolagem e nivelamento' },
  { code: '1002', name: 'Plantio',                   type: 'PLANTIO',         description: 'Plantio e semeadura de culturas' },
  { code: '1003', name: 'Colheita',                  type: 'COLHEITA',        description: 'Colheita mecanizada de graos e fibras' },
  { code: '1004', name: 'Transbordo',                type: 'TRANSBORDO',      description: 'Transbordo e transporte interno de graos' },
  { code: '1005', name: 'Aplicacao',                 type: 'APLICACAO',       description: 'Pulverizacao, calcareo e adubacao' },
  { code: '1006', name: 'Manutencao Operacional',    type: 'MANUTENCAO_OP',   description: 'Manutenção e revisao em campo' },
];

// ── Public function ───────────────────────────────────────────────────────────

/**
 * Ensures master operation types exist in the 'operacoes' entity for the tenant.
 * Adds only missing records — never modifies or removes existing ones.
 */
export function ensureOperationsCatalogForTenant(tenantId: string): void {
  const now = new Date().toISOString();
  const filePath = getCatalogFilePath(tenantId);
  const existing = readJson(filePath);

  // Build lookup: code (uppercased) → exists, name (normalized) → exists
  const existingByCode = new Set<string>();
  const existingByName = new Set<string>();
  for (const rec of existing) {
    const code = String(rec.code ?? '').toUpperCase();
    const name = norm(String(rec.name ?? ''));
    if (code) existingByCode.add(code);
    if (name) existingByName.add(name);
  }

  const toAdd: JsonRecord[] = [];

  for (const def of OP_TYPES) {
    const alreadyExists =
      existingByCode.has(def.code.toUpperCase()) ||
      existingByName.has(norm(def.name));

    if (alreadyExists) continue;

    toAdd.push({
      id:             stableOpId(def.code),
      tenantId,
      code:           def.code,
      name:           def.name,
      type:           def.type,
      description:    def.description,
      status:         'ATIVO',
      entityStatus:   'ATIVO',
      isMasterCatalog: true,
      createdAt:      now,
      updatedAt:      now,
    });
  }

  if (toAdd.length > 0) {
    writeJson(filePath, [...existing, ...toAdd]);
    console.info(
      '[ensure-operations-catalog] added ' + toAdd.length +
      ' master op types for tenant=' + tenantId +
      ': ' + toAdd.map(r => String(r.code)).join(', ')
    );
  }
}
