import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { acknowledgeAlert } from '@/lib/alertas-builder';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const tenantId = ServerStorage.resolveTenantId(req.headers);
    const alertId = params.id;

    if (!alertId) {
      return NextResponse.json({ error: 'ID do alerta obrigatorio' }, { status: 400 });
    }

    const alert = acknowledgeAlert(tenantId, alertId);
    if (!alert) {
      return NextResponse.json({ error: 'Alerta nao encontrado ou ja resolvido' }, { status: 404 });
    }

    console.info(`[alertas] acknowledged alertId=${alertId}`);
    return NextResponse.json({ alert });
  } catch (error) {
    console.error('[alertas/acknowledge] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
