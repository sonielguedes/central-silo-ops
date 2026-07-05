import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { requireTenant } from '@/lib/auth/api-guard';
import { resolveStop } from '@/lib/stop-resolver';
import { resolveEquipmentIconTypeFromContext } from '@/lib/equipment-icon-resolution';
import type { EquipmentLiveState } from '@/lib/types';

export const dynamic = 'force-dynamic';

const WORKING_STATUSES = new Set(['OPERANDO', 'ONLINE', 'EM_ANDAMENTO']);
const STOP_PENDING_STATUSES = new Set(['PARADO', 'AGUARDANDO_PARADA']);

export type StopState =
  | 'SEM_PARADA_ATIVA'
  | 'AGUARDANDO_APONTAMENTO'
  | 'PARADA_APONTADA'
  | 'PARADA_INCONSISTENTE';

export interface ResolvedStopForMap {
  state: StopState;
  label: string;
  code: string | null;
  reason: string | null;
  hasActiveStop: boolean;
  hasStopReason: boolean;
  startedAt: string | null;
  durationSeconds: number | null;
  inconsistency: string | null;
}

function buildStopState(
  status: string,
  stop: { code: string | null; description: string | null },
  liveState: EquipmentLiveState,
): ResolvedStopForMap {
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

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeForMap(
  s: EquipmentLiveState,
  allEvents: ReturnType<typeof ServerStorage.getEvents>,
  catalog: { code: string; description: string }[],
  equipmentCatalog: Array<Record<string, unknown>>,
  typeCatalog: Array<Record<string, unknown>>,
  modelCatalog: Array<Record<string, unknown>>,
  groupCatalog: Array<Record<string, unknown>>,
) {
  const speedKmh =
    s.speedKmh ??
    (s.speed != null ? Math.round(s.speed * 3.6 * 10) / 10 : undefined);

  const hasValidGps =
    s.latitude != null &&
    s.longitude != null &&
    !(s.latitude === 0 && s.longitude === 0) &&
    s.latitude > -90 &&
    s.latitude < 90 &&
    s.longitude > -180 &&
    s.longitude < 180;

  const resolvedStop = resolveStop(s, allEvents, catalog);
  const stop = buildStopState(s.status, resolvedStop, s);

  const equipmentRecord =
    equipmentCatalog.find((item) => String(item.id ?? '') === String(s.equipmentId ?? '')) ||
    equipmentCatalog.find((item) => String(item.code ?? '') === String(s.fleetCode ?? ''));
  const typeRecord =
    equipmentRecord
      ? typeCatalog.find((item) =>
          String(item.id ?? '') === String(equipmentRecord.typeId ?? '') ||
          String(item.code ?? '') === String(equipmentRecord.typeCode ?? '') ||
          String(item.name ?? '') === String(equipmentRecord.type ?? ''),
        )
      : undefined;
  const modelRecord =
    equipmentRecord
      ? modelCatalog.find((item) =>
          String(item.id ?? '') === String(equipmentRecord.modelId ?? '') ||
          String(item.name ?? '') === String(equipmentRecord.model ?? '') ||
          String(item.model ?? '') === String(equipmentRecord.model ?? ''),
        )
      : undefined;
  const groupRecord =
    equipmentRecord
      ? groupCatalog.find((item) =>
          String(item.id ?? '') === String(equipmentRecord.groupId ?? '') ||
          String(item.name ?? '') === String(equipmentRecord.group ?? ''),
        )
      : undefined;

  const resolvedEquipmentType =
    normalizeText(typeRecord?.name ?? typeRecord?.code ?? equipmentRecord?.type ?? modelRecord?.operationalType) || undefined;
  const resolvedEquipmentModel =
    normalizeText(modelRecord?.name ?? modelRecord?.model ?? equipmentRecord?.model ?? equipmentRecord?.name ?? s.implementName) || undefined;
  const resolvedEquipmentCategory =
    normalizeText(modelRecord?.category ?? typeRecord?.category ?? equipmentRecord?.category ?? groupRecord?.name) || undefined;
  const resolvedImplementName =
    normalizeText(s.implementName ?? equipmentRecord?.implementName ?? equipmentRecord?.implementCode) || undefined;
  const resolvedImplementCode =
    normalizeText(s.implementCode ?? equipmentRecord?.implementCode) || undefined;

  const resolvedIconType = resolveEquipmentIconTypeFromContext(
    {
      type: resolvedEquipmentType,
      model: resolvedEquipmentModel,
      category: resolvedEquipmentCategory,
      metadata: {
        equipmentType: normalizeText(modelRecord?.iconType ?? typeRecord?.iconType ?? equipmentRecord?.iconType) || null,
      },
      name: equipmentRecord ? normalizeText(equipmentRecord.name) : undefined,
      brand: equipmentRecord ? normalizeText(equipmentRecord.brand ?? equipmentRecord.manufacturer) : undefined,
      code: s.fleetCode,
      iconType: normalizeText((s as unknown as Record<string, unknown>).iconType) || null,
      implementName: resolvedImplementName,
      implementCode: resolvedImplementCode,
      operation: s.operationName ?? null,
      currentOperation: s.currentOperation ?? null,
    },
    {
      iconType: normalizeText(equipmentRecord?.iconType ?? modelRecord?.iconType ?? typeRecord?.iconType ?? groupRecord?.iconType) || null,
      type: resolvedEquipmentType,
      name: equipmentRecord ? normalizeText(equipmentRecord.name) : undefined,
      model: resolvedEquipmentModel,
      category: resolvedEquipmentCategory,
      brand: equipmentRecord ? normalizeText(equipmentRecord.brand ?? equipmentRecord.manufacturer) : undefined,
      manufacturer: equipmentRecord ? normalizeText(equipmentRecord.manufacturer ?? equipmentRecord.brand) : undefined,
    },
  );

  const extS = s as typeof s & { isOnline?: boolean; communicationStatus?: string; operationalStatus?: string; hasRecentGps?: boolean; hasRecentHeartbeat?: boolean };
  const RICH_OP_API = new Set(['OPERANDO', 'PARADO', 'AGUARDANDO_PARADA', 'PARADA_APONTADA', 'FINALIZADO']);
  const isOnlineApi           = extS.isOnline           ?? (s.status !== 'OFFLINE');
  const communicationStatusApi = extS.communicationStatus ?? (isOnlineApi ? 'ONLINE' : 'OFFLINE');
  const operationalStatusApi   = extS.operationalStatus   ?? s.status;
  const displayStatusApi       = RICH_OP_API.has(operationalStatusApi) ? operationalStatusApi : communicationStatusApi;
  const hasRecentGpsApi        = extS.hasRecentGps        ?? false;
  const hasRecentHeartbeatApi  = extS.hasRecentHeartbeat  ?? false;

  return {
    ...s,
    equipmentCode: s.fleetCode,
    speedKmh,
    horimetro: s.hourmeterCurrent,
    rpm: s.rpm,
    latitude: hasValidGps ? s.latitude : undefined,
    longitude: hasValidGps ? s.longitude : undefined,
    stopCode: stop.code,
    stopDescription: stop.reason,
    stopReason: stop.reason,
    stopSource: resolvedStop.source,
    stop,
    equipmentType: resolvedEquipmentType,
    equipmentModel: resolvedEquipmentModel,
    equipmentCategory: resolvedEquipmentCategory,
    implementName: resolvedImplementName,
    implementCode: resolvedImplementCode,
    iconType: resolvedIconType,
    isOnline:            isOnlineApi,
    communicationStatus: communicationStatusApi,
    operationalStatus:   operationalStatusApi,
    displayStatus:       displayStatusApi,
    hasRecentGps:        hasRecentGpsApi,
    hasRecentHeartbeat:  hasRecentHeartbeatApi,
  };
}

export async function GET(req: NextRequest) {
  try {
    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;

    const { tenantId } = tenant;
    const liveFleet = ServerStorage.getLiveFleet(tenantId);
    const equipmentCatalog = CadastroStorage.getAllRaw(tenantId, 'equipamentos') as Array<Record<string, unknown>>;
    const typeCatalog = CadastroStorage.getAllRaw(tenantId, 'tipos') as Array<Record<string, unknown>>;
    const modelCatalog = CadastroStorage.getAllRaw(tenantId, 'modelos') as Array<Record<string, unknown>>;
    const groupCatalog = CadastroStorage.getAllRaw(tenantId, 'grupos') as Array<Record<string, unknown>>;

    const allEvents = ServerStorage.getEvents(tenantId);
    const catalog = (
      CadastroStorage.getAll(tenantId, 'paradas') as { code?: string; description?: string }[]
    )
      .filter((p) => p.code && p.description)
      .map((p) => ({ code: p.code as string, description: p.description as string }));

    const response = NextResponse.json(
      liveFleet.map((s) => normalizeForMap(s, allEvents, catalog, equipmentCatalog, typeCatalog, modelCatalog, groupCatalog)),
    );
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    return response;
  } catch (error) {
    console.error('[api/equipamentos/status] failed to fetch live state', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
