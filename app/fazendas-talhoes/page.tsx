"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MasterDataShell } from '@/components/master-data/master-data-shell';
import { FarmService, FieldService } from '@/services/api-service';
import { Farm, Field } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { farmSchema, fieldSchema, FarmFormData, FieldFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import {
  MapPin,
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Sprout,
  Factory
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { withAuth } from '@/components/shared/with-auth';

function FazendasPage() {
  const [activeTab, setActiveTab] = useState<'FARMS' | 'FIELDS'>('FARMS');
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isFarmDrawerOpen, setIsFarmDrawerOpen] = useState(false);
  const [isFieldDrawerOpen, setIsFieldDrawerOpen] = useState(false);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [selectedField, setSelectedField] = useState<Field | null>(null);

  const farmForm = useForm<FarmFormData>({ resolver: zodResolver(farmSchema) });
  const fieldForm = useForm<FieldFormData>({ resolver: zodResolver(fieldSchema) });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isFarmDrawerOpen) {
      if (selectedFarm) farmForm.reset(selectedFarm);
      else farmForm.reset({ code: '', name: '', municipality: '', totalArea: 0, status: 'ATIVO' });
    }
  }, [selectedFarm, isFarmDrawerOpen, farmForm]);

  useEffect(() => {
    if (isFieldDrawerOpen) {
      if (selectedField) fieldForm.reset(selectedField);
      else fieldForm.reset({ code: '', farmId: '', area: 0, crop: '', status: 'ATIVO' });
    }
  }, [selectedField, isFieldDrawerOpen, fieldForm]);

  const loadData = async () => {
    setLoading(true);
    const [famsRes, fieldsRes] = await Promise.all([FarmService.getAll(), FieldService.getAll()]);
    setFarms(famsRes);
    setFields(fieldsRes);
    setLoading(false);
  };

  const onFarmSubmit = async (data: FarmFormData) => {
    if (selectedFarm) await FarmService.update(selectedFarm.id, data);
    else await FarmService.create(data);
    setIsFarmDrawerOpen(false);
    loadData();
  };

  const onFieldSubmit = async (data: FieldFormData) => {
    if (selectedField) await FieldService.update(selectedField.id, data);
    else await FieldService.create(data);
    setIsFieldDrawerOpen(false);
    loadData();
  };

  const filteredFarms = farms.filter(f => f.name.toLowerCase().includes(search.toLowerCase()) || f.code.toLowerCase().includes(search.toLowerCase()));
  const filteredFields = fields.filter(f => {
    const farmName = farms.find(farm => farm.id === f.farmId)?.name || '';
    return f.code.toLowerCase().includes(search.toLowerCase()) || farmName.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    <MasterDataShell
            title="Fazendas e Talhões"
            description="Gestão de Áreas e Estrutura Geográfica"
            actions={
              <div className="flex gap-3">
                <button
                  onClick={() => { setSelectedFarm(null); setIsFarmDrawerOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-[#252d4a] transition-all"
                >
                  <Plus size={14} /> Nova Fazenda
                </button>
                <button
                  onClick={() => { setSelectedField(null); setIsFieldDrawerOpen(true); }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-[10px] font-black uppercase tracking-tighter hover:scale-105 transition-transform"
                >
                  <Plus size={14} strokeWidth={3} /> Novo Talhão
                </button>
              </div>
            }
          >

          <div className="flex items-center justify-between mb-6">
             <div className="flex bg-[#0a0e27] border border-[#2d3647] p-1 rounded-2xl">
                <button
                  onClick={() => setActiveTab('FARMS')}
                  className={cn("px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", activeTab === 'FARMS' ? "bg-primary text-[#0a0e27]" : "text-muted-foreground hover:text-white")}
                >
                  Fazendas
                </button>
                <button
                  onClick={() => setActiveTab('FIELDS')}
                  className={cn("px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all", activeTab === 'FIELDS' ? "bg-primary text-[#0a0e27]" : "text-muted-foreground hover:text-white")}
                >
                  TalhÃµes
                </button>
             </div>
             <div className="relative w-64">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Pesquisar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#0a0e27] border border-[#2d3647] rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-primary/50"
                />
             </div>
          </div>

          {loading ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 size={40} className="text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Mapeando Território...</p>
            </div>
          ) : activeTab === 'FARMS' ? (
             filteredFarms.length === 0 ? (
               <div className="flex flex-col items-center justify-center min-h-[320px] rounded-3xl border border-dashed border-[#2d3647] bg-[#0a0e27]/60 px-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
                     <Factory size={28} />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tighter text-white">Nenhuma fazenda cadastrada</h3>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">Cadastre fazendas e talhões para estruturar a base territorial da operação agrícola.</p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button onClick={() => { setSelectedFarm(null); setIsFarmDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-[#252d4a] transition-all">
                      <Plus size={14} /> Nova Fazenda
                    </button>
                    <button onClick={() => { setSelectedField(null); setIsFieldDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-[10px] font-black uppercase tracking-tighter hover:scale-105 transition-transform">
                      <Plus size={14} strokeWidth={3} /> Novo Talhão
                    </button>
                  </div>
               </div>
             ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredFarms.map(farm => (
                   <div key={farm.id} className="bg-[#0a0e27]/70 border border-[#2d3647] rounded-3xl p-6 group hover:border-primary/30 hover:shadow-lg hover:shadow-black/10 transition-all overflow-hidden">
                      <div className="flex items-start justify-between mb-4">
                         <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20 text-primary">
                            <Factory size={24} />
                         </div>
                         <div className="flex gap-1">
                            <button onClick={() => { setSelectedFarm(farm); setIsFarmDrawerOpen(true); }} className="p-2 text-muted-foreground hover:text-white rounded-lg hover:bg-[#1a1f3a]"><Edit size={16} /></button>
                            <button onClick={async () => { if(confirm('Excluir fazenda?')) { await FarmService.archive(farm.id); loadData(); } }} className="p-2 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-500/10"><Trash2 size={16} /></button>
                         </div>
                      </div>
                      <h3 className="text-lg font-black italic tracking-tighter uppercase text-white group-hover:text-primary transition-colors">{farm.name}</h3>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1 mt-1"><MapPin size={10} /> {farm.municipality}</p>
                      <div className="mt-6 pt-4 border-t border-[#2d3647] flex items-center justify-between">
                         <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Área Total</span>
                         <span className="text-sm font-black italic text-primary">{farm.totalArea} ha</span>
                      </div>
                   </div>
                ))}
             </div>
             )
          ) : (
             filteredFields.length === 0 ? (
               <div className="flex flex-col items-center justify-center min-h-[320px] rounded-3xl border border-dashed border-[#2d3647] bg-[#0a0e27]/60 px-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
                     <Sprout size={28} />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tighter text-white">Nenhum talhão cadastrado</h3>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">Cadastre talhões vinculados às fazendas para organizar zonas, frentes e áreas operacionais.</p>
                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button onClick={() => { setSelectedFarm(null); setIsFarmDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-[#252d4a] transition-all">
                      <Plus size={14} /> Nova Fazenda
                    </button>
                    <button onClick={() => { setSelectedField(null); setIsFieldDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-[10px] font-black uppercase tracking-tighter hover:scale-105 transition-transform">
                      <Plus size={14} strokeWidth={3} /> Novo Talhão
                    </button>
                  </div>
               </div>
             ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredFields.map(field => {
                   const farm = farms.find(f => f.id === field.farmId);
                   return (
                      <div key={field.id} className="bg-[#0a0e27]/70 border border-[#2d3647] rounded-3xl p-6 group hover:border-primary/30 hover:shadow-lg hover:shadow-black/10 transition-all overflow-hidden">
                         <div className="flex items-start justify-between mb-4">
                            <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-500">
                               <Sprout size={24} />
                            </div>
                            <div className="flex gap-1">
                               <button onClick={() => { setSelectedField(field); setIsFieldDrawerOpen(true); }} className="p-2 text-muted-foreground hover:text-white rounded-lg hover:bg-[#1a1f3a]"><Edit size={16} /></button>
                               <button onClick={async () => { if(confirm('Excluir talhão?')) { await FieldService.archive(field.id); loadData(); } }} className="p-2 text-muted-foreground hover:text-red-500 rounded-lg hover:bg-red-500/10"><Trash2 size={16} /></button>
                            </div>
                         </div>
                         <h3 className="text-lg font-black italic tracking-tighter uppercase text-white group-hover:text-primary transition-colors">{field.code}</h3>
                         <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center gap-1 mt-1"><Factory size={10} /> {farm?.name || 'Desconhecido'}</p>
                         <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-[#2d3647]">
                            <div className="flex flex-col"><span className="text-[9px] text-muted-foreground font-black uppercase">Área</span><span className="text-xs font-black text-white">{field.area} ha</span></div>
                            <div className="flex flex-col"><span className="text-[9px] text-muted-foreground font-black uppercase">Cultura</span><span className="text-xs font-black text-white">{field.crop}</span></div>
                         </div>
                      </div>
                   )
                })}
            </div>
             )
          )}
          </MasterDataShell>
        </main>
      </div>

      {/* Farm Drawer */}
      {isFarmDrawerOpen && (
         <div className="fixed inset-0 z-[2000] flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsFarmDrawerOpen(false)}></div>
            <div className="relative w-full max-w-md bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">{selectedFarm ? 'Editar Fazenda' : 'Nova Fazenda'}</h2>
                  <button onClick={() => setIsFarmDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all"><X size={20} /></button>
               </div>
               <form className="space-y-6" onSubmit={farmForm.handleSubmit(onFarmSubmit)}>
                  <FormField label="CÃ³digo" error={farmForm.formState.errors.code?.message} required><input {...farmForm.register('code')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" /></FormField>
                  <FormField label="Nome" error={farmForm.formState.errors.name?.message} required><input {...farmForm.register('name')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" /></FormField>
                  <FormField label="MunicÃ­pio" error={farmForm.formState.errors.municipality?.message} required><input {...farmForm.register('municipality')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" /></FormField>
                  <FormField label="Ãrea Total (ha)" error={farmForm.formState.errors.totalArea?.message} required><input type="number" step="0.1" {...farmForm.register('totalArea')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" /></FormField>
                  <div className="pt-6 flex gap-3">
                    <button type="submit" className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20"><Save size={14} /> Salvar Fazenda</button>
                  </div>
               </form>
            </div>
         </div>
      )}

      {/* Field Drawer */}
      {isFieldDrawerOpen && (
         <div className="fixed inset-0 z-[2000] flex justify-end">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsFieldDrawerOpen(false)}></div>
            <div className="relative w-full max-w-md bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">{selectedField ? 'Editar TalhÃ£o' : 'Novo TalhÃ£o'}</h2>
                  <button onClick={() => setIsFieldDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all"><X size={20} /></button>
               </div>
               <form className="space-y-6" onSubmit={fieldForm.handleSubmit(onFieldSubmit)}>
                  <FormField label="Fazenda" error={fieldForm.formState.errors.farmId?.message} required>
                    <select {...fieldForm.register('farmId')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                       <option value="">Selecione a Fazenda</option>
                       {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </select>
                  </FormField>
                  <FormField label="CÃ³digo do TalhÃ£o" error={fieldForm.formState.errors.code?.message} required><input {...fieldForm.register('code')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" /></FormField>
                  <div className="grid grid-cols-2 gap-4">
                     <FormField label="Ãrea (ha)" error={fieldForm.formState.errors.area?.message} required><input type="number" step="0.1" {...fieldForm.register('area')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" /></FormField>
                     <FormField label="Cultura" error={fieldForm.formState.errors.crop?.message} required><input {...fieldForm.register('crop')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" /></FormField>
                  </div>
                  <div className="pt-6 flex gap-3">
                    <button type="submit" className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20"><Save size={14} /> Salvar TalhÃ£o</button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </div>
  );
}

export default withAuth(FazendasPage, { module: 'FAZENDAS' });


