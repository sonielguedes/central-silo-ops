import { ServerStorage } from '@/lib/server-storage';
import type { EquipmentLiveState, TrailPoint } from '@/lib/types';
import { createLogger } from '@/lib/logger';
import { calculateJourneyTimes } from '@/lib/operational/journey-time-calculator';
import { calculateJourneyHourmeter } from '@/lib/operational/journey-hourmeter-calculator';

// ── Inconsistency codes ───────────────────────────────────────────────────────
export const INCONSISTENCY = {
  JORNADA_FINALIZADA_SEM_HORIMETRO_FINAL:  'JORNADA_FINALIZADA_SEM_HORIMETRO_FINAL',
  HORIMETRO_FINAL_MENOR_QUE_INICIAL:       'HORIMETRO_FINAL_MENOR_QUE_INICIAL',
  OPERADOR_NAO_IDENTIFICADO:               'OPERADOR_NAO_IDENTIFICADO',
  MATRICULA_INVALIDA:                      'MATRICULA_INVALIDA',
  FROTA_NAO_IDENTIFICADA:                  'FROTA_NAO_IDENTIFICADA',
  OPERACAO_NAO_INFORMADA:                  'OPERACAO_NAO_INFORMADA',
  OS_NAO_INFORMADA:                        'OS_NAO_INFORMADA (alerta)',
  IMPLEMENTO_NAO_INFORMADO:                'IMPLEMENTO_NAO_INFORMADO (alerta)',
  SEM_GPS_RECENTE:                         'SEM_GPS_RECENTE (alerta)',
  SEM_HEARTBEAT_RECENTE:                   'SEM_HEARTBEAT_RECENTE (alerta)',
  JORNADA_SEM_EVENTOS_GPS:                 'JORNADA_SEM_EVENTOS_GPS (alerta)',
  TOTAL_HORAS_INCONSISTENTE:               'TOTAL_HORAS_INCONSISTENTE',
  TEMPO_INDETERMINADO_ACIMA_LIMITE:        'TEMPO_INDETERMINADO_ACIMA_LIMITE (alerta)',
} as const;

const GPS_RECENTE_LIMITE_MIN  = 30; // minutos
const HEARTBEAT_LIMITE_MIN    = 60; // minutos
const INDETERMINADO_LIMITE_PCT = 50; // %
const logger = createLogger('operator-sheet-builder');

export interface StopEntry {
  code: string;
  description: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
}

export interface OperationalTimelineEntry {
  id: string;
  type: string;
  timestamp: string;
  label: string;
  description: string | null;
}

export interface FichaOperador {
  journeyId: string | null;
  fleetCode: string;
  equipmentId: string;
  operatorRegistration: string | null;
  operatorName: string | null;
  operationCode: string | null;
  operationName: string | null;
  implementCode: string | null;
  implementName: string | null;
  workOrderId: string | null;
  workOrderNumber: string | null;
  costCenterId: string | null;
  costCenterName: string | null;
  hourmeterStart: number | null;
  hourmeterCurrent: number | null;
  hourmeterEnd: number | null;
  totalHourmeter: number | null;
  /** Duração da jornada em minutos (calculada de startedAt até endedAt ou agora) */
  durationMinutes: number | null;
  /** Minutos operando (status ONLINE/OPERANDO) */
  minutesOperating: number | null;
  /** Minutos parado (status PARADO) */
  minutesStopped: number | null;
  /** Minutos indeterminados (sem sinal, ou estado desconhecido) */
  minutesUndetermined: number | null;
  /** Percentual de tempo indeterminado */
  pctUndetermined: number | null;
  startedAt: string | null;
  endedAt: string | null;
  stops: StopEntry[];
  events: OperationalTimelineEntry[];
  operationalStatus: string;
  trailSummary: {
    points: number;
    firstGpsAt: string | null;
    lastGpsAt: string | null;
    distanceKm: number;
  };
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'EXPORTADO' | 'INCONSISTENTE' | 'FINALIZADO';
  /** Inconsistências bloqueantes e alertas (sufixo " (alerta)" = não-bloqueante) */
  inconsistencies: string[];
  /** true quando validado manualmente ou exportado sem inconsistências */
  validated: boolean;
}

export type BuildSheetResult =
  | { ok: true;  ficha: FichaOperador }
  | { ok: false; status: number; error: string };

// ── Geo helpers ───────────────────────────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R    = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcDistanceKm(points: TrailPoint[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    d += haversineKm(
      points[i - 1].latitude, points[i - 1].longitude,
      points[i].latitude,     points[i].longitude,
    );
  }
  return Math.round(d * 10) / 10;
}

// ── Time helpers ──────────────────────────────────────────────────────────────
function ageMinutes(ts: string | null | undefined): number | null {
  if (!ts) return null;
  const d = new Date(ts).getTime();
  if (Number.isNaN(d)) return null;
  return Math.round((Date.now() - d) / 60000);
}

// ── Stop duration helper ──────────────────────────────────────────────────────
function sameLabel(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = String(a ?? '').trim().toUpperCase();
  const right = String(b ?? '').trim().toUpperCase();
  return !!left && left === right;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 ? text : null;
}

function eventPayload(event: { payload: unknown }): Record<string, unknown> {
  const payload = asRecord(event.payload);
  return { ...asRecord(payload.raw), ...asRecord(payload.data), ...payload };
}

function eventType(event: { type: string; payload: unknown }): string {
  const payload = eventPayload(event);
  const type = (cleanText(event.type) ?? cleanText(payload.eventType) ?? cleanText(payload.type) ?? '').toUpperCase();
  return type === 'MANUAL_JOURNEY_END' ? 'JOURNEY_END' : type;
}

function eventTime(event?: { timestamp: string; receivedAt: string; payload: unknown }): string | null {
  if (!event) return null;
  const payload = eventPayload(event);
  const candidate = cleanText(payload.occurredAt) ?? cleanText(payload.timestamp) ?? cleanText(payload.createdAt)
    ?? cleanText(payload.receivedAt) ?? cleanText(event.timestamp) ?? cleanText(event.receivedAt);
  return candidate && Number.isFinite(new Date(candidate).getTime()) ? candidate : null;
}

function stopFields(payload: Record<string, unknown>): { code: string; description: string; category: string | null } {
  return {
    code: cleanText(payload.reasonCode) ?? cleanText(payload.stopReasonCode) ?? cleanText(payload.stopCode) ?? cleanText(payload.code) ?? '',
    description: cleanText(payload.reasonName) ?? cleanText(payload.stopReasonName) ?? cleanText(payload.stopReasonDescription)
      ?? cleanText(payload.stopDescription) ?? cleanText(payload.description) ?? cleanText(payload.reason) ?? '',
    category: cleanText(payload.reasonCategory),
  };
}

function stopLabel(code: string, name: string): string {
  return code && name ? `${code} — ${name}` : name || code || 'Parada sem motivo informado';
}

// ── Main builder ──────────────────────────────────────────────────────────────
export function buildOperatorSheet(params: {
  tenantId:  string;
  fleetCode: string | null;
  journeyId: string | null;
}): BuildSheetResult {
  const { tenantId, fleetCode, journeyId } = params;

  const liveFleet = ServerStorage.getLiveFleet(tenantId);
  const tenantEvents = ServerStorage.getEvents(tenantId);
  const journeyEvent = journeyId ? tenantEvents.find(event => cleanText(eventPayload(event).journeyId) === journeyId) : undefined;
  const eventData = journeyEvent ? eventPayload(journeyEvent) : {};
  const resolvedFleetCode = fleetCode ?? cleanText(eventData.fleetCode);
  const eventEquipmentId = journeyEvent?.equipmentId ?? cleanText(eventData.equipmentId) ?? cleanText(eventData.machineId);
  const liveMachine = liveFleet.find(machine =>
    (resolvedFleetCode && machine.fleetCode === resolvedFleetCode) ||
    (eventEquipmentId && machine.equipmentId === eventEquipmentId)
  );
  if (!liveMachine && !journeyEvent) {
    return { ok: false, status: 404, error: 'Ficha não encontrada para esta jornada' };
  }
  const machine = liveMachine ?? ({
    equipmentId: eventEquipmentId ?? 'unknown',
    fleetCode: resolvedFleetCode ?? 'Não informada',
    tenantId,
    status: 'ONLINE',
    updatedAt: journeyEvent?.receivedAt ?? journeyEvent?.timestamp ?? new Date().toISOString(),
  } as EquipmentLiveState);

  const effectiveJourneyId = journeyId || machine.journeyId || null;

  const allEvents = ServerStorage.getEvents(tenantId, machine.equipmentId)
    .filter(event => eventTime(event) !== null)
    .sort((a, b) => (eventTime(a) ?? '').localeCompare(eventTime(b) ?? ''));
  const exactJourneyEvents = effectiveJourneyId
    ? allEvents.filter(event => cleanText(eventPayload(event).journeyId) === effectiveJourneyId)
    : [];
  const exactStart = exactJourneyEvents.find(event => eventType(event) === 'JOURNEY_START');
  const exactEnd = [...exactJourneyEvents].reverse().find(event => eventType(event) === 'JOURNEY_END');
  const fallbackStart = [...allEvents].reverse().find(event => eventType(event) === 'JOURNEY_START');
  const windowStart = eventTime(exactStart ?? exactJourneyEvents[0] ?? fallbackStart);
  const fallbackEnd = allEvents.find(event => eventType(event) === 'JOURNEY_END' && !!windowStart && (eventTime(event) ?? '') >= windowStart);
  const windowEnd = eventTime(exactEnd ?? fallbackEnd);
  const journeyEvents = effectiveJourneyId
    ? allEvents.filter(event => {
        const payloadJourneyId = cleanText(eventPayload(event).journeyId);
        if (payloadJourneyId) return payloadJourneyId === effectiveJourneyId;
        const timestamp = eventTime(event);
        return !!timestamp && (!windowStart || timestamp >= windowStart) && (!windowEnd || timestamp <= windowEnd);
      })
    : allEvents;

  const startEvent = journeyEvents
    .filter(e => eventType(e) === 'JOURNEY_START')[0];
  const endEvent = journeyEvents
    .filter(e => eventType(e) === 'JOURNEY_END').at(-1);

  const timeCalculation = calculateJourneyTimes({ events: journeyEvents });
  const startedAt = timeCalculation.journeyStartedAt ?? null;
  const endedAt = timeCalculation.journeyEndedAt ?? null;

  const enrichedStops: StopEntry[] = timeCalculation.stops
    .filter(stop => stop.status !== 'ORFA')
    .map(stop => ({
      code: stop.reasonCode ?? '',
      description: stop.reasonName ?? '',
      startedAt: stop.startedAt,
      endedAt: stop.endedAt ?? undefined,
      durationMinutes: Math.round(stop.durationMs / 60_000),
    }));

  const eventLabels: Record<string, string> = {
    JOURNEY_START: 'Jornada iniciada',
    STOP_STARTED: 'Parada iniciada',
    STOP_REASON: 'Motivo da parada registrado',
    PARADA: 'Parada registrada',
    STOP_ENDED: 'Parada finalizada',
    JOURNEY_END: 'Jornada finalizada',
    POSITION_UPDATE: 'Posição atualizada',
    HEARTBEAT: 'Comunicação recebida',
  };
  const priorityTypes = new Set(['JOURNEY_START', 'STOP_STARTED', 'STOP_REASON', 'PARADA', 'STOP_ENDED', 'JOURNEY_END', 'POSITION_UPDATE', 'HEARTBEAT']);
  const technicalSeen = new Set<string>();
  const events: OperationalTimelineEntry[] = journeyEvents.flatMap(event => {
    const type = eventType(event);
    const timestamp = eventTime(event);
    if (!timestamp || !priorityTypes.has(type)) return [];
    if ((type === 'POSITION_UPDATE' || type === 'HEARTBEAT') && technicalSeen.has(type)) return [];
    technicalSeen.add(type);
    const fields = stopFields(eventPayload(event));
    return [{ id: event.offlineId || `${type}-${timestamp}`, type, timestamp, label: eventLabels[type] ?? type,
      description: type.startsWith('STOP_') || type === 'PARADA' ? stopLabel(fields.code, fields.description) : null }];
  });

  // ── Trail ────────────────────────────────────────────────────────────────────
  const trailPoints = effectiveJourneyId
    ? ServerStorage.getTrail(tenantId, effectiveJourneyId)
    : [];
  const sortedTrail = [...trailPoints].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const trailSummary = {
    points:     sortedTrail.length,
    firstGpsAt: sortedTrail[0]?.timestamp ?? null,
    lastGpsAt:  sortedTrail[sortedTrail.length - 1]?.timestamp ?? null,
    distanceKm: calcDistanceKm(sortedTrail),
  };

  // ── Operational fields ───────────────────────────────────────────────────────
  const sp = startEvent?.payload as Record<string, unknown> | undefined;
  const ep = endEvent?.payload   as Record<string, unknown> | undefined;
  const m  = machine as unknown as Record<string, unknown>;

  const operatorRegistration =
    String(machine.operatorRegistration ?? machine.registration ?? sp?.operatorRegistration ?? '').trim() || null;
  const operatorName =
    String(machine.operatorName ?? machine.currentOperator ?? sp?.operatorName ?? '').trim() || null;
  const operationCode =
    String(machine.operationCode ?? sp?.operationCode ?? '').trim() || null;
  const operationName =
    String(machine.operationName ?? machine.currentOperation ?? sp?.operationName ?? '').trim() || null;
  const implementCode =
    String(machine.implementCode ?? sp?.implementCode ?? '').trim() || null;
  const implementName =
    String(m['implementName'] ?? sp?.implementName ?? '').trim() || null;

  // Work order — from live state or startEvent payload
  const workOrderId =
    String(m['workOrderId'] ?? sp?.workOrderId ?? '').trim() || null;
  const workOrderNumber =
    String(m['workOrderNumber'] ?? sp?.workOrderNumber ?? m['workOrder'] ?? sp?.workOrder ?? '').trim() || null;

  // Cost center — from live state or startEvent payload
  const costCenterId =
    String(m['costCenterId'] ?? sp?.costCenterId ?? '').trim() || null;
  const rawCostCenterName =
    String(m['costCenterName'] ?? sp?.costCenterName ?? m['costCenter'] ?? sp?.costCenter ?? '').trim() || null;
  const costCenterName =
    sameLabel(rawCostCenterName, operationName) || sameLabel(rawCostCenterName, machine.currentOperation)
      ? null
      : rawCostCenterName;

  // ── Hourmeter ────────────────────────────────────────────────────────────────
  // journeyEnded: true only when JOURNEY_END was received (batch/route.ts sets liveUpdates.endedAt).
  // machine.status === 'OFFLINE' means GPS signal loss — NOT end of journey.
  const journeyEnded = !!endedAt;

  const rawHourmeterStart = (() => {
    if (typeof machine.hourmeterStart   === 'number' && machine.hourmeterStart   > 0) return machine.hourmeterStart;
    if (typeof machine.hourmeterInitial === 'number' && machine.hourmeterInitial > 0) return machine.hourmeterInitial;
    if (sp && typeof sp.hourmeterStart  === 'number' && (sp.hourmeterStart as number) > 0) return sp.hourmeterStart as number;
    if (!journeyEnded && typeof machine.hourmeterCurrent === 'number' && machine.hourmeterCurrent > 0)
      return machine.hourmeterCurrent;
    return null;
  })();

  const rawHourmeterCurrent =
    typeof machine.hourmeterCurrent === 'number' && machine.hourmeterCurrent > 0
      ? machine.hourmeterCurrent : null;

  const rawHourmeterEnd = (() => {
    if (typeof machine.hourmeterEnd   === 'number' && machine.hourmeterEnd   > 0) return machine.hourmeterEnd;
    if (typeof machine.hourmeterFinal === 'number' && machine.hourmeterFinal > 0) return machine.hourmeterFinal;
    if (ep && typeof ep.hourmeterEnd  === 'number' && (ep.hourmeterEnd as number) > 0) return ep.hourmeterEnd as number;
    return null;
  })();

  const hourmeterCalculation = calculateJourneyHourmeter({
    status: journeyEnded ? 'FINALIZADO' : String(machine.status ?? 'EM_ANDAMENTO'),
    hourmeterStart: rawHourmeterStart,
    hourmeterCurrent: rawHourmeterCurrent,
    hourmeterEnd: rawHourmeterEnd,
  });
  const hourmeterStart = hourmeterCalculation.start;
  const hourmeterCurrent = hourmeterCalculation.current;
  const hourmeterEnd = hourmeterCalculation.end;
  const totalHourmeter = hourmeterCalculation.total;

  // ── Time calculations ─────────────────────────────────────────────────────────
  // Duration: from startedAt to endedAt (or now if active)
  const durationMinutes = Math.round(timeCalculation.totalMs / 60_000);

  const minutesStopped = Math.round(timeCalculation.stoppedMs / 60_000);
  const minutesUndetermined = Math.round(timeCalculation.indeterminateMs / 60_000);
  const minutesOperating = Math.round(timeCalculation.workingMs / 60_000);

  const pctUndetermined =
    durationMinutes !== null && durationMinutes > 0 && minutesUndetermined !== null
      ? Math.round((minutesUndetermined / durationMinutes) * 100)
      : null;

  // ── Inconsistency engine ──────────────────────────────────────────────────────
  const inconsistencies: string[] = [...timeCalculation.warnings, ...hourmeterCalculation.warnings];

  if (!operatorRegistration && !operatorName)
    inconsistencies.push(INCONSISTENCY.OPERADOR_NAO_IDENTIFICADO);
  if (operatorRegistration && operatorRegistration.length < 2)
    inconsistencies.push(INCONSISTENCY.MATRICULA_INVALIDA);
  if (!operationCode)
    inconsistencies.push(INCONSISTENCY.OPERACAO_NAO_INFORMADA);
  if (!workOrderNumber)
    inconsistencies.push(INCONSISTENCY.OS_NAO_INFORMADA);
  if (!implementCode)
    inconsistencies.push(INCONSISTENCY.IMPLEMENTO_NAO_INFORMADO);

  if (journeyEnded) {
    if (!hourmeterEnd)
      inconsistencies.push(INCONSISTENCY.JORNADA_FINALIZADA_SEM_HORIMETRO_FINAL);
    if (hourmeterEnd !== null && hourmeterStart !== null && hourmeterEnd < hourmeterStart)
      inconsistencies.push(INCONSISTENCY.HORIMETRO_FINAL_MENOR_QUE_INICIAL);
    if (totalHourmeter !== null && totalHourmeter < 0)
      inconsistencies.push(INCONSISTENCY.TOTAL_HORAS_INCONSISTENTE);
  }

  // GPS / heartbeat recency (only for active journeys — finalized ones lose signal normally)
  if (!journeyEnded) {
    const gpsAge       = ageMinutes(machine.lastGpsAt);
    const heartbeatAge = ageMinutes(machine.lastHeartbeatAt);
    if (gpsAge === null || gpsAge > GPS_RECENTE_LIMITE_MIN)
      inconsistencies.push(INCONSISTENCY.SEM_GPS_RECENTE);
    if (heartbeatAge === null || heartbeatAge > HEARTBEAT_LIMITE_MIN)
      inconsistencies.push(INCONSISTENCY.SEM_HEARTBEAT_RECENTE);
  }

  if (trailSummary.points === 0)
    inconsistencies.push(INCONSISTENCY.JORNADA_SEM_EVENTOS_GPS);

  if (pctUndetermined !== null && pctUndetermined > INDETERMINADO_LIMITE_PCT)
    inconsistencies.push(INCONSISTENCY.TEMPO_INDETERMINADO_ACIMA_LIMITE);

  // ── Status ────────────────────────────────────────────────────────────────────
  const hasBlockingInconsistency = inconsistencies.some(i => !i.includes('(alerta)'));

  const isFullyFinalized =
    journeyEnded &&
    hourmeterEnd !== null &&
    totalHourmeter !== null && totalHourmeter >= 0 &&
    !hasBlockingInconsistency;

  // Status rules (spec ETAPA 6.2):
  //   1. Sem JOURNEY_END → EM_ANDAMENTO
  //   2. Com JOURNEY_END + inconsistência bloqueante → INCONSISTENTE
  //   3. Com JOURNEY_END + horímetro final válido + sem bloqueantes → FINALIZADO
  //   4. Com JOURNEY_END mas sem dados completos → PENDENTE
  const status: FichaOperador['status'] =
    !journeyEnded              ? 'EM_ANDAMENTO'
    : hasBlockingInconsistency ? 'INCONSISTENTE'
    : isFullyFinalized         ? 'FINALIZADO'
    :                            'PENDENTE';

  const validated = status === 'FINALIZADO';

  logger.debug(
    'fleetCode=' + machine.fleetCode +
    ' journeyId=' + (effectiveJourneyId ?? 'none') +
    ' status=' + status +
    ' inconsistencies=' + inconsistencies.length +
    ' journeyEnded=' + String(journeyEnded),
  );

  const ficha: FichaOperador = {
    journeyId: effectiveJourneyId,
    fleetCode: machine.fleetCode,
    equipmentId: machine.equipmentId,
    operatorRegistration,
    operatorName,
    operationCode,
    operationName,
    implementCode,
    implementName,
    workOrderId,
    workOrderNumber,
    costCenterId,
    costCenterName,
    hourmeterStart,
    hourmeterCurrent,
    hourmeterEnd,
    totalHourmeter,
    durationMinutes,
    minutesOperating,
    minutesStopped: minutesStopped > 0 ? minutesStopped : null,
    minutesUndetermined,
    pctUndetermined,
    startedAt,
    endedAt,
    stops: enrichedStops,
    events,
    operationalStatus: endedAt ? 'FINALIZADO' : String(machine.status ?? 'OFFLINE'),
    trailSummary,
    status,
    inconsistencies,
    validated,
  };

  return { ok: true, ficha };
}
