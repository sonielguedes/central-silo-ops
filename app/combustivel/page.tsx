"use client";

import React, { useState } from 'react';
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

// ── KPI Card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: 'green' | 'blue' | 'orange' | 'red' | 'default';
}

function KpiCard({ icon, label, value, sub, color = 'default' }: KpiCardProps) {
  const colors = {
    green:   'border-emerald-500/30 shadow-emerald-500/5',
    blue:    'border-blue-500/30 shadow-blue-500/5',
    orange:  'border-orange-500/30 shadow-orange-500/5',
    red:     'border-red-500/30 shadow-red-500/5',
    default: 'border-[#2d3647] shadow-black/10',
  };
  const iconColors = {
    green:   'text-emerald-400',
    blue:    'text-blue-400',
    orange:  'text-orange-400',
    red:     'text-red-400',
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

// ── Alert Row ─────────────────────────────────────────────────────────────────

interface AlertRowProps {
  type: 'warning' | 'info' | 'error';
  message: string;
  time: string;
}

function AlertRow({ type, message, time }: AlertRowProps) {
  const styles = {
    warning: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
    info:    'bg-blue-500/10 border-blue-500/30 text-blue-300',
    error:   'bg-red-500/10 border-red-500/30 text-red-300',
  };
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-xs ${styles[type]}`}>
      <AlertTriangle size={14} className="shrink-0" />
      <span className="flex-1">{message}</span>
      <span className="text-[10px] opacity-60 shrink-0">{time}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function CombustivelPainelPage() {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1200);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[#060c1a] text-white">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-[#2d3647] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Fuel size={24} className="text-orange-400" />
          <div>
            <h1 className="text-xl font-black tracking-tight">Gestão de Combustível</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Painel geral — abastecimentos, comboios e estoque</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
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
            Novo Abastecimento
          </a>
        </div>
      </div>

      <div className="px-8 py-6 space-y-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <KpiCard icon={<Droplets size={20} />} label="Litros Hoje" value="0,0 L" sub="Nenhum registro" color="blue" />
          <KpiCard icon={<Fuel size={20} />} label="Abastecimentos Hoje" value="0" sub="Aguardando registros" color="green" />
          <KpiCard icon={<Truck size={20} />} label="Comboios Ativos" value="0" sub="Cadastrar comboio" color="orange" />
          <KpiCard icon={<Package size={20} />} label="Produto + Utilizado" value="—" sub="Sem dados" color="default" />
          <KpiCard icon={<Clock size={20} />} label="Pendentes Sincronismo" value="0" sub="Tudo sincronizado" color="default" />
          <KpiCard icon={<AlertTriangle size={20} />} label="Divergências" value="0" sub="Sem alertas" color="default" />
        </div>

        {/* Alertas */}
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">Alertas Recentes</h2>
          <div className="space-y-2">
            <AlertRow
              type="info"
              message="Módulo inicializado. Cadastre comboios e produtos para iniciar os controles."
              time="agora"
            />
          </div>
        </div>

        {/* Últimos abastecimentos */}
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
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Fuel size={32} className="opacity-20" />
                      <p className="font-bold text-sm">Nenhum abastecimento registrado</p>
                      <p className="text-[10px]">Os registros aparecerão aqui após o primeiro abastecimento via App ou Web.</p>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Info integração */}
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <TrendingUp size={18} className="text-blue-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-black text-blue-300 mb-1">Integração App Robson</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Este módulo está preparado para receber eventos <code className="bg-blue-500/10 px-1 rounded text-blue-300">FUELING_RECORDED</code> do
                App Robson (appCode: ROBSON). Após a integração, os abastecimentos realizados no campo
                serão sincronizados automaticamente.
              </p>
            </div>
          </div>
        </div>

        {/* Links rápidos */}
        <div>
          <h2 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground mb-3">Acessos Rápidos</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { href: '/combustivel/abastecimentos', label: 'Abastecimentos', icon: <Fuel size={16} /> },
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
