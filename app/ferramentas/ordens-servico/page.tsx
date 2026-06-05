"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { ServiceOrderService, EquipmentService } from '@/services/master.service';
import { ServiceOrder, Equipment } from '@/lib/types';
import {
  Plus,
  Loader2,
  X,
  Save,
  Search,
  Wrench,
  Clock,
  LayoutList
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { serviceOrderSchema, ServiceOrderFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';

export default function ServiceOrdersPage() {
  const [data, setData] = useState<ServiceOrder[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ServiceOrder | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ServiceOrderFormData>({
    resolver: zodResolver(serviceOrderSchema),
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) reset(selectedItem);
      else reset({ code: '', equipmentId: '', type: 'CORRETIVA', priority: 'MEDIA', description: '', status: 'ABERTA' });
    }
  }, [selectedItem, isDrawerOpen, reset]);

  const loadData = async () => {
    setLoading(true);
    const [orders, eqs] = await Promise.all([ServiceOrderService.getAll(), EquipmentService.getAll()]);
    setData(orders);
    setEquipments(eqs);
    setLoading(false);
  };

  const onSubmit = async (formData: ServiceOrderFormData) => {
    try {
      if (selectedItem) await ServiceOrderService.update(selectedItem.id, formData);
      else await ServiceOrderService.create({ ...formData, openedAt: new Date().toISOString() });
      setIsDrawerOpen(false);
      loadData();
    } catch (error: any) { alert(error.message); }
  };

  const filteredData = data.filter(item => item.code.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase()));

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'CRITICA': return 'text-red-500 bg-red-500/10 border-red-500/20';
      case 'ALTA': return 'text-orange-500 bg-orange-500/10 border-orange-500/20';
      case 'MEDIA': return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Ordens de Serviço" description="Gestão de Manutenções e Intervenções Técnicas na Frota">
            <button onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg"><Plus size={16} strokeWidth={3} /> Nova OS</button>
          </PageHeader>

          <div className="mb-6 relative w-full max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Buscar por código ou descrição..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50" />
          </div>

          {loading ? (
             <div className="flex justify-center p-12"><Loader2 size={40} className="text-primary animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredData.map(item => {
                const eq = equipments.find(e => e.id === item.equipmentId);
                return (
                  <div key={item.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-6 hover:border-primary/40 transition-all flex flex-col relative overflow-hidden">
                    <div className={cn("absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full blur-3xl opacity-10",
                      item.priority === 'CRITICA' ? 'bg-red-500' : 'bg-primary'
                    )}></div>

                    <div className="flex items-start justify-between mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#1a1f3a] border border-[#2d3647] flex items-center justify-center text-primary"><Wrench size={24} /></div>
                        <div>
                          <h3 className="text-lg font-black italic tracking-tighter text-white uppercase">{item.code}</h3>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Equipamento: {eq?.code || 'Desconhecido'}</p>
                        </div>
                      </div>
                      <span className={cn("px-3 py-1 rounded-full text-[9px] font-black uppercase border", getPriorityColor(item.priority))}>
                        {item.priority}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-white/80 line-clamp-2 mb-6">{item.description}</p>

                    <div className="grid grid-cols-2 gap-4 mt-auto pt-6 border-t border-[#2d3647]">
                       <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock size={14} />
                          <div className="flex flex-col">
                             <span className="text-[8px] uppercase font-black">Abertura</span>
                             <span className="text-[10px] font-bold text-white">{new Date(item.openedAt).toLocaleDateString()}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-2">
                          <LayoutList size={14} className="text-primary" />
                          <div className="flex flex-col">
                             <span className="text-[8px] uppercase font-black">Status</span>
                             <span className="text-[10px] font-bold text-white uppercase">{item.status.replace('_', ' ')}</span>
                          </div>
                       </div>
                    </div>

                    <div className="mt-6 flex gap-2">
                       <button onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }} className="flex-1 py-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[10px] font-black uppercase hover:bg-[#252d4a] transition-all">Detalhes</button>
                       <button className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase hover:bg-primary/20 transition-all">Iniciar Reparo</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="relative w-full max-w-md bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
             <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">{selectedItem ? 'Configurar OS' : 'Nova Ordem de Serviço'}</h2>
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all"><X size={20} /></button>
             </div>
             <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <FormField label="Código da OS" error={errors.code?.message} required><input {...register('code')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" placeholder="Ex: OS-001" /></FormField>
                <FormField label="Equipamento" error={errors.equipmentId?.message} required>
                  <select {...register('equipmentId')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                    <option value="">Selecione...</option>
                    {equipments.map(e => <option key={e.id} value={e.id}>{e.code}</option>)}
                  </select>
                </FormField>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Tipo" error={errors.type?.message} required>
                    <select {...register('type')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                      <option value="CORRETIVA">Corretiva</option>
                      <option value="PREVENTIVA">Preventiva</option>
                      <option value="PREDITIVA">Preditiva</option>
                    </select>
                  </FormField>
                  <FormField label="Prioridade" error={errors.priority?.message} required>
                    <select {...register('priority')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                      <option value="BAIXA">Baixa</option>
                      <option value="MEDIA">Média</option>
                      <option value="ALTA">Alta</option>
                      <option value="CRITICA">Crítica</option>
                    </select>
                  </FormField>
                </div>
                <FormField label="Descrição da Falha / Serviço" error={errors.description?.message} required><textarea {...register('description')} rows={4} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none resize-none" /></FormField>
                <FormField label="Status" error={errors.status?.message} required>
                  <select {...register('status')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                    <option value="ABERTA">Aberta</option>
                    <option value="EM_EXECUCAO">Em Execução</option>
                    <option value="AGUARDANDO_PECA">Aguardando Peça</option>
                    <option value="CONCLUIDA">Concluída</option>
                    <option value="CANCELADA">Cancelada</option>
                  </select>
                </FormField>
                <div className="pt-6 flex gap-3">
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">{isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar OS</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
