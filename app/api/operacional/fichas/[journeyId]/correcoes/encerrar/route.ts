import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { buildOperatorSheet } from '@/lib/operator-sheet-builder';
import { parseCorrectionDateTime, resolveJourneyStartForCorrection, validateManualJourneyEnd } from '@/lib/operational/journey-correction-validator';
import { ServerStorage } from '@/lib/server-storage';
import { FichaStore } from '@/lib/ficha-store';

function apiError(status: number, code: string, message: string) {
  return NextResponse.json({ success: false, code, message, error: message }, { status });
}

function validationCode(message: string, startedAt: unknown, endedAt: unknown): string {
  if (message.includes('motivo')) return 'MISSING_REASON';
  if (message.includes('encerramento')) {
    const start = resolveJourneyStartForCorrection(startedAt);
    const end = parseCorrectionDateTime(endedAt);
    return start && end && end < start ? 'ENDED_AT_BEFORE_START' : 'INVALID_ENDED_AT';
  }
  if (message.includes('Início')) return 'INVALID_PAYLOAD';
  if (message.includes('Horímetro')) return 'INVALID_HOURMETER';
  return 'INVALID_PAYLOAD';
}

export async function POST(req: NextRequest, { params }: { params: { journeyId: string } }) {
  const tenant = requireTenant(req); if (!tenant.ok) return tenant.response;
  const denied = requirePermission(req, 'operadores', 'editar', tenant.tenantId); if (denied) return denied;
  const journeyId = decodeURIComponent(params.journeyId);
  let body: Record<string, unknown>;
  try { body = await req.json() as Record<string, unknown>; }
  catch { return apiError(400, 'INVALID_PAYLOAD', 'Payload JSON inválido.'); }
  if (typeof body.reason !== 'string' || !body.reason.trim()) return apiError(400, 'MISSING_REASON', 'Informe o motivo da correção.');
  const fleetCode = typeof body.fleetCode === 'string' && body.fleetCode.trim() ? body.fleetCode.trim() : null;
  let sheet = buildOperatorSheet({ tenantId: tenant.tenantId, journeyId, fleetCode: null });
  if (!sheet.ok && fleetCode) sheet = buildOperatorSheet({ tenantId: tenant.tenantId, journeyId: null, fleetCode });
  if (!sheet.ok) return apiError(sheet.status === 404 ? 404 : sheet.status, 'JOURNEY_NOT_FOUND', sheet.error);
  if (sheet.ficha.endedAt) return apiError(409, 'JOURNEY_ALREADY_CLOSED', 'Jornada já finalizada.');
  const startedAt = sheet.ficha.startedAtForCorrection ?? sheet.ficha.startedAt ?? body.startedAtForCorrection;
  const valid = validateManualJourneyEnd({ startedAt, endedAt: body.endedAt, hourmeterStart: sheet.ficha.hourmeterStart, hourmeterEnd: body.hourmeterEnd, reason: body.reason });
  if (!valid.ok) return apiError(400, validationCode(valid.error, startedAt, body.endedAt), valid.error);
  const session = resolveSessionFromRequest(req);
  const correctionId = `corr-${Date.now()}`;
  const resolvedJourneyId = sheet.ficha.journeyId ?? journeyId;
  ServerStorage.saveEvent({ offlineId: correctionId, equipmentId: sheet.ficha.equipmentId, type: 'MANUAL_JOURNEY_END', timestamp: valid.endedAt, payload: { journeyId: resolvedJourneyId, fleetCode: sheet.ficha.fleetCode, endedAt: valid.endedAt, hourmeterEnd: valid.hourmeterEnd, reason: valid.reason, source: 'CENTRAL_ADMIN', userId: session?.id, userName: session?.name } }, tenant.tenantId);
  FichaStore.applyMultiCorrection(tenant.tenantId, sheet.ficha.fleetCode, valid.endedAt.slice(0, 10), { endedAt: valid.endedAt, ...(valid.hourmeterEnd === null ? {} : { hourmeterEnd: valid.hourmeterEnd }) }, { endedAt: null, hourmeterEnd: null }, valid.reason, session?.name ?? session?.id ?? 'sistema');
  return NextResponse.json({ success: true, journeyId: resolvedJourneyId, status: 'FINALIZADO', correctionId });
}
