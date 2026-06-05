"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { EquipmentProfileService } from '@/services/master.service';
import { EquipmentProfile } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { equipmentProfileSchema, EquipmentProfileFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import {
  ShieldCheck,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Search,
  Cpu
} from 'lucide-react';

export default function EquipmentProfilesPage() {
  const [data, setData] = useState<EquipmentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EquipmentProfile | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EquipmentProfileFormData>({
    resolver: zodResolver(equipmentProfileSchema),
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) reset(selectedItem);
      else reset({ name: '', description: '' });
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    const result = await EquipmentProfileService.getAll();
    setData(result);
    setLoading(false);
  };

  const onSubmit = async (formData: EquipmentProfileFormData) => {
    try {
      if (selectedItem) await EquipmentProfileService.update(selectedItem.id, formData);
      else await EquipmentProfileService.create(formData);
      setIsDrawerOpen(false);
      loadData();
    } catch (error: any) { alert(error.message); }
  };

  const filteredData = data.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Perfis de Configuração" description="Modelos de Parâmetros e Telemetria para Ativos">
            <button onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg"><Plus size={16} strokeWidth={3} /> Novo Perfil</button>
          </PageHeader>

          <div className="mb-6 relative w-full max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Filtrar perfis..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50" />
          </div>

          {loading ? (
            <div className="flex justify-center p-12"><Loader2 size={40} className="text-primary animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredData.map(item => (
                <div key={item.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-6 group hover:border-primary/40 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                       <ShieldCheck size={24} />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }} className="p-2 text-muted-foreground hover:text-white transition-colors"><Edit size={16} /></button>
                      <button onClick={async () => { if(confirm('Excluir perfil?')) { await EquipmentProfileService.archive(item.id); loadData(); } }} className="p-2 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <h3 className="text-lg font-black italic tracking-tighter uppercase text-white group-hover:text-primary transition-colors">{item.name}</h3>
                  <div className="mt-4 flex items-center gap-2 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                     <Cpu size={12} className="text-primary" /> Parâmetros Ativos
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="relative w-full max-w-md bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
             <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">{selectedItem ? 'Configurar Perfil' : 'Novo Perfil Técnico'}</h2>
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all"><X size={20} /></button>
             </div>
             <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <FormField label="Identificação do Perfil" error={errors.name?.message} required><input {...register('name')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" placeholder="Ex: Perfil Colheita Grãos" /></FormField>
                <FormField label="Descrição de Uso" error={errors.description?.message}><textarea {...register('description')} rows={4} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none resize-none" placeholder="..." /></FormField>
                <div className="pt-6 flex gap-3">
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">{isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar Perfil</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
