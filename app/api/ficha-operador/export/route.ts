import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { buildOperatorSheet } from '@/lib/operator-sheet-builder';
import type { FichaOperador } from '@/lib/operator-sheet-builder';

export const dynamic = 'force-dynamic';

/** Escape a value for semicolon-delimited CSV (RFC 4180). */
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
  return Number.isNaN(t.getTime()) ? '' : t.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function buildCsv(ficha: FichaOperador): string {
  const date = ficha.startedAt
    ? new Date(ficha.startedAt).toLocaleDateString('pt-BR')
    : new Date().toLocaleDateString('pt-BR');
  const hour = ficha.startedAt
    ? new Date(ficha.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';

  const HEADER =
    'data;hora;frota;operador;matricula;operacao;implemento;' +
    'horimetro_inicio;horimetro_fim;total_horas;' +
    'parada_codigo;parada_descricao;parada_inicio;parada_fim;status';

  const base = [
    esc(date),
    esc(hour),
    esc(ficha.fleetCode),
    esc(ficha.operatorName ?? ficha.operatorRegistration),
    esc(ficha.operatorRegistration),
    esc(ficha.operationName ?? ficha.operationCode),
    esc(ficha.implementName ?? ficha.implementCode),
    esc(ficha.hourmeterStart),
    esc(ficha.hourmeterEnd),
    esc(ficha.totalHourmeter),
  ];

  const rows: string[] =
    ficha.stops.length > 0
      ? ficha.stops.map(s =>
          [
            ...base,
            esc(s.code),
            esc(s.description),
            esc(fmtBR(s.startedAt)),
            esc(fmtBR(s.endedAt ?? null)),
            esc(ficha.status),
          ].join(';'),
        )
      : [[...base, '', '', '', '', esc(ficha.status)].join(';')];

  // UTF-8 BOM (\uFEFF) so Excel opens without encoding prompt
  return '\uFEFF' + [HEADER, ...rows].join('\n');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fleetCode = searchParams.get('fleetCode')?.trim();
    const journeyId = searchParams.get('journeyId')?.trim() || null;

    if (!fleetCode) {
      return NextResponse.json({ error: 'fleetCode is required' }, { status: 400 });
    }

    const tenantId = ServerStorage.resolveTenantId(req.headers);
    const result   = buildOperatorSheet({ tenantId, fleetCode, journeyId });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const { ficha } = result;
    const csv       = buildCsv(ficha);
    const safeFleet = ficha.fleetCode.replace(/[^\w-]/g, '_');
    const safeJid   = (ficha.journeyId ?? 'current').replace(/[^\w-]/g, '_');
    const filename  = 'ficha-operador-' + safeFleet + '-' + safeJid + '.csv';

    console.info(
      '[ficha-operador/export] fleetCode=' + fleetCode +
      ' journeyId=' + (ficha.journeyId ?? 'none') +
      ' stops=' + ficha.stops.length +
      ' status=' + ficha.status,
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
