import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { buildDailySheet, buildDailySheetList } from '@/lib/daily-sheet-builder';
import { FichaStore, deriveFichaStatus } from '@/lib/ficha-store';
import type { FichaDiaria } from '@/lib/daily-sheet-builder';
import type { FichaStatusFinal } from '@/lib/ficha-store';

export const dynamic = 'force-dynamic';

// Re-export types for consumers
export type { FichaDiaria } from '@/lib/daily-sheet-builder';
export type { FichaStatusFinal } from '@/lib/ficha-store';

/** Merge computed ficha with overlay state (validation, export, corrections). */
function mergeFichaWithOverlay(ficha: FichaDiaria, tenantId: string): FichaDiaria & { finalStatus: FichaStatusFinal } {
  const overlay = FichaStore.get(tenantId, ficha.fleetCode, ficha.date);

  // Apply manual corrections on top of computed fields
  let merged = { ...ficha };
  if (overlay?.correctedFields) {
    for (const [field, value] of Object.entries(overlay.correctedFields)) {
      (merged as Record<string, unknown>)[field] = value;
    }
  }

  const hasBlockingInconsistency = merged.inconsistencies.some(i => !i.includes('(alerta)'));

  const finalStatus = deriveFichaStatus({
    computedStatus: ficha.status,
    overlay,
    isDayOpen: ficha.isDayOpen,
    hasBlockingInconsistency,
  });

  return {
    ...merged,
    validated:   overlay?.validated   ?? false,
    validatedBy: overlay?.validatedBy ?? null,
    validatedAt: overlay?.validatedAt ?? null,
    finalStatus,
  };
}

// ── GET — list all fichas for a date, or a single ficha ─────────────────────
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
      // Single ficha
      const result = buildDailySheet({ tenantId, fleetCode, date });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      return NextResponse.json(mergeFichaWithOverlay(result.ficha, tenantId));
    }

    // All fichas for the day
    const fichas = buildDailySheetList({ tenantId, date });
    const merged = fichas.map(f => mergeFichaWithOverlay(f, tenantId));
    return NextResponse.json(merged);
  } catch (error) {
    console.error('[ficha-operador] GET error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// ── PATCH — validate / correct / mark-exported ───────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;
    const { tenantId } = tenant;

    const permCheck = requirePermission(req, 'operadores', 'editar', tenantId);
    if (permCheck) return permCheck;

    const body = await req.json() as Record<string, unknown>;
    const action    = String(body.action    ?? '');
    const fleetCode = String(body.fleetCode ?? '');
    const date      = String(body.date      ?? '');
    const actor     = String(body.actor     ?? body.user ?? 'sistema');

    if (!fleetCode || !date) {
      return NextResponse.json({ error: 'fleetCode and date are required' }, { status: 400 });
    }

    if (action === 'validate') {
      const overlay = FichaStore.validate(tenantId, fleetCode, date, actor);
      return NextResponse.json({ ok: true, overlay });
    }

    if (action === 'export-mark') {
      const overlay = FichaStore.markExported(tenantId, fleetCode, date, actor);
      return NextResponse.json({ ok: true, overlay });
    }

    if (action === 'correct') {
      const { field, oldValue, newValue, reason } = body as {
        field?: string; oldValue?: unknown; newValue?: unknown; reason?: string;
      };
      if (!field) return NextResponse.json({ error: 'field is required for correction' }, { status: 400 });
      const overlay = FichaStore.applyCorrection(tenantId, fleetCode, date, {
        field,
        oldValue: oldValue ?? null,
        newValue: newValue ?? null,
        reason: String(reason ?? ''),
        changedBy: actor,
      });
      return NextResponse.json({ ok: true, overlay });
    }

    return NextResponse.json({ error: 'Unknown action: ' + action }, { status: 400 });
  } catch (error) {
    console.error('[ficha-operador] PATCH error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
