import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { buildDailySheet, buildDailySheetList } from '@/lib/daily-sheet-builder';
import { FichaStore } from '@/lib/ficha-store';
import { buildFichaExportContent, canExportFicha, resolveFichaExportFilename, type ExportFormat } from '@/lib/ficha-export';
import type { FichaDiaria } from '@/lib/daily-sheet-builder';

export const dynamic = 'force-dynamic';

function parseFormat(value: string | null): ExportFormat {
  return String(value ?? 'csv').toLowerCase() === 'txt' ? 'txt' : 'csv';
}

function parseBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

function parseSheetIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === 'string' && raw.trim()) return raw.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

function logBlocked(sheetId: string, reasons: string[]): void {
  console.info('[ficha-export] blocked sheetId=' + sheetId + ' reasons=' + reasons.join('|'));
}

function logExported(count: number): void {
  console.info('[ficha-export] exported count=' + count);
}

async function loadSheets(tenantId: string, date: string, sheetIds: string[], fleetCode?: string | null): Promise<FichaDiaria[]> {
  if (fleetCode) {
    const result = buildDailySheet({ tenantId, fleetCode, date });
    if (!result.ok) throw new Error(result.error ?? 'Nenhuma ficha encontrada');
    return [result.ficha];
  }
  const fichas = buildDailySheetList({ tenantId, date });
  return sheetIds.length > 0 ? fichas.filter(f => sheetIds.includes(f.id)) : fichas;
}

function applyExportMark(tenantId: string, fichas: FichaDiaria[], format: ExportFormat): void {
  const actor = 'export-' + format;
  for (const ficha of fichas) {
    const overlay = FichaStore.get(tenantId, ficha.fleetCode, ficha.date);
    const shouldIncrement = !overlay?.exported || overlay?.needsReexport;
    if (shouldIncrement) {
      FichaStore.markExported(tenantId, ficha.fleetCode, ficha.date, actor);
    }
  }
}

async function handleExport(req: NextRequest, payload: Record<string, unknown>, markFromCaller: boolean) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const permCheck = requirePermission(req, 'operadores', 'exportar', tenantId);
  if (permCheck) return permCheck;

  const date = String(payload.date ?? new Date().toISOString().slice(0, 10)).trim();
  const format = parseFormat(String(payload.format ?? 'csv'));
  const sheetIds = parseSheetIds(payload.sheetIds);
  const fleetCode = String(payload.fleetCode ?? '').trim() || null;
  const markAsExported = markFromCaller && parseBool(payload.markAsExported);

  const fichas = await loadSheets(tenantId, date, sheetIds, fleetCode);
  if (fichas.length === 0) {
    return NextResponse.json({ ok: false, error: 'EXPORT_BLOCKED', blockingReasons: ['Nenhuma ficha encontrada'], warnings: [] }, { status: 404 });
  }

  const exportable: FichaDiaria[] = [];
  const blocked: { sheetId: string; reasons: string[] }[] = [];
  for (const ficha of fichas) {
    const overlay = FichaStore.get(tenantId, ficha.fleetCode, ficha.date);
    const check = canExportFicha(ficha, overlay);
    if (check.ok) exportable.push(ficha);
    else {
      blocked.push({ sheetId: ficha.id, reasons: check.blockingReasons });
      logBlocked(ficha.id, check.blockingReasons);
    }
  }

  if (blocked.length > 0) {
    return NextResponse.json({
      ok: false,
      error: 'EXPORT_BLOCKED',
      blockingReasons: blocked.flatMap(item => item.reasons),
      warnings: [],
      blocked,
    }, { status: 422 });
  }

  if (exportable.length === 0) {
    return NextResponse.json({ ok: false, error: 'EXPORT_BLOCKED', blockingReasons: [], warnings: [], blocked }, { status: 422 });
  }

  const content = buildFichaExportContent(exportable, tenantId, format);
  if (markAsExported) applyExportMark(tenantId, exportable, format);

  const filename = resolveFichaExportFilename(date, format);
  console.info('[ficha-export] date=' + date + ' format=' + format + ' selected=' + fichas.length);
  logExported(exportable.length);

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'text/plain; charset=utf-8',
      'Content-Disposition': 'attachment; filename="' + filename + '"',
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    return await handleExport(req, {
      date: searchParams.get('date'),
      format: searchParams.get('format'),
      sheetIds: searchParams.getAll('sheetIds'),
      fleetCode: searchParams.get('fleetCode'),
      markAsExported: searchParams.get('markAsExported'),
    }, false);
  } catch (error) {
    console.error('[ficha-export] GET error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as Record<string, unknown>;
    return await handleExport(req, body, true);
  } catch (error) {
    console.error('[ficha-export] POST error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
