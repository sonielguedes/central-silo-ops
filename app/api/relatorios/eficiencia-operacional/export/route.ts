import { NextRequest, NextResponse } from 'next/server';
import { buildEfficiencyCsv, buildEfficiencyReport } from '@/lib/eficiencia-operacional-builder';
import { ServerStorage } from '@/lib/server-storage';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format')?.trim().toLowerCase() || 'csv';
    if (format !== 'csv') {
      return NextResponse.json({ error: 'Formato invalido' }, { status: 400 });
    }

    const tenantId = ServerStorage.resolveTenantId(req.headers);
    const result = buildEfficiencyReport({
      tenantId,
      from: searchParams.get('from')?.trim() || null,
      to: searchParams.get('to')?.trim() || null,
      fleetCode: searchParams.get('fleetCode')?.trim() || null,
      operatorRegistration: searchParams.get('operatorRegistration')?.trim() || null,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const csv = buildEfficiencyCsv(result.report);
    const safeFrom = result.report.period.from.slice(0, 10).replace(/[^\d-]/g, '');
    const filename = 'eficiencia-operacional-' + safeFrom + '.csv';

    console.info('[relatorios/eficiencia-operacional/export] rows=' + result.report.byFleet.length);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="' + filename + '"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[relatorios/eficiencia-operacional/export] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
