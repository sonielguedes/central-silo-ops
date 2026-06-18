/**
 * GET /api/operacoes/ativas
 *
 * Operacoes Ativas Reais -- combina live-state + ficha operador para entregar
 * uma visao consolidada do que esta acontecendo na frota do tenant.
 *
 * Fontes em ordem de prioridade (para campos de exibicao):
 *   1. live-state      -- status real-time, horimetro atual, GPS
 *   2. ficha operador  -- operador, operacao, implemento, OS, centro de custo
 *   3. cadastros       -- fallback para nomes se live-state nao trouxer
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { ServerStorage } from '@/lib/server-storage';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { buildDailySheetList } from '@/lib/daily-sheet-builder';
import { FichaStore, deriveFichaStatus, getEffectiveBlockingInconsistencies } from '@/lib/ficha-store';
import { resolveStop } from '@/lib/stop-resolver';
import { resolveStopFull } from '@/lib/operational/resolve-active-operations';
import type { ResolvedStop } from '@/lib/operational/resolve-active-operations';
import type { EquipmentLiveState } from '@/lib/types';
import type { FichaDiaria } from '@/lib/daily-sheet-builder';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ActiveOperationItem {
  fleetCode: string;
  equipmentId: string;
  tenantId: string;
  /** Data operacional YYYY-MM-DD -- nunca converter via new Date() para exibicao */
  date: string;
  journeyId: string | null;
  // Operador
  operatorName: string | null;
  operatorRegistration: string | null;
  // Operacao
  operationCode: string | null;
  operationName: string | null;
  workOrderNumber: string | null;
  costCenterName: string | null;
  // Implemento
  implementCode: string | null;
  implementName: string | null;
  // Horimetro
  hourmeterCurrent: number | null;
  hourmeterStart: number | null;
  // Status
  liveStatus: string;
  fichaStatus: string;
  stopCode: string | null;
  stopDescription: string | null;
  /** Objeto resolvido com estado semantico da parada (SEM_PARADA_ATIVA, AGUARDANDO_APONTAMENTO, PARADA_APONTADA, PARADA_INCONSISTENTE). */
  stop: ResolvedStop;
  inconsistencies: string[];
  hasInconsistency: boolean;
  // GPS
  latitude: number | null;
  longitude: number | null;
  lastGpsAt: string | null;
  // Sincronizacao
  lastHeartbeatAt: string | null;
  updatedAt: string | null;
  // Origem dos dados
  dataSource: 'LIVE_ONLY' | 'FICHA_ONLY' | 'LIVE+FICHA';
}

export interface ActiveOperationsKpis {
  totalAtivas: number;
  frotasEmOperacao: number;
  operadoresAtivos: number;
  paradas: number;
  offlineOuSemSinal: number;
  inconsistencias: number;
  totalFrota: number;
  ultimaSincronizacao: string | null;
}

export interface ActiveOperationsResponse {
  date: string;
  items: ActiveOperationItem[];
  kpis: ActiveOperationsKpis;
  generatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Prioridade para ordenacao: operacoes ativas primeiro, offline/sem jornada por ultimo */
const STATUS_PRIORITY: Record<string, number> = {
  EM_ANDAMENTO:      0,
  OPERANDO:          0,
  ONLINE:            1,
  PARADO:            2,
  AGUARDANDO_PARADA: 2,
  PARADA_APONTADA:   2,
  ABASTECENDO:       3,
  FINALIZADO:        4,
  OFFLINE:           5,
  SEM_SINAL:         5,
  SEM_JORNADA:       6,
};

function statusPriority(s: string): number {
  return STATUS_PRIORITY[s] ?? 99;
}

function str(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

/** Constroi item a partir da ficha + live-state overlay */
function buildItem(
  tenantId: string,
  date: string,
  ficha: FichaDiaria,
  live: EquipmentLiveState | undefined,
  allEvents: ReturnType<typeof ServerStorage.getEvents>,
  catalog: { code: string; description: string }[],
): ActiveOperationItem {
  // ── overlay / ficha status ─────────────────────────────────────────────────
  const overlay = FichaStore.get(tenantId, ficha.fleetCode, date);
  const blockingReasons = getEffectiveBlockingInconsistencies(ficha.inconsistencies, overlay);
  const fichaStatus = deriveFichaStatus({
    computedStatus:           ficha.status,
    overlay,
    isDayOpen:                ficha.isDayOpen,
    hasBlockingInconsistency: blockingReasons.length > 0,
  });

  // ── live-state fields (real-time) ─────────────────────────────────────────
  const liveStatus   = live?.status ?? 'OFFLINE';
  const journeyId    = str(live?.journeyId)   ?? null;
  const lastGpsAt    = str(live?.lastGpsAt)   ?? null;
  const lastHbAt     = str(live?.lastHeartbeatAt) ?? null;
  const updatedAt    = lastHbAt ?? lastGpsAt;

  // GPS: usa live, descarta (0,0)
  const rawLat = num(live?.latitude);
  const rawLon = num(live?.longitude);
  const hasValidGps =
    rawLat !== null && rawLon !== null &&
    !(rawLat === 0 && rawLon === 0) &&
    rawLat > -90 && rawLat < 90 && rawLon > -180 && rawLon < 180;
  const latitude  = hasValidGps ? rawLat : null;
  const longitude = hasValidGps ? rawLon : null;

  // Horimetro: live vence para o atual, ficha para o inicial
  const hourmeterCurrent = num(live?.hourmeterCurrent) ?? num(ficha.hourmeterCurrent);
  const hourmeterStart   = num(ficha.hourmeterStart);

  // ── operacional: live vence se preenchido, ficha como fallback ─────────────
  const operatorName         = str(live?.operatorName)        ?? str(ficha.operatorName);
  const operatorRegistration = str(live?.operatorRegistration ?? live?.registration) ?? str(ficha.operatorRegistration);
  const operationCode        = str(live?.operationCode)       ?? str(ficha.operationCode);
  const operationName        = str(live?.operationName ?? live?.currentOperation) ?? str(ficha.operationName);
  const workOrderNumber      = str(live?.workOrder)           ?? str(ficha.workOrderNumber);
  const costCenterName       = str(live?.costCenterName ?? live?.costCenter) ?? str(ficha.costCenterName);
  const implementCode        = str(live?.implementCode)       ?? str(ficha.implementCode);
  const implementName        = str(live?.implementName)       ?? str(ficha.implementName);

  // Stop fields: resolve via prioridade total (evento -> live-state -> catalogo)
  const stopResolved    = live ? resolveStop(live, allEvents, catalog) : { code: null, description: null };
  const stopCode        = stopResolved.code;
  const stopDescription = stopResolved.description;
  // Objeto resolvido com estado semantico — mesmo resolver aprovado no Mapa Operacional
  const equipmentIdForStop = str(live?.equipmentId) ?? ficha.equipmentId;
  const stop = resolveStopFull(equipmentIdForStop, liveStatus, live, allEvents, catalog);

  const inconsistencies = ficha.inconsistencies ?? [];
  const hasInconsistency = inconsistencies.length > 0;

  const dataSource: ActiveOperationItem['dataSource'] =
    live ? 'LIVE+FICHA' : 'FICHA_ONLY';

  return {
    fleetCode:          ficha.fleetCode,
    equipmentId:        ficha.equipmentId,
    tenantId,
    date,
    journeyId,
    operatorName,
    operatorRegistration,
    operationCode,
    operationName,
    workOrderNumber,
    costCenterName,
    implementCode,
    implementName,
    hourmeterCurrent,
    hourmeterStart,
    liveStatus,
    fichaStatus,
    stopCode,
    stopDescription,
    stop,
    inconsistencies,
    hasInconsistency,
    latitude,
    longitude,
    lastGpsAt,
    lastHeartbeatAt: lastHbAt,
    updatedAt,
    dataSource,
  };
}

/** Calcula a data operacional atual em BRT (UTC-3) sem usar new Date(dateString) */
function todayBRT(): string {
  const offsetMs = 3 * 60 * 60 * 1000;
  return new Date(Date.now() - offsetMs).toISOString().slice(0, 10);
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;
    const { tenantId } = tenant;

    const permCheck = requirePermission(req, 'operacoes', 'visualizar', tenantId);
    if (permCheck) return permCheck;

    const sp     = req.nextUrl.searchParams;
    const date   = sp.get('date')?.trim() || todayBRT();
    const onlyActive = sp.get('onlyActive') === 'true';

    // ── fontes de dados ────────────────────────────────────────────────────────
    const liveFleet  = ServerStorage.getLiveFleet(tenantId);
    const fichas     = buildDailySheetList({ tenantId, date });
    const allEvents  = ServerStorage.getEvents(tenantId);
    const catalog    = (
      CadastroStorage.getAll(tenantId, 'paradas') as { code?: string; description?: string }[]
    )
      .filter((p) => p.code && p.description)
      .map((p) => ({ code: p.code as string, description: p.description as string }));

    // Indice: fleetCode -> live-state
    const liveByFleet = new Map<string, EquipmentLiveState>();
    for (const ls of liveFleet) {
      liveByFleet.set(ls.fleetCode, ls);
    }

    // Indice: fleetCode -> ficha
    const fichaByFleet = new Map<string, FichaDiaria>();
    for (const f of fichas) {
      fichaByFleet.set(f.fleetCode, f);
    }

    // ── merge: ficha como base, live-state como overlay ────────────────────────
    const items: ActiveOperationItem[] = [];

    for (const ficha of fichas) {
      const live = liveByFleet.get(ficha.fleetCode);
      const item = buildItem(tenantId, date, ficha, live, allEvents, catalog);
      items.push(item);
    }

    // Maquinas no live-state sem ficha (hoje sem eventos ainda)
    for (const live of liveFleet) {
      if (!fichaByFleet.has(live.fleetCode)) {
        const liveOnlyStop = resolveStop(live, allEvents, catalog);
        const liveOnlyStopFull = resolveStopFull(str(live.equipmentId), live.status, live, allEvents, catalog);
        const item: ActiveOperationItem = {
          fleetCode:          live.fleetCode,
          equipmentId:        live.equipmentId,
          tenantId,
          date,
          journeyId:          str(live.journeyId),
          operatorName:       str(live.operatorName ?? live.currentOperator),
          operatorRegistration: str(live.operatorRegistration ?? live.registration),
          operationCode:      str(live.operationCode),
          operationName:      str(live.operationName ?? live.currentOperation),
          workOrderNumber:    str(live.workOrder),
          costCenterName:     str(live.costCenterName ?? live.costCenter),
          implementCode:      str(live.implementCode),
          implementName:      str(live.implementName),
          hourmeterCurrent:   num(live.hourmeterCurrent),
          hourmeterStart:     num(live.hourmeterStart),
          liveStatus:         live.status,
          fichaStatus:        'SEM_JORNADA',
          stopCode:           liveOnlyStop.code,
          stopDescription:    liveOnlyStop.description,
          stop:               liveOnlyStopFull,
          inconsistencies:    [],
          hasInconsistency:   false,
          latitude:           null,
          longitude:          null,
          lastGpsAt:          str(live.lastGpsAt),
          lastHeartbeatAt:    str(live.lastHeartbeatAt),
          updatedAt:          str(live.lastHeartbeatAt) ?? str(live.lastGpsAt),
          dataSource:         'LIVE_ONLY',
        };

        // GPS valido
        const rawLat = num(live.latitude);
        const rawLon = num(live.longitude);
        const ok = rawLat !== null && rawLon !== null &&
          !(rawLat === 0 && rawLon === 0) &&
          rawLat > -90 && rawLat < 90 && rawLon > -180 && rawLon < 180;
        if (ok) {
          item.latitude  = rawLat;
          item.longitude = rawLon;
        }

        items.push(item);
      }
    }

    // ── filtro onlyActive ──────────────────────────────────────────────────────
    const filtered = onlyActive
      ? items.filter(i =>
          i.liveStatus !== 'OFFLINE' &&
          i.liveStatus !== 'FINALIZADO' &&
          i.fichaStatus !== 'SEM_JORNADA'
        )
      : items;

    // ── ordenacao ──────────────────────────────────────────────────────────────
    filtered.sort((a, b) => {
      const pa = statusPriority(a.liveStatus);
      const pb = statusPriority(b.liveStatus);
      if (pa !== pb) return pa - pb;
      // inconsistentes antes dos normais no mesmo nivel
      if (a.hasInconsistency !== b.hasInconsistency) return a.hasInconsistency ? -1 : 1;
      // mais recente primeiro
      const ta = a.updatedAt ?? '';
      const tb = b.updatedAt ?? '';
      if (ta !== tb) return tb.localeCompare(ta);
      return a.fleetCode.localeCompare(b.fleetCode);
    });

    // ── KPIs ──────────────────────────────────────────────────────────────────
    const allItems = items;
    const frotasEmOperacao = allItems.filter(i =>
      i.liveStatus === 'OPERANDO' || i.liveStatus === 'ONLINE' || i.liveStatus === 'EM_ANDAMENTO'
    ).length;
    const uniqueOperators = new Set(allItems.map(i => i.operatorRegistration).filter(Boolean));
    const paradas = allItems.filter(i =>
      i.liveStatus === 'PARADO' ||
      i.liveStatus === 'AGUARDANDO_PARADA' ||
      i.liveStatus === 'PARADA_APONTADA'
    ).length;
    const offline = allItems.filter(i =>
      i.liveStatus === 'OFFLINE' || i.liveStatus === 'SEM_SINAL'
    ).length;
    const inconsistencias = allItems.filter(i => i.hasInconsistency).length;

    const syncTimestamps = allItems
      .map(i => i.updatedAt)
      .filter((s): s is string => !!s)
      .sort();
    const ultimaSincronizacao = syncTimestamps.length > 0
      ? syncTimestamps[syncTimestamps.length - 1]
      : null;

    const kpis: ActiveOperationsKpis = {
      totalAtivas:        filtered.length,
      frotasEmOperacao,
      operadoresAtivos:   uniqueOperators.size,
      paradas,
      offlineOuSemSinal:  offline,
      inconsistencias,
      totalFrota:         liveFleet.length,
      ultimaSincronizacao,
    };

    const response: ActiveOperationsResponse = {
      date,
      items: filtered,
      kpis,
      generatedAt: new Date().toISOString(),
    };

    console.info(
      '[operacoes/ativas] tenant=' + tenantId +
      ' date=' + date +
      ' fichas=' + fichas.length +
      ' live=' + liveFleet.length +
      ' items=' + filtered.length,
    );

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[operacoes/ativas] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
