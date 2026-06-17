import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { buildDailySheet, buildDailySheetList } from '@/lib/daily-sheet-builder';
import { FichaStore, deriveFichaStatus, isBlockingInconsistency } from '@/lib/ficha-store';
import type { FichaDiaria } from '@/lib/daily-sheet-builder';
import type { FichaStatusFinal, CorrectionEntry, PimsFields } from '@/lib/ficha-store';

export const dynamic = 'force-dynamic';

// Re-export types for consumers
export type { FichaDiaria } from '@/lib/daily-sheet-builder';
export type { FichaStatusFinal } from '@/lib/ficha-store';

// ── Merged ficha type ─────────────────────────────────────────────────────────
export type FichaMerged = FichaDiaria & {
  finalStatus:         FichaStatusFinal;
  // Overlay — validação
  validated:           boolean;
  validatedBy:         string | null;
  validatedAt:         string | null;
  // Overlay — exportação
  exported:            boolean;
  exportedAt:          string | null;
  exportedBy:          string | null;
  exportCount:         number;
  needsReexport:       boolean;
  modifiedAfterExport: boolean;
  // Overlay — correções
  corrections:         CorrectionEntry[];
  correctedFields:     Record<string, unknown>;
  // PIMS (integração futura)
  pims:                PimsFields;
};

/** Merge computed ficha with overlay state (validation, export, corrections). */
function mergeFichaWithOverlay(ficha: FichaDiaria, tenantId: string): FichaMerged {
  const overlay = FichaStore.get(tenantId, ficha.fleetCode, ficha.date);

  // Apply manual corrections on top of computed fields
  const merged = { ...ficha } as Record<string, unknown> & FichaDiaria;
  if (overlay?.correctedFields) {
    for (const [field, value] of Object.entries(overlay.correctedFields)) {
      merged[field] = value;
    }
  }

  const hasBlockingInc = (merged.inconsistencies as string[]).some(i => isBlockingInconsistency(i));

  const finalStatus = deriveFichaStatus({
    computedStatus:          ficha.status,
    overlay,
    isDayOpen:               ficha.isDayOpen,
    hasBlockingInconsistency: hasBlockingInc,
  });

  return {
    ...(merged as FichaDiaria),
    finalStatus,
    // Validação
    validated:           overlay?.validated           ?? false,
    validatedBy:         overlay?.validatedBy         ?? null,
    validatedAt:         overlay?.validatedAt         ?? null,
    // Exportação
    exported:            overlay?.exported            ?? false,
    exportedAt:          overlay?.exportedAt          ?? null,
    exportedBy:          overlay?.exportedBy          ?? null,
    exportCount:         overlay?.exportCount         ?? 0,
    needsReexport:       overlay?.needsReexport       ?? false,
    modifiedAfterExport: overlay?.modifiedAfterExport ?? false,
    // Correções
    corrections:         overlay?.corrections         ?? [],
    correctedFields:     overlay?.correctedFields     ?? {},
    // PIMS
    pims:                overlay?.pims                ?? {},
  };
}

// ── GET — list or single ficha ────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date      = searchParams.get('date')?.trim()      || new Date().toISOString().slice(0, 10);
    const fleetCode = searchParams.get('fleetCode')?.trim() || null;

    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;
    const { tenantId } = tenant;

    const permCheck = requirePermission(req, 'operadores', 'visualizar', tenantId);
    if (permCheck) return permCheck;

    if (fleetCode) {
      const result = buildDailySheet({ tenantId, fleetCode, date });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json(mergeFichaWithOverlay(result.ficha, tenantId));
    }

    const fichas = buildDailySheetList({ tenantId, date });
    return NextResponse.json(fichas.map(f => mergeFichaWithOverlay(f, tenantId)));
  } catch (error) {
    console.error('[ficha-operador] GET error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ── PATCH — actions: validate | clear-validation | reopen | correct | export-mark | update-pims
export async function PATCH(req: NextRequest) {
  try {
    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;
    const { tenantId } = tenant;

    const permCheck = requirePermission(req, 'operadores', 'editar', tenantId);
    if (permCheck) return permCheck;

    const body      = await req.json() as Record<string, unknown>;
    const action    = String(body.action    ?? '');
    const fleetCode = String(body.fleetCode ?? '');
    const date      = String(body.date      ?? '');
    const actor     = String(body.actor ?? body.user ?? 'sistema');

    if (!fleetCode || !date) {
      return NextResponse.json({ error: 'fleetCode and date are required' }, { status: 400 });
    }

    // ── validate ──────────────────────────────────────────────────────────────
    if (action === 'validate') {
      const sheetResult = buildDailySheet({ tenantId, fleetCode, date });
      if (sheetResult.ok) {
        if (sheetResult.ficha.status === 'EM_ANDAMENTO') {
          return NextResponse.json({
            ok:      false,
            warning: 'EM_ANDAMENTO',
            message: 'Jornada em andamento. Aguarde a conclusão para validar a ficha.',
          }, { status: 422 });
        }
        const blockingList = sheetResult.ficha.inconsistencies.filter(i => isBlockingInconsistency(i));
        if (blockingList.length > 0) {
          return NextResponse.json({
            ok:         false,
            error:      'Ficha possui inconsistências críticas. Corrija antes de validar.',
            blocking:   blockingList,
          }, { status: 422 });
        }
      }
      const overlay = FichaStore.validate(tenantId, fleetCode, date, actor);
      return NextResponse.json({ ok: true, overlay });
    }

    // ── clear-validation ──────────────────────────────────────────────────────
    if (action === 'clear-validation') {
      const overlay = FichaStore.clearValidation(tenantId, fleetCode, date);
      return NextResponse.json({ ok: true, overlay });
    }

    // ── reopen (cancela validação e exportação para correção pós-exportação) ──
    if (action === 'reopen') {
      const overlay = FichaStore.reopen(tenantId, fleetCode, date, actor);
      return NextResponse.json({ ok: true, overlay });
    }

    // ── correct (single field) ────────────────────────────────────────────────
    if (action === 'correct') {
      const reason = String(body.reason ?? '').trim();
      if (!reason) {
        return NextResponse.json({ error: 'reason é obrigatório para correção' }, { status: 400 });
      }

      // Multi-field batch correction
      const updates = body.updates as Record<string, unknown> | undefined;
      if (updates && typeof updates === 'object') {
        const oldValues = (body.oldValues as Record<string, unknown>) ?? {};
        const overlay = FichaStore.applyMultiCorrection(
          tenantId, fleetCode, date,
          updates, oldValues,
          reason, actor,
        );
        return NextResponse.json({ ok: true, overlay });
      }

      // Single-field correction
      const field    = String(body.field    ?? '');
      const oldValue = body.oldValue ?? null;
      const newValue = body.newValue ?? null;
      if (!field) {
        return NextResponse.json({ error: 'field (ou updates) é obrigatório para correção' }, { status: 400 });
      }
      const overlay = FichaStore.applyCorrection(tenantId, fleetCode, date, {
        field, oldValue, newValue, reason, changedBy: actor,
      });
      return NextResponse.json({ ok: true, overlay });
    }

    // ── export-mark ───────────────────────────────────────────────────────────
    if (action === 'export-mark') {
      const overlay = FichaStore.markExported(tenantId, fleetCode, date, actor);
      return NextResponse.json({ ok: true, overlay });
    }

    // ── update-pims ───────────────────────────────────────────────────────────
    if (action === 'update-pims') {
      const pimsData = body.pims as Partial<PimsFields> | undefined;
      if (!pimsData || typeof pimsData !== 'object') {
        return NextResponse.json({ error: 'pims object is required' }, { status: 400 });
      }
      const overlay = FichaStore.updatePims(tenantId, fleetCode, date, pimsData);
      return NextResponse.json({ ok: true, overlay });
    }

    return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    console.error('[ficha-operador] PATCH error', error);
    if (msg.includes('obrigatório')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
