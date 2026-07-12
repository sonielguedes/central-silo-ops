import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { buildOperatorSheet } from '@/lib/operator-sheet-builder';
import { validateManualJourneyEnd } from '@/lib/operational/journey-correction-validator';
import { ServerStorage } from '@/lib/server-storage';
import { FichaStore } from '@/lib/ficha-store';

export async function POST(req: NextRequest, { params }: { params: { journeyId: string } }) {
  const tenant = requireTenant(req); if (!tenant.ok) return tenant.response;
  const denied = requirePermission(req, 'operadores', 'editar', tenant.tenantId); if (denied) return denied;
  const journeyId = decodeURIComponent(params.journeyId);
  const sheet = buildOperatorSheet({ tenantId: tenant.tenantId, journeyId, fleetCode: null });
  if (!sheet.ok) return NextResponse.json({ error: sheet.error }, { status: sheet.status });
  if (sheet.ficha.endedAt) return NextResponse.json({ error: 'Jornada já finalizada.' }, { status: 409 });
  const body = await req.json() as Record<string, unknown>;
  const valid = validateManualJourneyEnd({ startedAt: sheet.ficha.startedAt, endedAt: body.endedAt, hourmeterStart: sheet.ficha.hourmeterStart, hourmeterEnd: body.hourmeterEnd, reason: body.reason });
  if (!valid.ok) return NextResponse.json({ error: valid.error }, { status: 400 });
  const session = resolveSessionFromRequest(req);
  const correctionId = `corr-${Date.now()}`;
  ServerStorage.saveEvent({ offlineId: correctionId, equipmentId: sheet.ficha.equipmentId, type: 'MANUAL_JOURNEY_END', timestamp: valid.endedAt, payload: { journeyId, fleetCode: sheet.ficha.fleetCode, endedAt: valid.endedAt, hourmeterEnd: valid.hourmeterEnd, reason: valid.reason, source: 'CENTRAL_ADMIN', userId: session?.id, userName: session?.name } }, tenant.tenantId);
  FichaStore.applyMultiCorrection(tenant.tenantId, sheet.ficha.fleetCode, valid.endedAt.slice(0, 10), { endedAt: valid.endedAt, ...(valid.hourmeterEnd === null ? {} : { hourmeterEnd: valid.hourmeterEnd }) }, { endedAt: null, hourmeterEnd: null }, valid.reason, session?.name ?? session?.id ?? 'sistema');
  return NextResponse.json({ success: true, journeyId, status: 'FINALIZADO', correctionId });
}
