import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Re-use the same logic by calling the main ficha route internally
async function getFicha(
  req: NextRequest,
  fleetCode: string,
  journeyId: string | null
) {
  const { origin } = new URL(req.url);
  const url = new URL('/api/ficha-operador', origin);
  url.searchParams.set('fleetCode', fleetCode);
  if (journeyId) url.searchParams.set('journeyId', journeyId);

  const res = await fetch(url.toString(), {
    headers: {
      'x-company-token': req.headers.get('x-company-token') ?? '',
      'x-tenant-id':     req.headers.get('x-tenant-id') ?? '',
    },
  });
  if (!res.ok) return null;
  return res.json();
}

const esc = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v);
  return s.includes(';') || s.includes('"') || s.includes('\n')
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fleetCode = searchParams.get('fleetCode')?.trim();
    const journeyId = searchParams.get('journeyId')?.trim() || null;

    if (!fleetCode) {
      return NextResponse.json({ error: 'fleetCode is required' }, { status: 400 });
    }

    const ficha = await getFicha(req, fleetCode, journeyId);
    if (!ficha) {
      return NextResponse.json({ error: 'Ficha not found' }, { status: 404 });
    }

    const date = ficha.startedAt
      ? new Date(ficha.startedAt).toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR');

    const hour = ficha.startedAt
      ? new Date(ficha.startedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      : '';

    const CSV_HEADER =
      'data;hora;frota;operador;matricula;operacao;implemento;horimetro_inicio;horimetro_fim;total_horas;parada_codigo;parada_descricao;status';

    // One row per stop (or one row if no stops)
    const rows: string[] = [];

    if (ficha.stops && ficha.stops.length > 0) {
      for (const stop of ficha.stops) {
        rows.push([
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
          esc(stop.code),
          esc(stop.description),
          esc(ficha.status),
        ].join(';'));
      }
    } else {
      rows.push([
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
        '',
        '',
        esc(ficha.status),
      ].join(';'));
    }

    const csv = [CSV_HEADER, ...rows].join('\n');
    const filename = `ficha-${ficha.fleetCode}-${journeyId ?? 'current'}-${new Date().toISOString().slice(0, 10)}.csv`;

    console.info('[ficha-operador/export] fleetCode=' + fleetCode + ' rows=' + rows.length);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[ficha-operador/export] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
