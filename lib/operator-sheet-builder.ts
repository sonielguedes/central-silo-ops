import { ServerStorage } from '@/lib/server-storage';
import type { TrailPoint } from '@/lib/types';

export interface StopEntry {
  code: string;
  description: string;
  startedAt: string;
  endedAt?: string;
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
  hourmeterStart: number | null;
  hourmeterEnd: number | null;
  totalHourmeter: number | null;
  startedAt: string | null;
  endedAt: string | null;
  stops: StopEntry[];
  trailSummary: {
    points: number;
    firstGpsAt: string | null;
    lastGpsAt: string | null;
    distanceKm: number;
  };
  status: 'PENDENTE' | 'EXPORTADO' | 'INCONSISTENTE';
  inconsistencies: string[];
}

export type BuildSheetResult =
  | { ok: true;  ficha: FichaOperador }
  | { ok: false; status: number; error: string };

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

  const sp = startEvent?.payload as Record<string, unknown> | undefined;
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

  const hourmeterStart =
    typeof machine.hourmeterStart === 'number' && machine.hourmeterStart > 0
      ? machine.hourmeterStart : null;
  const hourmeterEnd =
    typeof machine.hourmeterEnd === 'number' && machine.hourmeterEnd > 0
      ? machine.hourmeterEnd : null;
  const totalHourmeter =
    typeof machine.totalHourmeter === 'number' ? machine.totalHourmeter : null;

  const isFinalized = machine.status === 'OFFLINE' || machine.status === 'FINALIZADO';

  const inconsistencies: string[] = [];
  if (!operatorRegistration && !operatorName) inconsistencies.push('Operador ausente');
  if (!hourmeterStart)                        inconsistencies.push('Horimetro inicial ausente');
  if (isFinalized && !hourmeterEnd)           inconsistencies.push('Jornada finalizada sem horimetro final');
  if (totalHourmeter !== null && totalHourmeter < 0)
    inconsistencies.push('Total de horimetro negativo');
  if (machine.hourmeterInconsistent)
    inconsistencies.push(machine.hourmeterInconsistencyReason ?? 'Inconsistencia de horimetro');
  if (trailSummary.points === 0)
    inconsistencies.push('Sem rastro de GPS registrado (alerta)');

  const status: FichaOperador['status'] =
    inconsistencies.some(i => !i.includes('(alerta)')) ? 'INCONSISTENTE' : 'PENDENTE';

  console.info(
    '[operator-sheet-builder] fleetCode=' + fleetCode +
    ' journeyId=' + (effectiveJourneyId ?? 'none') +
    ' status=' + status,
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
    hourmeterStart,
    hourmeterEnd,
    totalHourmeter,
    startedAt,
    endedAt,
    stops,
    trailSummary,
    status,
    inconsistencies,
  };

  return { ok: true, ficha };
}
