"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { ChecklistModelService, EquipmentTypeService } from '@/services/api-service';
import { ChecklistModel, EquipmentType } from '@/lib/types';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { checklistModelSchema, ChecklistModelFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import { withAuth } from '@/components/shared/with-auth';
import {
  ClipboardCheck,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Search,
  AlertTriangle,
  ChevronRight,
  GripVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';

function ChecklistsPage() {
  const [data, setData] = useState<ChecklistModel[]>([]);
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ChecklistModel | null>(null);

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<ChecklistModelFormData>({
    resolver: zodResolver(checklistModelSchema),
    defaultValues: {
      name: '',
      equipmentTypeId: '',
      questions: [{ id: Math.random().toString(36).substring(7), text: '', type: 'YES_NO', required: true, isCritical: false }],
      isActive: true
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "questions"
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) reset({
        name: selectedItem.name,
        description: selectedItem.description || '',
        equipmentTypeId: selectedItem.equipmentTypeId,
        questions: selectedItem.questions,
        isActive: selectedItem.isActive
      });
      else reset({ name: '', description: '', equipmentTypeId: '', questions: [{ id: Math.random().toString(36).substring(7), text: '', type: 'YES_NO', required: true, isCritical: false }], isActive: true });
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    const [models, t] = await Promise.all([
      ChecklistModelService.getAll(),
      EquipmentTypeService.getAll()
    ]);
    setData(models);
    setTypes(t);
    setLoading(false);
  };

  const onSubmit = async (formData: ChecklistModelFormData) => {
    try {
      if (selectedItem) await ChecklistModelService.update(selectedItem.id, formData);
      else await ChecklistModelService.create(formData);
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
          <PageHeader title="Checklists de Inspeção" description="Gestão de Formulários de Verificação Técnica e Segurança">
            <button onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"><Plus size={16} strokeWidth={3} /> Criar Template</button>
          </PageHeader>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="text" placeholder="Buscar por nome do modelo..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 shadow-inner" /></div>
          </div>

          {loading ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4"><Loader2 size={40} className="text-primary animate-spin" /><p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Sincronizando Templates...</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredData.map((item) => {
                const type = types.find(t => t.id === item.equipmentTypeId);
                return (
                  <div key={item.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-5 hover:border-primary/40 transition-all group relative overflow-hidden flex flex-col">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#1a1f3a] flex items-center justify-center text-primary shadow-lg border border-[#2d3647]"><ClipboardCheck size={24} /></div>
                        <div><h3 className="text-lg font-black italic tracking-tighter text-white uppercase group-hover:text-primary transition-colors leading-none">{item.name}</h3><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">{type?.name || 'Geral'}</p></div>
                      </div>
                      <div className="flex gap-1"><button onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }} className="p-2 text-muted-foreground hover:text-white transition-colors hover:bg-[#1a1f3a] rounded-lg"><Edit size={16} /></button><button onClick={async () => { if(confirm('Excluir template?')) { try { await ChecklistModelService.archive(item.id); loadData(); } catch(e:any) { alert(e.message); } } }} className="p-2 text-muted-foreground hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg"><Trash2 size={16} /></button></div>
                    </div>
                    <div className="space-y-3 mb-6 flex-1">
                      <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground uppercase font-black">Perguntas</span><span className="text-xs font-bold text-white">{item.questions.length} itens</span></div>
                      <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground uppercase font-black">Itens Críticos</span><span className="text-xs font-bold text-red-500">{item.questions.filter(q => q.isCritical).length}</span></div>
                    </div>
                    <div className="pt-4 border-t border-[#2d3647] flex items-center justify-between">
                       <div className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase border", item.isActive ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-gray-500/10 text-gray-500 border-gray-500/20")}>{item.isActive ? 'Ativo' : 'Inativo'}</div>
                       <button className="text-[10px] font-black text-primary uppercase hover:underline flex items-center gap-1">Visualizar Itens <ChevronRight size={12} /></button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="relative w-full max-w-2xl bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-8"><h2 className="text-xl font-black italic tracking-tighter uppercase text-white">{selectedItem ? 'Editar Template' : 'Novo Template'}</h2><button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all"><X size={24} /></button></div>
            <form className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar" onSubmit={handleSubmit(onSubmit)}>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Nome do Modelo" error={errors.name?.message} required><input {...register('name')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" placeholder="Ex: Checklist Semanal Tratores" /></FormField>
                <FormField label="Tipo de Equipamento" error={errors.equipmentTypeId?.message} required><select {...register('equipmentTypeId')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none font-bold uppercase"><option value="">Selecione...</option>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></FormField>
              </div>

              <div className="space-y-4">
                 <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-black uppercase tracking-widest text-primary">Itens do Checklist</h3>
                    <button type="button" onClick={() => append({ id: Math.random().toString(36).substring(7), text: '', type: 'YES_NO', required: true, isCritical: false })} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-black uppercase border border-primary/20 hover:bg-primary/20 transition-all"><Plus size={14} /> Adicionar Item</button>
                 </div>

                 <div className="space-y-3">
                    {fields.map((field, index) => (
                       <div key={field.id} className="bg-[#1a1f3a]/40 border border-[#2d3647] p-4 rounded-2xl relative group">
                          <div className="flex items-start gap-4">
                             <div className="mt-2 text-muted-foreground"><GripVertical size={16} /></div>
                             <div className="flex-1 grid grid-cols-12 gap-4">
                                <div className="col-span-12 lg:col-span-6">
                                   <input {...register(`questions.${index}.text`)} className="w-full bg-transparent border-b border-[#2d3647] py-1 text-sm focus:border-primary outline-none font-bold text-white" placeholder="Pergunta do checklist..." />
                                </div>
                                <div className="col-span-12 lg:col-span-3">
                                   <select {...register(`questions.${index}.type`)} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-lg p-1.5 text-[10px] font-black uppercase outline-none appearance-none"><option value="YES_NO">Sim / Não</option><option value="NUMERIC">Numérico</option><option value="TEXT">Texto</option><option value="PHOTO">Foto</option></select>
                                </div>
                                <div className="col-span-12 lg:col-span-3 flex items-center justify-end gap-4">
                                   <label className="flex items-center gap-2 cursor-pointer group/crit"><input type="checkbox" {...register(`questions.${index}.isCritical`)} className="sr-only peer" /><div className="w-4 h-4 border border-[#2d3647] rounded peer-checked:bg-red-500 peer-checked:border-red-500 flex items-center justify-center transition-all"><AlertTriangle size={10} className="text-white opacity-0 peer-checked:opacity-100" /></div><span className="text-[9px] font-black text-muted-foreground group-hover/crit:text-red-500 uppercase">Crítico</span></label>
                                   <button type="button" onClick={() => remove(index)} className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                                </div>
                             </div>
                          </div>
                       </div>
                    ))}
                 </div>
              </div>

              <div className="pt-6 flex gap-3"><button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20">{isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar Template</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(ChecklistsPage, { module: 'FROTA' });
