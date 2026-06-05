"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { EquipmentTypeService } from '@/services/master.service';
import { EquipmentType } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { equipmentTypeSchema, EquipmentTypeFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Search,
  Tractor,
  Truck,
  Zap,
  Box
} from 'lucide-react';

export default function EquipmentTypesPage() {
  const [data, setData] = useState<EquipmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EquipmentType | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<EquipmentTypeFormData>({
    resolver: zodResolver(equipmentTypeSchema),
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) reset(selectedItem);
      else reset({ name: '', description: '', category: 'MOTORIZADO', icon: 'Tractor' });
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    const result = await EquipmentTypeService.getAll();
    setData(result);
    setLoading(false);
  };

  const onSubmit = async (formData: EquipmentTypeFormData) => {
    try {
      if (selectedItem) await EquipmentTypeService.update(selectedItem.id, formData);
      else await EquipmentTypeService.create(formData);
      setIsDrawerOpen(false);
      loadData();
    } catch (error: any) { alert(error.message); }
  };

  const filteredData = data.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Tractor': return <Tractor size={20} />;
      case 'Truck': return <Truck size={20} />;
      case 'Zap': return <Zap size={20} />;
      default: return <Box size={20} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Tipos de Equipamento" description="Classificação Mestre de Ativos da Frota">
            <button onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"><Plus size={16} strokeWidth={3} /> Novo Tipo</button>
          </PageHeader>

          <div className="mb-6 relative w-full max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Filtrar tipos..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50" />
          </div>

          {loading ? (
            <div className="flex justify-center p-12"><Loader2 size={40} className="text-primary animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredData.map(item => (
                <div key={item.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl p-4 flex items-center justify-between group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#1a1f3a] border border-[#2d3647] flex items-center justify-center text-primary">{getIcon(item.icon)}</div>
                    <div>
                      <h3 className="text-sm font-black uppercase tracking-widest text-white">{item.name}</h3>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase">{item.category}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }} className="p-2 text-muted-foreground hover:text-white transition-colors"><Edit size={16} /></button>
                    <button onClick={async () => { if(confirm('Excluir tipo?')) { await EquipmentTypeService.archive(item.id); loadData(); } }} className="p-2 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
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
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">{selectedItem ? 'Editar Tipo' : 'Novo Tipo'}</h2>
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all"><X size={20} /></button>
             </div>
             <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <FormField label="Nome do Tipo" error={errors.name?.message} required><input {...register('name')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" /></FormField>
                <FormField label="Categoria" error={errors.category?.message} required><select {...register('category')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none"><option value="MOTORIZADO">Motorizado</option><option value="IMPLEMENTO">Implemento</option><option value="ESTATICO">Estático</option><option value="OUTROS">Outros</option></select></FormField>
                <FormField label="Ícone Representativo" error={errors.icon?.message}><select {...register('icon')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none"><option value="Tractor">Trator / Colhedora</option><option value="Truck">Caminhão / Veículo</option><option value="Zap">Transbordo / Implemento</option><option value="Box">Outros</option></select></FormField>
                <div className="pt-6 flex gap-3">
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">{isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
