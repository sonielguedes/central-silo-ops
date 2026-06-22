import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { buildFuelingDashboard } from '@/lib/fueling-dashboard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = requireTenant(req);
  if (!auth.ok) return auth.response;

  const date = req.nextUrl.searchParams.get('date')?.trim() || undefined;
  const fleet = req.nextUrl.searchParams.get('fleet')?.trim() || undefined;
  const truck = req.nextUrl.searchParams.get('truck')?.trim() || undefined;
  const fuel = req.nextUrl.searchParams.get('fuel')?.trim() || undefined;

  const payload = buildFuelingDashboard(auth.tenantId, { date, fleet, truck, fuel });

  return NextResponse.json({
    ...payload,
    filters: { date, fleet, truck, fuel },
  });
}

