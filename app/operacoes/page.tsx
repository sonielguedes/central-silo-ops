"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { OperationService, EquipmentService, OperatorService, FarmService, FieldService, EquipmentModelService } from '@/services/api-service';
import { Operation, Equipment, Operator, Farm, Field, EquipmentModel } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { operationSchema, OperationFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import {
  Play,
  Pause,
  StopCircle,
  Plus,
  Search,
  Loader2,
  X,
  Clock,
  MapPin,
  Truck,
  User,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';

function OperacoesPage() {
  const [data, setData] = useState<Operation[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [models, setModels] = useState<EquipmentModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<OperationFormData>({
    resolver: zodResolver(operationSchema),
  });

  const selectedFarmId = watch('farmId');

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen) reset({ type: '', equipmentId: '', operatorId: '', farmId: '', fieldId: '', start: new Date().toISOString().slice(0, 16), status: 'EM_CURSO' });
  }, [isDrawerOpen, reset]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [ops, eqs, oprs, fms, fds, mdls] = await Promise.all([
        OperationService.getAll().catch(() => [] as Operation[]),
        EquipmentService.getAll().catch(() => [] as Equipment[]),
        OperatorService.getAll().catch(() => [] as Operator[]),
        FarmService.getAll().catch(() => [] as Farm[]),
        FieldService.getAll().catch(() => [] as Field[]),
        EquipmentModelService.getAll().catch(() => [] as EquipmentModel[]),
      ]);
      setData(Array.isArray(ops) ? ops : []);
      setEquipments(Array.isArray(eqs) ? eqs : []);
      setOperators(Array.isArray(oprs) ? oprs : []);
      setFarms(Array.isArray(fms) ? fms : []);
      setFields(Array.isArray(fds) ? fds : []);
      setModels(Array.isArray(mdls) ? mdls : []);
    } catch (err) {
      console.error('[operacoes] loadData error', err);
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (formData: OperationFormData) => {
    try {
      await OperationService.create(formData);
      setIsDrawerOpen(false);
      loadData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao iniciar operacao';
      alert(msg);
    }
  };

  const filteredOps = data.filter(op => {
     if (!search) return true;
     const term = search.toLowerCase();
     const equipment = equipments.find(e => e.id === op.equipmentId);
     const codeMatch = (equipment?.code || '').toLowerCase().includes(term);
     const typeMatch = (op.type || '').toLowerCase().includes(term);
     return codeMatch || typeMatch;
  });

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Operações Ativas" description="Monitoramento e Controle de Frentes de Trabalho em Tempo Real">
            <button onClick={() => setIsDrawerOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"><Plus size={16} strokeWidth={3} /> Iniciar Operação</button>
          </PageHeader>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="text" placeholder="Buscar por equipamento ou operação..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 shadow-inner" /></div>
          </div>

          {loading ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4"><Loader2 size={40} className="text-primary animate-spin" /><p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Sincronizando Operações...</p></div>
          ) : error ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4">
               <AlertCircle size={40} className="text-red-500" />
               <p className="text-sm text-red-400 font-bold">{error}</p>
               <button onClick={loadData} className="px-4 py-2 bg-primary/20 text-primary rounded-xl text-xs font-black uppercase hover:bg-primary/30 transition-colors">Tentar Novamente</button>
             </div>
          ) : filteredOps.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4 opacity-40">
               <StopCircle size={48} />
               <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">{search ? 'Nenhuma operacao encontrada para esta busca' : 'Nenhuma operacao ativa no momento'}</p>
             </div>
          ) : (
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredOps.map(op => {
                   const eq = equipments.find(e => e.id === op.equipmentId);
                   const opr = operators.find(o => o.id === op.operatorId);
                   const farm = farms.find(f => f.id === op.farmId);
                   const field = fields.find(f => f.id === op.fieldId);

                   return (
                      <div key={op.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-6 relative overflow-hidden group">
                         <div className={cn("absolute top-0 left-0 w-1.5 h-full", op.status === 'EM_CURSO' ? "bg-emerald-500" : "bg-amber-500")}></div>
                         <div className="flex items-start justify-between mb-6">
                            <div className="flex items-center gap-4">
                               <div className="w-14 h-14 bg-[#1a1f3a] rounded-2xl border border-[#2d3647] flex items-center justify-center text-primary"><Truck size={28} /></div>
                               <div><h3 className="text-xl font-black italic tracking-tighter text-white uppercase group-hover:text-primary transition-colors">{eq?.code}</h3><p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em]">{op.type}</p></div>
                            </div>
                            <div className="flex gap-2">
                               {op.status === 'EM_CURSO' ? (
                                  <button onClick={() => { if(confirm('Pausar operação?')) { OperationService.update(op.id, {status: 'PAUSADA'}); loadData(); } }} className="p-2 bg-amber-500/10 text-amber-500 rounded-xl hover:bg-amber-500/20 transition-all"><Pause size={18} /></button>
                               ) : (
                                  <button onClick={() => { OperationService.startOperation(op.id); loadData(); }} className="p-2 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all"><Play size={18} /></button>
                               )}
                               <button onClick={() => { if(confirm('Finalizar operação?')) { OperationService.finishOperation(op.id); loadData(); } }} className="p-2 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all"><StopCircle size={18} /></button>
                            </div>
                         </div>
                         <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-6">
                            <div className="space-y-1"><p className="text-[9px] text-muted-foreground font-black uppercase flex items-center gap-1.5"><User size={10} className="text-primary" /> Operador</p><p className="text-xs font-bold text-white uppercase">{opr?.name}</p></div>
                            <div className="space-y-1"><p className="text-[9px] text-muted-foreground font-black uppercase flex items-center gap-1.5"><MapPin size={10} className="text-primary" /> Local</p><p className="text-xs font-bold text-white uppercase truncate">{farm?.name} • {field?.code}</p></div>
                            <div className="space-y-1"><p className="text-[9px] text-muted-foreground font-black uppercase flex items-center gap-1.5"><Clock size={10} className="text-primary" /> Início</p><p className="text-xs font-bold text-white">{op.start ? new Date(op.start).toLocaleString() : '-'}</p></div>
                            <div className="space-y-1"><p className="text-[9px] text-muted-foreground font-black uppercase flex items-center gap-1.5">Status</p><div className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase w-fit", op.status === 'EM_CURSO' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20")}>{op.status}</div></div>
                         </div>
                         <div className="pt-4 border-t border-[#2d3647] flex items-center justify-between"><span className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest">Tempo Decorrido: 02h 15m</span><button className="text-[10px] font-black text-primary uppercase hover:underline">Ver Detalhes</button></div>
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
            <div className="relative w-full max-w-md bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
               <div className="flex items-center justify-between mb-8"><h2 className="text-xl font-black italic tracking-tighter uppercase text-white">Nova Operação</h2><button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all"><X size={20} /></button></div>
               <form className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar" onSubmit={handleSubmit(onSubmit)}>
                  <FormField label="Tipo de Operação" error={errors.type?.message} required><select {...register('type')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none"><option value="">Selecione a Operação</option><option value="COLHEITA">Colheita</option><option value="PLANTIO">Plantio</option><option value="PREPARO">Preparo de Solo</option><option value="TRANSPORTE">Transporte</option><option value="PULVERIZACAO">Pulverização</option></select></FormField>
                  <FormField label="Equipamento" error={errors.equipmentId?.message} required><select {...register('equipmentId')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none"><option value="">Selecione o Equipamento</option>{equipments.map(e => {
                     const model = models.find(m => m.id === e.modelId);
                     return <option key={e.id} value={e.id}>{e.code} - {model?.name}</option>
                  })}</select></FormField>
                  <FormField label="Operador" error={errors.operatorId?.message} required><select {...register('operatorId')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none"><option value="">Selecione o Operador</option>{operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></FormField>
                  <div className="grid grid-cols-2 gap-4">
                     <FormField label="Fazenda" error={errors.farmId?.message} required><select {...register('farmId')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none"><option value="">Selecione</option>{farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></FormField>
                     <FormField label="Talhão" error={errors.fieldId?.message} required><select {...register('fieldId')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none"><option value="">Selecione</option>{fields.filter(f => f.farmId === selectedFarmId).map(f => <option key={f.id} value={f.id}>{f.code}</option>)}</select></FormField>
                  </div>
                  <FormField label="Data/Hora Início" error={errors.start?.message} required><input type="datetime-local" {...register('start')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none text-white" /></FormField>
                  <div className="pt-6 flex gap-3"><button type="submit" className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20"><Play size={14} /> Iniciar Operação</button></div>
               </form>
            </div>
         </div>
      )}
    </div>
  );
}

export default withAuth(OperacoesPage, { module: 'OPERACOES' });
