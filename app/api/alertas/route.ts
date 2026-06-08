import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { generateAlerts } from '@/lib/alertas-builder';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenantId = ServerStorage.resolveTenantId(req.headers);
    const alerts = generateAlerts(tenantId);

    const { searchParams } = new URL(req.url);
    const severity = searchParams.get('severity')?.toUpperCase() || null;
    const status = searchParams.get('status')?.toUpperCase() || null;

    let filtered = alerts;
    if (severity) filtered = filtered.filter(a => a.severity === severity);
    if (status) filtered = filtered.filter(a => a.status === status);

    // Most recent first
    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const summary = {
      total: filtered.length,
      critico: filtered.filter(a => a.severity === 'CRITICO' && a.status !== 'RESOLVIDO').length,
      atencao: filtered.filter(a => a.severity === 'ATENCAO' && a.status !== 'RESOLVIDO').length,
      informativo: filtered.filter(a => a.severity === 'INFORMATIVO' && a.status !== 'RESOLVIDO').length,
      abertos: filtered.filter(a => a.status === 'ABERTO').length,
      reconhecidos: filtered.filter(a => a.status === 'RECONHECIDO').length,
      resolvidos: filtered.filter(a => a.status === 'RESOLVIDO').length,
    };

    console.info(`[alertas] total=${summary.total} critico=${summary.critico} atencao=${summary.atencao} informativo=${summary.informativo}`);

    return NextResponse.json({ summary, alerts: filtered }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[alertas] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
