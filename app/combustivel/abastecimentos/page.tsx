"use client";

import React, { useState } from 'react';
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

type OrigemTag = 'Web' | 'App Robson' | 'Offline';
type StatusTag  = 'Sincronizado' | 'Pendente' | 'Erro';

const ORIGEM_STYLE: Record<OrigemTag, string> = {
  'Web':        'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'App Robson': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'Offline':    'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

const STATUS_STYLE: Record<StatusTag, string> = {
  'Sincronizado': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'Pendente':     'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'Erro':         'bg-red-500/15 text-red-300 border-red-500/30',
};

const ORIGEM_ICON: Record<OrigemTag, React.ReactNode> = {
  'Web':        <Globe size={11} />,
  'App Robson': <Smartphone size={11} />,
  'Offline':    <WifiOff size={11} />,
};

const STATUS_ICON: Record<StatusTag, React.ReactNode> = {
  'Sincronizado': <CheckCircle size={11} />,
  'Pendente':     <Clock size={11} />,
  'Erro':         <AlertCircle size={11} />,
};

const COLUMNS = ['Data/Hora', 'Frota', 'Operador', 'Comboio', 'Produto', 'Litros', 'Horímetro/KM', 'Origem', 'Status'];

function CombustivelAbastecimentosPage() {
  const [search, setSearch] = useState('');

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[#060c1a] text-white">
      {/* Header */}
      <div className="px-8 pt-8 pb-4 border-b border-[#2d3647] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Fuel size={24} className="text-orange-400" />
          <div>
            <h1 className="text-xl font-black tracking-tight">Abastecimentos</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Histórico completo de abastecimentos por frota, operador e comboio</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
            Registrar
          </button>
        </div>
      </div>

      {/* Filtros rápidos */}
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
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Fuel size={40} className="opacity-15" />
                    <p className="font-black text-sm text-white/50">Nenhum abastecimento encontrado</p>
                    <p className="text-[11px] max-w-sm text-center">
                      Registros aparecerão após o primeiro abastecimento via Web ou App Robson.
                      Utilize o botão <strong className="text-orange-400">Registrar</strong> para adicionar manualmente.
                    </p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legenda de status */}
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
