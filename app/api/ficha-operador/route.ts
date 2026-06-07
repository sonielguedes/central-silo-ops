import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { buildOperatorSheet } from '@/lib/operator-sheet-builder';

export type { FichaOperador } from '@/lib/operator-sheet-builder';

export const dynamic = 'force-dynamic';

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

    return NextResponse.json(result.ficha);
  } catch (error) {
    console.error('[ficha-operador] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
