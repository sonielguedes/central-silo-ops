import { NextRequest, NextResponse } from 'next/server';
import { generateAlerts } from '@/lib/alertas-builder';
import { requireTenant } from '@/lib/auth/api-guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;
    const { tenantId } = tenant;

    const alerts = generateAlerts(tenantId);

    const { searchParams } = new URL(req.url);
    const severity = searchParams.get('severity')?.toUpperCase() || null;
    const status = searchParams.get('status')?.toUpperCase() || null;

    let filtered = alerts;
    if (severity) filtered = filtered.filter(a => a.severity === severity);
    if (status) filtered = filtered.filter(a => a.status === status);

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

    return NextResponse.json({ summary, alerts: filtered }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[alertas] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
