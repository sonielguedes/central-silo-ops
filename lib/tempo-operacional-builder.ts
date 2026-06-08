/**
 * tempo-operacional-builder.ts — C4.5
 * Operational time report: time by operation, stop, fleet, operator, group.
 * Reuses all math from operational-time-core.ts (shared with C4.4).
 */

import { ServerStorage } from '@/lib/server-storage';
import {
  round, percent, hourBucket, firstName,
  makeCatalogs, collectJourneys, resolveDefaultPeriod,
  computeJourneyHours, capSummaryHours, addTimeline, esc,
} from '@/lib/operational-time-core';

// ── Public types ─────────────────────────────────────────────────────────────

export interface TempoReport {
  period: { from: string; to: string };
  summary: {
    totalHours: number;
    productiveHours: number;
    unproductiveHours: number;
    maintenanceHours: number;
    averageJourneyHours: number;
    totalJourneys: number;
    finalizedJourneys: number;
    inconsistentJourneys: number;
  };
  byGroup: Array<{ group: string; hours: number; percent: number; occurrences: number }>;
  byFleet: Array<{
    fleetCode: string;
    operatorName: string;
    operationName: string;
    implementName: string;
    totalHours: number;
    productiveHours: number;
    unproductiveHours: number;
    maintenanceHours: number;
    journeyCount: number;
    avgHours: number;
    inconsistencies?: string[];
  }>;
  byOperator: Array<{
    registration: string;
    name: string;
    totalHours: number;
    journeyCount: number;
    avgHours: number;
  }>;
  byOperation: Array<{
    code: string;
    name: string;
    group: string;
    hours: number;
    percent: number;
    occurrences: number;
  }>;
  byStop: Array<{
    code: string;
    description: string;
    group: string;
    hours: number;
    percent: number;
    occurrences: number;
  }>;
  timeline: Array<{
    dateHour: string;
    productiveHours: number;
    unproductiveHours: number;
    maintenanceHours: number;
  }>;
  inconsistencies: string[];
}

export type TempoResult =
  | { ok: true; report: TempoReport }
  | { ok: false; status: number; error: string };

// ── Zero summary ─────────────────────────────────────────────────────────────

const ZERO_SUMMARY: TempoReport['summary'] = {
  totalHours: 0,
  productiveHours: 0,
  unproductiveHours: 0,
  maintenanceHours: 0,
  averageJourneyHours: 0,
  totalJourneys: 0,
  finalizedJourneys: 0,
  inconsistentJourneys: 0,
};

// ── Main builder ─────────────────────────────────────────────────────────────

export function buildTempoReport(params: {
  tenantId: string;
  from?: string | null;
  to?: string | null;
  fleetCode?: string | null;
  operatorRegistration?: string | null;
  group?: string | null;
}): TempoResult {
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
      report: {
        period, summary: ZERO_SUMMARY,
        byGroup: [], byFleet: [], byOperator: [], byOperation: [], byStop: [],
        timeline: [], inconsistencies: [],
      },
    };
  }

  // Accumulators
  const fleetMap = new Map<string, {
    fleetCode: string; operatorName: string; operationName: string; implementName: string;
    totalHours: number; productiveHours: number; unproductiveHours: number; maintenanceHours: number;
    journeyCount: number; inconsistencies: string[];
  }>();
  const operatorMap = new Map<string, { registration: string; name: string; totalHours: number; journeyCount: number }>();
  const operationMap = new Map<string, { code: string; name: string; group: string; hours: number; occurrences: number }>();
  const stopMap = new Map<string, { code: string; description: string; group: string; hours: number; occurrences: number }>();
  const timelineMap = new Map<string, { productiveHours: number; unproductiveHours: number; maintenanceHours: number }>();
  const allInconsistencies: string[] = [];

  let totalHours = 0;
  let productiveHours = 0;
  let unproductiveHours = 0;
  let maintenanceHours = 0;
  let finalizedJourneys = 0;
  let inconsistentJourneys = 0;

  // Group filter
  const filterGroup = params.group?.toUpperCase() || null;

  for (const journey of journeys) {
    const computed = computeJourneyHours(journey);
    const { total, productive, stopUnproductive, stopMaintenance } = computed;

    totalHours += total;
    productiveHours += productive;
    unproductiveHours += stopUnproductive;
    maintenanceHours += stopMaintenance;
    if (journey.status === 'FINALIZADO') finalizedJourneys++;
    if (journey.inconsistencies.length > 0) {
      inconsistentJourneys++;
      for (const msg of journey.inconsistencies) {
        allInconsistencies.push(`[${journey.fleetCode || journey.journeyId}] ${msg}`);
      }
    }

    // Timeline
    addTimeline(timelineMap, hourBucket(journey.startedAt || journey.endedAt), 'productiveHours', productive);
    for (const stop of journey.stops) {
      addTimeline(timelineMap, hourBucket(stop.startedAt), stop.group === 'MANUTENCAO' ? 'maintenanceHours' : 'unproductiveHours', stop.hours);
    }

    // byStop
    for (const stop of journey.stops) {
      if (filterGroup && stop.group !== filterGroup) continue;
      const key = stop.code || stop.description;
      const current = stopMap.get(key) || { code: stop.code, description: stop.description, group: stop.group, hours: 0, occurrences: 0 };
      current.hours += stop.hours;
      current.occurrences += 1;
      stopMap.set(key, current);
    }

    // byOperation (productive hours by operation code)
    if (productive > 0 && (!filterGroup || filterGroup === 'PRODUTIVA')) {
      const opCode = journey.operationCode || 'NAO_INFORMADO';
      const op = operationMap.get(opCode) || {
        code: opCode,
        name: journey.operationName || firstName(catalogs.operations, opCode, 'Nao informado'),
        group: 'PRODUTIVA',
        hours: 0,
        occurrences: 0,
      };
      op.hours += productive;
      op.occurrences += 1;
      operationMap.set(opCode, op);
    }

    // byFleet
    const fleetKey = journey.fleetCode || 'NAO_INFORMADO';
    const fleet = fleetMap.get(fleetKey) || {
      fleetCode: fleetKey,
      operatorName: journey.operatorName || 'Nao informado',
      operationName: journey.operationName || 'Nao informado',
      implementName: journey.implementName || 'Nao informado',
      totalHours: 0, productiveHours: 0, unproductiveHours: 0, maintenanceHours: 0,
      journeyCount: 0, inconsistencies: [],
    };
    fleet.totalHours += total;
    fleet.productiveHours += productive;
    fleet.unproductiveHours += stopUnproductive;
    fleet.maintenanceHours += stopMaintenance;
    fleet.journeyCount += 1;
    if (journey.inconsistencies.length > 0) {
      fleet.inconsistencies = Array.from(new Set([...fleet.inconsistencies, ...journey.inconsistencies]));
    }
    fleetMap.set(fleetKey, fleet);

    // byOperator
    const opReg = journey.operatorRegistration || 'NAO_INFORMADO';
    const operator = operatorMap.get(opReg) || {
      registration: opReg,
      name: journey.operatorName || firstName(catalogs.operators, opReg, 'Nao informado'),
      totalHours: 0,
      journeyCount: 0,
    };
    operator.totalHours += total;
    operator.journeyCount += 1;
    operatorMap.set(opReg, operator);
  }

  // Cap summary
  const capped = capSummaryHours(totalHours, maintenanceHours, unproductiveHours, productiveHours);

  // byGroup
  const byGroup = [
    { group: 'PRODUTIVA', hours: round(capped.productiveHours), percent: percent(capped.productiveHours, totalHours), occurrences: journeys.filter(j => j.operationCode || j.operationName).length },
    { group: 'IMPRODUTIVA', hours: round(capped.unproductiveHours), percent: percent(capped.unproductiveHours, totalHours), occurrences: Array.from(stopMap.values()).filter(s => s.group === 'IMPRODUTIVA').reduce((sum, s) => sum + s.occurrences, 0) },
    { group: 'MANUTENCAO', hours: round(capped.maintenanceHours), percent: percent(capped.maintenanceHours, totalHours), occurrences: Array.from(stopMap.values()).filter(s => s.group === 'MANUTENCAO').reduce((sum, s) => sum + s.occurrences, 0) },
  ].filter(g => !filterGroup || g.group === filterGroup);

  // byFleet with cap
  const byFleet = Array.from(fleetMap.values())
    .map(item => {
      const fc = capSummaryHours(item.totalHours, item.maintenanceHours, item.unproductiveHours, item.productiveHours);
      return {
        fleetCode: item.fleetCode,
        operatorName: item.operatorName,
        operationName: item.operationName,
        implementName: item.implementName,
        totalHours: round(item.totalHours),
        productiveHours: round(fc.productiveHours),
        unproductiveHours: round(fc.unproductiveHours),
        maintenanceHours: round(fc.maintenanceHours),
        journeyCount: item.journeyCount,
        avgHours: item.journeyCount > 0 ? round(item.totalHours / item.journeyCount) : 0,
        inconsistencies: item.inconsistencies.length > 0 ? item.inconsistencies : undefined,
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours);

  const byOperator = Array.from(operatorMap.values())
    .map(item => ({
      ...item,
      totalHours: round(item.totalHours),
      avgHours: item.journeyCount > 0 ? round(item.totalHours / item.journeyCount) : 0,
    }))
    .sort((a, b) => b.totalHours - a.totalHours);

  const byOperation = Array.from(operationMap.values())
    .map(item => ({
      ...item,
      hours: round(item.hours),
      percent: percent(item.hours, totalHours),
    }))
    .sort((a, b) => b.hours - a.hours);

  const byStop = Array.from(stopMap.values())
    .map(item => ({
      ...item,
      hours: round(item.hours),
      percent: percent(item.hours, totalHours),
    }))
    .sort((a, b) => b.hours - a.hours);

  const timeline = Array.from(timelineMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, item]) => ({
      dateHour: hour,
      productiveHours: round(item.productiveHours),
      unproductiveHours: round(item.unproductiveHours),
      maintenanceHours: round(item.maintenanceHours),
    }));

  const avgJourney = journeys.length > 0 ? round(totalHours / journeys.length) : 0;

  return {
    ok: true,
    report: {
      period,
      summary: {
        totalHours: round(totalHours),
        productiveHours: round(capped.productiveHours),
        unproductiveHours: round(capped.unproductiveHours),
        maintenanceHours: round(capped.maintenanceHours),
        averageJourneyHours: avgJourney,
        totalJourneys: journeys.length,
        finalizedJourneys,
        inconsistentJourneys,
      },
      byGroup,
      byFleet,
      byOperator,
      byOperation,
      byStop,
      timeline,
      inconsistencies: allInconsistencies,
    },
  };
}

// ── CSV export ───────────────────────────────────────────────────────────────

export function buildTempoCsv(report: TempoReport): string {
  const rows = [
    'periodo_inicio;periodo_fim;grupo;frota;operador;operacao;implemento;codigo;descricao;horas;percentual;jornadas;ocorrencias;inconsistente',
  ];

  // byFleet rows (one per group per fleet)
  for (const f of report.byFleet) {
    const hasInc = (f.inconsistencies?.length || 0) > 0 ? 'SIM' : '';
    for (const [group, hours] of [
      ['PRODUTIVA', f.productiveHours],
      ['IMPRODUTIVA', f.unproductiveHours],
      ['MANUTENCAO', f.maintenanceHours],
    ] as const) {
      rows.push([
        report.period.from, report.period.to, group,
        f.fleetCode, f.operatorName, f.operationName, f.implementName,
        '', group === 'PRODUTIVA' ? 'Horas produtivas' : group === 'IMPRODUTIVA' ? 'Paradas improdutivas' : 'Horas manutencao',
        hours.toFixed(2), percent(hours, f.totalHours).toFixed(2),
        f.journeyCount, '', hasInc,
      ].map(esc).join(';'));
    }
  }

  // byStop rows
  for (const s of report.byStop) {
    rows.push([
      report.period.from, report.period.to, s.group,
      '', '', '', '',
      s.code, s.description,
      s.hours.toFixed(2), s.percent.toFixed(2),
      '', s.occurrences, '',
    ].map(esc).join(';'));
  }

  // byOperation rows
  for (const op of report.byOperation) {
    rows.push([
      report.period.from, report.period.to, op.group,
      '', '', op.name, '',
      op.code, op.name,
      op.hours.toFixed(2), op.percent.toFixed(2),
      '', op.occurrences, '',
    ].map(esc).join(';'));
  }

  return '﻿' + rows.join('\n');
}
