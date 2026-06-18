/* ─────────────────────────────────────────────────────────────────────────────
 * SILO OPS — Map Filters (SSR-safe)
 * Tipos e lógica de filtragem do mapa operacional.
 * Nenhuma dependência de leaflet / react-leaflet / window / document.
 * ────────────────────────────────────────────────────────────────────────── */

import type { EquipmentLiveState } from '@/lib/types';

/* ── Types ────────────────────────────────────────────────────────────── */

export type MapFilters = {
  search: string;
  status: string[];
  operation: string;
  operator: string;
  withOpenStop: boolean;
  withFinishedJourney: boolean;
  withInconsistency: boolean;
};

export const EMPTY_FILTERS: MapFilters = {
  search: '', status: [], operation: '', operator: '',
  withOpenStop: false, withFinishedJourney: false, withInconsistency: false,
};

/** Estado semantico de parada retornado pela API /api/equipamentos/status. */
export type StopState =
  | 'SEM_PARADA_ATIVA'
  | 'AGUARDANDO_APONTAMENTO'
  | 'PARADA_APONTADA'
  | 'PARADA_INCONSISTENTE';

/** Objeto stop estruturado -- nunca exibe "NÃO INFORMADO". */
export interface ResolvedStopForMap {
  state: StopState;
  /** Label legivel para o card/popup. */
  label: string;
  code: string | null;
  reason: string | null;
  hasActiveStop: boolean;
  hasStopReason: boolean;
  startedAt: string | null;
  durationSeconds: number | null;
  inconsistency: string | null;
}

export type LiveMapItem = EquipmentLiveState & {
  id: string;
  code: string;
  pos: [number, number] | null;
  typeIcon: 'Tractor' | 'Truck' | 'Zap' | 'Navigation';
  iconType: string;
  displayOperator: string;
  displayOperation: string;
  /** Estado semantico de parada (presente quando a API /equipamentos/status for >= hotfix 6.7C.1). */
  stop?: ResolvedStopForMap;
};

export type MapCounts = {
  online: number; operando: number; parado: number;
  offline: number; staleGps: number; staleHeartbeat: number;
};

/* ── Filter logic ─────────────────────────────────────────────────────── */

export function applyFilters(fleet: LiveMapItem[], filters: MapFilters): LiveMapItem[] {
  let result = fleet;

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(m =>
      m.code.toLowerCase().includes(q) ||
      (m.displayOperator || '').toLowerCase().includes(q) ||
      (m.displayOperation || '').toLowerCase().includes(q) ||
      (m.type || '').toLowerCase().includes(q) ||
      (m.name || '').toLowerCase().includes(q)
    );
  }

  if (filters.status.length > 0) {
    const set = new Set(filters.status.map(s => s.toUpperCase()));
    result = result.filter(m => set.has(m.status.toUpperCase()));
  }

  if (filters.operation) {
    const q = filters.operation.toLowerCase();
    result = result.filter(m =>
      (m.currentOperation || '').toLowerCase().includes(q) ||
      (m.operationName || '').toLowerCase().includes(q) ||
      (m.operationCode || '').toLowerCase().includes(q)
    );
  }

  if (filters.operator) {
    const q = filters.operator.toLowerCase();
    result = result.filter(m =>
      (m.currentOperator || '').toLowerCase().includes(q) ||
      (m.operatorName || '').toLowerCase().includes(q)
    );
  }

  if (filters.withOpenStop) {
    // Usa o estado semantico quando disponivel; cai nos campos flat para compatibilidade
    result = result.filter(m =>
      m.stop?.hasActiveStop ||
      m.stopCode != null ||
      m.stopReason != null ||
      m.stopDescription != null
    );
  }

  if (filters.withFinishedJourney) {
    result = result.filter(m => m.status === 'FINALIZADO' || m.endedAt);
  }

  if (filters.withInconsistency) {
    result = result.filter(m =>
      m.hourmeterInconsistent ||
      m.stop?.state === 'PARADA_INCONSISTENTE'
    );
  }

  return result;
}
