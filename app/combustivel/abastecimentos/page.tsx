"use client";

import React, { useEffect, useState } from 'react';
import {
  Fuel,
  Search,
  Plus,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  Smartphone,
  Globe,
  WifiOff,
} from 'lucide-react';
import { withAuth } from '@/components/shared/with-auth';
import { CombustivelPageHeader } from '@/components/combustivel/combustivel-page-header';
import type { FuelingRecord } from '@/lib/fueling-storage';
import { resolveComboioBomba } from '@/lib/fueling-display';

type ApiResponse = { records?: FuelingRecord[] };

type OrigemTag = 'APK' | 'Web' | 'Offline';
type StatusTag = 'Sincronizado' | 'Pendente' | 'Erro';

const ORIGEM_STYLE: Record<OrigemTag, string> = {
  APK: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Web: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  Offline: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

const STATUS_STYLE: Record<StatusTag, string> = {
  Sincronizado: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  Pendente: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  Erro: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const ORIGEM_ICON: Record<OrigemTag, React.ReactNode> = {
  APK: <Smartphone size={11} />,
  Web: <Globe size={11} />,
  Offline: <WifiOff size={11} />,
};

const STATUS_ICON: Record<StatusTag, React.ReactNode> = {
  Sincronizado: <CheckCircle size={11} />,
  Pendente: <Clock size={11} />,
  Erro: <AlertCircle size={11} />,
};

const COLUMNS = ['Data/Hora', 'Frota', 'Operador', 'Comboio/Bomba', 'Produto', 'Litros', 'Horímetro/KM', 'Origem', 'Status'];

const tz = 'America/Sao_Paulo';

function formatDateTime(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: tz,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatLiters(value?: number): string {
  if (!Number.isFinite(value ?? NaN)) return '0,0 L';
  return `${(value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`;
}

function formatMetric(value?: number | string | null): string {
  if (value === null || value === undefined || value === '') return '—';

  const numericValue = typeof value === 'number'
    ? value
    : Number(String(value).replace(',', '.'));

  if (!Number.isFinite(numericValue)) return '—';

  return numericValue.toFixed(1);
}

function getOrigin(record: FuelingRecord): OrigemTag {
  return record.source === 'APK' ? 'APK' : record.source === 'CENTRAL' ? 'Web' : 'Offline';
}

function getStatus(record: FuelingRecord): StatusTag {
  if (record.syncStatus === 'SYNCED') return 'Sincronizado';
  if (String(record.syncStatus ?? '').toUpperCase().includes('ERRO')) return 'Erro';
  return 'Pendente';
}

function CombustivelAbastecimentosPage() {
  const [search, setSearch] = useState('');
  const [data, setData] = useState<ApiResponse>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const res = await fetch('/api/abastecimentos', { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar abastecimentos');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar abastecimentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const records = data.records ?? [];
  const filtered = records.filter((record) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return [
      record.fleetCode,
      record.fleetDescription,
      record.operatorName,
      record.operatorRegistration,
      record.truckFleetCode,
      record.pumpCode,
      record.fuelType,
      String(record.dieselLiters ?? ''),
      String(record.hourmeter ?? ''),
      String(record.odometer ?? ''),
      record.syncStatus,
      record.source,
    ].some((value) => String(value ?? '').toLowerCase().includes(term));
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[#060c1a] text-white">
      <CombustivelPageHeader
        title="Abastecimentos"
        subtitle="Histórico completo de abastecimentos por frota, operador e comboio"
        currentPage="Abastecimentos"
        actions={
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar frota, operador..."
                className="pl-9 pr-4 py-2 bg-[#0d1426] border border-[#2d3647] rounded-xl text-xs text-white placeholder-muted-foreground focus:outline-none focus:border-orange-500/50 w-56"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0d1426] border border-[#2d3647] text-xs font-bold text-muted-foreground hover:text-white transition-all">
              <Filter size={13} />
              Filtros
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white transition-all">
              <Plus size={13} />
              Registrar abastecimento
            </button>
          </>
        }
      />

      <div className="px-8 pt-4 flex items-center gap-2">
        {(['Todos', 'Hoje', 'Esta Semana', 'Este Mês'] as const).map(f => (
          <button
            key={f}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
              f === 'Todos'
                ? 'bg-orange-500/15 border border-orange-500/30 text-orange-300'
                : 'bg-[#0d1426] border border-[#2d3647] text-muted-foreground hover:text-white'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="px-8 py-6">
        {error ? (
          <div className="mb-4 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 text-xs">{error}</div>
        ) : null}
        <div className="bg-[#0d1426] border border-[#2d3647] rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2d3647]">
                {COLUMNS.map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Fuel size={40} className="opacity-15" />
                      <p className="font-black text-sm text-white/50">Carregando abastecimentos reais...</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length > 0 ? filtered.map((record) => {
                const origin = getOrigin(record);
                const status = getStatus(record);
                return (
                  <tr key={record.eventId} className="border-t border-[#1f2740]">
                    <td className="px-4 py-3 text-white/80 whitespace-nowrap">{formatDateTime(record.fueledAt ?? record.receivedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="text-white font-semibold">{record.fleetCode}</div>
                      {record.fleetDescription ? <div className="text-[10px] text-muted-foreground">{record.fleetDescription}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-white/80">{record.operatorName ?? record.operatorRegistration ?? '—'}</td>
                    <td className="px-4 py-3 text-white/80">{resolveComboioBomba({
                      pumpCode: record.pumpCode,
                      comboioFleetCode: record.truckFleetCode,
                    })}</td>
                    <td className="px-4 py-3 text-white/80">{record.fuelType ?? '—'}</td>
                    <td className="px-4 py-3 text-white/80">{formatLiters(record.dieselLiters)}</td>
                    <td className="px-4 py-3 text-white/80">{formatMetric(record.hourmeter ?? record.odometer)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${ORIGEM_STYLE[origin]}`}>
                        {ORIGEM_ICON[origin]} {origin}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${STATUS_STYLE[status]}`}>
                        {STATUS_ICON[status]} {status}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Fuel size={40} className="opacity-15" />
                      <p className="font-black text-sm text-white/50">Nenhum abastecimento encontrado</p>
                      <p className="text-[11px] max-w-sm text-center">
                        Registros aparecerão após o primeiro abastecimento via Web ou aplicativo.
                        Utilize o botão <strong className="text-orange-400">Registrar abastecimento</strong> para adicionar manualmente.
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-6 mt-4">
          {(Object.keys(STATUS_STYLE) as StatusTag[]).map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${STATUS_STYLE[s]}`}>
                {STATUS_ICON[s]} {s}
              </span>
            </div>
          ))}
          <div className="h-3 w-px bg-[#2d3647] mx-1" />
          {(Object.keys(ORIGEM_STYLE) as OrigemTag[]).map(o => (
            <div key={o} className="flex items-center gap-1.5">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-bold ${ORIGEM_STYLE[o]}`}>
                {ORIGEM_ICON[o]} {o}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default withAuth(CombustivelAbastecimentosPage, { module: 'COMBUSTIVEL_ABAST' });
