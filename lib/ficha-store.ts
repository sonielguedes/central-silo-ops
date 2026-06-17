/**
 * ficha-store.ts
 *
 * Persistência do estado overlay das Fichas Diárias.
 *
 * Armazena em data/{tenantId}/fichas-overlay.json os dados que NÃO são
 * deriváveis dos eventos: validação, exportação, correções manuais, histórico.
 *
 * O computed (eventos + tempos) vem de daily-sheet-builder.ts.
 * Este store complementa com o estado persistido.
 */

import fs   from 'fs';
import path from 'path';

// ── Storage root (mesma lógica do server-storage.ts) ────────────────────────
function resolveStorageDir(): string {
  const env = process.env.STORAGE_DIR;
  if (env) return env;
  const base = process.cwd();
  const prod = path.join(base, 'data');
  if (fs.existsSync(prod)) return prod;
  const dev = path.join(base, '..', 'data');
  if (fs.existsSync(dev)) return dev;
  fs.mkdirSync(prod, { recursive: true });
  return prod;
}

const DATA_ROOT = resolveStorageDir();

function tenantDir(tenantId: string): string {
  const d = path.join(DATA_ROOT, tenantId);
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  return d;
}

function overlayFile(tenantId: string): string {
  return path.join(tenantDir(tenantId), 'fichas-overlay.json');
}

// ── Types ────────────────────────────────────────────────────────────────────
export interface CorrectionEntry {
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  changedBy: string;
  changedAt: string;
}

export interface FichaOverlay {
  /** Chave: tenantId|fleetCode|date */
  id: string;
  tenantId: string;
  fleetCode: string;
  date: string;
  /** Campos corrigidos manualmente (aplicados sobre os dados computados) */
  correctedFields: Record<string, unknown>;
  corrections: CorrectionEntry[];
  validated: boolean;
  validatedBy: string | null;
  validatedAt: string | null;
  exported: boolean;
  exportedAt: string | null;
  exportedBy: string | null;
  /**
   * Se a ficha foi exportada e depois sofreu correção,
   * status deve ser ATUALIZADO até nova exportação.
   */
  modifiedAfterExport: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Load / save helpers ───────────────────────────────────────────────────────
function loadOverlays(tenantId: string): FichaOverlay[] {
  const file = overlayFile(tenantId);
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveOverlays(tenantId: string, overlays: FichaOverlay[]): void {
  const file = overlayFile(tenantId);
  fs.writeFileSync(file, JSON.stringify(overlays, null, 2), 'utf-8');
}

function makeId(tenantId: string, fleetCode: string, date: string): string {
  return tenantId + '|' + fleetCode + '|' + date;
}

// ── Public API ────────────────────────────────────────────────────────────────
export const FichaStore = {
  /** Retorna overlay para uma ficha, ou null se não existir. */
  get(tenantId: string, fleetCode: string, date: string): FichaOverlay | null {
    const overlays = loadOverlays(tenantId);
    return overlays.find(o => o.id === makeId(tenantId, fleetCode, date)) ?? null;
  },

  /** Retorna todos os overlays de um tenant. */
  list(tenantId: string): FichaOverlay[] {
    return loadOverlays(tenantId);
  },

  /** Cria ou atualiza um overlay. */
  upsert(overlay: FichaOverlay): FichaOverlay {
    const overlays = loadOverlays(overlay.tenantId);
    const idx = overlays.findIndex(o => o.id === overlay.id);
    const now = new Date().toISOString();
    const updated = { ...overlay, updatedAt: now };
    if (idx === -1) overlays.push({ ...updated, createdAt: now });
    else overlays[idx] = { ...overlays[idx], ...updated };
    saveOverlays(overlay.tenantId, overlays);
    return updated;
  },

  /** Inicializa overlay se não existir (chamado no primeiro acesso). */
  ensure(tenantId: string, fleetCode: string, date: string): FichaOverlay {
    const existing = this.get(tenantId, fleetCode, date);
    if (existing) return existing;
    const now = new Date().toISOString();
    const overlay: FichaOverlay = {
      id: makeId(tenantId, fleetCode, date),
      tenantId, fleetCode, date,
      correctedFields: {},
      corrections: [],
      validated: false,
      validatedBy: null,
      validatedAt: null,
      exported: false,
      exportedAt: null,
      exportedBy: null,
      modifiedAfterExport: false,
      createdAt: now,
      updatedAt: now,
    };
    return this.upsert(overlay);
  },

  /** Marca ficha como validada. */
  validate(tenantId: string, fleetCode: string, date: string, validatedBy: string): FichaOverlay {
    const overlay = this.ensure(tenantId, fleetCode, date);
    return this.upsert({
      ...overlay,
      validated: true,
      validatedBy,
      validatedAt: new Date().toISOString(),
    });
  },

  /** Marca ficha como exportada. Limpa modifiedAfterExport. */
  markExported(tenantId: string, fleetCode: string, date: string, exportedBy: string): FichaOverlay {
    const overlay = this.ensure(tenantId, fleetCode, date);
    return this.upsert({
      ...overlay,
      exported: true,
      exportedAt: new Date().toISOString(),
      exportedBy,
      modifiedAfterExport: false,
    });
  },

  /** Aplica correção manual a um campo da ficha. */
  applyCorrection(
    tenantId: string,
    fleetCode: string,
    date: string,
    correction: {
      field: string;
      oldValue: unknown;
      newValue: unknown;
      reason: string;
      changedBy: string;
    },
  ): FichaOverlay {
    const overlay = this.ensure(tenantId, fleetCode, date);
    const entry: CorrectionEntry = {
      ...correction,
      changedAt: new Date().toISOString(),
    };
    const correctedFields = { ...overlay.correctedFields, [correction.field]: correction.newValue };
    // Se já foi exportada, marcar como ATUALIZADO
    const modifiedAfterExport = overlay.exported ? true : overlay.modifiedAfterExport;

    return this.upsert({
      ...overlay,
      correctedFields,
      corrections: [...overlay.corrections, entry],
      modifiedAfterExport,
    });
  },
};

// ── Status derivation from overlay + computed ─────────────────────────────────
export type FichaStatusFinal =
  | 'EM_ANDAMENTO'
  | 'PENDENTE'
  | 'INCONSISTENTE'
  | 'VALIDADO'
  | 'ATUALIZADO'
  | 'EXPORTADO';

export function deriveFichaStatus(params: {
  computedStatus: string;
  overlay: FichaOverlay | null;
  isDayOpen: boolean;
  hasBlockingInconsistency: boolean;
}): FichaStatusFinal {
  const { computedStatus, overlay, isDayOpen, hasBlockingInconsistency } = params;

  // Ativo hoje → EM_ANDAMENTO
  if (computedStatus === 'EM_ANDAMENTO' || isDayOpen) return 'EM_ANDAMENTO';

  if (!overlay) {
    return hasBlockingInconsistency ? 'INCONSISTENTE' : 'PENDENTE';
  }

  // Exportada e depois corrigida → ATUALIZADO
  if (overlay.exported && overlay.modifiedAfterExport) return 'ATUALIZADO';

  // Exportada sem modificação posterior → EXPORTADO
  if (overlay.exported) return 'EXPORTADO';

  // Validada → VALIDADO
  if (overlay.validated) return 'VALIDADO';

  // Com inconsistência → INCONSISTENTE
  if (hasBlockingInconsistency) return 'INCONSISTENTE';

  // Sem problemas → PENDENTE (aguardando exportação)
  return 'PENDENTE';
}
