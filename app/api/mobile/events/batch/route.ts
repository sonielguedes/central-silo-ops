import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { EquipmentLiveState, EquipmentLiveStatus, TrailPoint } from '@/lib/types';
import { requireMobileAuth } from '@/lib/auth/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { FuelingStorage } from '@/lib/fueling-storage';
import { checkOperationAllowed } from '@/lib/operational-profiles';

export const dynamic = 'force-dynamic';

const maskToken = (token?: string) => {
  if (!token) return 'missing';
  return token.slice(0, 4) + '...' + token.slice(-4);
};

/** Map FSM state strings to EquipmentLiveStatus */
function fsmToStatus(state: string): EquipmentLiveStatus {
  const s = state.toUpperCase();
  // JORNADA_FINALIZADA / FINALIZADO are terminal — handled by the FSM_TRANSITION branch
  // before fsmToStatus is called, but guard here for safety.
  if (s === 'JORNADA_FINALIZADA' || s === 'FINALIZADO') return 'FINALIZADO';
  if (s.includes('TRABALHO') || s.includes('OPERAND') || s === 'WORKING') return 'OPERANDO';
  if (s.includes('PARADO') || s.includes('PARADA') || s === 'STOPPED') return 'PARADO';
  if (s === 'JOURNEY_END' || s === 'OFFLINE') return 'OFFLINE';
  return 'ONLINE';
}

/** Fields cleared from live-state when a journey is finalized via FSM_TRANSITION.
 *  Preserves: equipmentId, fleetCode, tenantId, hourmeter*, status, endedAt, updatedAt. */
const JORNADA_FINALIZADA_CLEAR_FIELDS = [
  'journeyId',
  'operatorRegistration', 'registration', 'operatorId', 'operatorName', 'currentOperator',
  'operationCode', 'operationName', 'currentOperation', 'costCenterCode', 'costCenterName', 'costCenter', 'workOrder',
  'implementCode', 'implementId', 'implementName',
  'stopCode', 'stopDescription', 'stopReason', 'stopStartedAt', 'stopDurationSeconds',
] satisfies (keyof EquipmentLiveState)[];

const hasValidValue = (value: unknown) => value !== undefined && value !== null && value !== '';

function putIfValid(target: Record<string, unknown>, key: string, value: unknown) {
  if (hasValidValue(value)) target[key] = value;
}

function shouldAcceptCostCenter(costCenter: unknown, operationName: unknown): boolean {
  const cc = asString(costCenter)?.toUpperCase();
  if (!cc) return false;
  const op = asString(operationName)?.toUpperCase();
  return !op || cc !== op;
}

function isOperationLikeCostCenter(tenantId: string, value: unknown, operationValues: Array<unknown>): boolean {
  const cc = asString(value)?.toUpperCase();
  if (!cc) return false;
  if (operationValues.some(v => asString(v)?.toUpperCase() === cc)) return true;

  try {
    const ops = CadastroStorage.getAll(tenantId, 'operacoes') as Array<Record<string, unknown>>;
    for (const op of ops) {
      for (const candidate of [op.code, op.type, op.name, op.description]) {
        if (asString(candidate)?.toUpperCase() === cc) return true;
      }
    }
  } catch {
    // Falha de cadastro não pode quebrar a ingestão; usamos apenas a checagem local.
  }

  return false;
}

function sanitizeOperationalCostCenter(tenantId: string, target: Record<string, unknown>): void {
  const currentOperationValues = [
    target.operationCode,
    target.operationName,
    target.currentOperation,
  ];
  const rawValues = [target.costCenterCode, target.costCenterName, target.costCenter];
  if (!rawValues.some(v => asString(v))) return;

  if (rawValues.every(v => isOperationLikeCostCenter(tenantId, v, currentOperationValues))) {
    delete target.costCenterCode;
    delete target.costCenterName;
    delete target.costCenter;
    return;
  }

  if (isOperationLikeCostCenter(tenantId, target.costCenterCode, currentOperationValues)) delete target.costCenterCode;
  if (isOperationLikeCostCenter(tenantId, target.costCenterName, currentOperationValues)) delete target.costCenterName;
  if (isOperationLikeCostCenter(tenantId, target.costCenter, currentOperationValues)) delete target.costCenter;
}

const asNumber = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
};

/**
 * Returns true only for GPS coordinates that are geographically usable.
 * Rejects: null/undefined, 0,0 (null island), out-of-range values.
 */
const isValidGps = (lat: number | undefined, lng: number | undefined): boolean => {
  if (lat === undefined || lng === undefined) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat <= -90 || lat >= 90)   return false;
  if (lng <= -180 || lng >= 180) return false;
  return true;
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
  const operatorRegistration = data.operatorRegistration ?? data.registration;
  // operatorId: internal ID (never used as registration fallback — would corrupt matrícula)
  const operatorId    = data.operatorId;
  const operatorName  = data.operatorName ?? data.currentOperator;
  const operationCode = data.operationCode;
  const operationName = data.operationName ?? data.currentOperation;
  const implementCode = data.implementCode;
  const implementId   = data.implementId;   // APK may send implementId instead of implementCode
  const implementName = data.implementName;
  const rawCostCenter = data.costCenterName ?? data.costCenterCode ?? data.costCenter;
  const costCenterCode = data.costCenterCode ?? data.costCenter ?? data.costCenterName;
  const costCenterName = data.costCenterName ?? data.costCenter ?? data.costCenterCode;
  const hourmeterCurrent = asValidHourmeter(data.hourmeterCurrent ?? data.hourmeter);

  putIfValid(target, 'operatorRegistration', operatorRegistration);
  putIfValid(target, 'registration', operatorRegistration);
  putIfValid(target, 'operatorId', operatorId);
  putIfValid(target, 'operatorName', operatorName);
  putIfValid(target, 'currentOperator', operatorName);
  putIfValid(target, 'operationCode', operationCode);
  putIfValid(target, 'operationName', operationName);
  putIfValid(target, 'currentOperation', operationName);
  if (shouldAcceptCostCenter(rawCostCenter, operationName)) {
    putIfValid(target, 'costCenterCode', costCenterCode);
    putIfValid(target, 'costCenterName', costCenterName);
    putIfValid(target, 'costCenter', costCenterName);
  }
  putIfValid(target, 'workOrder', data.workOrder);
  putIfValid(target, 'implementCode', implementCode);
  putIfValid(target, 'implementId', implementId);
  putIfValid(target, 'implementName', implementName);
  // Stop fields: ONLY from explicit stopCode/stopDescription — no generic fallbacks.
  // Using data.code or data.description as fallback would overwrite a valid stopCode
  // when other events (LOCATION, FSM_TRANSITION) pass through applyOperationalFields.
  putIfValid(target, 'stopCode', data.stopCode);
  putIfValid(target, 'stopDescription', data.stopDescription ?? data.stopReason);
  putIfValid(target, 'stopReason', data.stopDescription ?? data.stopReason);
  putIfValid(target, 'journeyId', data.journeyId);
  putIfValid(target, 'hourmeterSource', data.hourmeterSource);
  putIfValid(target, 'hourmeterCurrent', hourmeterCurrent);
}


/** Look up catalog names from codes when the APK only sent codes (no names). */
function enrichOperationalFields(
  tenantId: string,
  updates: Record<string, unknown>
): void {
  // Operator: normalize operatorRegistration to real matrícula.
  // APK may send operatorId (internal id) instead of the registration number.
  // Strategy: match by registration first; if no match, try matching by id.
  // When matched by id, overwrite operatorRegistration with the real matrícula.
  const regRaw  = asString(updates.operatorRegistration);
  const idRaw   = asString(updates.operatorId);
  const searchKey = regRaw || idRaw;
  if (searchKey) {
    const ops = CadastroStorage.getAll(tenantId, 'operadores') as Array<Record<string, unknown>>;
    // 1st pass: exact registration match
    let found = ops.find(o => asString(o.registration) === searchKey);
    // 2nd pass: id match (APK sent internal id as operatorRegistration)
    if (!found) found = ops.find(o => asString(o.id) === searchKey);
    if (found) {
      const realReg = asString(found.registration);
      if (realReg) {
        updates.operatorRegistration = realReg;
        updates.registration         = realReg;
      }
      updates.operatorId = asString(found.id) || updates.operatorId;
      if (asString(found.name)) {
        updates.operatorName    = found.name;
        updates.currentOperator = found.name;
      }
      console.info(
        '[operational-fields] enriched operator=' + String(found.name ?? '') +
        ' reg=' + String(realReg ?? searchKey)
      );
    }
  }

  // Operation: operationCode -> operationName (from 'operacoes' catalog)
  // Match by 'code' field first, then 'type' field (legacy seed data uses type).
  // Only uses found.name -- never falls back to type/code as name.
  const opCode = asString(updates.operationCode);
  if (opCode && !asString(updates.operationName)) {
    const ops2 = CadastroStorage.getAll(tenantId, 'operacoes') as Array<Record<string, unknown>>;
    console.info('[operational-fields] lookup operacoes count=' + ops2.length + ' opCode=' + opCode);
    const found = ops2.find(o => asString(o.code) === opCode || asString(o.type) === opCode);
    const opName = found ? asString(found.name) : undefined;
    if (opName) {
      updates.operationName    = opName;
      updates.currentOperation = opName;
      console.info('[operational-fields] enriched operation=' + opName + ' code=' + opCode);
    } else if (found) {
      console.warn('[operational-fields] operacoes item found for code=' + opCode + ' but name is empty -- fields: ' + Object.keys(found).join(','));
    } else {
      console.warn('[operational-fields] operacoes: no item found for code=' + opCode);
    }
  }

  // Implement: code -> name. If code absent, try implementId -> code + name.
  const impCode = asString(updates.implementCode);
  const impId   = asString(updates.implementId);
  if ((impCode || impId) && !asString(updates.implementName)) {
    const imps = CadastroStorage.getAll(tenantId, 'implementos') as Array<Record<string, unknown>>;
    let found = impCode ? imps.find(i => asString(i.code) === impCode) : undefined;
    if (!found && impId) found = imps.find(i => asString(i.id) === impId);
    if (found) {
      if (!impCode && asString(found.code)) {
        updates.implementCode = found.code;
      }
      if (asString(found.name)) {
        updates.implementName = found.name;
      }
      console.info(
        '[operational-fields] enriched implement=' + String(found.name ?? '') +
        ' code=' + String(found.code ?? impId ?? impCode ?? '')
      );
    }
  }

  // Stop reason: stopCode -> stopDescription. stopCode always persists regardless of lookup result.
  const stopCodeEnrich = asString(updates.stopCode);
  if (stopCodeEnrich && !asString(updates.stopDescription)) {
    const paradas = CadastroStorage.getAll(tenantId, 'paradas') as Array<Record<string, unknown>>;
    const found = paradas.find(p => asString(p.code) === stopCodeEnrich);
    const stopDesc = found ? (asString(found.description) || asString(found.name)) : undefined;
    if (stopDesc) {
      updates.stopDescription = stopDesc;
      updates.stopReason      = stopDesc;
      console.info('[operational-fields] enriched stop=' + stopDesc + ' code=' + stopCodeEnrich);
    } else {
      // No catalog match or empty description -- stopCode stays intact, stopDescription left absent
      console.warn('[operational-fields] paradas: no description found for code=' + stopCodeEnrich + ' (stopCode preserved)');
    }
  }
}


// ── Cadastro equipment helpers ─────────────────────────────────────────────
// Mirror of the pattern used in /api/mobile/equipment/lookup/route.ts.
// Lifecycle statuses that block mobile access (ARQUIVADO is already filtered
// out by CadastroStorage.getAll; INATIVO must be caught explicitly here).
const INACTIVE_BATCH_ENTITY_STATUSES = new Set([
  'INATIVO', 'inativo', 'ARQUIVADO', 'arquivado',
]);

function isBatchCadastroBlocked(item: Record<string, unknown>): boolean {
  return INACTIVE_BATCH_ENTITY_STATUSES.has(String(item.entityStatus ?? 'ATIVO'));
}

function normalizeBatchMobileEnabled(item: Record<string, unknown>): boolean {
  if (typeof item.mobileEnabled === 'boolean') return item.mobileEnabled;
  if (typeof item.mobile    === 'boolean') return item.mobile;
  if (item.mobileEnabled === 'true'  || item.mobile === 'true')  return true;
  if (item.mobileEnabled === 'false' || item.mobile === 'false') return false;
  return false; // fail-safe default
}

/**
 * Validate a cadastro-equipamentos item for mobile batch access.
 * Returns {ok:true, equipment} on success where equipment is a minimal
 * object containing all fields consumed by the batch route (id, code,
 * mobileToken, tenantId).  On failure returns {ok:false, status, error}
 * matching the same shape as ServerStorage.validateMobileEquipment.
 */
function validateCadastroEquipment(
  item: Record<string, unknown>,
  mobileToken: string | undefined,
  tenantId: string,
): { ok: true; equipment: { id: string; code: string; mobileToken?: string; tenantId: string } }
 | { ok: false; status: 403 | 404; error: string } {
  // tenantId is always sourced from the Company Token (requireMobileAuth), so
  // CadastroStorage already scopes to the right tenant — but we double-check
  // the stored field when present.
  const storedTenant = item.tenantId ? String(item.tenantId) : tenantId;
  if (storedTenant !== tenantId) {
    return { ok: false, status: 404, error: 'Equipamento nao encontrado' };
  }

  if (isBatchCadastroBlocked(item)) {
    return { ok: false, status: 403, error: 'Frota inativa' };
  }

  if (!normalizeBatchMobileEnabled(item)) {
    return { ok: false, status: 403, error: 'Mobile desabilitado para esta frota' };
  }

  const storedToken = typeof item.mobileToken === 'string' ? item.mobileToken : undefined;
  if (!storedToken || storedToken !== mobileToken) {
    return { ok: false, status: 403, error: 'mobileToken invalido' };
  }

  return {
    ok: true,
    equipment: {
      id:          String(item.id   ?? ''),
      code:        String(item.code ?? ''),
      mobileToken: storedToken,
      tenantId,
    },
  };
}

export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, RATE_LIMITS.mobileBatch);
    if (rl) return rl;

    const auth = requireMobileAuth(req);
    if (!auth.ok) return auth.response;

    const { tenantId, companyToken, company } = auth;
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
    // ── Equipment resolution: cadastro (primary) → legacy (fallback) ─────────
    // Lookup order (mirrors /api/mobile/equipment/lookup):
    //   1. CadastroStorage by item.id === machineId
    //   2. CadastroStorage by item.code === machineId (fleet-code format)
    //   3. CadastroStorage by item.code === events[0].data.equipmentCode
    //   4. ServerStorage  (legacy equipments.json, read-only)
    const cadastroItems = CadastroStorage.getAll(
      tenantId,
      'equipamentos',
    ) as Array<Record<string, unknown>>;

    const machineIdLower = header.machineId.toLowerCase();
    const firstEquipCode =
      typeof firstEventData?.equipmentCode === 'string'
        ? firstEventData.equipmentCode.toLowerCase()
        : '';

    const cadastroMatch = cadastroItems.find((item) => {
      const itemId   = String(item.id   ?? '').toLowerCase();
      const itemCode = String(item.code ?? '').toLowerCase();
      return (
        itemId   === machineIdLower ||
        itemCode === machineIdLower ||
        (firstEquipCode !== '' && itemCode === firstEquipCode)
      );
    });

    type ValidationResult =
      | { ok: true;  equipment: { id: string; code: string; mobileToken?: string; tenantId: string } }
      | { ok: false; status: 403 | 404; error: string };

    let validation: ValidationResult;
    if (cadastroMatch) {
      validation = validateCadastroEquipment(cadastroMatch, mobileToken, tenantId);
    } else {
      // Fallback: legacy equipments.json (read-only, no migration)
      const legacyEquip = ServerStorage.getEquipmentById(header.machineId, tenantId);
      validation = ServerStorage.validateMobileEquipment(
        legacyEquip,
        mobileToken,
        tenantId,
        companyToken,
      );
    }

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
      // ── FUELING pre-validation (reject invalid before saveEvent) ──
      if (event.type === 'FUELING') {
        const fLiters = typeof event.data?.dieselLiters === 'number' ? event.data.dieselLiters : NaN;
        const fHm    = typeof event.data?.hourmeter === 'number' ? event.data.hourmeter : NaN;
        if (!Number.isFinite(fLiters) || fLiters <= 0) {
          return { offlineId: event.uuid, status: 'REJECTED' as const, reason: 'dieselLiters deve ser > 0' };
        }
        if (!Number.isFinite(fHm) || fHm <= 0) {
          return { offlineId: event.uuid, status: 'REJECTED' as const, reason: 'hourmeter deve ser > 0' };
        }
      }
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
    const resultByUuid = new Map(results.map(r => [r.offlineId, r.status]));

    // -- Build live-state update from all events ----------------------------------------
    const now = new Date().toISOString();
    const liveUpdates: Record<string, unknown> = { updatedAt: now };

    // Process events in chronological order so latest wins
    const sorted = [...events].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Tracks whether a terminal journey event was seen in this batch. FINALIZADO is terminal and
    // must win over any other status regardless of event ordering or later heartbeats.
    let journeyEnded = false;
    let journeyEndedAt: string | undefined;
    // Set to true when finalization came via FSM_TRANSITION/JORNADA_FINALIZADA (not JOURNEY_END),
    // so fieldsToDelete is passed to updateLiveState to clear journeyId/operator/stop fields.
    let jornadaFinalizadaByFsm = false;

    for (const event of sorted) {
      const d = event.data || {};
      const ts = event.timestamp ? new Date(event.timestamp).toISOString() : now;

      switch (event.type) {
        case 'JOURNEY_START': {
          // ── Guard: verificar operação permitida para o perfil da frota ──
          const jsOpCode = asString(d.operationCode);
          if (jsOpCode) {
            const jsGuard = checkOperationAllowed(
              { operationalProfileCode: (validation.equipment as Record<string,unknown>).operationalProfileCode as string | null | undefined, code: validation.equipment.code },
              jsOpCode,
            );
            if (!jsGuard.allowed) {
              console.warn(
                '[batch/JOURNEY_START] OPERATION_NOT_ALLOWED fleetCode=' + validation.equipment.code +
                ' operationCode=' + jsOpCode + ' profile=' + jsGuard.profile.code +
                ' reason=' + (jsGuard.reason ?? 'profile restriction'),
              );
              results.push({
                offlineId: event.uuid,
                status:    'REJECTED' as const,
                reason:    'OPERATION_NOT_ALLOWED_FOR_EQUIPMENT_PROFILE:' + jsOpCode + ':' + jsGuard.profile.code,
              });
              break;
            }
          }
          applyOperationalFields(liveUpdates, d);
          const hStart = asValidHourmeter(d.hourmeterStart ?? d.hourmeter);
          if (hStart != null) { liveUpdates.hourmeterStart = hStart; liveUpdates.hourmeterCurrent = hStart; }
          // Persist hourmeterSource explicitly -- applyOperationalFields handles it via putIfValid,
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
          // Late GPS after journey finalized must not reopen the journey or update status.
          if (journeyEnded) break;
          applyOperationalFields(liveUpdates, d);
          const latitude  = asNumber(d.latitude);
          const longitude = asNumber(d.longitude);
          const speed     = asNumber(d.speed);
          const accuracy  = asNumber(d.accuracy);
          const rpm       = asNumber(d.rpm);
          const speedKmh  = asNumber(d.speedKmh) ?? (speed != null ? speed * 3.6 : undefined);
          if (isValidGps(latitude, longitude)) {
            liveUpdates.latitude  = latitude;
            liveUpdates.longitude = longitude;
            liveUpdates.lastGpsAt = ts;
            if (speed    != null) liveUpdates.speed    = speed;
            if (speedKmh != null) liveUpdates.speedKmh = speedKmh;
            if (accuracy != null) liveUpdates.accuracy = accuracy;
            if (rpm      != null) liveUpdates.rpm      = rpm;
          } else {
            console.warn(
              '[batch/LOCATION] GPS rejected fleetCode=' + validation.equipment.code +
              ' lat=' + String(latitude) + ' lng=' + String(longitude) +
              ' -- keeping last valid position'
            );
          }
          const srcGps = asString(d.hourmeterSource);
          if (srcGps) liveUpdates.hourmeterSource = srcGps;
          if (!liveUpdates.status) liveUpdates.status = 'ONLINE';
          // Save trail point only when coordinates are valid
          const jId = asString(d.journeyId) || asString(liveUpdates.journeyId) || '';
          const hCurrGps = asValidHourmeter(d.hourmeterCurrent ?? d.hourmeter);
          if (jId && isValidGps(latitude, longitude)) {
            // qualityStatus: mark low accuracy but still save the point
            const gpsQuality = (accuracy != null && accuracy > 20)
              ? 'LOW_ACCURACY' as const
              : 'VALID' as const;
            const trailPoint: TrailPoint = {
              tenantId,
              fleetCode:            validation.equipment.code,
              equipmentId:          validation.equipment.id,
              journeyId:            jId,
              latitude:             latitude!,
              longitude:            longitude!,
              speed,
              speedKmh:             speedKmh ?? undefined,
              rpm:                  rpm ?? undefined,
              accuracy,
              timestamp:            ts,
              status:               (liveUpdates.status as string) || 'ONLINE',
              operatorRegistration: (liveUpdates.operatorRegistration as string | undefined),
              operationCode:        (liveUpdates.operationCode as string | undefined),
              hourmeterCurrent:     hCurrGps,
              eventId:              asString(d.offlineId) || asString(d.eventId) || undefined,
              qualityStatus:        gpsQuality,
            };
            ServerStorage.saveTrailPoint(tenantId, trailPoint);
          }
          break;
        }
        case 'HEARTBEAT': {
          // Late heartbeat after journey finalized must not reopen the journey or update status.
          if (journeyEnded) break;
          applyOperationalFields(liveUpdates, d);
          liveUpdates.lastHeartbeatAt = now;
          const latitude  = asNumber(d.latitude);
          const longitude = asNumber(d.longitude);
          const speed     = asNumber(d.speed);
          const accuracy  = asNumber(d.accuracy);
          const rpm       = asNumber(d.rpm);
          const speedKmh  = asNumber(d.speedKmh) ?? (speed != null ? speed * 3.6 : undefined);
          if (isValidGps(latitude, longitude)) {
            liveUpdates.latitude  = latitude;
            liveUpdates.longitude = longitude;
            liveUpdates.lastGpsAt = ts;
            if (speed    != null) liveUpdates.speed    = speed;
            if (speedKmh != null) liveUpdates.speedKmh = speedKmh;
            if (accuracy != null) liveUpdates.accuracy = accuracy;
            if (rpm      != null) liveUpdates.rpm      = rpm;
          } else if (latitude !== undefined || longitude !== undefined) {
            console.warn(
              '[batch/HEARTBEAT] GPS rejected fleetCode=' + validation.equipment.code +
              ' lat=' + String(latitude) + ' lng=' + String(longitude) +
              ' -- keeping last valid position'
            );
          }
          const hCurr = asValidHourmeter(d.hourmeterCurrent ?? d.hourmeter);
          if (hCurr != null) liveUpdates.hourmeterCurrent = hCurr;
          const srcHb = asString(d.hourmeterSource);
          if (srcHb) liveUpdates.hourmeterSource = srcHb;
          if (!liveUpdates.status) liveUpdates.status = 'ONLINE';
          break;
        }
        case 'FSM_TRANSITION': {
          const toState       = asString(d.toState) || asString(d.state) || '';
          const payloadStatus = asString(d.status) || '';
          const isJornadaFinalizada =
            toState.toUpperCase() === 'JORNADA_FINALIZADA' ||
            payloadStatus.toUpperCase() === 'JORNADA_FINALIZADA';

          if (isJornadaFinalizada) {
            // Terminal state: set hourmeter/endedAt, mark journey ended.
            // Do NOT call applyOperationalFields -- operator/operation/stop must be cleared.
            const hStart = asValidHourmeter(d.hourmeterStart);
            const hFinal = asValidHourmeter(d.hourmeterFinal ?? d.hourmeterEnd ?? d.hourmeter);
            if (hStart != null) liveUpdates.hourmeterStart = hStart;
            if (hFinal != null) {
              liveUpdates.hourmeterCurrent = hFinal;
              liveUpdates.hourmeterEnd     = hFinal;
            }
            liveUpdates.endedAt         = asString(d.endedAt) || ts;
            liveUpdates.status          = 'FINALIZADO';
            liveUpdates.statusStartedAt = ts;
            journeyEnded           = true;
            journeyEndedAt         = liveUpdates.endedAt as string;
            jornadaFinalizadaByFsm = true;
            console.info('[FSM/JORNADA_FINALIZADA] fleetCode=' + validation.equipment.code +
              ' hStart=' + (hStart ?? 'missing') + ' hFinal=' + (hFinal ?? 'missing') +
              ' endedAt=' + String(liveUpdates.endedAt));
            break;
          }

          // Normal FSM transition
          // ── Guard: verificar operação permitida para o perfil da frota ──
          const fsmOpCode = asString(d.operationCode);
          if (fsmOpCode) {
            const fsmGuard = checkOperationAllowed(
              { operationalProfileCode: (validation.equipment as Record<string,unknown>).operationalProfileCode as string | null | undefined, code: validation.equipment.code },
              fsmOpCode,
            );
            if (!fsmGuard.allowed) {
              console.warn(
                '[batch/FSM_TRANSITION] OPERATION_NOT_ALLOWED fleetCode=' + validation.equipment.code +
                ' operationCode=' + fsmOpCode + ' profile=' + fsmGuard.profile.code,
              );
              results.push({
                offlineId: event.uuid,
                status:    'REJECTED' as const,
                reason:    'OPERATION_NOT_ALLOWED_FOR_EQUIPMENT_PROFILE:' + fsmOpCode + ':' + fsmGuard.profile.code,
              });
              break;
            }
          }
          applyOperationalFields(liveUpdates, d);
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
          // ── Guard: verificar operação permitida para o perfil da frota ──
          const wsOpCode = asString(d.operationCode);
          if (wsOpCode) {
            const wsGuard = checkOperationAllowed(
              { operationalProfileCode: (validation.equipment as Record<string,unknown>).operationalProfileCode as string | null | undefined, code: validation.equipment.code },
              wsOpCode,
            );
            if (!wsGuard.allowed) {
              console.warn(
                '[batch/WORK_STARTED] OPERATION_NOT_ALLOWED fleetCode=' + validation.equipment.code +
                ' operationCode=' + wsOpCode + ' profile=' + wsGuard.profile.code,
              );
              results.push({
                offlineId: event.uuid,
                status:    'REJECTED' as const,
                reason:    'OPERATION_NOT_ALLOWED_FOR_EQUIPMENT_PROFILE:' + wsOpCode + ':' + wsGuard.profile.code,
              });
              break;
            }
          }
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

          const jIdEnd = asString(d.journeyId);
          if (!jIdEnd) {
            console.warn('[JourneyEnd] journeyId ausente fleetCode=' + validation.equipment.code);
          }

          const hStartEnd = asValidHourmeter(d.hourmeterStart ?? d.hourmeterStartValue);
          const hEnd      = asValidHourmeter(d.hourmeterEnd ?? d.hourmeter);

          if (hStartEnd != null) liveUpdates.hourmeterStart = hStartEnd;

          if (hEnd != null) {
            if (hStartEnd != null && hEnd < hStartEnd) {
              liveUpdates.hourmeterInconsistent = true;
              liveUpdates.hourmeterInconsistencyReason = 'hourmeterEnd menor que hourmeterStart';
              console.warn('[JourneyEnd] validation failed: hourmeterEnd(' + hEnd + ') < hourmeterStart(' + hStartEnd + ') fleetCode=' + validation.equipment.code);
            }
            // Accept hourmeterEnd regardless -- inconsistency flag signals the anomaly
            liveUpdates.hourmeterEnd     = hEnd;
            liveUpdates.hourmeterCurrent = hEnd;
          }

          // totalHourmeter: prefer APK-provided; fallback to calculated
          const totalFromPayload = asNumber(d.totalHourmeter);
          if (totalFromPayload != null && totalFromPayload >= 0) {
            liveUpdates.totalHourmeter = totalFromPayload;
          } else if (hStartEnd != null && hEnd != null && hEnd >= hStartEnd) {
            liveUpdates.totalHourmeter = Math.round((hEnd - hStartEnd) * 1000) / 1000;
          }

          const srcEnd = asString(d.hourmeterSource);
          if (srcEnd) liveUpdates.hourmeterSource = srcEnd;

          // Close any open stop that was not closed by the APK
          if (liveUpdates.stopCode || liveUpdates.stopStartedAt) {
            liveUpdates.stopEndedAt = ts;
          }

          // Journey end timestamp + final status
          liveUpdates.endedAt         = asString(d.endedAt) || ts;
          liveUpdates.status          = 'FINALIZADO';
          liveUpdates.statusStartedAt = ts;

          // FINALIZADO has maximum priority -- record it so it cannot be undone by
          // out-of-order events later in this same batch.
          journeyEnded   = true;
          journeyEndedAt = liveUpdates.endedAt as string;

          console.info('[JourneyEnd] payload: fleetCode=' + validation.equipment.code +
            ' journeyId=' + (jIdEnd || 'missing') +
            ' hourmeterStart=' + String(hStartEnd ?? 'missing') +
            ' hourmeterEnd=' + String(hEnd ?? 'missing') +
            ' total=' + String(liveUpdates.totalHourmeter ?? 'n/a'));
          break;
        }
        case 'FUELING': {
          // Guard: skip live-state update for pre-rejected events.
          const fuelingResult = resultByUuid.get(event.uuid);
          if (fuelingResult === 'REJECTED') break;

          applyOperationalFields(liveUpdates, d);
          const diesel   = asNumber(d.dieselLiters);
          const hourmeter = asValidHourmeter(d.hourmeter);
          const fuelType = asString(d.fuelType ?? d.fuelTypeCode);
          const targetFleetCode = asString(d.targetFleetCode ?? d.fueledFleetCode ?? d.abastecidaFleetCode ?? d.fleetCode);

          if (diesel != null && diesel > 0) liveUpdates.lastDieselLiters = diesel;
          if (hourmeter != null) liveUpdates.hourmeterCurrent = hourmeter;
          liveUpdates.lastFuelingAt = ts;

          // ── Persist fueling record (idempotent on retry) ──
          if (fuelingResult === 'SYNCED') {
            FuelingStorage.save({
              eventId:              event.uuid,
              tenantId,
              equipmentId:          validation.equipment.id,
              fleetCode:            targetFleetCode ?? validation.equipment.code,
              truckFleetCode:       validation.equipment.code,
              dieselLiters:         diesel ?? 0,
              hourmeter:            hourmeter ?? 0,
              fuelType,
              gpsLatitude:          asNumber(d.gpsLatitude ?? d.latitude),
              gpsLongitude:         asNumber(d.gpsLongitude ?? d.longitude),
              operatorRegistration: asString(d.operatorRegistration ?? d.registration),
              operatorName:         asString(d.operatorName ?? d.currentOperator),
              operationCode:        asString(d.operationCode),
              targetFleetCode:      targetFleetCode ?? validation.equipment.code,
              fueledAt:             ts,
            });
            auditFromRequest(req, tenantId, {
              action:   'FUELING_RECEIVED',
              entity:   'fueling',
              entityId: event.uuid,
              metadata: { fleetCode: targetFleetCode ?? validation.equipment.code, truckFleetCode: validation.equipment.code, liters: diesel, hourmeter, fuelType, source: 'APK' },
            });
            console.info('[Fueling] persisted eventId=' + event.uuid + ' fleetCode=' + String(targetFleetCode ?? validation.equipment.code) + ' truck=' + validation.equipment.code + ' liters=' + String(diesel) + ' h=' + String(hourmeter));
          } else {
            console.info('[Fueling] idempotent eventId=' + event.uuid + ' fleetCode=' + validation.equipment.code);
          }
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

    // -- JOURNEY_END has maximum priority --------------------------------------------------
    // Re-assert FINALIZADO after the whole batch so a heartbeat/GPS with a newer
    // timestamp than the JOURNEY_END (common with offline sync) cannot flip it back.
    if (journeyEnded) {
      liveUpdates.status = 'FINALIZADO';
      if (!liveUpdates.endedAt && journeyEndedAt) liveUpdates.endedAt = journeyEndedAt;
      // If a stop was open in this batch and not closed by the APK, close it now.
      if ((liveUpdates.stopCode || liveUpdates.stopStartedAt) && !liveUpdates.stopEndedAt) {
        liveUpdates.stopEndedAt = liveUpdates.endedAt as string;
      }
    }

    const loggedHourmeter = liveUpdates.hourmeterCurrent ?? liveUpdates.hourmeterEnd ?? liveUpdates.hourmeterStart ?? 'missing';
    console.info('[operational-fields] received fleetCode=' + validation.equipment.code);
    enrichOperationalFields(tenantId, liveUpdates);
    sanitizeOperationalCostCenter(tenantId, liveUpdates);
    console.info('[batch-operational] fleetCode=' + validation.equipment.code + ' operator=' + String(liveUpdates.operatorName || liveUpdates.operatorRegistration || 'missing') + ' operation=' + String(liveUpdates.operationName || liveUpdates.operationCode || 'missing') + ' hourmeter=' + String(loggedHourmeter));
    console.info('[Hourmeter] source=' + String(liveUpdates.hourmeterSource || 'missing'));
    console.info('[Hourmeter] start=' + String(liveUpdates.hourmeterStart ?? 'missing'));
    console.info('[Hourmeter] current=' + String(liveUpdates.hourmeterCurrent ?? 'missing'));
    console.info('[Hourmeter] end=' + String(liveUpdates.hourmeterEnd ?? 'missing'));

    ServerStorage.updateLiveState(
      tenantId,
      validation.equipment.id,
      validation.equipment.code,
      liveUpdates,
      // JORNADA_FINALIZADA via FSM_TRANSITION: explicitly clear journey/operator/stop fields
      // from the existing live-state record so they don't carry over into the finalized state.
      jornadaFinalizadaByFsm ? JORNADA_FINALIZADA_CLEAR_FIELDS : undefined,
    );

    auditFromRequest(req, tenantId, {
      action: 'MOBILE_BATCH',
      entity: 'events',
      entityId: validation.equipment.code,
      metadata: { received: events.length, processed: results.length },
    });

    // Build per-event response arrays for new APK Outbox protocol.
    // Legacy `results` array is preserved for backward compat.
    const accepted: { eventId: string; status: 'ACCEPTED' }[] = [];
    const duplicates: { eventId: string; status: 'DUPLICATE' }[] = [];
    const rejected: { eventId: string; status: 'REJECTED'; reason: string }[] = [];
    for (const r of results) {
      const eventId = r.offlineId;
      const s = r.status;
      if (s === 'SYNCED') {
        accepted.push({ eventId, status: 'ACCEPTED' });
      } else if (s === 'DUPLICATE') {
        duplicates.push({ eventId, status: 'DUPLICATE' });
      } else {
        const reason = ('reason' in r && typeof r.reason === 'string') ? r.reason : 'Rejeitado';
        rejected.push({ eventId, status: 'REJECTED', reason });
      }
    }

    return NextResponse.json({
      received: events.length,
      processed: results.length,
      accepted,
      duplicates,
      rejected,
      results,
    });

  } catch (error) {
    console.error('[batch] unhandled error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
