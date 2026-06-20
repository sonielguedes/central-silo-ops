"use client";
/**
 * SILO OPS — Trail Timeline Panel
 * Painel inferior do Mapa Operacional para exibição do rastro ativo.
 * Mostra: card do equipamento, qualidade do rastro, linha do tempo e controles.
 */

import React from 'react';
import {
  Route, X as XIcon, Crosshair, ClipboardCopy,
  PlusCircle, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrailQualitySummary } from '@/lib/trail-quality';
import type { LiveMapItem } from '@/components/mapa/map-filters';

// ── Tipos ────────────────────────────────────────────────────────────────────

interface TrailState {
  fleetCode: string;
  journeyId: string;
  points: { latitude: number; longitude: number; timestamp: string; qualityStatus?: string }[];
  summary: TrailQualitySummary | null;
}

interface TrailTimelinePanelProps {
  trail: TrailState;
  machine: LiveMapItem | null;
  rawMode: boolean;
  trailLoading: boolean;
  copiedId: string | null;
  onClear: () => void;
  onCenter: (pos: [number, number] | null) => void;
  onCopyJourney: (id: string) => void;
  onToggleRaw: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function qualityFromSummary(summary: TrailQualitySummary | null): {
  label: 'Boa' | 'Média' | 'Baixa' | null;
  color: string;
  pct: number | null;
} {
  if (!summary || summary.rawPointsCount === 0) return { label: null, color: 'text-muted-foreground', pct: null };
  const valid = summary.quality.valid + summary.quality.lowAccuracy;
  const pct = (valid / summary.rawPointsCount) * 100;
  if (pct >= 85) return { label: 'Boa', color: 'text-emerald-400', pct };
  if (pct >= 60) return { label: 'Média', color: 'text-amber-400', pct };
  return { label: 'Baixa', color: 'text-red-400', pct };
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); } catch { return '—'; }
}

// ── Stat cell ────────────────────────────────────────────────────────────────

function StatCell({ label, value, color = 'text-white' }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[8px] font-black uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={cn('text-[13px] font-black leading-none', color)}>{value}</span>
    </div>
  );
}

// ── Quality bar ──────────────────────────────────────────────────────────────

function QualityBar({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const color = pct >= 85 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className="h-1 w-full rounded-full bg-[#1a1f3a] overflow-hidden mt-1">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct.toFixed(0)}%`, background: color }} />
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function TrailTimelinePanel({
  trail, machine, rawMode, trailLoading,
  copiedId, onClear, onCenter, onCopyJourney, onToggleRaw,
}: TrailTimelinePanelProps) {
  const { summary } = trail;
  const q = qualityFromSummary(summary);

  const statusColors: Record<string, string> = {
    OPERANDO: 'text-emerald-400', ONLINE: 'text-blue-400',
    PARADO: 'text-orange-400', FINALIZADO: 'text-gray-400', OFFLINE: 'text-gray-500',
  };
  const statusColor = statusColors[machine?.status?.toUpperCase() ?? ''] ?? 'text-muted-foreground';

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1300] bg-[#0a0e27]/95 backdrop-blur-xl border-t border-[#2d3647] shadow-2xl">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2d3647]/60">
        <div className="flex items-center gap-2">
          <Route size={13} className="text-blue-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">
            Rastro · Linha do Tempo
          </span>
          {trailLoading && (
            <span className="text-[8px] font-black uppercase text-muted-foreground animate-pulse ml-2">
              atualizando...
            </span>
          )}
          <span className={cn(
            'text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ml-1',
            rawMode
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
          )}>
            {rawMode ? 'Bruto' : 'Limpo'}
          </span>
        </div>
        <button onClick={onClear} className="flex items-center gap-1.5 text-[9px] font-black uppercase text-muted-foreground hover:text-white transition-colors">
          <XIcon size={11} /> Fechar rastro
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex items-stretch gap-0 divide-x divide-[#2d3647]/60 overflow-x-auto">

        {/* Coluna 1 — Equipamento */}
        <div className="flex flex-col gap-2 px-4 py-2.5 min-w-[160px]">
          <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Equipamento</span>
          <div className="flex flex-col gap-1">
            <span className="text-[15px] font-black text-white leading-none">{trail.fleetCode}</span>
            {machine && (
              <>
                <span className="text-[10px] font-bold text-muted-foreground truncate max-w-[140px]">
                  {machine.displayOperation || '—'}
                </span>
                <span className="text-[9px] text-muted-foreground/70 truncate max-w-[140px]">
                  {machine.displayOperator || '—'}
                </span>
                <span className={cn('text-[9px] font-black uppercase mt-0.5', statusColor)}>
                  ● {machine.status}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Coluna 2 — Pontos */}
        <div className="flex flex-col gap-2 px-4 py-2.5 min-w-[180px]">
          <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Pontos GPS</span>
          <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
            <StatCell label="Recebidos" value={summary?.rawPointsCount ?? trail.points.length} />
            <StatCell label="No mapa" value={summary?.visualPointsCount ?? trail.points.length} color="text-emerald-400" />
            <StatCell label="Filtrados" value={summary?.filteredPointsCount ?? 0} color="text-amber-400" />
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-[8px] text-muted-foreground uppercase">Distância</span>
            <span className="text-[10px] font-black text-white">{(summary?.distanceKm ?? 0).toFixed(2)} km</span>
          </div>
        </div>

        {/* Coluna 3 — Qualidade */}
        <div className="flex flex-col gap-2 px-4 py-2.5 min-w-[190px]">
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Qualidade GPS</span>
            {q.label && <span className={cn('text-[9px] font-black uppercase', q.color)}>{q.label}</span>}
          </div>
          <QualityBar pct={q.pct} />
          {summary && (
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-0.5">
              <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
                <CheckCircle2 size={8} className="text-emerald-400" />
                Válidos: <span className="text-white font-black ml-1">{summary.quality.valid}</span>
              </div>
              <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
                <AlertTriangle size={8} className="text-amber-400" />
                Baixa prec.: <span className="text-white font-black ml-1">{summary.quality.lowAccuracy}</span>
              </div>
              <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
                <AlertTriangle size={8} className="text-orange-400" />
                Duplicados: <span className="text-white font-black ml-1">{summary.quality.duplicate}</span>
              </div>
              <div className="flex items-center gap-1 text-[8px] text-muted-foreground">
                <AlertTriangle size={8} className="text-red-400" />
                Outliers: <span className="text-white font-black ml-1">{summary.quality.outlier}</span>
              </div>
            </div>
          )}
        </div>

        {/* Coluna 4 — Horários */}
        <div className="flex flex-col gap-2 px-4 py-2.5 min-w-[140px]">
          <span className="text-[8px] font-black uppercase tracking-widest text-muted-foreground">Linha do Tempo</span>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[8px] text-muted-foreground uppercase">Início</span>
                <span className="text-[10px] font-black text-white">{fmtTime(summary?.startedAt)}</span>
              </div>
            </div>
            <div className="w-px h-3 bg-[#2d3647] ml-1.5" />
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[8px] text-muted-foreground uppercase">{summary?.endedAt ? 'Fim' : 'Último GPS'}</span>
                <span className="text-[10px] font-black text-white">
                  {fmtTime(summary?.endedAt ?? trail.points[trail.points.length - 1]?.timestamp)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 5 — Ações */}
        <div className="flex flex-col gap-1.5 px-4 py-2.5 min-w-[170px] justify-center">
          {/* Modo toggle */}
          <button
            onClick={onToggleRaw}
            className={cn(
              'flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-all',
              rawMode
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20'
                : 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20'
            )}
          >
            <Route size={9} />
            {rawMode ? 'Mostrar rastro limpo' : 'Mostrar rastro bruto'}
          </button>

          {/* Centralizar */}
          <button
            onClick={() => onCenter(machine?.pos ?? null)}
            disabled={!machine?.pos}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-[9px] font-black uppercase hover:bg-white/10 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Crosshair size={9} /> Centralizar
          </button>

          {/* Copiar journeyId */}
          {trail.journeyId && (
            <button
              onClick={() => onCopyJourney(trail.journeyId)}
              className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 text-[9px] font-black uppercase hover:bg-white/10 transition-all"
            >
              <ClipboardCopy size={9} />
              {copiedId === trail.journeyId ? 'Copiado!' : 'Copiar JourneyId'}
            </button>
          )}

          {/* Adicionar Equipamento — placeholder */}
          <button
            onClick={() => alert('Comparação de múltiplos equipamentos será liberada em etapa futura.')}
            className="flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/3 border border-dashed border-white/10 text-white/30 text-[9px] font-black uppercase hover:border-white/20 hover:text-white/50 transition-all"
          >
            <PlusCircle size={9} /> + Adicionar Equipamento
          </button>
        </div>
      </div>
    </div>
  );
}
