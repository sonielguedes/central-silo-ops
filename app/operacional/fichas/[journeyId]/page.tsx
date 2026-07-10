'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Activity, ArrowLeft, Clock, Loader2, PauseCircle, Tractor, User } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';
import { withAuth } from '@/components/shared/with-auth';
import type { FichaOperador } from '@/lib/operator-sheet-builder';

const cleanText = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null;
const stopLabel = (code: unknown, name: unknown) => {
  const c = cleanText(code); const n = cleanText(name);
  return c && n ? `${c} — ${n}` : n ?? c ?? 'Parada sem motivo informado';
};
const time = (value?: string | null) => {
  if (!value) return '—'; const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
const dateTime = (value?: string | null) => {
  if (!value) return '—'; const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('pt-BR');
};
const duration = (minutes?: number | null, active = false) => active ? 'Em andamento' : minutes == null || minutes < 0 ? '—' : minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
const hm = (value?: number | null) => value == null ? '—' : `${value.toFixed(1).replace('.', ',')} h`;

function Card({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-white/10 bg-[#0a1020] p-4"><div className="mb-3 flex items-center gap-2 text-xs font-black uppercase text-primary">{icon}{title}</div><div className="space-y-2">{children}</div></section>;
}
function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="flex justify-between gap-4 text-xs"><span className="text-muted-foreground">{label}</span><span className="text-right font-bold text-white">{cleanText(value) ?? '—'}</span></div>;
}

function JourneySheetPage() {
  const journeyId = String(useParams().journeyId ?? '');
  const fleetCode = useSearchParams().get('fleetCode') ?? '';
  const [sheet, setSheet] = useState<FichaOperador | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/operacional/fichas/${encodeURIComponent(journeyId)}?fleetCode=${encodeURIComponent(fleetCode)}`, { cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error((await response.json()).error ?? `HTTP ${response.status}`); return response.json(); })
      .then(setSheet).catch(error => setError(error.message));
  }, [fleetCode, journeyId]);

  return <div className="min-h-screen bg-background"><Sidebar /><div className="lg:pl-64"><Header /><main className="mx-auto max-w-7xl space-y-5 p-6">
    <Link href="/mapa-operacional" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-white"><ArrowLeft size={14}/>Voltar ao mapa</Link>
    {error && <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">{error}</div>}
    {!sheet && !error && <div className="flex justify-center py-24"><Loader2 className="animate-spin text-primary"/></div>}
    {sheet && <>
      <header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-black text-white">Ficha Operacional</h1><p className="text-sm text-muted-foreground">Jornada {sheet.journeyId} · Frota {sheet.fleetCode} · {sheet.operatorName ?? 'Operador não informado'}</p></div><span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-black text-orange-300">{sheet.operationalStatus}</span></header>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Frota" icon={<Tractor size={15}/>}><Row label="Código" value={sheet.fleetCode}/><Row label="Equipamento" value={sheet.equipmentId}/><Row label="Implemento" value={sheet.implementName ?? sheet.implementCode}/></Card>
        <Card title="Operador" icon={<User size={15}/>}><Row label="Nome" value={sheet.operatorName}/><Row label="Matrícula" value={sheet.operatorRegistration}/></Card>
        <Card title="Operação" icon={<Activity size={15}/>}><Row label="Nome" value={sheet.operationName}/><Row label="Código" value={sheet.operationCode}/><Row label="OS" value={sheet.workOrderNumber}/></Card>
        <Card title="Jornada" icon={<Clock size={15}/>}><Row label="Início" value={dateTime(sheet.startedAt)}/><Row label="Fim" value={dateTime(sheet.endedAt)}/><Row label="Duração" value={duration(sheet.durationMinutes, !sheet.endedAt)}/><Row label="Horímetro" value={`${hm(sheet.hourmeterStart)} → ${hm(sheet.hourmeterEnd ?? sheet.hourmeterCurrent)}`}/></Card>
      </div>
      <Card title={`Paradas (${sheet.stops.length})`} icon={<PauseCircle size={15}/>}>{sheet.stops.length === 0 ? <p className="text-xs text-muted-foreground">Sem paradas registradas nesta jornada.</p> : sheet.stops.map((stop, index) => <div key={`${stop.startedAt}-${index}`} className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs md:grid-cols-5"><strong className="md:col-span-2 text-orange-200">{stopLabel(stop.code, stop.description)}</strong><span>{time(stop.startedAt)} → {time(stop.endedAt)}</span><span>{duration(stop.durationMinutes, !stop.endedAt)}</span><span className="font-bold uppercase">{stop.endedAt ? 'Finalizada' : 'Em andamento'}</span></div>)}</Card>
      <Card title="Histórico · Eventos operacionais" icon={<Activity size={15}/>}>{sheet.events.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum evento operacional encontrado para esta jornada.</p> : sheet.events.map(event => <div key={event.id} className="flex items-start justify-between gap-4 border-b border-white/5 py-2 text-xs"><div><span className="font-bold text-white">{event.type} · {event.label}</span>{event.description && <p className="mt-1 text-orange-200">{event.description}</p>}</div><span className="shrink-0 text-muted-foreground">{dateTime(event.timestamp)}</span></div>)}</Card>
    </>}
  </main></div></div>;
}

export default withAuth(JourneySheetPage, { module: 'FICHA_OPERADOR' });
