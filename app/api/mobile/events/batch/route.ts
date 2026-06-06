import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { EquipmentLiveStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

const maskToken = (token?: string) => {
  if (!token) return 'missing';
  return token.slice(0, 4) + '...' + token.slice(-4);
};

/** Map FSM state strings to EquipmentLiveStatus */
function fsmToStatus(state: string): EquipmentLiveStatus {
  const s = state.toUpperCase();
  if (s.includes('TRABALHO') || s.includes('OPERAND') || s === 'WORKING') return 'OPERANDO';
  if (s.includes('PARADO') || s.includes('PARADA') || s === 'STOPPED') return 'PARADO';
  if (s === 'JOURNEY_END' || s === 'OFFLINE') return 'OFFLINE';
  return 'ONLINE';
}

export async function POST(req: NextRequest) {
  try {
    const companyToken = (req.headers.get('x-company-token') || undefined)?.trim();
    if (!companyToken) {
      return NextResponse.json({ error: 'X-Company-Token is required' }, { status: 401 });
    }

    const company = ServerStorage.getCompanyByToken(companyToken);
    if (!company || company.status === 'INATIVO') {
      return NextResponse.json({ error: 'Token invalido ou instancia inativa' }, { status: 403 });
    }

    const tenantId = company.tenantId;
    const body = await req.json();
    const { header, events } = body;

    if (!header || !header.machineId || !Array.isArray(events)) {
      return NextResponse.json({ error: 'Invalid batch format' }, { status: 400 });
    }

    const bodyTenantId = header.tenantId || body.tenantId;
    if (bodyTenantId && bodyTenantId !== tenantId) {
      console.warn('[mobile/events/batch] tenant mismatch', { expected: tenantId, received: bodyTenantId });
      return NextResponse.json({ error: 'tenantId divergente do token' }, { status: 403 });
    }

    const mobileToken = header.mobileToken || events[0]?.data?.mobileToken;
    const equipment = ServerStorage.getEquipmentById(header.machineId, tenantId);
    const validation = ServerStorage.validateMobileEquipment(equipment, mobileToken, tenantId, companyToken);

    if (!validation.ok) {
      console.warn('[mobile/events/batch] validation failed', {
        companyId: company.id, companyTenantId: company.tenantId,
        receivedCompanyToken: maskToken(companyToken), error: validation.error
      });
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const bodyFleetCode = header.fleetCode || events[0]?.data?.fleetCode;
    if (bodyFleetCode && bodyFleetCode !== validation.equipment.code) {
      return NextResponse.json({ error: 'fleetCode divergente' }, { status: 403 });
    }

    const results = events.map((event: any) => {
      if (event.data?.mobileToken && event.data.mobileToken !== validation.equipment.mobileToken) {
        return { offlineId: event.uuid, status: 'REJECTED', reason: 'Token invalido' };
      }
      const status = ServerStorage.saveEvent({
        offlineId: event.uuid,
        equipmentId: validation.equipment.id,
        type: event.type,
        timestamp: new Date(event.timestamp).toISOString(),
        payload: event.data
      }, tenantId);
      return { offlineId: event.uuid, status };
    });

    // ── Build live-state update from all events ────────────────────────────
    const now = new Date().toISOString();
    const liveUpdates: Record<string, unknown> = { updatedAt: now };

    // Process events in chronological order so latest wins
    const sorted = [...events].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    for (const event of sorted) {
      const d = event.data || {};
      const ts = event.timestamp ? new Date(event.timestamp).toISOString() : now;

      switch (event.type) {
        case 'JOURNEY_START': {
          if (d.journeyId)            liveUpdates.journeyId            = d.journeyId;
          if (d.operatorName)         liveUpdates.operatorName         = d.operatorName;
          if (d.operatorName)         liveUpdates.currentOperator      = d.operatorName;
          if (d.operatorRegistration) liveUpdates.operatorRegistration = d.operatorRegistration;
          if (d.registration)         liveUpdates.operatorRegistration = d.registration;
          if (d.operationCode)        liveUpdates.operationCode        = d.operationCode;
          if (d.operationName)        liveUpdates.operationName        = d.operationName;
          if (d.operationName)        liveUpdates.currentOperation     = d.operationName;
          if (d.costCenter)           liveUpdates.costCenter           = d.costCenter;
          if (d.workOrder)            liveUpdates.workOrder            = d.workOrder;
          if (d.implementCode)        liveUpdates.implementCode        = d.implementCode;
          const hStart = d.hourmeterStart ?? d.hourmeter;
          if (hStart != null) { liveUpdates.hourmeterStart = hStart; liveUpdates.hourmeterCurrent = hStart; }
          liveUpdates.statusStartedAt = ts;
          liveUpdates.status = 'ONLINE';
          break;
        }
        case 'LOCATION':
        case 'GPS': {
          if (d.latitude  != null) liveUpdates.latitude  = d.latitude;
          if (d.longitude != null) liveUpdates.longitude = d.longitude;
          if (d.speed     != null) liveUpdates.speed     = d.speed;
          if (d.accuracy  != null) liveUpdates.accuracy  = d.accuracy;
          liveUpdates.lastGpsAt = ts;
          if (!liveUpdates.status) liveUpdates.status = 'ONLINE';
          break;
        }
        case 'HEARTBEAT': {
          liveUpdates.lastHeartbeatAt = now;
          if (d.latitude  != null) liveUpdates.latitude  = d.latitude;
          if (d.longitude != null) liveUpdates.longitude = d.longitude;
          if (d.speed     != null) liveUpdates.speed     = d.speed;
          if (d.accuracy  != null) liveUpdates.accuracy  = d.accuracy;
          if (d.latitude  != null) liveUpdates.lastGpsAt = ts;
          const hCurr = d.hourmeterCurrent ?? d.hourmeter;
          if (hCurr != null) liveUpdates.hourmeterCurrent = hCurr;
          if (!liveUpdates.status) liveUpdates.status = 'ONLINE';
          break;
        }
        case 'FSM_TRANSITION': {
          const toState = d.toState || d.state || '';
          liveUpdates.status = fsmToStatus(toState);
          if (d.operationCode) liveUpdates.operationCode = d.operationCode;
          if (d.operationName) { liveUpdates.operationName = d.operationName; liveUpdates.currentOperation = d.operationName; }
          if (d.journeyId)     liveUpdates.journeyId     = d.journeyId;
          liveUpdates.statusStartedAt = ts;
          const elapsed = d.statusDurationSeconds ?? d.durationSeconds;
          if (elapsed != null) liveUpdates.statusDurationSeconds = elapsed;
          break;
        }
        case 'WORK_STATUS':
        case 'WORK_STARTED':
        case 'FSM_TRABALHO': {
          liveUpdates.status = 'OPERANDO';
          if (d.operationCode) liveUpdates.operationCode = d.operationCode;
          if (d.operationName || d.name) {
            liveUpdates.operationName    = d.operationName || d.name;
            liveUpdates.currentOperation = d.operationName || d.name;
          }
          liveUpdates.statusStartedAt = d.startedAt || ts;
          break;
        }
        case 'STOP_REASON':
        case 'PARADA': {
          liveUpdates.status = 'PARADO';
          if (d.stopCode || d.code)        liveUpdates.stopCode        = d.stopCode || d.code;
          if (d.stopDescription || d.description || d.reason)
            liveUpdates.stopDescription = d.stopDescription || d.description || d.reason;
          liveUpdates.stopStartedAt = d.startedAt || ts;
          if (d.durationSeconds != null) liveUpdates.stopDurationSeconds = d.durationSeconds;
          break;
        }
        case 'JOURNEY_END': {
          const hEnd = d.hourmeterEnd ?? d.hourmeter;
          if (hEnd != null) liveUpdates.hourmeterEnd = hEnd;
          liveUpdates.status = 'OFFLINE';
          liveUpdates.statusStartedAt = ts;
          break;
        }
        default:
          break;
      }
    }

    // Heartbeat presence = at least ONLINE
    const hasHeartbeat = events.some((e: any) => e.type === 'HEARTBEAT');
    if (hasHeartbeat && !liveUpdates.lastHeartbeatAt) {
      liveUpdates.lastHeartbeatAt = now;
    }

    ServerStorage.updateLiveState(
      tenantId,
      validation.equipment.id,
      validation.equipment.code,
      liveUpdates as any
    );

    return NextResponse.json({ results, tenantId });
  } catch (error) {
    console.error('[mobile/events/batch] critical error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
