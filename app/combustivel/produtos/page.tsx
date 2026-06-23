"use client";

import React, { useState } from 'react';
import { Package, Plus, Search } from 'lucide-react';
import { withAuth } from '@/components/shared/with-auth';
import { CombustivelPageHeader } from '@/components/combustivel/combustivel-page-header';

const COLUMNS = ['Código', 'Nome', 'Tipo', 'Unidade', 'Status'];

const EXEMPLOS = [
  { code: 'DIESEL_S10',  name: 'Diesel S10',   tipo: 'Combustível', unit: 'L' },
  { code: 'DIESEL_S500', name: 'Diesel S500',  tipo: 'Combustível', unit: 'L' },
  { code: 'ARLA_32',     name: 'Arla 32',      tipo: 'Aditivo',     unit: 'L' },
  { code: 'LUBR_15W40',  name: 'Lubrificante 15W40', tipo: 'Lubrificante', unit: 'L' },
  { code: 'GRAXA_GP',    name: 'Graxa GP',     tipo: 'Lubrificante', unit: 'kg' },
];

function CombustivelProdutosPage() {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);

  const filtered = EXEMPLOS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto bg-[#060c1a] text-white">
      <CombustivelPageHeader
        title="Produtos"
        subtitle="Combustíveis, lubrificantes e aditivos cadastrados"
        currentPage="Produtos"
        actions={
          <>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                className="pl-9 pr-4 py-2 bg-[#0d1426] border border-[#2d3647] rounded-xl text-xs text-white placeholder-muted-foreground focus:outline-none focus:border-orange-500/50 w-48"
              />
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-xs font-bold text-white transition-all"
            >
              <Plus size={13} />
              Novo Produto
            </button>
          </>
        }
      />

      <div className="px-8 py-6 space-y-4">
        {/* Form */}
        {showForm && (
          <div className="bg-[#0d1426] border border-orange-500/30 rounded-xl p-6">
            <h3 className="text-sm font-black mb-4 text-orange-300">Cadastrar Produto</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              {[
                { label: 'Código', placeholder: 'DIESEL_S10' },
                { label: 'Nome', placeholder: 'Diesel S10' },
                { label: 'Tipo', placeholder: 'Combustível / Lubrificante / Aditivo' },
                { label: 'Unidade', placeholder: 'L / kg / unid' },
              ].map(field => (
                <div key={field.label}>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5">{field.label}</label>
                  <input
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

        {/* Info */}
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4 text-[11px] text-orange-200/70">
          Estes produtos serão usados nos abastecimentos e sincronizados com o aplicativo via código (<code className="text-orange-300">productCode</code>).
          O código deve ser único por empresa e nunca convertido para número.
        </div>

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
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length} className="px-4 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Package size={36} className="opacity-15" />
                      <p className="font-black text-sm text-white/50">Nenhum produto encontrado</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p, i) => (
                  <tr key={p.code} className={`border-b border-[#2d3647]/50 hover:bg-[#ffffff04] transition-colors ${i % 2 === 0 ? '' : 'bg-[#ffffff02]'}`}>
                    <td className="px-4 py-3 font-mono text-orange-300 font-bold">{p.code}</td>
                    <td className="px-4 py-3 font-bold text-white">{p.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.tipo}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.unit}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300">
                        Ativo
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Exibindo {filtered.length} produto(s). Os produtos acima são exemplos de referência — edite ou substitua conforme necessário.
        </p>
      </div>
    </div>
  );
}

export default withAuth(CombustivelProdutosPage, { module: 'COMBUSTIVEL_PRODUTOS' });
