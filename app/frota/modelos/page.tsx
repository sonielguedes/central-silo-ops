"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { EquipmentModelService, EquipmentTypeService } from '@/services/api-service';
import { EquipmentModel, EquipmentType } from '@/lib/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { equipmentModelSchema, EquipmentModelFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import { EquipmentIcon } from '@/components/icons/equipment-icons';
import { EquipmentIconPicker } from '@/components/icons/equipment-icon-picker';
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Search,
} from 'lucide-react';

export default function EquipmentModelsPage() {
  const [data, setData] = useState<EquipmentModel[]>([]);
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<EquipmentModel | null>(null);

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<EquipmentModelFormData>({
    resolver: zodResolver(equipmentModelSchema),
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) reset({ ...selectedItem, iconType: selectedItem.iconType || '' });
      else reset({ name: '', brand: '', typeId: '', iconType: '' });
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    const [models, t] = await Promise.all([EquipmentModelService.getAll(), EquipmentTypeService.getAll()]);
    setData(models);
    setTypes(t);
    setLoading(false);
  };

  const onSubmit = async (formData: EquipmentModelFormData) => {
    try {
      if (selectedItem) await EquipmentModelService.update(selectedItem.id, formData);
      else await EquipmentModelService.create(formData);
      setIsDrawerOpen(false);
      loadData();
    } catch (error: any) { alert(error.message); }
  };

  const filteredData = data.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.brand.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Modelos de Frota" description="Configurações Técnicas por Fabricante e Modelo">
            <button onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg"><Plus size={16} strokeWidth={3} /> Novo Modelo</button>
          </PageHeader>

          <div className="mb-6 relative w-full max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Filtrar modelos..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50" />
          </div>

          {loading ? (
            <div className="flex justify-center p-12"><Loader2 size={40} className="text-primary animate-spin" /></div>
          ) : (
            <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead className="bg-[#1a1f3a]/50 text-[10px] uppercase font-black tracking-widest text-muted-foreground border-b border-[#2d3647]">
                  <tr>
                    <th className="px-6 py-4">Ícone</th>
                    <th className="px-6 py-4">Fabricante</th>
                    <th className="px-6 py-4">Modelo</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3647]">
                  {filteredData.map(item => (
                    <tr key={item.id} className="hover:bg-primary/5 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="w-10 h-10 rounded-xl bg-[#1a1f3a] flex items-center justify-center text-primary border border-[#2d3647]">
                          <EquipmentIcon type={item.iconType} size={24} />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-white uppercase tracking-tighter">{item.brand}</td>
                      <td className="px-6 py-4 text-xs font-black italic text-primary">{item.name}</td>
                      <td className="px-6 py-4 text-xs text-muted-foreground uppercase">{types.find(t => t.id === item.typeId)?.name || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }} className="p-2 text-muted-foreground hover:text-white transition-colors"><Edit size={16} /></button>
                          <button onClick={async () => { if(confirm('Excluir modelo?')) { await EquipmentModelService.archive(item.id); loadData(); } }} className="p-2 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="relative w-full max-w-md bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
             <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">{selectedItem ? 'Editar Modelo' : 'Novo Modelo'}</h2>
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all"><X size={20} /></button>
             </div>
             <form className="space-y-6 flex-1 overflow-y-auto custom-scrollbar pr-1" onSubmit={handleSubmit(onSubmit)}>
                <FormField label="Fabricante" error={errors.brand?.message} required><input {...register('brand')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none uppercase font-bold" placeholder="John Deere, Case IH, Scania..." /></FormField>
                <FormField label="Nome do Modelo" error={errors.name?.message} required><input {...register('name')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none uppercase font-bold" placeholder="S770, Magnum 340..." /></FormField>
                <FormField label="Tipo de Equipamento" error={errors.typeId?.message} required>
                  <select {...register('typeId')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                    <option value="">Selecione...</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </FormField>

                {/* Ícone Operacional */}
                <FormField label="Ícone Operacional">
                  <Controller
                    name="iconType"
                    control={control}
                    render={({ field }) => (
                      <EquipmentIconPicker
                        value={field.value}
                        onChange={(v) => field.onChange(v)}
                      />
                    )}
                  />
                </FormField>

                <div className="pt-6 flex gap-3">
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">{isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar Modelo</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
