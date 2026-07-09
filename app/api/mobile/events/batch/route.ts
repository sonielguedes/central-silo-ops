import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { DeviceBindingStorage } from '@/lib/device-binding-storage';
import { EquipmentLiveState } from '@/lib/types';
import { requireMobileAuth } from '@/lib/auth/api-guard';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { FuelingStorage } from '@/lib/fueling-storage';

export const dynamic = 'force-dynamic';

const hasValidValue = (value: unknown) => value !== undefined && value !== null && value !== '';

type StopLikeState = {
  status?: unknown;
  stopReasonCode?: unknown;
  stopCode?: unknown;
};

function isStopActive(state: StopLikeState | null | undefined): boolean {
  if (!state) return false;
  const st = String(state.status ?? '').toUpperCase();
  if (new Set(['PARADA_APONTADA', 'PARADO', 'AGUARDANDO_PARADA']).has(st)) return true;
  if (state.stopReasonCode || state.stopCode) return true;
  return false;
}

function putIfValid(target: Record<string, unknown>, key: string, value: unknown) {
  if (hasValidValue(value)) target[key] = value;
}

function shouldAcceptCostCenter(costCenter: unknown, operationName: unknown): boolean {
  const cc = asString(costCenter)?.toUpperCase();
  if (!cc) return false;
  const op = asString(operationName)?.toUpperCase();
  return !op || cc !== op;
}

const asNumber = (value: unknown): number | undefined => typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const isValidGps = (lat: number | undefined, lng: number | undefined): boolean => lat !== undefined && lng !== undefined && !(lat === 0 && lng === 0) && lat > -90 && lat < 90 && lng > -180 && lng < 180;
const asValidHourmeter = (value: unknown): number | undefined => { const parsed = asNumber(value); return parsed !== undefined && parsed > 0 ? parsed : undefined; };
const asString = (value: unknown): string | undefined => typeof value === 'string' && value.trim() ? value : undefined;
const asRecord = (value: unknown): Record<string, unknown> | undefined => (value && typeof value === 'object' && !Array.isArray(value)) ? value as Record<string, unknown> : undefined;
const firstDefined = (...values: unknown[]): unknown => values.find((value) => value !== undefined && value !== null && value !== '');

interface MobileBatchEvent {
  uuid: string;
  type: string;
  timestamp: string | number | Date;
  data?: Record<string, unknown>;
  eventId?: string;
  occurredAt?: string | number | Date;
  payload?: Record<string, unknown>;
  journeyId?: string;
}
interface MobileBatchHeader { machineId?: string; tenantId?: string; mobileToken?: string; fleetCode?: string; }

const JOURNEY_START_CLEAR_FIELDS = [
  'hourmeterEnd',
  'hourmeterFinal',
  'totalHourmeter',
  'hourmeterInconsistent',
  'hourmeterInconsistencyReason',
  'stopCode',
  'stopReasonCode',
  'stopDescription',
  'stopReasonDescription',
  'stopReason',
  'stopStartedAt',
  'stopDurationSeconds',
  'lastStopReasonCode',
  'lastStopReasonDescription',
  'lastStopStartedAt',
  'lastStopEndedAt',
] satisfies (keyof EquipmentLiveState)[];

function applyOperationalFields(target: Record<string, unknown>, data: Record<string, unknown>) {
  const operatorRegistration = data.operatorRegistration ?? data.registration;
  const operatorId    = data.operatorId;
  const operatorName  = data.operatorName ?? data.currentOperator;
  const operationCode = data.operationCode;
  const operationName = data.operationName ?? data.currentOperation;
  const implementCode = data.implementCode;
  const implementId   = data.implementId;
  const implementName = data.implementName;
  const rawCostCenter = data.costCenterName ?? data.costCenterCode ?? data.costCenter;
  const costCenterCode = data.costCenterCode ?? data.costCenter ?? data.costCenterName;
  const costCenterName = data.costCenterName ?? data.costCenter ?? data.costCenterCode;
  const hourmeterCurrent = asValidHourmeter(data.hourmeterCurrent ?? data.currentHourmeter ?? data.hourmeter ?? data.horimeter ?? data.engineHours ?? data.horimetro ?? data.horimetroAtual);

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
  putIfValid(target, 'stopCode', data.stopCode);
  putIfValid(target, 'stopDescription', data.stopDescription ?? data.stopReason);
  putIfValid(target, 'stopReason', data.stopDescription ?? data.stopReason);
  putIfValid(target, 'journeyId', data.journeyId);
  putIfValid(target, 'hourmeterSource', data.hourmeterSource);
  putIfValid(target, 'hourmeterCurrent', hourmeterCurrent);
}

function enrichOperationalFields(tenantId: string, updates: Record<string, unknown>): void {
  const regRaw  = asString(updates.operatorRegistration);
  const idRaw   = asString(updates.operatorId);
  const searchKey = regRaw || idRaw;
  if (searchKey) {
    const ops = CadastroStorage.getAll(tenantId, 'operadores') as Array<Record<string, unknown>>;
    let found = ops.find(o => asString(o.registration) === searchKey) || ops.find(o => asString(o.id) === searchKey);
    if (found) {
      const realReg = asString(found.registration);
      if (realReg) { updates.operatorRegistration = realReg; updates.registration = realReg; }
      updates.operatorId = asString(found.id) || updates.operatorId;
      if (asString(found.name)) { updates.operatorName = found.name; updates.currentOperator = found.name; }
    }
  }
  const opCode = asString(updates.operationCode);
  if (opCode && !asString(updates.operationName)) {
    const ops2 = CadastroStorage.getAll(tenantId, 'operacoes') as Array<Record<string, unknown>>;
    const found = ops2.find(o => asString(o.code) === opCode || asString(o.type) === opCode);
    const opName = found ? asString(found.name) : undefined;
    if (opName) { updates.operationName = opName; updates.currentOperation = opName; }
  }
  const impCode = asString(updates.implementCode);
  const impId   = asString(updates.implementId);
  if ((impCode || impId) && !asString(updates.implementName)) {
    const imps = CadastroStorage.getAll(tenantId, 'implementos') as Array<Record<string, unknown>>;
    let found = impCode ? imps.find(i => asString(i.code) === impCode) : undefined;
    if (!found && impId) found = imps.find(i => asString(i.id) === impId);
    if (found) {
      if (!impCode && asString(found.code)) updates.implementCode = found.code;
      if (asString(found.name)) updates.implementName = found.name;
    }
  }
  const stopCodeEnrich = asString(updates.stopCode);
  if (stopCodeEnrich && !asString(updates.stopDescription)) {
    const paradas = CadastroStorage.getAll(tenantId, 'paradas') as Array<Record<string, unknown>>;
    const found = paradas.find(p => asString(p.code) === stopCodeEnrich);
    const stopDesc = found ? (asString(found.description) || asString(found.name)) : undefined;
    if (stopDesc) { updates.stopDescription = stopDesc; updates.stopReason = stopDesc; }
  }
}

const INACTIVE_BATCH_ENTITY_STATUSES = new Set(['INATIVO', 'inativo', 'ARQUIVADO', 'arquivado']);
function isBatchCadastroBlocked(item: Record<string, unknown>): boolean { return INACTIVE_BATCH_ENTITY_STATUSES.has(String(item.entityStatus ?? 'ATIVO')); }
function normalizeBatchMobileEnabled(item: Record<string, unknown>): boolean {
  if (typeof item.mobileEnabled === 'boolean') return item.mobileEnabled;
  if (typeof item.mobile === 'boolean') return item.mobile;
  return item.mobileEnabled === 'true' || item.mobile === 'true';
}

function validateCadastroEquipment(item: Record<string, unknown>, mobileToken: string | undefined, tenantId: string): { ok: true; equipment: { id: string; code: string; mobileToken?: string; tenantId: string } } | { ok: false; status: 403 | 404; error: string } {
  const storedTenant = item.tenantId ? String(item.tenantId) : tenantId;
  if (storedTenant !== tenantId) return { ok: false, status: 404, error: 'Equipamento nao encontrado' };
  if (isBatchCadastroBlocked(item)) return { ok: false, status: 403, error: 'Frota inativa' };
  if (!normalizeBatchMobileEnabled(item)) return { ok: false, status: 403, error: 'Mobile desabilitado para esta frota' };
  const storedToken = typeof item.mobileToken === 'string' ? item.mobileToken : undefined;
  if (!storedToken || storedToken !== mobileToken) return { ok: false, status: 403, error: 'mobileToken invalido' };
  return { ok: true, equipment: { id: String(item.id ?? ''), code: String(item.code ?? ''), mobileToken: storedToken, tenantId } };
}

function readEventData(event: MobileBatchEvent): Record<string, unknown> {
  const root = event as unknown as Record<string, unknown>;
  const data = asRecord(event.data) ?? {};
  const payload = asRecord(root.payload) ?? {};
  const nestedPayload = asRecord(data.payload) ?? {};
  return { ...payload, ...nestedPayload, ...data, ...root };
}

function extractGpsFields(event: MobileBatchEvent, timestamp: string): Record<string, unknown> {
  const source = readEventData(event);
  const lat = asNumber(firstDefined(source.latitude, source.lat, source.gpsLatitude));
  const lng = asNumber(firstDefined(source.longitude, source.lng, source.gpsLongitude));
  const gpsAccuracy = asNumber(firstDefined(source.gpsAccuracy, source.accuracy));
  const speedKmh = asNumber(firstDefined(source.speedKmh, source.speed));
  const bearing = asNumber(firstDefined(source.bearing, source.course, source.azimuth, source.direction));
  const gpsSource = asString(firstDefined(source.gpsSource, source.source, source.positionSource));
  const updates: Record<string, unknown> = {};

  if (isValidGps(lat, lng)) {
    updates.latitude = lat;
    updates.longitude = lng;
    updates.lastGpsAt = timestamp;
  }
  if (gpsAccuracy !== undefined) {
    updates.accuracy = gpsAccuracy;
    updates.gpsAccuracy = gpsAccuracy;
  }
  if (speedKmh !== undefined) updates.speedKmh = speedKmh;
  if (bearing !== undefined) updates.bearing = bearing;
  if (gpsSource) {
    updates.gpsSource = gpsSource;
    updates.source = gpsSource;
  }
  return updates;
}

export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, RATE_LIMITS.mobileBatch);
    if (rl) return rl;

    const auth = requireMobileAuth(req);
    if (!auth.ok) return auth.response;

    const { tenantId, companyToken } = auth;
    let body: { app?: string; header?: MobileBatchHeader; events?: MobileBatchEvent[]; deviceId?: string; driver?: Record<string, unknown>; vehicle?: Record<string, unknown>; version?: string; [key: string]: unknown };
    try {
      body = await req.json();
    } catch (e) {
      return NextResponse.json({ ok: false, error: 'INVALID_JSON', message: 'Payload invalido' }, { status: 400 });
    }

    const isPlm = body.app === 'PLM_MOTORISTA';
    let header: MobileBatchHeader | undefined;
    let events: MobileBatchEvent[] | undefined;

    if (isPlm) {
      if (!body.deviceId) return NextResponse.json({ ok: false, error: 'INVALID_PAYLOAD', message: 'deviceId obrigatorio' }, { status: 400 });
      if (!Array.isArray(body.events)) return NextResponse.json({ ok: false, error: 'INVALID_PAYLOAD', message: 'events obrigatorio' }, { status: 400 });
      header = { machineId: body.deviceId, tenantId: tenantId };
      events = body.events.map((e) => ({
        uuid: String(e.eventId),
        type: String(e.type),
        timestamp: e.occurredAt as string,
        data: {
          ...(asRecord(e.payload) ?? {}),
          journeyId: e.journeyId as string | undefined,
          deviceId: body.deviceId,
          driver: body.driver,
          vehicle: body.vehicle,
          appVersion: body.version
        }
      }));
    } else {
      header = body.header;
      events = body.events;
      if (!header || !header.machineId || !Array.isArray(events)) {
        return NextResponse.json({ error: 'Invalid batch format' }, { status: 400 });
      }
    }

    const firstEventData = events[0]?.data;
    const mobileToken = header.mobileToken || (typeof firstEventData?.mobileToken === 'string' ? firstEventData.mobileToken : undefined);
    const deviceBinding = DeviceBindingStorage.getByDeviceId(tenantId, header.machineId!);
    const boundEquipmentId = deviceBinding?.equipmentId ? String(deviceBinding.equipmentId) : undefined;
    const boundFleetCode = deviceBinding?.fleetCode ? String(deviceBinding.fleetCode) : undefined;
    const cadastroItems = CadastroStorage.getAll(tenantId, 'equipamentos') as Array<Record<string, unknown>>;
    const machineIdLower = header.machineId!.toLowerCase();
    const firstEquipCode = typeof firstEventData?.equipmentCode === 'string' ? firstEventData.equipmentCode.toLowerCase() : '';
    const bindingEquipmentIdLower = boundEquipmentId?.toLowerCase() ?? '';
    const bindingFleetCodeLower = boundFleetCode?.toLowerCase() ?? '';

    const cadastroMatch = cadastroItems.find((item) => {
      const itemId = String(item.id ?? '').toLowerCase();
      const itemCode = String(item.code ?? '').toLowerCase();
      return (
        itemId === machineIdLower ||
        itemCode === machineIdLower ||
        (firstEquipCode !== '' && itemCode === firstEquipCode) ||
        (bindingEquipmentIdLower !== '' && itemId === bindingEquipmentIdLower) ||
        (bindingFleetCodeLower !== '' && itemCode === bindingFleetCodeLower)
      );
    });

    let validation: any;
    if (cadastroMatch) {
      validation = validateCadastroEquipment(cadastroMatch, mobileToken, tenantId);
    } else {
      const legacyEquip =
        (boundEquipmentId ? ServerStorage.getEquipmentById(boundEquipmentId, tenantId) : undefined) ??
        (boundFleetCode ? ServerStorage.getEquipmentByFleetCode(boundFleetCode, tenantId) : undefined) ??
        ServerStorage.getEquipmentById(header.machineId!, tenantId);
      validation = ServerStorage.validateMobileEquipment(legacyEquip, mobileToken, tenantId, companyToken);
    }

    if (!validation.ok) {
      if (isPlm) return NextResponse.json({ ok: false, error: 'VALIDATION_FAILED', message: validation.error }, { status: validation.status });
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const currentLiveState = ServerStorage.getLiveFleet(tenantId).find(s => s.equipmentId === validation.equipment.id) ?? null;
    const results = events.map((event) => {
      const eventData = readEventData(event);
      if (event.type === 'FUELING') {
        const liters = asNumber(eventData.dieselLiters);
        if (liters === undefined || liters <= 0) return { offlineId: event.uuid, status: 'REJECTED', reason: 'dieselLiters > 0' };
      }
      const status = ServerStorage.saveEvent({
        offlineId: event.uuid,
        equipmentId: validation.equipment.id,
        type: event.type,
        timestamp: new Date(event.timestamp).toISOString(),
        payload: eventData
      }, tenantId);
      return { offlineId: event.uuid, status };
    });

    const resultByUuid = new Map(results.map(r => [r.offlineId, r.status]));
    const now = new Date().toISOString();
    const liveUpdates: Record<string, unknown> = { updatedAt: now };
    const sorted = [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    let journeyEnded = false;
    let journeyStarted = false;
    let stopActive = isStopActive(currentLiveState);
    let stopEndedFieldsToDelete: (keyof EquipmentLiveState)[] = [];

    for (const event of sorted) {
      const d = readEventData(event);
      const ts = new Date(event.timestamp).toISOString();

      switch (event.type) {
        case 'JOURNEY_START':
        case 'JOURNEY_STARTED':
          applyOperationalFields(liveUpdates, d);
          const hStart = asValidHourmeter(d.hourmeterStart ?? d.hourmeter);
          if (hStart != null) { liveUpdates.hourmeterStart = hStart; liveUpdates.hourmeterCurrent = hStart; }
          liveUpdates.status = 'OPERANDO';
          liveUpdates.statusStartedAt = ts;
          journeyStarted = true;
          break;

        case 'POSITION_UPDATE':
        case 'LOCATION':
        case 'GPS':
        case 'GPS_POINT':
          if (journeyEnded) break;
          applyOperationalFields(liveUpdates, d);
          const gpsUpdates = extractGpsFields(event, ts);
          Object.assign(liveUpdates, gpsUpdates);
          if (gpsUpdates.speedKmh !== undefined) liveUpdates.speedKmh = gpsUpdates.speedKmh;
          if (!stopActive && !isStopActive(liveUpdates)) {
            const s = asString(firstDefined(d.status, d.operationalStatus))?.toUpperCase();
            if (s && new Set(['OPERANDO','PARADO','AGUARDANDO_PARADA','PARADA_APONTADA']).has(s)) liveUpdates.status = s;
            else if (!liveUpdates.status) liveUpdates.status = 'ONLINE';
          }
          break;

        case 'HEARTBEAT':
          if (journeyEnded) break;
          applyOperationalFields(liveUpdates, d);
          liveUpdates.lastHeartbeatAt = now;
          const hCurr = asValidHourmeter(firstDefined(d.hourmeterCurrent, d.hourmeter));
          if (hCurr != null) liveUpdates.hourmeterCurrent = hCurr;
          break;

        case 'STOP_REASON':
        case 'PARADA':
          applyOperationalFields(liveUpdates, d);
          liveUpdates.status = 'PARADA_APONTADA';
          const code = asString(d.stopReasonCode ?? d.stopCode ?? d.code);
          if (code) { liveUpdates.stopReasonCode = code; liveUpdates.stopCode = code; }
          liveUpdates.stopStartedAt = ts;
          stopActive = true;
          break;

        case 'STOP_ENDED':
          const lastCode = asString(liveUpdates.stopReasonCode as string) || asString(currentLiveState?.stopReasonCode);
          if (lastCode) liveUpdates.lastStopReasonCode = lastCode;
          liveUpdates.lastStopEndedAt = ts;
          stopEndedFieldsToDelete = ['stopReasonCode', 'stopCode', 'stopStartedAt'];
          liveUpdates.status = 'OPERANDO';
          stopActive = false;
          break;

        case 'JOURNEY_END':
        case 'JOURNEY_FINISHED':
          applyOperationalFields(liveUpdates, d);
          const hEnd = asValidHourmeter(d.hourmeterEnd ?? d.hourmeter);
          if (hEnd != null) { liveUpdates.hourmeterEnd = hEnd; liveUpdates.hourmeterCurrent = hEnd; }
          liveUpdates.endedAt = ts;
          liveUpdates.status = 'FINALIZADO';
          journeyEnded = true;
          break;

        case 'FUELING':
          if (resultByUuid.get(event.uuid) === 'REJECTED') break;
          applyOperationalFields(liveUpdates, d);
          const diesel = asNumber(d.dieselLiters);
          if (diesel != null) liveUpdates.lastDieselLiters = diesel;
          liveUpdates.lastFuelingAt = ts;
          if (resultByUuid.get(event.uuid) === 'SYNCED') {
            FuelingStorage.save({
              eventId: event.uuid, tenantId, equipmentId: validation.equipment.id,
              fleetCode: (d.targetFleetCode as string) || validation.equipment.code,
              dieselLiters: diesel ?? 0, fueledAt: ts, truckFleetCode: validation.equipment.code,
              hourmeter: asValidHourmeter(d.hourmeter) ?? null, odometer: asNumber(d.odometer) ?? null,
              fuelType: asString(d.fuelType), gpsLatitude: asNumber(d.latitude), gpsLongitude: asNumber(d.longitude),
              operatorRegistration: asString(d.registration), operatorName: asString(d.operatorName),
              operationCode: asString(d.operationCode), targetFleetCode: (d.targetFleetCode as string) || validation.equipment.code,
            });
          }
          break;
      }
    }

    if (journeyEnded) liveUpdates.status = 'FINALIZADO';
    enrichOperationalFields(tenantId, liveUpdates);
    ServerStorage.updateLiveState(tenantId, validation.equipment.id, validation.equipment.code, liveUpdates, (() => {
      const toDelete: any[] = [];
      if (journeyStarted) toDelete.push(...JOURNEY_START_CLEAR_FIELDS);
      if (stopEndedFieldsToDelete.length) toDelete.push(...stopEndedFieldsToDelete);
      return toDelete.length ? toDelete : undefined;
    })());

    if (isPlm) {
      const accepted = results.filter(r => r.status === 'SYNCED').length;
      const dups = results.filter(r => r.status === 'DUPLICATE').length;
      const failed = results.filter(r => r.status === 'REJECTED').length;
      return NextResponse.json({ ok: true, received: events.length, processed: accepted + dups, failed });
    }

    return NextResponse.json({
      received: events.length, processed: results.length,
      accepted: results.filter(r => r.status === 'SYNCED').map(r => ({ eventId: r.offlineId, status: 'ACCEPTED' })),
      duplicates: results.filter(r => r.status === 'DUPLICATE').map(r => ({ eventId: r.offlineId, status: 'DUPLICATE' })),
      rejected: results.filter(r => r.status === 'REJECTED').map(r => ({ eventId: r.offlineId, status: 'REJECTED' })),
      results
    });

  } catch (error: unknown) {
    console.error('[batch] error', error);
    return NextResponse.json({ ok: false, error: 'INTERNAL_ERROR', message: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 });
  }
}
