import type { EquipmentLiveState } from '@/lib/types';

export type DashboardFleetStatus = 'TRABALHANDO' | 'DESLOCANDO' | 'PARADA' | 'ALERTA' | 'OFFLINE';

export interface DashboardFleetCounts {
  total: number;
  TRABALHANDO: number;
  DESLOCANDO: number;
  PARADA: number;
  ALERTA: number;
  OFFLINE: number;
}

export interface DashboardFleetItem {
  equipmentId: string;
  fleetCode: string;
  status: DashboardFleetStatus;
  rawStatus: string;
  live?: EquipmentLiveState;
  catalog?: unknown;
}

type EquipmentRecord = Record<string, unknown> & { id?: string; code?: string; fleetCode?: string; tenantId?: string };

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function normalize(value: string): string {
  return value
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-\/]+/g, '_');
}

export function normalizeDashboardFleetStatus(value: unknown): DashboardFleetStatus {
  const s = normalize(clean(value) || 'OFFLINE');
  if (s === 'OPERANDO' || s === 'TRABALHANDO' || s === 'ONLINE' || s === 'EM_ANDAMENTO' || s === 'MOVIMENTO') return 'TRABALHANDO';
  if (s === 'DESLOCANDO' || s === 'MOVING') return 'DESLOCANDO';
  if (s === 'PARADO' || s === 'STOPPED' || s === 'AGUARDANDO_PARADA' || s === 'PARADA_APONTADA') return 'PARADA';
  if (s === 'ALERTA' || s === 'ALARM' || s === 'ERRO' || s === 'FALHA') return 'ALERTA';
  if (s === 'OFFLINE' || s === 'SEM_SINAL' || s === 'SEM_SIGNAL' || s === 'FINALIZADO' || s === 'INATIVO') return 'OFFLINE';
  return 'OFFLINE';
}

function resolveEquipmentKey(item: EquipmentRecord | EquipmentLiveState): string {
  const raw = item as unknown as Record<string, unknown>;
  return clean(raw.id) || clean(raw.code) || clean(raw.fleetCode) || clean(raw.equipmentId);
}

function resolveFleetCode(item: EquipmentRecord | EquipmentLiveState, live?: EquipmentLiveState): string {
  const raw = item as unknown as Record<string, unknown>;
  return clean(raw.code) || clean(raw.fleetCode) || clean(live?.fleetCode) || clean(live?.equipmentId);
}

function resolveLiveMatch(item: EquipmentRecord, liveFleet: EquipmentLiveState[]): EquipmentLiveState | undefined {
  const key = resolveEquipmentKey(item);
  const fleetCode = resolveFleetCode(item);
  return liveFleet.find((entry) => {
    const entryKey = clean(entry.equipmentId);
    return (key && entryKey === key) || (fleetCode && clean(entry.fleetCode) === fleetCode);
  });
}

export function buildDashboardFleetSnapshot(params: {
  catalog: EquipmentRecord[];
  liveFleet: EquipmentLiveState[];
}): { items: DashboardFleetItem[]; counts: DashboardFleetCounts } {
  const liveByKey = new Map<string, EquipmentLiveState>();
  const liveByFleetCode = new Map<string, EquipmentLiveState>();

  for (const live of params.liveFleet) {
    const key = resolveEquipmentKey(live);
    if (key) liveByKey.set(key, live);
    const fleetCode = clean(live.fleetCode);
    if (fleetCode) liveByFleetCode.set(fleetCode, live);
  }

  const catalog = params.catalog.filter((item) => resolveEquipmentKey(item));
  const source: Array<EquipmentRecord | EquipmentLiveState> = catalog.length > 0 ? catalog : params.liveFleet;
  const items = source.map((item) => {
    const live = 'equipmentId' in item && !('code' in item) && !('fleetCode' in item)
      ? undefined
      : ('id' in item || 'code' in item || 'fleetCode' in item)
        ? liveByKey.get(resolveEquipmentKey(item as EquipmentRecord)) ?? liveByFleetCode.get(resolveFleetCode(item as EquipmentRecord))
        : resolveLiveMatch(item as EquipmentRecord, params.liveFleet);
    const rawStatus = clean(live?.displayStatus || live?.operationalStatus || live?.status || item.status || 'OFFLINE');
    return {
      equipmentId: resolveEquipmentKey(item),
      fleetCode: resolveFleetCode(item, live),
      status: normalizeDashboardFleetStatus(rawStatus),
      rawStatus,
      live,
      catalog: item,
    };
  });

  const counts: DashboardFleetCounts = {
    total: items.length,
    TRABALHANDO: 0,
    DESLOCANDO: 0,
    PARADA: 0,
    ALERTA: 0,
    OFFLINE: 0,
  };

  for (const item of items) {
    counts[item.status] += 1;
  }

  return { items, counts };
}
