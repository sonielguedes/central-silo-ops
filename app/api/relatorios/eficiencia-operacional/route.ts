import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { buildEfficiencyReport } from '@/lib/eficiencia-operacional-builder';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;
    const { tenantId } = tenant;
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

    console.info(
      '[relatorios/eficiencia-operacional] totalHours=' + result.report.summary.totalHours +
      ' journeys=' + result.report.summary.totalJourneys +
      ' finalized=' + result.report.summary.finalizedJourneys,
    );

    return NextResponse.json(result.report, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[relatorios/eficiencia-operacional] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
