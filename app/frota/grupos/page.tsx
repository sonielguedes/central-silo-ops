"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { EquipmentGroupService } from '@/services/master.service';
import { EquipmentGroup } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { equipmentGroupSchema, EquipmentGroupFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Search
} from 'lucide-react';

export default function EquipmentGroupsPage() {
  const [data, setData] = useState<EquipmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EquipmentGroup | null>(null);

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<EquipmentGroupFormData>({
    resolver: zodResolver(equipmentGroupSchema),
    defaultValues: { color: '#3b82f6' }
  });

  const colorValue = watch('color');

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) reset({
        name: selectedItem.name,
        description: selectedItem.description || '',
        color: selectedItem.color || '#3b82f6',
        status: selectedItem.status || 'ATIVO'
      });
      else reset({ name: '', description: '', color: '#3b82f6', status: 'ATIVO' });
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    const result = await EquipmentGroupService.getAll();
    setData(result);
    setLoading(false);
  };

  const onSubmit = async (formData: EquipmentGroupFormData) => {
    try {
      if (selectedItem) await EquipmentGroupService.update(selectedItem.id, formData);
      else await EquipmentGroupService.create(formData);
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
          <PageHeader title="Grupos de Frota" description="Organização Lógica por Frentes ou Unidades Operacionais">
            <button onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg"><Plus size={16} strokeWidth={3} /> Novo Grupo</button>
          </PageHeader>

          <div className="mb-6 relative w-full max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Filtrar grupos..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50" />
          </div>

          {loading ? (
            <div className="flex justify-center p-12"><Loader2 size={40} className="text-primary animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredData.map(item => (
                <div key={item.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-6 group hover:border-primary/40 transition-all">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl border flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: `${item.color}20`, borderColor: `${item.color}40` }}>
                       <Users size={24} style={{ color: item.color }} />
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }} className="p-2 text-muted-foreground hover:text-white transition-colors"><Edit size={16} /></button>
                      <button onClick={async () => { if(confirm('Excluir grupo?')) { await EquipmentGroupService.archive(item.id); loadData(); } }} className="p-2 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <h3 className="text-lg font-black italic tracking-tighter uppercase text-white group-hover:text-primary transition-colors">{item.name}</h3>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.description || 'Sem descrição'}</p>
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
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">{selectedItem ? 'Editar Grupo' : 'Novo Grupo'}</h2>
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all text-white"><X size={24} /></button>
             </div>
             <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <FormField label="Nome do Grupo" error={errors.name?.message} required><input {...register('name')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" /></FormField>
                <FormField label="Cor de Identificação" error={errors.color?.message}>
                   <div className="flex gap-4 items-center">
                      <input type="color" {...register('color')} className="w-12 h-12 rounded-lg bg-transparent border-none cursor-pointer" />
                      <input type="text" readOnly value={colorValue} className="flex-1 bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none uppercase font-mono" placeholder="#000000" />
                   </div>
                </FormField>
                <FormField label="Status" error={errors.status?.message} required>
                  <select {...register('status')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </FormField>
                <FormField label="Descrição" error={errors.description?.message}><textarea {...register('description')} rows={4} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none resize-none" /></FormField>
                <div className="pt-6 flex gap-3">
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">{isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar Grupo</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
