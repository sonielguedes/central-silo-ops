import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { TimelineAggregator } from '@/lib/timeline';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const rbac = requirePermission(req, 'cadastros', 'visualizar', tenantId);
  if (rbac) return rbac;

  const url = new URL(req.url);
  const fleetCode = url.searchParams.get('fleetCode') || undefined;
  const equipmentId = url.searchParams.get('equipmentId') || undefined;
  const operatorRegistration = url.searchParams.get('operatorRegistration') || undefined;
  const journeyId = url.searchParams.get('journeyId') || undefined;
  const startDate = url.searchParams.get('startDate') || undefined;
  const endDate = url.searchParams.get('endDate') || undefined;
  const typesRaw = url.searchParams.get('types');
  const types = typesRaw ? typesRaw.split(',') : undefined;

  try {
    const events = TimelineAggregator.getTimeline({
      tenantId,
      fleetCode,
      equipmentId,
      operatorRegistration,
      journeyId,
      startDate,
      endDate,
      types
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('[api/timeline] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
