import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { EquipmentLiveState, EquipmentLiveStatus, TrailPoint } from '@/lib/types';

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

const hasValidValue = (value: unknown) => value !== undefined && value !== null && value !== '';

function putIfValid(target: Record<string, unknown>, key: string, value: unknown) {
  if (hasValidValue(value)) target[key] = value;
}

const asNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

const asValidHourmeter = (value: unknown): number | undefined => {
  const parsed = asNumber(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
};

const asString = (value: unknown): string | undefined => {
  return typeof value === 'string' && value.trim() ? value : undefined;
};

interface MobileBatchEvent {
  uuid: string;
  type: string;
  timestamp: string | number | Date;
  data?: Record<string, unknown>;
}

interface MobileBatchHeader {
  machineId?: string;
  tenantId?: string;
  mobileToken?: string;
  fleetCode?: string;
}

interface MobileBatchBody {
  header?: MobileBatchHeader;
  tenantId?: string;
  events?: MobileBatchEvent[];
}

function applyOperationalFields(target: Record<string, unknown>, data: Record<string, unknown>) {
  const operatorRegistration = data.operatorRegistration ?? data.registration ?? data.operatorId;
  const operatorName = data.operatorName ?? data.currentOperator;
  const operationCode = data.operationCode;
  const operationName = data.operationName ?? data.currentOperation;
  const implementCode = data.implementCode;
  const implementName = data.implementName;
  const hourmeterCurrent = asValidHourmeter(data.hourmeterCurrent ?? data.hourmeter);

  putIfValid(target, 'operatorRegistration', operatorRegistration);
  putIfValid(target, 'registration', operatorRegistration);
  putIfValid(target, 'operatorName', operatorName);
  putIfValid(target, 'currentOperator', operatorName);
  putIfValid(target, 'operationCode', operationCode);
  putIfValid(target, 'operationName', operationName);
  putIfValid(target, 'currentOperation', operationName);
  putIfValid(target, 'costCenter', data.costCenter);
  putIfValid(target, 'workOrder', data.workOrder);
  putIfValid(target, 'implementCode', implementCode);
  putIfValid(target, 'implementName', implementName);
  putIfValid(target, 'journeyId', data.journeyId);
  putIfValid(target, 'hourmeterSource', data.hourmeterSource);
  putIfValid(target, 'hourmeterCurrent', hourmeterCurrent);
}


/** Look up catalog names from codes when the APK only sent codes (no names). */
function enrichOperationalFields(
  tenantId: string,
  updates: Record<string, unknown>
): void {
  // Operator: registration → name
  const reg = asString(updates.operatorRegistration);
  if (reg && !asString(updates.operatorName)) {
    const ops = CadastroStorage.getAll(tenantId, 'operadores') as Array<Record<string, unknown>>;
    const found = ops.find(o => asString(o.registration) === reg);
    if (found && asString(found.name)) {
      updates.operatorName  = found.name;
      updates.currentOperator = found.name;
      console.info('[operational-fields] enriched operator=' + String(found.name) + ' reg=' + reg);
    }
  }

  // Operation: code → name (from 'estados' operational-state catalog)
  const opCode = asString(updates.operationCode);
  if (opCode && !asString(updates.operationName)) {
    const estados = CadastroStorage.getAll(tenantId, 'estados') as Array<Record<string, unknown>>;
    const found = estados.find(e => asString(e.code) === opCode);
    if (found && asString(found.name)) {
      updates.operationName    = found.name;
      updates.currentOperation = found.name;
      console.info('[operational-fields] enriched operation=' + String(found.name) + ' code=' + opCode);
    }
  }

  // Implement: code → name
  const impCode = asString(updates.implementCode);
  if (impCode && !asString(updates.implementName)) {
    const imps = CadastroStorage.getAll(tenantId, 'implementos') as Array<Record<string, unknown>>;
    const found = imps.find(i => asString(i.code) === impCode);
    if (found && asString(found.name)) {
      updates.implementName = found.name;
      console.info('[operational-fields] enriched implement=' + String(found.name) + ' code=' + impCode);
    }
  }

  // Stop reason: code → description
  const stopCode = asString(updates.stopCode);
  if (stopCode && !asString(updates.stopDescription)) {
    const paradas = CadastroStorage.getAll(tenantId, 'paradas') as Array<Record<string, unknown>>;
    const found = paradas.find(p => asString(p.code) === stopCode);
    if (found && asString(found.description)) {
      updates.stopDescription = found.description;
      updates.stopReason      = found.description;
      console.info('[operational-fields] enriched stop=' + String(found.description) + ' code=' + stopCode);
    }
  }
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
    const body = await req.json() as MobileBatchBody;
    const { header, events } = body;

    if (!header || !header.machineId || !Array.isArray(events)) {
      return NextResponse.json({ error: 'Invalid batch format' }, { status: 400 });
    }

    const bodyTenantId = header.tenantId || body.tenantId;
    if (bodyTenantId && bodyTenantId !== tenantId) {
      console.warn('[mobile/events/batch] tenant mismatch', { expected: tenantId, received: bodyTenantId });
      return NextResponse.json({ error: 'tenantId divergente do token' }, { status: 403 });
    }

    const firstEventData = events[0]?.data;
    const mobileToken = header.mobileToken || (typeof firstEventData?.mobileToken === 'string' ? firstEventData.mobileToken : undefined);
    const equipment = ServerStorage.getEquipmentById(header.machineId, tenantId);
    const validation = ServerStorage.validateMobileEquipment(equipment, mobileToken, tenantId, companyToken);

    if (!validation.ok) {
      console.warn('[mobile/events/batch] validation failed', {
        companyId: company.id, companyTenantId: company.tenantId,
        receivedCompanyToken: maskToken(companyToken), error: validation.error
      });
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const firstFleetCode = typeof firstEventData?.fleetCode === 'string' ? firstEventData.fleetCode : undefined;
    const bodyFleetCode = header.fleetCode || firstFleetCode;
    if (bodyFleetCode && bodyFleetCode !== validation.equipment.code) {
      return NextResponse.json({ error: 'fleetCode divergente' }, { status: 403 });
    }

    const results = events.map((event) => {
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
          applyOperationalFields(liveUpdates, d);
          const hStart = asValidHourmeter(d.hourmeterStart ?? d.hourmeter);
          if (hStart != null) { liveUpdates.hourmeterStart = hStart; liveUpdates.hourmeterCurrent = hStart; }
          // Persist hourmeterSource explicitly — applyOperationalFields handles it via putIfValid,
          // but an explicit set here guarantees it even if the field arrives outside the data envelope.
          const srcStart = asString(d.hourmeterSource);
          if (srcStart) liveUpdates.hourmeterSource = srcStart;
          liveUpdates.statusStartedAt = ts;
          liveUpdates.status = 'ONLINE';
          break;
        }
        case 'LOCATION':
        case 'GPS':
        case 'GPS_POINT': {
          applyOperationalFields(liveUpdates, d);
          const latitude = asNumber(d.latitude);
          const longitude = asNumber(d.longitude);
          const speed = asNumber(d.speed);
          const accuracy = asNumber(d.accuracy);
          if (latitude  != null) liveUpdates.latitude  = latitude;
          if (longitude != null) liveUpdates.longitude = longitude;
          if (speed     != null) liveUpdates.speed     = speed;
          if (accuracy  != null) liveUpdates.accuracy  = accuracy;
          liveUpdates.lastGpsAt = ts;
          const srcGps = asString(d.hourmeterSource);
          if (srcGps) liveUpdates.hourmeterSource = srcGps;
          if (!liveUpdates.status) liveUpdates.status = 'ONLINE';
          // Save trail point (rejected if lat/lng invalid, 0/0, ts or journeyId absent)
          const jId = asString(d.journeyId) || asString(liveUpdates.journeyId) || '';
          const hCurrGps = asValidHourmeter(d.hourmeterCurrent ?? d.hourmeter);
          if (jId && latitude != null && longitude != null) {
            const trailPoint: TrailPoint = {
              tenantId,
              fleetCode:            validation.equipment.code,
              equipmentId:          validation.equipment.id,
              journeyId:            jId,
              latitude,
              longitude,
              speed,
              accuracy,
              timestamp:            ts,
              status:               (liveUpdates.status as string) || 'ONLINE',
              operatorRegistration: (liveUpdates.operatorRegistration as string | undefined),
              operationCode:        (liveUpdates.operationCode as string | undefined),
              hourmeterCurrent:     hCurrGps,
            };
            ServerStorage.saveTrailPoint(tenantId, trailPoint);
          }
          break;
        }
        case 'HEARTBEAT': {
          applyOperationalFields(liveUpdates, d);
          liveUpdates.lastHeartbeatAt = now;
          const latitude = asNumber(d.latitude);
          const longitude = asNumber(d.longitude);
          const speed = asNumber(d.speed);
          const accuracy = asNumber(d.accuracy);
          if (latitude  != null) liveUpdates.latitude  = latitude;
          if (longitude != null) liveUpdates.longitude = longitude;
          if (speed     != null) liveUpdates.speed     = speed;
          if (accuracy  != null) liveUpdates.accuracy  = accuracy;
          if (latitude  != null) liveUpdates.lastGpsAt = ts;
          const hCurr = asValidHourmeter(d.hourmeterCurrent ?? d.hourmeter);
          if (hCurr != null) liveUpdates.hourmeterCurrent = hCurr;
          const srcHb = asString(d.hourmeterSource);
          if (srcHb) liveUpdates.hourmeterSource = srcHb;
          if (!liveUpdates.status) liveUpdates.status = 'ONLINE';
          break;
        }
        case 'FSM_TRANSITION': {
          applyOperationalFields(liveUpdates, d);
          const toState = asString(d.toState) || asString(d.state) || '';
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
          applyOperationalFields(liveUpdates, d);
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
          applyOperationalFields(liveUpdates, d);
          liveUpdates.status = 'PARADO';
          if (d.stopCode || d.code)        liveUpdates.stopCode        = d.stopCode || d.code;
          if (d.stopDescription || d.description || d.reason)
            liveUpdates.stopDescription = d.stopDescription || d.description || d.reason;
          if (d.stopDescription || d.description || d.reason)
            liveUpdates.stopReason = d.stopDescription || d.description || d.reason;
          liveUpdates.stopStartedAt = d.stopStartedAt || d.startedAt || ts;
          if (d.stopDurationSeconds != null || d.durationSeconds != null) liveUpdates.stopDurationSeconds = d.stopDurationSeconds ?? d.durationSeconds;
          break;
        }
        case 'JOURNEY_END': {
          applyOperationalFields(liveUpdates, d);
          const hStart = asValidHourmeter(d.hourmeterStart ?? d.hourmeterStartValue);
          const hEnd = asValidHourmeter(d.hourmeterEnd ?? d.hourmeter);
          if (hStart != null && hEnd != null && hEnd < hStart) {
            // Flag the inconsistency — sanitizeLiveStateItem will also re-validate on write
            liveUpdates.hourmeterInconsistent = true;
            liveUpdates.hourmeterInconsistencyReason = 'hourmeterEnd menor que hourmeterStart';
            console.warn(`[Hourmeter] inconsistent fleetCode=${validation.equipment.code} start=${hStart} end=${hEnd}`);
          }
          if (hStart != null) liveUpdates.hourmeterStart = hStart;
          if (hEnd != null && (hStart == null || hEnd >= hStart)) liveUpdates.hourmeterEnd = hEnd;
          const total = asNumber(d.totalHourmeter);
          if (total != null && total >= 0) liveUpdates.totalHourmeter = total;
          const srcEnd = asString(d.hourmeterSource);
          if (srcEnd) liveUpdates.hourmeterSource = srcEnd;
          liveUpdates.status = 'OFFLINE';
          liveUpdates.statusStartedAt = ts;
          break;
        }
        default:
          break;
      }
    }

    // Heartbeat presence = at least ONLINE
    const hasHeartbeat = events.some((e) => e.type === 'HEARTBEAT');
    if (hasHeartbeat && !liveUpdates.lastHeartbeatAt) {
      liveUpdates.lastHeartbeatAt = now;
    }

    const loggedHourmeter = liveUpdates.hourmeterCurrent ?? liveUpdates.hourmeterEnd ?? liveUpdates.hourmeterStart ?? 'missing';
    console.info('[operational-fields] received fleetCode=' + validation.equipment.code);
    enrichOperationalFields(tenantId, liveUpdates);
        console.info(`[batch-operational] fleetCode=${validation.equipment.code} operator=${String(liveUpdates.operatorName || liveUpdates.operatorRegistration || 'missing')} operation=${String(liveUpdates.operationName || liveUpdates.operationCode || 'missing')} hourmeter=${String(loggedHourmeter)}`);
    console.info(`[Hourmeter] source=${String(liveUpdates.hourmeterSource || 'missing')}`);
    console.info(`[Hourmeter] start=${String(liveUpdates.hourmeterStart ?? 'missing')}`);
    console.info(`[Hourmeter] current=${String(liveUpdates.hourmeterCurrent ?? 'missing')}`);
    console.info(`[Hourmeter] end=${String(liveUpdates.hourmeterEnd ?? 'missing')}`);

    ServerStorage.updateLiveState(
      tenantId,
      validation.equipment.id,
      validation.equipment.code,
      liveUpdates as Partial<EquipmentLiveState>
    );

    return NextResponse.json({ results, tenantId });
  } catch (error) {
    console.error('[mobile/events/batch] critical error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
