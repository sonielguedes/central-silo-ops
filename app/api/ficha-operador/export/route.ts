import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { buildDailySheet, buildDailySheetList } from '@/lib/daily-sheet-builder';
import { FichaStore, deriveFichaStatus } from '@/lib/ficha-store';
import type { FichaDiaria } from '@/lib/daily-sheet-builder';

export const dynamic = 'force-dynamic';

// ── CSV helpers ───────────────────────────────────────────────────────────────
function esc(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  if (s.includes(';') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function fmtBR(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso);
  return Number.isNaN(t.getTime())
    ? ''
    : t.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtMin(min: number | null | undefined): string {
  if (min == null) return '';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h + 'h' + (m > 0 ? String(m).padStart(2, '0') + 'min' : '');
}

function fmtH(v: number | null | undefined): string {
  if (v == null) return '';
  return String(Math.round(v * 100) / 100).replace('.', ',');
}

// ── Build CSV rows ────────────────────────────────────────────────────────────
const HEADER = [
  'data', 'periodo_inicio', 'periodo_fim',
  'regional', 'unidade', 'grupo_equipamento',
  'frota', 'tipo_equipamento',
  'operador', 'matricula',
  'os', 'operacao_codigo', 'operacao_descricao',
  'centro_custo', 'implemento_codigo', 'implemento_descricao',
  'fazenda', 'zona', 'talhao',
  'horimetro_inicio', 'horimetro_atual', 'horimetro_fim', 'total_horas',
  'horas_produtivas', 'horas_paradas', 'horas_indeterminado', 'percentual_indeterminado',
  'status', 'inconsistencias',
  'validado', 'exportado',
  'validado_por', 'validado_em', 'exportado_em',
].join(';');

function buildRow(ficha: FichaDiaria, tenantId: string): string {
  const overlay = FichaStore.get(tenantId, ficha.fleetCode, ficha.date);
  const hasBlocking = ficha.inconsistencies.some(i => !i.includes('(alerta)'));
  const finalStatus = deriveFichaStatus({
    computedStatus: ficha.status,
    overlay,
    isDayOpen: ficha.isDayOpen,
    hasBlockingInconsistency: hasBlocking,
  });

  // Apply corrections
  const cf = overlay?.correctedFields ?? {};
  const get = (field: string, base: unknown): unknown => field in cf ? cf[field] : base;

  // Stops row expansion — one CSV row per stop, or one row if no stops
  const stops = ficha.stops;

  const baseFields = [
    esc(ficha.date),
    esc(fmtBR(ficha.periodStart)),
    esc(fmtBR(ficha.periodEnd)),
    '', // regional
    '', // unidade
    '', // grupo_equipamento
    esc(ficha.fleetCode),
    '', // tipo_equipamento
    esc(get('operatorName',   ficha.operatorName)),
    esc(get('operatorRegistration', ficha.operatorRegistration)),
    esc(get('workOrderNumber', ficha.workOrderNumber)),
    esc(get('operationCode',  ficha.operationCode)),
    esc(get('operationName',  ficha.operationName)),
    esc(get('costCenterName', ficha.costCenterName)),
    esc(get('implementCode',  ficha.implementCode)),
    esc(get('implementName',  ficha.implementName)),
    '', // fazenda
    '', // zona
    '', // talhao
    esc(fmtH(ficha.hourmeterStart)),
    esc(fmtH(ficha.hourmeterCurrent)),
    esc(fmtH(ficha.hourmeterEnd)),
    esc(fmtH(ficha.totalHourmeter)),
    esc(fmtMin(ficha.minutesOperating)),
    esc(fmtMin(ficha.minutesStopped)),
    esc(fmtMin(ficha.minutesUndetermined)),
    esc(ficha.pctUndetermined != null ? ficha.pctUndetermined + '%' : ''),
    esc(finalStatus),
    esc(ficha.inconsistencies.join(' | ')),
    esc(overlay?.validated ? 'SIM' : 'NAO'),
    esc(overlay?.exported  ? 'SIM' : 'NAO'),
    esc(overlay?.validatedBy ?? ''),
    esc(fmtBR(overlay?.validatedAt)),
    esc(fmtBR(overlay?.exportedAt)),
  ];

  if (stops.length === 0) {
    return baseFields.join(';');
  }

  // One row per stop — repeat base fields
  return stops.map(s =>
    baseFields.join(';') +
    '\n' +
    // Add a second row with stop detail as a sub-row (no extra columns — keep same schema)
    // Encode stop into inconsistencias column as annotation, or simply repeat base
    // Per spec the CSV is flat — stops are shown as rows, so we annotate within
    baseFields.map((_, i) => {
      if (i === 18) return esc('PARADA ' + s.code + ': ' + s.description);
      if (i === 17) return esc(fmtBR(s.startedAt));
      if (i === 18) return esc(fmtBR(s.endedAt ?? ''));
      return _;
    }).join(';')
  ).join('\n');
}

// ── GET /api/ficha-operador/export ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date      = searchParams.get('date')?.trim()      || new Date().toISOString().slice(0, 10);
    const fleetCode = searchParams.get('fleetCode')?.trim() || null;

    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;
    const { tenantId } = tenant;

    const permCheck = requirePermission(req, 'operadores', 'exportar', tenantId);
    if (permCheck) return permCheck;

    let fichas: FichaDiaria[];
    if (fleetCode) {
      const result = buildDailySheet({ tenantId, fleetCode, date });
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
      fichas = [result.ficha];
    } else {
      fichas = buildDailySheetList({ tenantId, date });
    }

    if (fichas.length === 0) {
      return NextResponse.json({ error: 'Nenhuma ficha encontrada para exportação' }, { status: 404 });
    }

    // Build CSV
    const rows = fichas.map(f => buildRow(f, tenantId));
    const csv  = '﻿' + [HEADER, ...rows].join('\n');

    // Mark as exported
    for (const f of fichas) {
      FichaStore.markExported(tenantId, f.fleetCode, f.date, 'export-csv');
    }

    const safeDate = date.replace(/-/g, '');
    const suffix   = fleetCode ? '-frota' + fleetCode : '-todas';
    const filename = 'ficha-operador-' + safeDate + suffix + '.csv';

    console.info(
      '[ficha-operador/export] date=' + date +
      ' fichas=' + fichas.length +
      (fleetCode ? ' fleetCode=' + fleetCode : ''),
    );

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="' + filename + '"',
        'Cache-Control':       'no-store',
      },
    });
  } catch (error) {
    console.error('[ficha-operador/export] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
