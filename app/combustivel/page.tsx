"use client";

import React, { useEffect, useState } from 'react';
import {
  Fuel,
  Truck,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  Droplets,
  Package,
  CheckCircle,
  Clock,
  Plus,
} from 'lucide-react';
import { withAuth } from '@/components/shared/with-auth';
import { CombustivelPageHeader } from '@/components/combustivel/combustivel-page-header';
import type { FuelingRecord } from '@/lib/fueling-storage';
import { resolveComboioBomba, resolveFuelProduct, resolveOperatorDisplay } from '@/lib/fueling-display';

type ApiResponse = {
  summary?: {
    pending?: number;
    inconsistent?: number;
  };
  records?: FuelingRecord[];
  recentRecords?: FuelingRecord[];
};

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: 'green' | 'blue' | 'orange' | 'red' | 'default';
}

function KpiCard({ icon, label, value, sub, color = 'default' }: KpiCardProps) {
  const colors = {
    green: 'border-emerald-500/30 shadow-emerald-500/5',
    blue: 'border-blue-500/30 shadow-blue-500/5',
    orange: 'border-orange-500/30 shadow-orange-500/5',
    red: 'border-red-500/30 shadow-red-500/5',
    default: 'border-[#2d3647] shadow-black/10',
  };
  const iconColors = {
    green: 'text-emerald-400',
    blue: 'text-blue-400',
    orange: 'text-orange-400',
    red: 'text-red-400',
    default: 'text-slate-400',
  };
  return (
    <div className={`bg-[#0d1426] border rounded-xl p-5 shadow-lg flex items-start gap-4 ${colors[color]}`}>
      <div className={`mt-0.5 ${iconColors[color]}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-black text-white leading-none">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>}
      </div>
    </div>
  );
}

interface AlertRowProps {
  type: 'warning' | 'info' | 'error';
  message: string;
  time: string;
}

function AlertRow({ type, message, time }: AlertRowProps) {
  const styles = {
    warning: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
    error: 'bg-red-500/10 border-red-500/30 text-red-300',
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-xs ${styles[type]}`}>
      <AlertTriangle size={14} className="shrink-0" />
      <span className="flex-1">{message}</span>
      <span className="text-[10px] opacity-60 shrink-0">{time}</span>
    </div>
  );
}

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

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
}

function isToday(value?: string): boolean {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date) === todayKey();
}

function formatLiters(value?: number): string {
  if (!Number.isFinite(value ?? NaN)) return '0,0 L';
  return `${(value ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`;
}

function isInconsistent(record: FuelingRecord): boolean {
  const hasHourmeter = record.hourmeter != null && Number.isFinite(record.hourmeter) && record.hourmeter > 0;
  const hasOdometer = record.odometer != null && Number.isFinite(record.odometer) && record.odometer > 0;

  return !Number.isFinite(record.dieselLiters) ||
    record.dieselLiters <= 0 ||
    (!hasHourmeter && !hasOdometer) ||
    ((record.gpsLatitude != null || record.gpsLongitude != null) &&
      (
        !Number.isFinite(record.gpsLatitude as number) ||
        !Number.isFinite(record.gpsLongitude as number) ||
        record.gpsLatitude === 0 ||
        record.gpsLongitude === 0
      ));
}

function getTopFuel(records: FuelingRecord[]): { fuelType: string; liters: number } {
  const totals = new Map<string, number>();
  for (const record of records) {
    const key = String(record.fuelType ?? '').trim() || 'Desconhecido';
    totals.set(key, (totals.get(key) ?? 0) + (Number(record.dieselLiters) || 0));
  }
  let fuelType = '—';
  let liters = 0;
  for (const [key, total] of totals.entries()) {
    if (total > liters) {
      fuelType = key;
      liters = total;
    }
  }
  return { fuelType, liters };
}

function CombustivelPainelPage() {
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiResponse>({});

  const load = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/abastecimentos', { cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar abastecimentos');
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar abastecimentos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const records = data.records ?? [];
  const todayRecords = records.filter((record) => isToday(record.fueledAt ?? record.receivedAt));
  const recentRecords = (data.recentRecords?.length ? data.recentRecords : records.slice(0, 5)).slice(0, 5);
  const topFuel = getTopFuel(todayRecords.length ? todayRecords : records);
  const litersToday = todayRecords.reduce((sum, record) => sum + (Number(record.dieselLiters) || 0), 0);
  const fuelingToday = todayRecords.length;
  const pending = records.filter((record) => record.syncStatus !== 'SYNCED').length;
  const divergences = records.filter(isInconsistent).length;
  const hasData = records.length > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[#060c1a] text-white">
      <CombustivelPageHeader
        title="Gestão de Combustível"
        subtitle="Painel geral — abastecimentos, comboios e estoque"
        currentPage="Painel"
        actions={
          <>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0d1426] border border-[#2d3647] text-xs font-bold text-muted-foreground hover:text-white hover:border-[#3d4a5f] transition-all"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Atualizar
            </button>
            <a
              href="/combustivel/abastecimentos"
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white transition-all"
            >
              <Plus size={13} />
Registrar abastecimento
            </a>
          </>
        }
      />

      <div className="px-8 py-6 space-y-8">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard icon={<Droplets size={20} />} label="Litros Hoje" value={formatLiters(litersToday)} sub={hasData ? 'Dados reais do tenant' : 'Nenhum registro'} color="blue" />
          <KpiCard icon={<Fuel size={20} />} label="Abastecimentos Hoje" value={fuelingToday} sub={hasData ? 'Registros do dia' : 'Aguardando registros'} color="green" />
          <KpiCard icon={<Truck size={20} />} label="Comboios Ativos" value="—" sub="Base para próxima fase" color="orange" />
<KpiCard icon={<Package size={20} />} label="Produto mais utilizado" value={topFuel.fuelType} sub={topFuel.liters > 0 ? formatLiters(topFuel.liters) : 'Sem dados do dia'} color="default" />
          <KpiCard icon={<Clock size={20} />} label="Pendentes Sincronismo" value={pending} sub={pending > 0 ? 'Há eventos pendentes' : 'Tudo sincronizado'} color="default" />
          <KpiCard icon={<AlertTriangle size={20} />} label="Divergências" value={divergences} sub={divergences > 0 ? 'Revisar inconsistências' : 'Sem alertas'} color="default" />
        </div>

        <div>
<h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">Alertas recentes</h2>
          <div className="space-y-2">
            {error ? (
              <AlertRow type="error" message={error} time="agora" />
            ) : hasData ? (
              <AlertRow
                type="info"
                message={`Painel atualizado com ${records.length} abastecimento(s) reais do tenant.`}
                time={refreshing ? 'atualizando' : 'agora'}
              />
            ) : (
              <AlertRow
                type="info"
                message={loading ? 'Carregando abastecimentos reais...' : 'Nenhum abastecimento real recebido ainda.'}
                time="agora"
              />
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Últimos Abastecimentos</h2>
            <a href="/combustivel/abastecimentos" className="text-[10px] text-blue-400 hover:text-blue-300 font-bold">ver todos →</a>
          </div>
          <div className="bg-[#0d1426] border border-[#2d3647] rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#2d3647]">
                  {['Data/Hora', 'Frota', 'Operador', 'Comboio', 'Produto', 'Litros', 'Status'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRecords.length > 0 ? recentRecords.map((record) => (
                  <tr key={record.eventId} className="border-t border-[#1f2740]">
                    <td className="px-4 py-3 text-white/80 whitespace-nowrap">{formatDateTime(record.fueledAt ?? record.receivedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="text-white font-semibold">{record.fleetCode}</div>
                      {record.fleetDescription ? <div className="text-[10px] text-muted-foreground">{record.fleetDescription}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-white/80">{resolveOperatorDisplay(record)}</td>
                    <td className="px-4 py-3 text-white/80">{resolveComboioBomba({
                      comboioFleetCode: record.comboioFleetCode,
                      truckFleetCode: record.truckFleetCode,
                      pumpCode: record.pumpCode,
                    })}</td>
                    <td className="px-4 py-3 text-white/80">{resolveFuelProduct(record)}</td>
                    <td className="px-4 py-3 text-white/80">{formatLiters(record.dieselLiters)}</td>
                    <td className="px-4 py-3 text-white/80">{record.syncStatus ?? 'SYNCED'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Fuel size={32} className="opacity-20" />
                        <p className="font-bold text-sm">Nenhum abastecimento registrado</p>
                        <p className="text-[10px]">Os registros aparecerão aqui após o primeiro abastecimento via App ou Web.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <TrendingUp size={18} className="text-blue-400 mt-0.5 shrink-0" />
            <div>
<p className="text-xs font-black text-blue-300 mb-1">Integração com o aplicativo</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Este módulo agora lê dados reais persistidos por tenant a partir da sincronização mobile.
              </p>
            </div>
          </div>
        </div>

        <div>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">Acessos Rápidos</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { href: '/combustivel/abastecimentos', label: 'Abastecimentos', icon: <Fuel size={16} /> },
              { href: '/combustivel/jornadas', label: 'Jornadas', icon: <Clock size={16} /> },
              { href: '/combustivel/comboios', label: 'Comboios', icon: <Truck size={16} /> },
              { href: '/combustivel/produtos', label: 'Produtos', icon: <Package size={16} /> },
              { href: '/combustivel/compartimentos', label: 'Compartimentos', icon: <Droplets size={16} /> },
              { href: '/combustivel/relatorios', label: 'Relatórios', icon: <CheckCircle size={16} /> },
            ].map(link => (
              <a
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-4 py-3 bg-[#0d1426] border border-[#2d3647] rounded-xl text-xs font-bold text-muted-foreground hover:text-white hover:border-[#3d4a5f] transition-all"
              >
                <span className="text-orange-400">{link.icon}</span>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default withAuth(CombustivelPainelPage, { module: 'COMBUSTIVEL_PAINEL' });
