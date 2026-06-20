"use client";

import React, { useState } from 'react';
import { Truck, Plus, Search, CheckCircle, XCircle } from 'lucide-react';
import { withAuth } from '@/components/shared/with-auth';
import { CombustivelPageHeader } from '@/components/combustivel/combustivel-page-header';

const COLUMNS = ['Código', 'Descrição', 'Placa', 'Capacidade Total (L)', 'Status', 'Ações'];

function CombustivelComboiosPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[#060c1a] text-white">
      <CombustivelPageHeader
        title="Comboios"
        subtitle="Cadastro de unidades abastecedoras (caminhão-pipa, reboque, etc.)"
        currentPage="Comboios"
        actions={
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar comboio..."
                className="pl-9 pr-4 py-2 bg-[#0d1426] border border-[#2d3647] rounded-xl text-xs text-white placeholder-muted-foreground focus:outline-none focus:border-orange-500/50 w-48"
              />
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white transition-all"
            >
              <Plus size={13} />
              Novo Comboio
            </button>
          </>
        }
      />

      <div className="px-8 py-6 space-y-4">
        {/* Form */}
        {showForm && (
          <div className="bg-[#0d1426] border border-orange-500/30 rounded-xl p-6">
            <h3 className="text-sm font-black mb-4 text-orange-300">Cadastrar Comboio</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Código', placeholder: 'CB-01', hint: 'Sempre String' },
                { label: 'Descrição', placeholder: 'Caminhão Pipa 01' },
                { label: 'Placa', placeholder: 'AAA-0000 (opcional)' },
                { label: 'Capacidade (L)', placeholder: '0,0', type: 'number' },
              ].map(field => (
                <div key={field.label}>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">
                    {field.label}
                    {field.hint && <span className="ml-1 text-orange-400/70">({field.hint})</span>}
                  </label>
                  <input
                    type={field.type || 'text'}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 bg-[#060c1a] border border-[#2d3647] rounded-lg text-xs text-white placeholder-muted-foreground focus:outline-none focus:border-orange-500/50"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white rounded-xl transition-all">
                Salvar
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-[#060c1a] border border-[#2d3647] text-xs font-bold text-muted-foreground hover:text-white rounded-xl transition-all"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Table */}
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
                    <Truck size={40} className="opacity-15" />
                    <p className="font-black text-sm text-white/50">Nenhum comboio cadastrado</p>
                    <p className="text-[11px] max-w-xs text-center">
                      Clique em <strong className="text-orange-400">Novo Comboio</strong> para cadastrar sua primeira unidade abastecedora.
                    </p>
                    <button
                      onClick={() => setShowForm(true)}
                      className="flex items-center gap-2 px-4 py-2 mt-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white transition-all"
                    >
                      <Plus size={13} />
                      Cadastrar Agora
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legenda status */}
        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-emerald-300">
            <CheckCircle size={12} /> Ativo
          </span>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
            <XCircle size={12} /> Inativo
          </span>
        </div>
      </div>
    </div>
  );
}

export default withAuth(CombustivelComboiosPage, { module: 'COMBUSTIVEL_COMBOIOS' });
