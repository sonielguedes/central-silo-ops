/**
 * ficha-store.ts
 *
 * Persistência do estado overlay das Fichas Diárias.
 * Armazena em data/{tenantId}/fichas-overlay.json os dados que NÃO são
 * deriváveis dos eventos: validação, exportação, correções manuais, histórico.
 */

import fs   from 'fs';
import path from 'path';

// ── Storage root — mesma lógica de server-storage.ts ────────────────────────
function resolveStorageDir(): string {
  const dir =
    process.env.SILO_STORAGE_DIR ||
    process.env.SILO_DATA_DIR    ||
    process.env.STORAGE_DIR      ||
    (process.env.NODE_ENV === 'production' ? '/app/data' : './data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
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
  id: string;
  sheetId: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  correctedBy: string;
  correctedAt: string;
}

/** Campos PIMS para futura integração */
export interface PimsFields {
  pimsInstance?:       string | null;
  pimsBoletim?:        string | null;
  pimsOperationDate?:  string | null;
  pimsEquipmentCode?:  string | null;
  pimsOperatorCode?:   string | null;
  pimsOperationCode?:  string | null;
  pimsCostCenterCode?: string | null;
  pimsImplementCode?:  string | null;
  pimsFarmCode?:       string | null;
  pimsZoneCode?:       string | null;
  pimsFieldCode?:      string | null;
  pimsExportStatus?:   'PENDING' | 'EXPORTED' | 'ERROR' | null;
  pimsExportedAt?:     string | null;
  pimsLastError?:      string | null;
}

export interface FichaOverlay {
  /** Chave: tenantId|fleetCode|date */
  id: string;
  tenantId: string;
  fleetCode: string;
  date: string;
  /** Campos corrigidos manualmente — aplicados sobre os dados computados */
  correctedFields: Record<string, unknown>;
  corrections: CorrectionEntry[];

  // ── Validação ─────────────────────────────────────────────────────────────
  validated: boolean;
  validatedBy: string | null;
  validatedAt: string | null;

  // ── Exportação ────────────────────────────────────────────────────────────
  exported: boolean;
  exportedAt: string | null;
  exportedBy: string | null;
  exportCount: number;
  /**
   * Ficha foi exportada e depois recebeu correção manual.
   * Status derivado = ATUALIZADO. Requer nova exportação.
   */
  modifiedAfterExport: boolean;
  needsReexport: boolean;

  // ── Reabertura ────────────────────────────────────────────────────────────
  reopenedBy: string | null;
  reopenedAt: string | null;

  // ── PIMS (integração futura) ───────────────────────────────────────────────
  pims: PimsFields;

  // ── Metadados ─────────────────────────────────────────────────────────────
  createdAt: string;
  updatedAt: string;
}

// ── Inconsistência crítica: bloqueia validação e exportação ──────────────────
export const BLOCKING_INCONSISTENCIES = new Set([
  'FROTA_NAO_IDENTIFICADA',
  'OPERADOR_NAO_IDENTIFICADO',
  'MATRICULA_INVALIDA',
  'OPERACAO_NAO_INFORMADA',
  'OS_NAO_INFORMADA',
  'CENTRO_CUSTO_NAO_INFORMADO',
  'HORIMETRO_FINAL_MENOR_QUE_INICIAL',
  'JOURNEY_END_SEM_HORIMETRO_FINAL',
  'SEM_HORIMETRO_INICIAL',
]);

export function isBlockingInconsistency(inc: string): boolean {
  // Strip " (alerta)" suffix before checking
  const clean = inc.replace(/ \(alerta\)$/, '').trim();
  return BLOCKING_INCONSISTENCIES.has(clean);
}

export function hasManualCloseCorrection(overlay: FichaOverlay | null): boolean {
  if (!overlay?.correctedFields) return false;
  return (
    overlay.correctedFields.hourmeterEnd != null ||
    overlay.correctedFields.hourmeterFinal != null ||
    overlay.correctedFields.endedAt != null
  );
}

export function getEffectiveBlockingInconsistencies(
  inconsistencies: string[],
  overlay: FichaOverlay | null,
): string[] {
  const manualClose = hasManualCloseCorrection(overlay);
  return inconsistencies.filter(inc => {
    if (!isBlockingInconsistency(inc)) return false;
    const clean = inc.replace(/ \(alerta\)$/, '').trim();
    if (manualClose && clean === 'JOURNEY_END_SEM_HORIMETRO_FINAL') return false;
    return true;
  });
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
  fs.writeFileSync(overlayFile(tenantId), JSON.stringify(overlays, null, 2), 'utf-8');
}

function makeId(tenantId: string, fleetCode: string, date: string): string {
  return tenantId + '|' + fleetCode + '|' + date;
}

function newOverlay(tenantId: string, fleetCode: string, date: string, now: string): FichaOverlay {
  return {
    id: makeId(tenantId, fleetCode, date),
    tenantId, fleetCode, date,
    correctedFields: {},
    corrections: [],
    validated: false,    validatedBy: null,   validatedAt: null,
    exported: false,     exportedAt: null,    exportedBy: null,
    exportCount: 0,
    modifiedAfterExport: false, needsReexport: false,
    reopenedBy: null,   reopenedAt: null,
    pims: {},
    createdAt: now, updatedAt: now,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────
export const FichaStore = {
  get(tenantId: string, fleetCode: string, date: string): FichaOverlay | null {
    return loadOverlays(tenantId).find(o => o.id === makeId(tenantId, fleetCode, date)) ?? null;
  },

  list(tenantId: string): FichaOverlay[] {
    return loadOverlays(tenantId);
  },

  upsert(overlay: FichaOverlay): FichaOverlay {
    const overlays = loadOverlays(overlay.tenantId);
    const idx      = overlays.findIndex(o => o.id === overlay.id);
    const now      = new Date().toISOString();
    const updated  = { ...overlay, updatedAt: now };
    if (idx === -1) overlays.push({ ...updated, createdAt: updated.createdAt || now });
    else            overlays[idx] = { ...overlays[idx], ...updated };
    saveOverlays(overlay.tenantId, overlays);
    return updated;
  },

  ensure(tenantId: string, fleetCode: string, date: string): FichaOverlay {
    return this.get(tenantId, fleetCode, date) ?? this.upsert(newOverlay(tenantId, fleetCode, date, new Date().toISOString()));
  },

  validate(tenantId: string, fleetCode: string, date: string, validatedBy: string): FichaOverlay {
    const overlay = this.ensure(tenantId, fleetCode, date);
    return this.upsert({ ...overlay, validated: true, validatedBy, validatedAt: new Date().toISOString() });
  },

  clearValidation(tenantId: string, fleetCode: string, date: string): FichaOverlay {
    const overlay = this.ensure(tenantId, fleetCode, date);
    return this.upsert({ ...overlay, validated: false, validatedBy: null, validatedAt: null });
  },

  reopen(tenantId: string, fleetCode: string, date: string, actor: string): FichaOverlay {
    const overlay = this.ensure(tenantId, fleetCode, date);
    return this.upsert({
      ...overlay,
      validated: false, validatedBy: null, validatedAt: null,
      reopenedBy: actor, reopenedAt: new Date().toISOString(),
    });
  },

  markExported(tenantId: string, fleetCode: string, date: string, exportedBy: string): FichaOverlay {
    const overlay = this.ensure(tenantId, fleetCode, date);
    return this.upsert({
      ...overlay,
      exported:           true,
      exportedAt:         new Date().toISOString(),
      exportedBy,
      exportCount:        (overlay.exportCount ?? 0) + 1,
      modifiedAfterExport: false,
      needsReexport:       false,
    });
  },

  updatePims(tenantId: string, fleetCode: string, date: string, pimsData: Partial<PimsFields>): FichaOverlay {
    const overlay = this.ensure(tenantId, fleetCode, date);
    return this.upsert({ ...overlay, pims: { ...overlay.pims, ...pimsData } });
  },

  /**
   * Aplica correção manual a um ou mais campos.
   * Cada campo gera um CorrectionEntry separado com o mesmo motivo.
   * Se a ficha já foi exportada, seta modifiedAfterExport + needsReexport.
   */
  applyCorrection(
    tenantId: string,
    fleetCode: string,
    date: string,
    correction: {
      field:     string;
      oldValue:  unknown;
      newValue:  unknown;
      reason:    string;
      changedBy: string;
    },
  ): FichaOverlay {
    if (!correction.reason?.trim()) {
      throw new Error('Motivo da correção é obrigatório');
    }
    const overlay = this.ensure(tenantId, fleetCode, date);
    const entry: CorrectionEntry = {
      id:          'corr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      sheetId:     overlay.id,
      field:       correction.field,
      oldValue:    correction.oldValue,
      newValue:    correction.newValue,
      reason:      correction.reason,
      correctedBy: correction.changedBy,
      correctedAt: new Date().toISOString(),
    };
    const correctedFields = { ...overlay.correctedFields, [correction.field]: correction.newValue };
    const wasExported     = overlay.exported;
    return this.upsert({
      ...overlay,
      correctedFields,
      corrections:         [...overlay.corrections, entry],
      modifiedAfterExport: wasExported,
      needsReexport:       wasExported,
    });
  },

  /**
   * Aplica múltiplos campos de uma vez (batch correction).
   * Cada campo gera um CorrectionEntry com o mesmo motivo.
   */
  applyMultiCorrection(
    tenantId: string,
    fleetCode: string,
    date: string,
    updates: Record<string, unknown>,
    oldValues: Record<string, unknown>,
    reason: string,
    changedBy: string,
  ): FichaOverlay {
    if (!reason?.trim()) {
      throw new Error('Motivo da correção é obrigatório');
    }
    const overlay = this.ensure(tenantId, fleetCode, date);
    const now = new Date().toISOString();
    const newEntries: CorrectionEntry[] = Object.entries(updates)
      .filter(([, v]) => v !== undefined)
      .map(([field, newValue]) => ({
        id:          'corr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        sheetId:     overlay.id,
        field,
        oldValue:    oldValues[field] ?? null,
        newValue,
        reason,
        correctedBy: changedBy,
        correctedAt: now,
      }));

    const correctedFields = { ...overlay.correctedFields, ...updates };
    const wasExported     = overlay.exported;
    return this.upsert({
      ...overlay,
      correctedFields,
      corrections:         [...overlay.corrections, ...newEntries],
      modifiedAfterExport: wasExported,
      needsReexport:       wasExported,
    });
  },
};

// ── Status derivation ────────────────────────────────────────────────────────
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

  if (overlay?.exported && overlay.modifiedAfterExport) return 'ATUALIZADO';
  if (overlay?.exported) return 'EXPORTADO';
  if (overlay?.validated) return 'VALIDADO';

  // Jornada ativa só permanece EM_ANDAMENTO quando não houve fechamento manual.
  if (computedStatus === 'EM_ANDAMENTO' && isDayOpen && !hasManualCloseCorrection(overlay)) {
    return 'EM_ANDAMENTO';
  }

  if (!overlay) {
    return hasBlockingInconsistency ? 'INCONSISTENTE' : 'PENDENTE';
  }

  // Com inconsistência crítica → INCONSISTENTE
  if (hasBlockingInconsistency) return 'INCONSISTENTE';

  return 'PENDENTE';
}
