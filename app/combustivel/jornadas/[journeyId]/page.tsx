"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { withAuth } from '@/components/shared/with-auth';
import { CombustivelPageHeader } from '@/components/combustivel/combustivel-page-header';
import { resolveComboioBomba } from '@/lib/fueling-display';
import { Fuel, ArrowLeft, Clock3, MapPinned, BadgeInfo, AlertTriangle, Activity, CalendarDays } from 'lucide-react';

type FuelJourneyDetail = {
  summary: {
    companyCode?: string;
    comboioFleetCode?: string;
    comboioDescription?: string;
    driverName?: string;
    driverRegistration?: string;
    shift?: string;
    deviceId?: string;
    source?: string;
    status: 'FINALIZADA' | 'ATIVA' | 'INCONSISTENTE';
    calculationModeLabel?: string;
    startedAtLabel: string;
    finishedAtLabel: string;
    kmInicial?: number;
    kmFinal?: number;
    distanciaPercorrida?: number;
    tanqueInicial?: number;
    totalCarregadoPosto?: number;
    totalAbastecidoMaquinas?: number;
    saldoTeorico?: number;
    saldoFinalAutomatico?: number;
    diferenca?: number;
    fuelingCount: number;
  };
  timeline: Array<{ offlineId: string; type: string; summary: string; occurredAtLabel: string; source: string; syncStatus: string }>;
  fuelings: Array<{ offlineId: string; occurredAtLabel: string; fleetCode: string; operatorName?: string; operatorRegistration?: string; pumpCode?: string; product?: string; meterStart?: number; meterEnd?: number; liters: number; hourmeter?: number; odometer?: number; syncStatus: string }>;
};

type ApiResponse = { success?: boolean; item?: FuelJourneyDetail };

function liters(value?: number): string {
  if (!Number.isFinite(value ?? NaN)) return '0,0 L';
  return `${(value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`;
}

function km(value?: number): string {
  if (!Number.isFinite(value ?? NaN)) return '—';
  return `${(value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

function cardTitle(label: string, value: React.ReactNode) {
  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-5 shadow-lg shadow-black/10">
      <p className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function badgeStatus(value?: string) {
  switch (value) {
    case 'FINALIZADA':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    case 'ATIVA':
      return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
    case 'INCONSISTENTE':
      return 'bg-red-500/15 text-red-300 border-red-500/30';
    default:
      return 'bg-slate-500/15 text-slate-300 border-slate-500/30';
  }
}

function JourneyDetailPage() {
  const params = useParams<{ journeyId: string }>();
  const searchParams = useSearchParams();
  const [data, setData] = useState<ApiResponse>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const journeyId = params?.journeyId;
  const companyCode = searchParams.get('companyCode')?.trim();

  const load = async () => {
    if (!journeyId) return;
    setError(null);
    try {
      const url = new URL(`/api/combustivel/jornadas/${journeyId}`, window.location.origin);
      if (companyCode) url.searchParams.set('companyCode', companyCode);
      const res = await fetch(url.toString(), { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar jornada');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar jornada');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journeyId, companyCode]);

  const item = data.item;
  const timeline = useMemo(() => item?.timeline ?? [], [item]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[#060c1a] text-white">
      <CombustivelPageHeader
        title="Detalhes da Jornada"
        subtitle={item ? `Comboio ${resolveComboioBomba({ pumpCode: item.summary.comboioFleetCode, comboioFleetCode: item.summary.comboioFleetCode, comboioDescription: item.summary.comboioDescription })} • ${item.summary.driverName ?? item.summary.driverRegistration ?? '—'} • ${item.summary.shift ?? '—'}` : 'Detalhamento operacional da jornada'}
        currentPage="Jornadas"
        actions={
          <Link href="/combustivel/jornadas" className="inline-flex items-center gap-2 rounded-xl border border-[#2d3647] bg-[#0d1426] px-4 py-2 text-xs font-bold text-muted-foreground transition-all hover:text-white">
            <ArrowLeft size={13} />
            Voltar
          </Link>
        }
      />

      <div className="px-8 py-6 space-y-6">
        {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-300">{error}</div> : null}

        {!loading && item ? (
          <>
            <div className="grid gap-4 xl:grid-cols-4">
              {cardTitle('Empresa / Tenant', item.summary.companyCode ?? '—')}
              {cardTitle('Comboio', resolveComboioBomba({ pumpCode: item.summary.comboioFleetCode, comboioFleetCode: item.summary.comboioFleetCode, comboioDescription: item.summary.comboioDescription }))}
              {cardTitle('Motorista', item.summary.driverName ?? item.summary.driverRegistration ?? '—')}
              {cardTitle('Status', <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.25em] ${badgeStatus(item.summary.status)}`}>{item.summary.status}</span>)}
            </div>

            <div className="grid gap-4 xl:grid-cols-5">
              {cardTitle('Matrícula', item.summary.driverRegistration ?? '—')}
              {cardTitle('Turno', item.summary.shift ?? '—')}
              {cardTitle('Origem', item.summary.source ?? 'APK')}
              {cardTitle('Device ID', item.summary.deviceId ?? '—')}
              {cardTitle('Cálculo', item.summary.calculationModeLabel ?? '—')}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-5">
                <h2 className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">Início da Jornada</h2>
                <div className="mt-4 grid gap-3 text-sm">
                  <Row icon={<CalendarDays size={14} />} label="Data/hora início" value={item.summary.startedAtLabel} />
                  <Row icon={<Activity size={14} />} label="KM inicial" value={item.summary.kmInicial ?? '—'} />
                  <Row icon={<Fuel size={14} />} label="Tanque inicial" value={liters(item.summary.tanqueInicial)} />
                  <Row icon={<Clock3 size={14} />} label="Evento" value="JOURNEY_START" />
                  <Row icon={<BadgeInfo size={14} />} label="offlineId" value={item.timeline.find((event) => event.type === 'JOURNEY_START')?.offlineId ?? '—'} />
                </div>
              </div>

              <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-5">
                <h2 className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">Finalização</h2>
                <div className="mt-4 grid gap-3 text-sm">
                  <Row icon={<CalendarDays size={14} />} label="Data/hora fim" value={item.summary.finishedAtLabel} />
                  <Row icon={<Activity size={14} />} label="KM final" value={item.summary.kmFinal ?? '—'} />
                  <Row icon={<MapPinned size={14} />} label="Distância percorrida" value={km(item.summary.distanciaPercorrida)} />
                  <Row icon={<Fuel size={14} />} label="Saldo final automático" value={<span className={Number(item.summary.saldoFinalAutomatico ?? 0) < 0 ? 'text-red-300' : 'text-white'}>{liters(item.summary.saldoFinalAutomatico)}</span>} />
                  <Row icon={<Clock3 size={14} />} label="Evento" value="JOURNEY_END" />
                  <Row icon={<BadgeInfo size={14} />} label="offlineId" value={item.timeline.find((event) => event.type === 'JOURNEY_END')?.offlineId ?? '—'} />
                </div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-5">
                <h2 className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">Resumo Operacional</h2>
                <div className="mt-4 grid gap-3 text-sm">
                  <Row icon={<Fuel size={14} />} label="Total carregado no posto" value={liters(item.summary.totalCarregadoPosto)} />
                  <Row icon={<Fuel size={14} />} label="Total abastecido em máquinas" value={liters(item.summary.totalAbastecidoMaquinas)} />
                  <Row icon={<Fuel size={14} />} label="Saldo teórico" value={liters(item.summary.saldoTeorico)} />
                  <Row icon={<Fuel size={14} />} label="Saldo final calculado" value={liters(item.summary.saldoFinalAutomatico)} />
                  <Row icon={<AlertTriangle size={14} />} label="Diferença" value={item.summary.diferenca != null ? liters(item.summary.diferenca) : '—'} />
                  <Row icon={<Activity size={14} />} label="Abastecimentos vinculados" value={item.summary.fuelingCount} />
                </div>
              </div>

              <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-5">
                <h2 className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">Linha do Tempo</h2>
                <div className="mt-4 space-y-3">
                  {timeline.length > 0 ? timeline.map((event) => (
                    <div key={event.offlineId} className="rounded-xl border border-[#1f2740] bg-[#050812] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-300">{event.type}</p>
                          <p className="mt-1 text-sm text-white">{event.summary}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{event.occurredAtLabel}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Tag>{event.source}</Tag>
                        <Tag>{event.syncStatus}</Tag>
                        <Tag>{event.offlineId}</Tag>
                      </div>
                    </div>
                  )) : (
                    <div className="rounded-xl border border-dashed border-[#2d3647] bg-[#050812] p-8 text-center text-xs text-muted-foreground">Nenhum evento consolidado encontrado.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-black uppercase tracking-[0.28em] text-muted-foreground">Abastecimentos Vinculados</h2>
                <span className="text-[10px] text-muted-foreground">{item.summary.fuelingCount} registro(s)</span>
              </div>
              <div className="mt-4 overflow-hidden rounded-xl border border-[#1f2740]">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-[#1f2740]">
                      {['Data/hora', 'Frota', 'Operador', 'Bomba/Medidor', 'Produto', 'Registro inicial', 'Registro final', 'Litros', 'Horímetro/KM', 'Status'].map((head) => (
                        <th key={head} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground">{head}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {item.fuelings.length > 0 ? item.fuelings.map((fueling) => (
                      <tr key={fueling.offlineId} className="border-t border-[#1f2740]">
                        <td className="px-4 py-3 text-white/80 whitespace-nowrap">{fueling.occurredAtLabel}</td>
                        <td className="px-4 py-3 text-white/80">{fueling.fleetCode}</td>
                        <td className="px-4 py-3 text-white/80">{fueling.operatorName ?? fueling.operatorRegistration ?? '—'}</td>
                        <td className="px-4 py-3 text-white/80">{fueling.pumpCode ?? 'Não informado'}</td>
                        <td className="px-4 py-3 text-white/80">{fueling.product ?? '—'}</td>
                        <td className="px-4 py-3 text-white/80">{fueling.meterStart ?? '—'}</td>
                        <td className="px-4 py-3 text-white/80">{fueling.meterEnd ?? '—'}</td>
                        <td className="px-4 py-3 text-white/80">{liters(fueling.liters)}</td>
                        <td className="px-4 py-3 text-white/80">{fueling.hourmeter ?? fueling.odometer ?? '—'}</td>
                        <td className="px-4 py-3 text-white/80">{fueling.syncStatus}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">Nenhum abastecimento vinculado a esta jornada.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-[#2d3647] bg-[#0d1426] p-12 text-center">
            <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-muted-foreground">
              <BadgeInfo size={36} className="opacity-20" />
              <p className="text-sm font-black text-white/60">{loading ? 'Carregando jornada...' : 'Jornada não encontrada'}</p>
              <p className="text-[11px]">Se o APK ainda não enviou o ciclo completo, o detalhe fica vazio sem quebrar nada.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-[#1f2740] bg-[#050812] px-4 py-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="text-orange-400">{icon}</span>
        <span className="text-[10px] font-black uppercase tracking-[0.25em]">{label}</span>
      </div>
      <div className="text-right text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex rounded-md border border-[#2d3647] bg-[#0d1426] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{children}</span>;
}

export default withAuth(JourneyDetailPage, { module: 'COMBUSTIVEL' });
