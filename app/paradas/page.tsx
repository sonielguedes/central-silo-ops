"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { StopReasonService } from '@/services/master.service';
import { StopReason } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { stopReasonSchema, StopReasonFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import {
  PauseCircle,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Search,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';

function ParadasPage() {
  const [data, setData] = useState<StopReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<StopReason | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<StopReasonFormData>({
    resolver: zodResolver(stopReasonSchema),
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) reset(selectedItem);
      else reset({ code: '', description: '', category: 'OPERACIONAL', type: 'IMPRODUTIVA', requiresObservation: false, isActive: true });
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    const result = await StopReasonService.getAll();
    setData(result);
    setLoading(false);
  };

  const onSubmit = async (formData: StopReasonFormData) => {
    try {
      if (selectedItem) await StopReasonService.update(selectedItem.id, formData);
      else await StopReasonService.create(formData);
      setIsDrawerOpen(false);
      loadData();
    } catch (error: any) { alert(error.message); }
  };

  const filteredData = data.filter(item => item.description.toLowerCase().includes(search.toLowerCase()) || item.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Motivos de Parada" description="Classificação e Gestão de Eventos Operacionais">
            <button onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"><Plus size={16} strokeWidth={3} /> Novo Motivo</button>
          </PageHeader>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="text" placeholder="Buscar por código ou descrição..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 shadow-inner" /></div>
          </div>

          {loading ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4"><Loader2 size={40} className="text-primary animate-spin" /><p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Sincronizando Motivos...</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredData.map((item) => (
                <div key={item.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-5 hover:border-primary/40 transition-all group relative overflow-hidden">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border border-[#2d3647]", item.type === 'PRODUTIVA' ? "bg-emerald-500/10 text-emerald-500" : "bg-red-500/10 text-red-500")}><PauseCircle size={24} /></div>
                      <div><h3 className="text-lg font-black italic tracking-tighter text-white uppercase group-hover:text-primary transition-colors">{item.description}</h3><p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Código: {item.code}</p></div>
                    </div>
                    <div className="flex gap-1"><button onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }} className="p-2 text-muted-foreground hover:text-white transition-colors hover:bg-[#1a1f3a] rounded-lg"><Edit size={16} /></button><button onClick={async () => { if(confirm('Excluir motivo?')) { try { await StopReasonService.archive(item.id); loadData(); } catch(e:any) { alert(e.message); } } }} className="p-2 text-muted-foreground hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg"><Trash2 size={16} /></button></div>
                  </div>
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground uppercase font-black">Categoria</span><span className="text-xs font-bold text-white uppercase">{item.category}</span></div>
                    <div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground uppercase font-black">Tipo</span><span className={cn("text-xs font-bold uppercase", item.type === 'PRODUTIVA' ? "text-emerald-500" : "text-red-500")}>{item.type}</span></div>
                    <div className="flex items-center gap-2">{item.requiresObservation && <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded text-[9px] font-black uppercase"><Info size={10} /> Exige Obs.</div>}</div>
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
            <div className="flex items-center justify-between mb-8"><h2 className="text-xl font-black italic tracking-tighter uppercase text-white">{selectedItem ? 'Editar Motivo' : 'Novo Motivo'}</h2><button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all"><X size={20} /></button></div>
            <form className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar" onSubmit={handleSubmit(onSubmit)}>
              <FormField label="Código" error={errors.code?.message} required><input {...register('code')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" /></FormField>
              <FormField label="Descrição" error={errors.description?.message} required><input {...register('description')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" /></FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Categoria" error={errors.category?.message} required><select {...register('category')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none"><option value="OPERACIONAL">Operacional</option><option value="MANUTENCAO">Manutenção</option><option value="CLIMA">Clima</option><option value="LOGISTICA">Logística</option><option value="SEGURANCA">Segurança</option><option value="OUTROS">Outros</option></select></FormField>
                <FormField label="Tipo" error={errors.type?.message} required><select {...register('type')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none"><option value="PRODUTIVA">Produtiva</option><option value="IMPRODUTIVA">Improdutiva</option></select></FormField>
              </div>
              <div className="space-y-4 pt-2">
                 <label className="flex items-center gap-3 cursor-pointer group"><div className="relative w-10 h-6 bg-[#1a1f3a] border border-[#2d3647] rounded-full transition-colors group-hover:border-primary/50"><input type="checkbox" {...register('requiresObservation')} className="sr-only peer" /><div className="absolute left-1 top-1 w-4 h-4 bg-muted-foreground rounded-full transition-all peer-checked:left-5 peer-checked:bg-primary"></div></div><span className="text-xs font-bold text-white uppercase">Exigir Observação</span></label>
              </div>
              <div className="pt-6 flex gap-3"><button type="submit" className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20"><Save size={14} /> Salvar Motivo</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(ParadasPage, { module: 'PARADAS' });
