import { ServerStorage } from '@/lib/server-storage';
import {
  round, percent, hourBucket, firstName,
  makeCatalogs, collectJourneys, resolveDefaultPeriod,
  computeJourneyHours, capSummaryHours, addTimeline, esc,
} from '@/lib/operational-time-core';

// ── Report types ─────────────────────────────────────────────────────────────

export interface EfficiencyReport {
  period: { from: string; to: string };
  summary: {
    totalHours: number;
    productiveHours: number;
    unproductiveHours: number;
    maintenanceHours: number;
    productivePercent: number;
    unproductivePercent: number;
    maintenancePercent: number;
    totalJourneys: number;
    finalizedJourneys: number;
    pendingJourneys: number;
  };
  topStops: Array<{ code: string; description: string; hours: number; percent: number; occurrences: number }>;
  byFleet: Array<{
    fleetCode: string;
    operatorName: string;
    operationName: string;
    implementName: string;
    totalHours: number;
    productiveHours: number;
    unproductiveHours: number;
    maintenanceHours?: number;
    productivePercent?: number;
    unproductivePercent?: number;
    maintenancePercent?: number;
    stopsCount: number;
    finalizedJourneys: number;
    hourmeterInconsistent?: boolean;
    inconsistencies?: string[];
  }>;
  byOperator: Array<{
    registration: string;
    name: string;
    totalHours: number;
    productiveHours: number;
    unproductiveHours: number;
    efficiencyPercent: number;
  }>;
  byOperation: Array<{ code: string; name: string; hours: number; percent: number }>;
  timeline: Array<{ hour: string; productiveHours: number; unproductiveHours: number; maintenanceHours: number }>;
}

export type EfficiencyResult =
  | { ok: true; report: EfficiencyReport }
  | { ok: false; status: number; error: string };

const ZERO_SUMMARY: EfficiencyReport['summary'] = {
  totalHours: 0,
  productiveHours: 0,
  unproductiveHours: 0,
  maintenanceHours: 0,
  productivePercent: 0,
  unproductivePercent: 0,
  maintenancePercent: 0,
  totalJourneys: 0,
  finalizedJourneys: 0,
  pendingJourneys: 0,
};

// ── Main builder ─────────────────────────────────────────────────────────────

export function buildEfficiencyReport(params: {
  tenantId: string;
  from?: string | null;
  to?: string | null;
  fleetCode?: string | null;
  operatorRegistration?: string | null;
}): EfficiencyResult {
  const allEvents = ServerStorage.getEvents(params.tenantId);
  const period = resolveDefaultPeriod(allEvents, params.from, params.to);
  const fromDate = new Date(period.from);
  const toDate = new Date(period.to);

  if (!Number.isFinite(fromDate.getTime()) || !Number.isFinite(toDate.getTime())) {
    return { ok: false, status: 400, error: 'Periodo invalido' };
  }
  if (toDate < fromDate) {
    return { ok: false, status: 400, error: 'Periodo final menor que inicial' };
  }

  const catalogs = makeCatalogs(params.tenantId);
  const journeys = collectJourneys({
    tenantId: params.tenantId,
    events: allEvents,
    catalogs,
    fromDate,
    toDate,
    fleetCode: params.fleetCode,
    operatorRegistration: params.operatorRegistration,
  });

  if (journeys.length === 0) {
    return {
      ok: true,
      report: { period, summary: ZERO_SUMMARY, topStops: [], byFleet: [], byOperator: [], byOperation: [], timeline: [] },
    };
  }

  const stopMap = new Map<string, { code: string; description: string; hours: number; occurrences: number }>();
  const fleetMap = new Map<string, EfficiencyReport['byFleet'][number]>();
  const operatorMap = new Map<string, EfficiencyReport['byOperator'][number]>();
  const operationMap = new Map<string, EfficiencyReport['byOperation'][number]>();
  const timelineMap = new Map<string, { productiveHours: number; unproductiveHours: number; maintenanceHours: number }>();

  let totalHours = 0;
  let productiveHours = 0;
  let unproductiveHours = 0;
  let maintenanceHours = 0;
  let finalizedJourneys = 0;

  for (const journey of journeys) {
    const computed = computeJourneyHours(journey);
    const { total, productive, stopUnproductive, stopMaintenance, hasReliableJourney } = computed;

    totalHours += total;
    productiveHours += productive;
    unproductiveHours += stopUnproductive;
    maintenanceHours += stopMaintenance;
    if (journey.status === 'FINALIZADO') finalizedJourneys++;

    addTimeline(timelineMap, hourBucket(journey.startedAt || journey.endedAt), 'productiveHours', productive);
    for (const stop of journey.stops) {
      addTimeline(timelineMap, hourBucket(stop.startedAt), stop.group === 'MANUTENCAO' ? 'maintenanceHours' : 'unproductiveHours', stop.hours);
      const key = stop.code || stop.description;
      const current = stopMap.get(key) || { code: stop.code, description: stop.description, hours: 0, occurrences: 0 };
      current.hours += stop.hours;
      current.occurrences += 1;
      stopMap.set(key, current);
    }

    if (!hasReliableJourney) {
      journey.inconsistencies.push('journeyId não confiável – excluído do byFleet');
    } else {
      const fleetKey = journey.fleetCode || 'NAO_INFORMADO';
      const fleet = fleetMap.get(fleetKey) || {
        fleetCode: fleetKey,
        operatorName: journey.operatorName || 'Nao informado',
        operationName: journey.operationName || 'Nao informado',
        implementName: journey.implementName || 'Nao informado',
        totalHours: 0, productiveHours: 0, unproductiveHours: 0, maintenanceHours: 0,
        productivePercent: 0, unproductivePercent: 0, maintenancePercent: 0,
        stopsCount: 0, finalizedJourneys: 0,
        hourmeterInconsistent: false, inconsistencies: [],
      };
      fleet.totalHours += total;
      fleet.productiveHours += productive;
      fleet.unproductiveHours += stopUnproductive;
      fleet.maintenanceHours = (fleet.maintenanceHours || 0) + stopMaintenance;
      fleet.stopsCount += journey.stops.length;
      fleet.finalizedJourneys += journey.status === 'FINALIZADO' ? 1 : 0;
      if (journey.inconsistencies.length > 0) {
        fleet.hourmeterInconsistent = true;
        fleet.inconsistencies = Array.from(new Set([...(fleet.inconsistencies || []), ...journey.inconsistencies]));
      }
      fleetMap.set(fleetKey, fleet);
    }

    const opReg = journey.operatorRegistration || 'NAO_INFORMADO';
    const operator = operatorMap.get(opReg) || {
      registration: opReg,
      name: journey.operatorName || firstName(catalogs.operators, opReg, 'Nao informado'),
      totalHours: 0, productiveHours: 0, unproductiveHours: 0, efficiencyPercent: 0,
    };
    operator.totalHours += total;
    operator.productiveHours += productive;
    operator.unproductiveHours += stopUnproductive + stopMaintenance;
    operatorMap.set(opReg, operator);

    const opCode = journey.operationCode || 'NAO_INFORMADO';
    if (productive > 0) {
      const operation = operationMap.get(opCode) || {
        code: opCode,
        name: journey.operationName || firstName(catalogs.operations, opCode, 'Nao informado'),
        hours: 0, percent: 0,
      };
      operation.hours += productive;
      operationMap.set(opCode, operation);
    }
  }

  const byFleet = Array.from(fleetMap.values())
    .map(item => {
      const inconsistencies = [...(item.inconsistencies || [])];
      if (item.unproductiveHours > item.totalHours) inconsistencies.push('unproductiveHours excede totalHours da frota');
      if (item.unproductiveHours + (item.maintenanceHours || 0) > item.totalHours) inconsistencies.push('paradas excedem totalHours da frota');
      const capped = capSummaryHours(item.totalHours, item.maintenanceHours || 0, item.unproductiveHours, item.productiveHours);
      return {
        ...item,
        totalHours: round(item.totalHours),
        productiveHours: round(capped.productiveHours),
        unproductiveHours: round(capped.unproductiveHours),
        maintenanceHours: round(capped.maintenanceHours),
        productivePercent: percent(capped.productiveHours, item.totalHours),
        unproductivePercent: percent(capped.unproductiveHours, item.totalHours),
        maintenancePercent: percent(capped.maintenanceHours, item.totalHours),
        hourmeterInconsistent: inconsistencies.length > 0,
        inconsistencies: Array.from(new Set(inconsistencies)),
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);

  const byOperator = Array.from(operatorMap.values())
    .map(item => ({
      ...item,
      totalHours: round(item.totalHours),
      productiveHours: round(item.productiveHours),
      unproductiveHours: round(item.unproductiveHours),
      efficiencyPercent: percent(item.productiveHours, item.totalHours),
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  const byOperation = Array.from(operationMap.values())
    .map(item => ({ ...item, hours: round(item.hours), percent: percent(item.hours, totalHours) }))
    .sort((a, b) => b.hours - a.hours);

  const topStops = Array.from(stopMap.values())
    .map(item => ({ ...item, hours: round(item.hours), percent: percent(item.hours, totalHours) }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 10);

  const timeline = Array.from(timelineMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, item]) => ({
      hour,
      productiveHours: round(item.productiveHours),
      unproductiveHours: round(item.unproductiveHours),
      maintenanceHours: round(item.maintenanceHours),
    }));

  const capped = capSummaryHours(totalHours, maintenanceHours, unproductiveHours, productiveHours);

  return {
    ok: true,
    report: {
      period,
      summary: {
        totalHours: round(totalHours),
        productiveHours: round(capped.productiveHours),
        unproductiveHours: round(capped.unproductiveHours),
        maintenanceHours: round(capped.maintenanceHours),
        productivePercent: percent(capped.productiveHours, totalHours),
        unproductivePercent: percent(capped.unproductiveHours, totalHours),
        maintenancePercent: percent(capped.maintenanceHours, totalHours),
        totalJourneys: journeys.length,
        finalizedJourneys,
        pendingJourneys: journeys.length - finalizedJourneys,
      },
      topStops,
      byFleet,
      byOperator,
      byOperation,
      timeline,
    },
  };
}

// ── CSV export ───────────────────────────────────────────────────────────────

export function buildEfficiencyCsv(report: EfficiencyReport): string {
  const rows = [
    'periodo_inicio;periodo_fim;frota;operador;operacao;implemento;grupo;codigo;descricao;horas;percentual;jornadas_finalizadas;paradas',
  ];

  for (const item of report.byFleet) {
    rows.push([
      report.period.from, report.period.to, item.fleetCode, item.operatorName,
      item.operationName, item.implementName, 'PRODUTIVA', '', 'Horas produtivas',
      item.productiveHours.toFixed(2), percent(item.productiveHours, item.totalHours).toFixed(2),
      item.finalizedJourneys, item.stopsCount,
    ].map(esc).join(';'));

    rows.push([
      report.period.from, report.period.to, item.fleetCode, item.operatorName,
      item.operationName, item.implementName, 'IMPRODUTIVA', '', 'Paradas e improdutividade',
      item.unproductiveHours.toFixed(2), percent(item.unproductiveHours, item.totalHours).toFixed(2),
      item.finalizedJourneys, item.stopsCount,
    ].map(esc).join(';'));

    rows.push([
      report.period.from, report.period.to, item.fleetCode, item.operatorName,
      item.operationName, item.implementName, 'MANUTENCAO', '', 'Horas de manutencao',
      (item.maintenanceHours || 0).toFixed(2), percent(item.maintenanceHours || 0, item.totalHours).toFixed(2),
      item.finalizedJourneys, item.stopsCount,
    ].map(esc).join(';'));
  }

  for (const stop of report.topStops) {
    rows.push([
      report.period.from, report.period.to, '', '', '', '', 'PARADA',
      stop.code, stop.description, stop.hours.toFixed(2), stop.percent.toFixed(2),
      report.summary.finalizedJourneys, stop.occurrences,
    ].map(esc).join(';'));
  }

  return '﻿' + rows.join('\n');
}
