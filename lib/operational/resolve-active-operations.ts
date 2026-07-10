/**
 * lib/operational/resolve-active-operations.ts
 *
 * Resolvedor operacional centralizado — monta a "verdade operacional" da frota
 * combinando, em ordem de prioridade:
 *
 *   1. live-state (dados em tempo real do APK)
 *   2. eventos mobile mais recentes da jornada/frota
 *   3. ficha do operador (dados do dia calculados pelos daily-sheet-builder)
 *   4. cadastros mestres (operadores, implementos, centros de custo, paradas)
 *
 * REGRAS CRITICAS:
 *   - Matricula SEMPRE string (nunca Number("00125") = 125).
 *   - Data operacional SEMPRE string "YYYY-MM-DD". Nunca new Date("YYYY-MM-DD").
 *   - GPS invalido (0,0 ou fora de range) descartado antes de retornar.
 *   - Status desconhecido retornado sem quebrar.
 *   - Parada resolvida pela cadeia: evento > live-state > catalogo > NONE.
 *   - Sem dados fake, sem mock estatico.
 *
 * Este modulo e pura logica (sem IO) — as dependencias sao injetadas pelo chamador.
 */

import type { EquipmentLiveState } from '@/lib/types';
import type { MobileEvent } from '@/lib/server-storage';

// ── Input types ───────────────────────────────────────────────────────────────

/** Entrada minima de uma ficha do dia (subset usado pelo resolvedor). */
export interface OperatorSheetInput {
  fleetCode: string;
  equipmentId?: string | null;
  operatorRegistration?: string | null;
  operatorName?: string | null;
  operationCode?: string | null;
  operationName?: string | null;
  implementCode?: string | null;
  implementName?: string | null;
  workOrderNumber?: string | null;
  costCenterCode?: string | null;
  costCenterName?: string | null;
  hourmeterStart?: number | null;
  hourmeterCurrent?: number | null;
  hourmeterEnd?: number | null;
  journeyId?: string | null;
}

/** Catalogo de paradas — subset do StopReason do cadastro. */
export interface StopCatalogItem {
  code: string;
  description: string;
}

/** Catalogo de operadores — subset do Operator do cadastro. */
export interface OperatorCatalogItem {
  registration: string;
  name: string;
}

/** Catalogo de implementos — subset do Implement do cadastro. */
export interface ImplementCatalogItem {
  code: string;
  name: string;
}

/** Catalogo de centros de custo. */
export interface CostCenterCatalogItem {
  code: string;
  name: string;
}

/** Catalogo de equipamentos — subset do Equipment do cadastro. */
export interface EquipmentCatalogItem {
  code: string;
  name?: string | null;
  type?: string | null;
  brand?: string | null;
}

/** Input completo para o resolvedor. */
export interface ResolveActiveOperationsInput {
  tenantId: string;
  /** Data operacional no formato YYYY-MM-DD. Nunca converter via new Date(). */
  dataOperacional: string;
  liveFleet: EquipmentLiveState[];
  mobileEvents: MobileEvent[];
  operatorSheets: OperatorSheetInput[];
  catalogs: {
    paradas: StopCatalogItem[];
    operadores: OperatorCatalogItem[];
    implementos: ImplementCatalogItem[];
    centrosCusto: CostCenterCatalogItem[];
    equipamentos: EquipmentCatalogItem[];
  };
}

// ── Output types ──────────────────────────────────────────────────────────────

export type StopState =
  | 'SEM_PARADA_ATIVA'
  | 'AGUARDANDO_APONTAMENTO'
  | 'PARADA_APONTADA'
  | 'PARADA_INCONSISTENTE';

export type StopSource = 'EVENT' | 'LIVE_STATE' | 'TRAIL' | 'CATALOG' | 'INFERRED' | 'NONE';

export interface ResolvedStop {
  state: StopState;
  code: string | null;
  reason: string | null;
  startedAt: string | null;
  durationSeconds: number | null;
  source: StopSource;
  inconsistency: string | null;
}

export interface ResolvedActiveOperation {
  tenantId: string;
  fleetCode: string;
  equipmentId: string | null;
  equipmentName: string | null;
  equipmentType: string | null;

  operatorRegistration: string | null;
  operatorName: string | null;

  journeyId: string | null;
  workOrderNumber: string | null;

  operationCode: string | null;
  operationName: string | null;

  costCenterCode: string | null;
  costCenterName: string | null;

  implementCode: string | null;
  implementName: string | null;

  horimeter: {
    initial: number | null;
    current: number | null;
    final: number | null;
    total: number | null;
  };

  telemetry: {
    latitude: number | null;
    longitude: number | null;
    speedKmh: number | null;
    rpm: number | null;
    accuracy: number | null;
    lastGpsAt: string | null;
    lastHeartbeatAt: string | null;
  };

  operationalStatus: string;

  stop: ResolvedStop;

  dataOperacional: string;
  lastUpdatedAt: string | null;

  sources: {
    liveState: boolean;
    mobileEvents: boolean;
    trail: boolean;
    operatorSheet: boolean;
    catalogs: boolean;
  };

  inconsistencies: string[];
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function asStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function asNum(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return null;
}

/** Status operacionais que indicam maquina em movimento/trabalho. */
const WORKING_STATUSES = new Set([
  'TRABALHANDO', 'OPERANDO', 'EM_MOVIMENTO', 'EM_ANDAMENTO', 'ONLINE',
]);

/** Status operacionais que indicam parada. */
const STOPPED_STATUSES = new Set([
  'PARADO', 'AGUARDANDO_PARADA', 'PARADA_APONTADA',
]);

/** Normaliza variantes de status enviadas pelo APK para o valor canonico. */
function normalizeStatus(raw: string | undefined | null): string {
  if (!raw) return 'OFFLINE';
  const s = raw.toUpperCase().trim();
  if (s === 'TRABALHANDO' || s === 'EM_ANDAMENTO') return 'OPERANDO';
  if (s === 'EM_MOVIMENTO') return 'ONLINE';
  return s;
}

/** Descarta GPS invalido (0,0 ou fora de range). */
function validGps(lat: unknown, lon: unknown): { lat: number; lon: number } | null {
  const la = asNum(lat);
  const lo = asNum(lon);
  if (la === null || lo === null) return null;
  if (la === 0 && lo === 0) return null;
  if (la < -90 || la > 90 || lo < -180 || lo > 180) return null;
  return { lat: la, lon: lo };
}

/**
 * Extrai o codigo de parada de um payload de evento mobile.
 * O APK pode enviar qualquer das variantes listadas no spec.
 */
function eventStopCode(p: Record<string, unknown>): string | null {
  return (
    asStr(p.stopCode) ??
    asStr(p.stopReasonCode) ??
    asStr(p.statusCode) ??
    asStr(p.eventStatusCode) ??
    asStr(p.reasonCode) ??
    asStr(p.codigoParada) ??
    asStr(p.codigoMotivo) ??
    asStr(p.motivoCodigo) ??
    asStr(p.code)
  );
}

/**
 * Extrai a descricao de parada de um payload de evento mobile.
 * stopReasonDescription e o campo canonico do APK SILO OPS.
 */
function eventStopDesc(p: Record<string, unknown>): string | null {
  return (
    asStr(p.stopReasonDescription) ??
    asStr(p.stopReasonName) ??
    asStr(p.stopDescription) ??
    asStr(p.stopReason) ??
    asStr(p.reasonDescription) ??
    asStr(p.motivo) ??
    asStr(p.descricaoMotivo) ??
    asStr(p.descricaoParada) ??
    asStr(p.statusDescription) ??
    asStr(p.description) ??
    asStr(p.reason)
  );
}

/** Extrai timestamp de inicio de parada do payload. */
function eventStopStartedAt(p: Record<string, unknown>): string | null {
  return (
    asStr(p.stopStartedAt) ??
    asStr(p.paradaIniciadaEm) ??
    asStr(p.startedAt)
  );
}

/** Lookup de operador pelo numero de matricula (preserva zeros a esquerda). */
function lookupOperatorName(
  registration: string | null,
  catalog: OperatorCatalogItem[],
): string | null {
  if (!registration) return null;
  const found = catalog.find((o) => o.registration === registration);
  return asStr(found?.name);
}

/** Lookup de descricao no catalogo de paradas pelo codigo. */
function lookupStopDesc(code: string | null, catalog: StopCatalogItem[]): string | null {
  if (!code) return null;
  const found = catalog.find((p) => p.code === code);
  return asStr(found?.description);
}

/** Lookup de nome do implemento pelo codigo. */
function lookupImplementName(code: string | null, catalog: ImplementCatalogItem[]): string | null {
  if (!code) return null;
  const found = catalog.find((i) => i.code === code);
  return asStr(found?.name);
}

/** Lookup de nome do centro de custo pelo codigo. */
function lookupCostCenterName(code: string | null, catalog: CostCenterCatalogItem[]): string | null {
  if (!code) return null;
  const found = catalog.find((c) => c.code === code);
  return asStr(found?.name);
}

/** Lookup de nome/tipo de equipamento pelo codigo de frota. */
function lookupEquipment(code: string, catalog: EquipmentCatalogItem[]): EquipmentCatalogItem | null {
  return catalog.find((e) => e.code === code) ?? null;
}

/**
 * Resolve os campos de parada com cadeia de prioridade:
 *   1. Evento PARADA/STOP_REASON mais recente para o equipamento
 *   2. Campos do live-state
 *   3. Lookup no catalogo pelo codigo
 *
 * Aplica as regras semanticas:
 *   - status PARADO/AGUARDANDO sem codigo -> AGUARDANDO_APONTAMENTO
 *   - status PARADA_APONTADA sem codigo   -> PARADA_INCONSISTENTE
 *   - status em trabalho                  -> SEM_PARADA_ATIVA
 *   - codigo + (desc ou catalogo)         -> PARADA_APONTADA
 *
 * Exportada para reutilizacao em /api/operacoes/ativas e outros modulos.
 */
export function resolveStopFull(
  equipmentId: string | null,
  liveStatus: string,
  live: EquipmentLiveState | undefined,
  events: MobileEvent[],
  catalog: StopCatalogItem[],
): ResolvedStop {
  // Eventos de parada para este equipamento, mais recente primeiro
  const stopEvents = events
    .filter(
      (e) =>
        e.equipmentId === equipmentId &&
        (e.type === 'PARADA' || e.type === 'STOP_REASON'),
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  let code: string | null = null;
  let desc: string | null = null;
  let startedAt: string | null = null;
  let durationSeconds: number | null = null;
  let source: StopSource = 'NONE';

  // Prioridade 1: evento mais recente
  for (const ev of stopEvents) {
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    const evCode = eventStopCode(p);
    const evDesc = eventStopDesc(p);
    if (evCode !== null || evDesc !== null) {
      code = evCode;
      desc = evDesc ?? (evCode ? lookupStopDesc(evCode, catalog) : null);
      startedAt = eventStopStartedAt(p);
      const dur = asNum(p.stopDurationSeconds ?? p.durationSeconds);
      durationSeconds = dur;
      source = 'EVENT';
      break;
    }
  }

  // Prioridade 2: live-state
  if (source === 'NONE') {
    const lsCode = asStr(live?.stopCode);
    const lsDesc = asStr(live?.stopReasonDescription) ?? asStr(live?.stopReasonName) ?? asStr(live?.stopDescription) ?? asStr(live?.stopReason);
    if (lsCode !== null || lsDesc !== null) {
      code = lsCode;
      desc = lsDesc ?? (lsCode ? lookupStopDesc(lsCode, catalog) : null);
      startedAt = asStr(live?.stopStartedAt);
      durationSeconds = asNum(live?.stopDurationSeconds);
      source = 'LIVE_STATE';
    } else if (lsCode) {
      // Prioridade 3: catalogo (temos code mas sem desc)
      const catDesc = lookupStopDesc(lsCode, catalog);
      if (catDesc) {
        code = lsCode;
        desc = catDesc;
        source = 'CATALOG';
      }
    }
  }

  // Determinar o estado semantico
  const isWorking = WORKING_STATUSES.has(liveStatus);
  const isStopped = STOPPED_STATUSES.has(liveStatus);
  const isStopAppointed = liveStatus === 'PARADA_APONTADA';

  let state: StopState;
  let inconsistency: string | null = null;

  if (isWorking) {
    state = 'SEM_PARADA_ATIVA';
    // Limpar codigo/desc — maquina em operacao nao tem parada ativa
    code = null;
    desc = null;
    source = 'NONE';
  } else if (code !== null) {
    state = 'PARADA_APONTADA';
  } else if (isStopAppointed) {
    state = 'PARADA_INCONSISTENTE';
    inconsistency = 'Parada apontada sem codigo/motivo informado.';
  } else if (isStopped) {
    state = 'AGUARDANDO_APONTAMENTO';
  } else {
    // OFFLINE, FINALIZADO, SEM_JORNADA, desconhecido — sem parada ativa
    state = 'SEM_PARADA_ATIVA';
    code = null;
    desc = null;
    source = 'NONE';
  }

  return {
    state,
    code,
    reason: desc,
    startedAt,
    durationSeconds,
    source,
    inconsistency,
  };
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Constroi o snapshot operacional de toda a frota do tenant.
 *
 * Combina live-state, eventos mobile, ficha operador e cadastros em uma
 * lista de ResolvedActiveOperation, uma por frota conhecida.
 *
 * Fontes de dados sao injetadas pelo chamador (sem IO interno).
 */
export function buildOperationalFleetSnapshot(
  input: ResolveActiveOperationsInput,
): ResolvedActiveOperation[] {
  const {
    tenantId,
    dataOperacional,
    liveFleet,
    mobileEvents,
    operatorSheets,
    catalogs,
  } = input;

  // Indice de fichas por fleetCode
  const sheetByFleet = new Map<string, OperatorSheetInput>();
  for (const s of operatorSheets) {
    sheetByFleet.set(s.fleetCode, s);
  }

  // Indice de live-state por fleetCode
  const liveByFleet = new Map<string, EquipmentLiveState>();
  for (const ls of liveFleet) {
    liveByFleet.set(ls.fleetCode, ls);
  }

  // Uniao de frotas conhecidas (live + fichas)
  const allFleetCodes = new Set<string>([
    ...liveFleet.map((l) => l.fleetCode),
    ...operatorSheets.map((s) => s.fleetCode),
  ]);

  const results: ResolvedActiveOperation[] = [];

  for (const fleetCode of allFleetCodes) {
    const live = liveByFleet.get(fleetCode);
    const sheet = sheetByFleet.get(fleetCode);

    const hasLive  = live !== undefined;
    const hasSheet = sheet !== undefined;

    // ── equipmentId ─────────────────────────────────────────────────────────
    const equipmentId =
      asStr(live?.equipmentId) ??
      asStr(sheet?.equipmentId) ??
      null;

    // ── catalogo de equipamentos ─────────────────────────────────────────────
    const eqCatalog = lookupEquipment(fleetCode, catalogs.equipamentos);
    const hasCatalogs = !!(eqCatalog || catalogs.operadores.length || catalogs.implementos.length);

    // ── status normalizado ───────────────────────────────────────────────────
    const rawStatus = live?.status;
    const operationalStatus = normalizeStatus(rawStatus);

    // ── operador ─────────────────────────────────────────────────────────────
    // Matricula: live-state vence, depois ficha. NUNCA converter para numero.
    const operatorRegistration =
      asStr(live?.operatorRegistration) ??
      asStr((live as unknown as Record<string, unknown>)?.registration) ??
      asStr(sheet?.operatorRegistration) ??
      null;

    // Nome: live-state > ficha > catalogo (lookup por matricula)
    const operatorNameFromLive =
      asStr(live?.operatorName) ??
      asStr((live as unknown as Record<string, unknown>)?.currentOperator);
    const operatorNameFromSheet = asStr(sheet?.operatorName);
    const operatorNameFromCatalog = lookupOperatorName(operatorRegistration, catalogs.operadores);
    const operatorName =
      operatorNameFromLive ?? operatorNameFromSheet ?? operatorNameFromCatalog;

    // ── jornada / O.S. ──────────────────────────────────────────────────────
    const journeyId = asStr(live?.journeyId) ?? asStr(sheet?.journeyId) ?? null;
    const workOrderNumber =
      asStr((live as unknown as Record<string, unknown>)?.workOrder) ??
      asStr(sheet?.workOrderNumber) ??
      null;

    // ── operacao ─────────────────────────────────────────────────────────────
    const operationCode =
      asStr(live?.operationCode) ?? asStr(sheet?.operationCode) ?? null;
    const operationName =
      asStr(live?.operationName) ??
      asStr((live as unknown as Record<string, unknown>)?.currentOperation) ??
      asStr(sheet?.operationName) ??
      null;

    // ── implemento ───────────────────────────────────────────────────────────
    const implementCode =
      asStr(live?.implementCode) ?? asStr(sheet?.implementCode) ?? null;
    const implementNameFromLive = asStr(live?.implementName);
    const implementNameFromSheet = asStr(sheet?.implementName);
    const implementNameFromCatalog = lookupImplementName(implementCode, catalogs.implementos);
    const implementName =
      implementNameFromLive ?? implementNameFromSheet ?? implementNameFromCatalog;

    // ── centro de custo ──────────────────────────────────────────────────────
    const costCenterCode =
      asStr((live as unknown as Record<string, unknown>)?.costCenterCode) ??
      asStr(sheet?.costCenterCode) ??
      null;
    const costCenterNameFromLive =
      asStr(live?.costCenterName) ??
      asStr((live as unknown as Record<string, unknown>)?.costCenter);
    const costCenterNameFromSheet = asStr(sheet?.costCenterName);
    const costCenterNameFromCatalog = lookupCostCenterName(costCenterCode, catalogs.centrosCusto);
    const costCenterName =
      costCenterNameFromLive ?? costCenterNameFromSheet ?? costCenterNameFromCatalog;

    // ── horimetro ────────────────────────────────────────────────────────────
    const hourmeterCurrent =
      asNum(live?.hourmeterCurrent) ??
      asNum((live as unknown as Record<string, unknown>)?.hourmeter) ??
      asNum(sheet?.hourmeterCurrent) ??
      null;
    const hourmeterInitial =
      asNum(live?.hourmeterStart) ??
      asNum((live as unknown as Record<string, unknown>)?.hourmeterInitial) ??
      asNum(sheet?.hourmeterStart) ??
      null;
    const hourmeterFinal =
      asNum((live as unknown as Record<string, unknown>)?.hourmeterEnd) ??
      asNum((live as unknown as Record<string, unknown>)?.hourmeterFinal) ??
      asNum(sheet?.hourmeterEnd) ??
      null;
    const hourmeterTotal =
      hourmeterFinal !== null && hourmeterInitial !== null && hourmeterFinal >= hourmeterInitial
        ? Math.round((hourmeterFinal - hourmeterInitial) * 1000) / 1000
        : null;

    // ── GPS / telemetria ─────────────────────────────────────────────────────
    const gps = validGps(live?.latitude, live?.longitude);
    const speedKmh =
      asNum(live?.speedKmh) ??
      (live?.speed != null ? Math.round((live.speed as number) * 3.6 * 10) / 10 : null);
    const rpm = asNum((live as unknown as Record<string, unknown>)?.rpm);
    const accuracy = asNum((live as unknown as Record<string, unknown>)?.accuracy);

    // ── parada ───────────────────────────────────────────────────────────────
    const stop = resolveStopFull(
      equipmentId,
      operationalStatus,
      live,
      mobileEvents,
      catalogs.paradas,
    );

    // ── inconsistencias ──────────────────────────────────────────────────────
    const inconsistencies: string[] = [];
    if (stop.inconsistency) inconsistencies.push(stop.inconsistency);

    // ── timestamps ───────────────────────────────────────────────────────────
    const lastUpdatedAt =
      asStr(live?.lastHeartbeatAt) ??
      asStr(live?.lastGpsAt) ??
      asStr(live?.updatedAt) ??
      null;

    // ── origem dos dados ─────────────────────────────────────────────────────
    const hasMobileEvents = mobileEvents.some((e) => e.equipmentId === equipmentId);

    results.push({
      tenantId,
      fleetCode,
      equipmentId,
      equipmentName: asStr(eqCatalog?.name) ?? asStr(eqCatalog?.brand),
      equipmentType: asStr(eqCatalog?.type),

      operatorRegistration,
      operatorName,

      journeyId,
      workOrderNumber,

      operationCode,
      operationName,

      costCenterCode,
      costCenterName,

      implementCode,
      implementName,

      horimeter: {
        initial: hourmeterInitial,
        current: hourmeterCurrent,
        final:   hourmeterFinal,
        total:   hourmeterTotal,
      },

      telemetry: {
        latitude:        gps?.lat ?? null,
        longitude:       gps?.lon ?? null,
        speedKmh:        speedKmh ?? null,
        rpm:             rpm ?? null,
        accuracy:        accuracy ?? null,
        lastGpsAt:       asStr(live?.lastGpsAt),
        lastHeartbeatAt: asStr(live?.lastHeartbeatAt),
      },

      operationalStatus,

      stop,

      // Data operacional preservada como string -- nunca new Date(dataOperacional)
      dataOperacional,
      lastUpdatedAt,

      sources: {
        liveState:    hasLive,
        mobileEvents: hasMobileEvents,
        trail:        false, // trail nao implementado nesta versao
        operatorSheet: hasSheet,
        catalogs:     hasCatalogs,
      },

      inconsistencies,
    });
  }

  return results;
}
