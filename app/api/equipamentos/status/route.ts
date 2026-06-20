import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { requireTenant } from '@/lib/auth/api-guard';
import { resolveStop } from '@/lib/stop-resolver';
import type { EquipmentLiveState } from '@/lib/types';

export const dynamic = 'force-dynamic';

// ── Stop state machine ────────────────────────────────────────────────────────

const WORKING_STATUSES = new Set(['OPERANDO', 'ONLINE', 'EM_ANDAMENTO']);
const STOP_PENDING_STATUSES = new Set(['PARADO', 'AGUARDANDO_PARADA']);

export type StopState =
  | 'SEM_PARADA_ATIVA'
  | 'AGUARDANDO_APONTAMENTO'
  | 'PARADA_APONTADA'
  | 'PARADA_INCONSISTENTE';

export interface ResolvedStopForMap {
  state: StopState;
  /** Label legivel para exibicao no card/popup do mapa. */
  label: string;
  code: string | null;
  reason: string | null;
  hasActiveStop: boolean;
  hasStopReason: boolean;
  startedAt: string | null;
  durationSeconds: number | null;
  inconsistency: string | null;
}

/**
 * Constroi o estado semantico de parada baseado no status do equipamento e
 * nos dados ja resolvidos pelo resolveStop(). Nunca retorna "NÃO INFORMADO" --
 * cada estado tem uma label explicita.
 */
function buildStopState(
  status: string,
  stop: { code: string | null; description: string | null },
  liveState: EquipmentLiveState,
): ResolvedStopForMap {
  // Em operacao: sem parada ativa
  if (WORKING_STATUSES.has(status)) {
    return {
      state: 'SEM_PARADA_ATIVA',
      label: 'Sem parada ativa',
      code: null,
      reason: null,
      hasActiveStop: false,
      hasStopReason: false,
      startedAt: null,
      durationSeconds: null,
      inconsistency: null,
    };
  }

  // Tem codigo resolvido -> parada apontada
  if (stop.code != null) {
    return {
      state: 'PARADA_APONTADA',
      label: stop.description ?? stop.code,
      code: stop.code,
      reason: stop.description,
      hasActiveStop: true,
      hasStopReason: stop.description != null,
      startedAt: liveState.stopStartedAt ?? null,
      durationSeconds: liveState.stopDurationSeconds ?? null,
      inconsistency: null,
    };
  }

  // Status indica parada apontada mas sem codigo/motivo -> inconsistente
  if (status === 'PARADA_APONTADA') {
    return {
      state: 'PARADA_INCONSISTENTE',
      label: 'Parada inconsistente',
      code: null,
      reason: null,
      hasActiveStop: true,
      hasStopReason: false,
      startedAt: null,
      durationSeconds: null,
      inconsistency: 'Status indica parada apontada mas falta codigo ou motivo',
    };
  }

  // Maquina parada aguardando operador apontar motivo
  if (STOP_PENDING_STATUSES.has(status)) {
    return {
      state: 'AGUARDANDO_APONTAMENTO',
      label: 'Aguardando apontamento de parada',
      code: null,
      reason: null,
      hasActiveStop: true,
      hasStopReason: false,
      startedAt: liveState.stopStartedAt ?? null,
      durationSeconds: liveState.stopDurationSeconds ?? null,
      inconsistency: null,
    };
  }

  // OFFLINE, FINALIZADO e demais estados
  return {
    state: 'SEM_PARADA_ATIVA',
    label: 'Sem parada ativa',
    code: null,
    reason: null,
    hasActiveStop: false,
    hasStopReason: false,
    startedAt: null,
    durationSeconds: null,
    inconsistency: null,
  };
}

/**
 * Normalizes a liveFleet item to guarantee:
 * - speedKmh: calculated from speed (m/s) when not sent by APK
 * - horimetro: canonical alias for hourmeterCurrent for the Operational Map
 * - rpm: passed through directly (when available via CAN/APK)
 * - Invalid GPS (0,0 or out of range) is discarded before reaching the map
 * - stop: structured object with semantic state (SEM_PARADA_ATIVA, AGUARDANDO_APONTAMENTO,
 *         PARADA_APONTADA, PARADA_INCONSISTENTE) -- never returns "NÃO INFORMADO"
 * - stopCode / stopDescription: flat fields kept for backward compat
 */
function normalizeForMap(
  s: EquipmentLiveState,
  allEvents: ReturnType<typeof ServerStorage.getEvents>,
  catalog: { code: string; description: string }[],
) {
  // Calculate speedKmh if APK sent speed in m/s and did not send speedKmh
  const speedKmh =
    s.speedKmh ??
    (s.speed != null ? Math.round(s.speed * 3.6 * 10) / 10 : undefined);

  // Ensure invalid coordinates do not reach the map
  const hasValidGps =
    s.latitude != null &&
    s.longitude != null &&
    !(s.latitude === 0 && s.longitude === 0) &&
    s.latitude > -90 &&
    s.latitude < 90 &&
    s.longitude > -180 &&
    s.longitude < 180;

  // Resolve stop via full priority chain (event -> live-state -> catalog)
  const resolvedStop = resolveStop(s, allEvents, catalog);

  // Build semantic stop state (4-state machine, no "NÃO INFORMADO")
  const stop = buildStopState(s.status, resolvedStop, s);

  return {
    ...s,
    // Extra fields for the Operational Map
    equipmentCode: s.fleetCode,
    speedKmh,
    horimetro: s.hourmeterCurrent,
    rpm: s.rpm,
    // GPS: clear if invalid so the map shows the alert instead of pinning at 0,0
    latitude: hasValidGps ? s.latitude : undefined,
    longitude: hasValidGps ? s.longitude : undefined,
    // Flat stop fields (backward compat -- use stop.* for new code)
    stopCode: stop.code,
    stopDescription: stop.reason,
    stopReason: stop.reason,
    stopSource: resolvedStop.source,
    // Structured stop state for the map card/popup
    stop,
  };
}

export async function GET(req: NextRequest) {
  try {
    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;

    const { tenantId } = tenant;
    const liveFleet = ServerStorage.getLiveFleet(tenantId);

    // Load events and catalog once per request (not per machine)
    const allEvents = ServerStorage.getEvents(tenantId);
    const catalog = (
      CadastroStorage.getAll(tenantId, 'paradas') as { code?: string; description?: string }[]
    )
      .filter((p) => p.code && p.description)
      .map((p) => ({ code: p.code as string, description: p.description as string }));

    const response = NextResponse.json(liveFleet.map((s) => normalizeForMap(s, allEvents, catalog)));
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  } catch (error) {
    console.error('[api/equipamentos/status] failed to fetch live state', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
