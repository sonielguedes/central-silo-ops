import { ServerStorage } from '@/lib/server-storage';
import type { TrailPoint } from '@/lib/types';

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

export interface StopEntry {
  code: string;
  description: string;
  startedAt: string;
  endedAt?: string;
  durationMinutes?: number;
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

function minutesBetween(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return null;
  return Math.round((tb - ta) / 60000);
}

// ── Stop duration helper ──────────────────────────────────────────────────────
function stopDurationMinutes(s: { startedAt: string; endedAt?: string }): number | undefined {
  const m = minutesBetween(s.startedAt, s.endedAt ?? null);
  return m != null && m >= 0 ? m : undefined;
}

function sameLabel(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = String(a ?? '').trim().toUpperCase();
  const right = String(b ?? '').trim().toUpperCase();
  return !!left && left === right;
}

// ── Main builder ──────────────────────────────────────────────────────────────
export function buildOperatorSheet(params: {
  tenantId:  string;
  fleetCode: string;
  journeyId: string | null;
}): BuildSheetResult {
  const { tenantId, fleetCode, journeyId } = params;

  const liveFleet = ServerStorage.getLiveFleet(tenantId);
  const machine   = liveFleet.find(m => m.fleetCode === fleetCode);
  if (!machine) {
    return { ok: false, status: 404, error: 'fleetCode not found in live-state' };
  }

  const effectiveJourneyId = journeyId || machine.journeyId || null;

  const allEvents     = ServerStorage.getEvents(tenantId, machine.equipmentId);
  const journeyEvents = effectiveJourneyId
    ? allEvents.filter(e => {
        const p = e.payload as Record<string, unknown>;
        return p?.journeyId === effectiveJourneyId;
      })
    : allEvents;

  const startEvent = journeyEvents
    .filter(e => e.type === 'JOURNEY_START')
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))[0];
  const endEvent = journeyEvents
    .filter(e => e.type === 'JOURNEY_END')
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

  const startedAt = startEvent?.timestamp ?? null;
  const endedAt   = endEvent?.timestamp   ?? null;

  // ── Stops ────────────────────────────────────────────────────────────────────
  const stops: StopEntry[] = [];
  const stopSeen = new Set<string>();
  const stopEvents = journeyEvents
    .filter(e => e.type === 'STOP_REASON' || e.type === 'PARADA')
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  for (const ev of stopEvents) {
    const p           = ev.payload as Record<string, unknown>;
    const code        = String(p?.stopCode ?? p?.code ?? '').trim();
    const desc        = String(p?.stopDescription ?? p?.description ?? p?.reason ?? '').trim();
    const stopStartAt = String(p?.stopStartedAt ?? ev.timestamp);
    if (!code) continue;
    const dedupKey = code + '|' + stopStartAt.slice(0, 16);
    if (stopSeen.has(dedupKey)) continue;
    stopSeen.add(dedupKey);
    stops.push({ code, description: desc, startedAt: stopStartAt });
  }

  const machineStopEndedAt =
    String((machine as unknown as Record<string, unknown>)['stopEndedAt'] ?? '').trim() || null;
  if (machineStopEndedAt) {
    for (const s of stops) {
      if (!s.endedAt) s.endedAt = machineStopEndedAt;
    }
  }

  // Compute stop durations
  const enrichedStops: StopEntry[] = stops.map(s => ({
    ...s,
    durationMinutes: stopDurationMinutes(s),
  }));

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

  const hourmeterStart = (() => {
    if (typeof machine.hourmeterStart   === 'number' && machine.hourmeterStart   > 0) return machine.hourmeterStart;
    if (typeof machine.hourmeterInitial === 'number' && machine.hourmeterInitial > 0) return machine.hourmeterInitial;
    if (sp && typeof sp.hourmeterStart  === 'number' && (sp.hourmeterStart as number) > 0) return sp.hourmeterStart as number;
    if (!journeyEnded && typeof machine.hourmeterCurrent === 'number' && machine.hourmeterCurrent > 0)
      return machine.hourmeterCurrent;
    return null;
  })();

  const hourmeterCurrent =
    typeof machine.hourmeterCurrent === 'number' && machine.hourmeterCurrent > 0
      ? machine.hourmeterCurrent : null;

  const hourmeterEnd = (() => {
    if (typeof machine.hourmeterEnd   === 'number' && machine.hourmeterEnd   > 0) return machine.hourmeterEnd;
    if (typeof machine.hourmeterFinal === 'number' && machine.hourmeterFinal > 0) return machine.hourmeterFinal;
    if (ep && typeof ep.hourmeterEnd  === 'number' && (ep.hourmeterEnd as number) > 0) return ep.hourmeterEnd as number;
    return null;
  })();

  const totalHourmeter = (() => {
    if (typeof machine.totalHourmeter === 'number') return machine.totalHourmeter;
    if (hourmeterEnd !== null && hourmeterStart !== null) {
      const diff = Math.round((hourmeterEnd - hourmeterStart) * 100) / 100;
      return diff >= 0 ? diff : null;
    }
    return null;
  })();

  // ── Time calculations ─────────────────────────────────────────────────────────
  // Duration: from startedAt to endedAt (or now if active)
  const endTs = endedAt ?? new Date().toISOString();
  const durationMinutes = minutesBetween(startedAt, endTs);

  // minutesStopped: sum of stop durations for closed stops
  let minutesStopped = 0;
  for (const s of enrichedStops) {
    const stopEnd = s.endedAt ?? (journeyEnded ? endedAt : null);
    const dur = minutesBetween(s.startedAt, stopEnd ?? null);
    if (dur != null && dur > 0) minutesStopped += dur;
  }
  const minutesStoppedFinal = minutesStopped > 0 ? minutesStopped : null;

  // minutesOperating: derived from trail GPS points (best effort)
  // Strategy: count minutes covered by GPS activity (1 GPS point per period = that period is "operating")
  // For now use: durationMinutes - minutesStopped - indeterminado
  // We know indeterminado = duration - operating - stopped
  // Simplest correct derivation: operating = duration - stopped (if no GPS gaps)
  // Mark time with no GPS as indeterminado
  let minutesUndetermined: number | null = null;
  let minutesOperating: number | null    = null;

  if (durationMinutes !== null) {
    // Undetermined = gaps where no GPS was received (> GPS_RECENTE_LIMITE_MIN minutes between points)
    let undetermined = 0;
    if (sortedTrail.length >= 2) {
      for (let i = 1; i < sortedTrail.length; i++) {
        const gap = minutesBetween(sortedTrail[i - 1].timestamp, sortedTrail[i].timestamp);
        if (gap !== null && gap > GPS_RECENTE_LIMITE_MIN) {
          undetermined += gap;
        }
      }
    } else if (sortedTrail.length === 0) {
      // No GPS at all — entire journey is undetermined
      undetermined = durationMinutes;
    } else {
      // Single GPS point — time before first and after last is undetermined
      const beforeFirst = minutesBetween(startedAt, sortedTrail[0]?.timestamp ?? null);
      const afterLast   = minutesBetween(sortedTrail[sortedTrail.length - 1]?.timestamp ?? null, endTs);
      undetermined = (beforeFirst ?? 0) + (afterLast ?? 0);
    }
    minutesUndetermined = Math.min(undetermined, durationMinutes);
    const known = durationMinutes - minutesUndetermined;
    const stopped = Math.min(minutesStopped, known);
    minutesOperating = Math.max(0, known - stopped);
    minutesStoppedFinal === null; // suppress unused-var; use stopped below
  }

  const pctUndetermined =
    durationMinutes !== null && durationMinutes > 0 && minutesUndetermined !== null
      ? Math.round((minutesUndetermined / durationMinutes) * 100)
      : null;

  // ── Inconsistency engine ──────────────────────────────────────────────────────
  const inconsistencies: string[] = [];

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

  console.info(
    '[operator-sheet-builder] fleetCode=' + fleetCode +
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
    trailSummary,
    status,
    inconsistencies,
    validated,
  };

  return { ok: true, ficha };
}
