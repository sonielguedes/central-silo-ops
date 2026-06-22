import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { calculateJourneyKpis, listFuelJourneys } from '@/lib/fuel-journeys';

export const dynamic = 'force-dynamic';

function read(value: string | null): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const perm = requirePermission(req, 'combustivel', 'visualizar', tenant.tenantId);
  if (perm) return perm;

  const query = req.nextUrl.searchParams;
  const items = listFuelJourneys({
    tenantId: tenant.tenantId,
    companyCode: read(query.get('companyCode')),
    journeyId: read(query.get('journeyId')),
    from: read(query.get('from')),
    to: read(query.get('to')),
    status: (read(query.get('status'))?.toUpperCase() as 'FINALIZADA' | 'ATIVA' | 'INCONSISTENTE' | undefined),
    comboio: read(query.get('comboio')),
    driver: read(query.get('driver')),
    source: read(query.get('source')),
    q: read(query.get('q')),
  });

  return NextResponse.json({
    success: true,
    items,
    summary: calculateJourneyKpis(items, read(query.get('from'))),
  });
}
