"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { SupplyService, EquipmentService, OperatorService } from '@/services/master.service';
import { Supply, Equipment, Operator } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { supplySchema, SupplyFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import {
  Droplets,
  Plus,
  Search,
  Loader2,
  X,
  Save,
  Truck,
  History,
  TrendingUp
} from 'lucide-react';

import { withAuth } from '@/components/shared/with-auth';

function AbastecimentosPage() {
  const [data, setData] = useState<Supply[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<SupplyFormData>({
    resolver: zodResolver(supplySchema),
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen) reset({ equipmentId: '', operatorId: '', liters: 0, hourmeter: 0, timestamp: new Date().toISOString().slice(0, 16), observations: '' });
  }, [isDrawerOpen, reset]);

  const loadData = async () => {
    setLoading(true);
    const [supps, eqs, oprs] = await Promise.all([
      SupplyService.getAll(),
      EquipmentService.getAll(),
      OperatorService.getAll()
    ]);
    setData(supps);
    setEquipments(eqs);
    setOperators(oprs);
    setLoading(false);
  };

  const onSubmit = async (formData: SupplyFormData) => {
    try {
      await SupplyService.create(formData);
      setIsDrawerOpen(false);
      loadData();
    } catch (error: any) { alert(error.message); }
  };

  const filteredData = data.filter(s => {
     const eq = equipments.find(e => e.id === s.equipmentId);
     return eq?.code.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Abastecimentos" description="Controle de Insumos e Consumo de Combustível da Frota">
            <button onClick={() => setIsDrawerOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"><Plus size={16} strokeWidth={3} /> Registrar Abastecimento</button>
          </PageHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
             <div className="bg-[#1a1f3a]/40 border border-[#2d3647] p-6 rounded-3xl flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-2xl text-primary"><Droplets size={24} /></div>
                <div><p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Total Litros (Mês)</p><p className="text-2xl font-black italic text-white tracking-tighter">14.250 L</p></div>
             </div>
             <div className="bg-[#1a1f3a]/40 border border-[#2d3647] p-6 rounded-3xl flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-500"><TrendingUp size={24} /></div>
                <div><p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Consumo Médio</p><p className="text-2xl font-black italic text-white tracking-tighter">18.5 L/h</p></div>
             </div>
             <div className="bg-[#1a1f3a]/40 border border-[#2d3647] p-6 rounded-3xl flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-500"><History size={24} /></div>
                <div><p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Último Registro</p><p className="text-2xl font-black italic text-white tracking-tighter">Hoje, 10:30</p></div>
             </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="text" placeholder="Buscar por equipamento..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 shadow-inner" /></div>
          </div>

          {loading ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4"><Loader2 size={40} className="text-primary animate-spin" /><p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Sincronizando Registros...</p></div>
          ) : (
             <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl overflow-hidden shadow-2xl">
                <table className="w-full text-left">
                   <thead className="bg-[#1a1f3a]/50 text-[10px] uppercase font-black tracking-widest text-muted-foreground border-b border-[#2d3647]">
                      <tr><th className="px-6 py-4">Data/Hora</th><th className="px-6 py-4">Equipamento</th><th className="px-6 py-4">Operador</th><th className="px-6 py-4">Litros</th><th className="px-6 py-4">Horímetro</th><th className="px-6 py-4">Obs.</th></tr>
                   </thead>
                   <tbody className="divide-y divide-[#2d3647]">
                      {filteredData.map(s => {
                         const eq = equipments.find(e => e.id === s.equipmentId);
                         const opr = operators.find(o => o.id === s.operatorId);
                         return (
                            <tr key={s.id} className="hover:bg-primary/5 transition-colors group">
                               <td className="px-6 py-4 text-xs font-bold text-white">{new Date(s.timestamp).toLocaleString()}</td>
                               <td className="px-6 py-4"><div className="flex items-center gap-2"><Truck size={14} className="text-primary" /><span className="text-xs font-black italic text-white">{eq?.code}</span></div></td>
                               <td className="px-6 py-4 text-xs text-muted-foreground font-medium uppercase">{opr?.name}</td>
                               <td className="px-6 py-4 font-black italic text-primary">{s.liters} L</td>
                               <td className="px-6 py-4 text-xs font-bold text-white">{s.hourmeter}h</td>
                               <td className="px-6 py-4 text-[10px] text-muted-foreground max-w-[200px] truncate">{s.observations || '-'}</td>
                            </tr>
                         )
                      })}
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
               <div className="flex items-center justify-between mb-8"><h2 className="text-xl font-black italic tracking-tighter uppercase text-white">Registrar Abastecimento</h2><button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all text-white"><X size={24} /></button></div>
               <form className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar" onSubmit={handleSubmit(onSubmit)}>
                  <FormField label="Equipamento" error={errors.equipmentId?.message} required><select {...register('equipmentId')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                     <option value="">Selecione o Equipamento</option>
                     {equipments.map(e => <option key={e.id} value={e.id}>{e.code}</option>)}
                  </select></FormField>
                  <FormField label="Operador" error={errors.operatorId?.message} required><select {...register('operatorId')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none"><option value="">Selecione o Operador</option>{operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></FormField>
                  <div className="grid grid-cols-2 gap-4">
                     <FormField label="Volume (Litros)" error={errors.liters?.message} required><input type="number" step="0.1" {...register('liters')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" placeholder="0.0" /></FormField>
                     <FormField label="Horímetro" error={errors.hourmeter?.message} required><input type="number" step="0.1" {...register('hourmeter')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" placeholder="0.0" /></FormField>
                  </div>
                  <FormField label="Data/Hora" error={errors.timestamp?.message} required><input type="datetime-local" {...register('timestamp')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none text-white" /></FormField>
                  <FormField label="Observações" error={errors.observations?.message}><textarea {...register('observations')} rows={4} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none resize-none" placeholder="Notas adicionais..."></textarea></FormField>
                  <div className="pt-6 flex gap-3">
                    <button type="button" onClick={() => setIsDrawerOpen(false)} className="flex-1 py-3 bg-transparent border border-[#2d3647] rounded-xl text-xs font-black uppercase hover:bg-[#1a1f3a] transition-all flex items-center justify-center gap-2 text-white">Cancelar</button>
                    <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                      {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar Registro
                    </button>
                  </div>
               </form>
            </div>
         </div>
      )}
    </div>
  );
}

export default withAuth(AbastecimentosPage, { module: 'ABASTECIMENTOS' });
