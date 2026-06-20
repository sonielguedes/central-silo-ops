"use client";

import React, { useState } from 'react';
import { Droplets, Plus, Search } from 'lucide-react';
import { withAuth } from '@/components/shared/with-auth';

const COLUMNS = ['Comboio', 'Nº Compartimento', 'Produto Vinculado', 'Capacidade (L)', 'Volume Atual (L)', 'Status'];

function CombustivelCompartimentosPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[#060c1a] text-white">
      <div className="px-8 pt-8 pb-4 border-b border-[#2d3647] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Droplets size={24} className="text-orange-400" />
          <div>
            <h1 className="text-xl font-black tracking-tight">Compartimentos</h1>
            <p className="text-[11px] text-muted-foreground mt-0.5">Compartimentos por comboio — produto vinculado, capacidade e volume atual</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-9 pr-4 py-2 bg-[#0d1426] border border-[#2d3647] rounded-xl text-xs text-white placeholder-muted-foreground focus:outline-none focus:border-orange-500/50 w-48"
            />
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white transition-all"
          >
            <Plus size={13} />
            Novo Compartimento
          </button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-4">
        {showForm && (
          <div className="bg-[#0d1426] border border-orange-500/30 rounded-xl p-6">
            <h3 className="text-sm font-black mb-4 text-orange-300">Cadastrar Compartimento</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
              {[
                { label: 'Comboio', placeholder: 'Selecione o comboio' },
                { label: 'Nº Compartimento', placeholder: '1 / 2 / 3...' },
                { label: 'Produto Vinculado', placeholder: 'DIESEL_S10' },
                { label: 'Capacidade (L)', placeholder: '0,0', type: 'number' },
                { label: 'Volume Atual (L)', placeholder: '0,0', type: 'number' },
              ].map(field => (
                <div key={field.label}>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">{field.label}</label>
                  <input
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 bg-[#060c1a] border border-[#2d3647] rounded-lg text-xs text-white placeholder-muted-foreground focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white rounded-xl transition-all">Salvar</button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-[#060c1a] border border-[#2d3647] text-xs font-bold text-muted-foreground hover:text-white rounded-xl transition-all"
              >Cancelar</button>
            </div>
          </div>
        )}

        <div className="bg-[#0d1426] border border-[#2d3647] rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#2d3647]">
                {COLUMNS.map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Droplets size={40} className="opacity-15" />
                    <p className="font-black text-sm text-white/50">Nenhum compartimento cadastrado</p>
                    <p className="text-[11px] max-w-xs text-center">
                      Cadastre comboios primeiro, depois vincule compartimentos e produtos a cada um.
                    </p>
                    <div className="flex gap-3 mt-2">
                      <a href="/combustivel/comboios" className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-[#0d1426] border border-[#2d3647] text-muted-foreground hover:text-white transition-all">
                        → Comboios
                      </a>
                      <button
                        onClick={() => setShowForm(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-[10px] font-bold text-white transition-all"
                      >
                        <Plus size={11} />
                        Novo Compartimento
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default withAuth(CombustivelCompartimentosPage, { module: 'COMBUSTIVEL_COMPRT' });
