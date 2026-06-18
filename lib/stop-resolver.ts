/**
 * stop-resolver.ts
 *
 * Resolve os campos de parada (codigo + descricao) com a cadeia de prioridade:
 *   1. Evento mais recente do tipo PARADA/STOP_REASON para o equipamento
 *   2. Campos do live-state (stopCode, stopDescription, stopReason e variantes)
 *   3. Lookup no cadastro de paradas pelo codigo encontrado em 1 ou 2
 *   4. Descricao direta presente no live-state
 *   5. Nenhuma informacao disponivel -> null
 *
 * Nao depende de Next.js nem de IO -- e uma funcao pura que recebe os dados
 * ja carregados, facilitando os testes unitarios.
 */

import type { EquipmentLiveState } from '@/lib/types';
import type { MobileEvent } from '@/lib/server-storage';

// ── Types ─────────────────────────────────────────────────────────────────────

export type StopSource = 'EVENT' | 'LIVE_STATE' | 'CATALOG' | 'NONE';

export interface ResolvedStop {
  /** Codigo de parada, ex: "PAR-01". Null quando nao identificado. */
  code: string | null;
  /** Descricao legivel da parada. Null quando nao disponivel. */
  description: string | null;
  /** Origem dos dados resolvidos. */
  source: StopSource;
}

/** Entrada minima esperada do cadastro de paradas. */
export interface StopCatalogEntry {
  code: string;
  description: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function asStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

/** Extrai o codigo de parada do payload de um evento mobile. */
function eventCode(payload: Record<string, unknown>): string | null {
  // O APK pode enviar stopCode (preferido) ou code (campo generico do evento)
  return asStr(payload.stopCode) ?? asStr(payload.code);
}

/** Extrai a descricao de parada do payload de um evento mobile. */
function eventDesc(payload: Record<string, unknown>): string | null {
  return (
    asStr(payload.stopDescription) ??
    asStr(payload.stopReason) ??
    asStr(payload.description) ??
    asStr(payload.reason)
  );
}

/** Busca a descricao no cadastro de paradas pelo codigo. */
function catalogLookup(code: string, catalog: StopCatalogEntry[]): string | null {
  if (!code) return null;
  const entry = catalog.find((p) => p.code === code);
  return asStr(entry?.description) ?? null;
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * Resolve codigo e descricao de parada para um equipamento.
 *
 * @param machine   Registro live-state do equipamento.
 * @param events    Todos os MobileEvents do tenant (ou apenas do equipamento --
 *                  a funcao filtra por equipmentId internamente).
 * @param catalog   Lista de paradas do cadastro (CadastroStorage.getAll(tenantId, 'paradas')).
 * @returns         ResolvedStop com os campos mais precisos que conseguimos obter.
 */
export function resolveStop(
  machine: EquipmentLiveState,
  events: MobileEvent[],
  catalog: StopCatalogEntry[],
): ResolvedStop {
  // ── Prioridade 1: evento mais recente com dados de parada ─────────────────
  const stopEvents = events
    .filter(
      (e) =>
        e.equipmentId === machine.equipmentId &&
        (e.type === 'PARADA' || e.type === 'STOP_REASON'),
    )
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  for (const ev of stopEvents) {
    const p = (ev.payload ?? {}) as Record<string, unknown>;
    const code = eventCode(p);
    const desc = eventDesc(p);
    if (code !== null || desc !== null) {
      // Enriquece descricao via catalogo se so o codigo foi enviado
      const resolvedDesc = desc ?? (code ? catalogLookup(code, catalog) : null);
      return { code, description: resolvedDesc, source: 'EVENT' };
    }
  }

  // ── Prioridade 2: campos do live-state (todas as variantes de nome) ───────
  const lsCode = asStr(machine.stopCode);
  const lsDesc =
    asStr(machine.stopDescription) ??
    asStr(machine.stopReason);

  if (lsCode !== null || lsDesc !== null) {
    // Prioridade 3 (dentro do bloco): enriquece descricao via catalogo
    const resolvedDesc = lsDesc ?? (lsCode ? catalogLookup(lsCode, catalog) : null);
    return { code: lsCode, description: resolvedDesc, source: 'LIVE_STATE' };
  }

  // ── Nenhuma fonte disponivel ───────────────────────────────────────────────
  return { code: null, description: null, source: 'NONE' };
}
