"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { OperationalRecordService, EquipmentService, OperatorService, FarmService, FieldService, OperationalStateService } from '@/services/master.service';
import { OperationalRecord, Equipment, Operator, Farm, Field, OperationalState } from '@/lib/types';
import {
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  Loader2,
  X,
  Save,
  Ban,
  History,
  CheckSquare,
  Square,
  ArrowRightLeft,
  RefreshCw,
  Edit
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { operationalRecordSchema, OperationalRecordFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import { EntityAuditInfo } from '@/components/shared/entity-audit-info';

export default function OperationalConferencePage() {
  const [data, setData] = useState<OperationalRecord[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [states, setStates] = useState<OperationalState[]>([]);

  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<OperationalRecord | null>(null);
  const [viewAudit, setViewAudit] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('PENDENTE');
  const [filterOrigin, setFilterOrigin] = useState<string>('ALL');

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<OperationalRecordFormData>({
    resolver: zodResolver(operationalRecordSchema),
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen && selectedRecord) {
      reset({
        equipmentId: selectedRecord.equipmentId,
        operatorId: selectedRecord.operatorId,
        farmId: selectedRecord.farmId,
        fieldId: selectedRecord.fieldId,
        operationTypeId: selectedRecord.operationTypeId,
        start: selectedRecord.start.slice(0, 16),
        end: selectedRecord.end?.slice(0, 16),
        initialHourmeter: selectedRecord.initialHourmeter,
        finalHourmeter: selectedRecord.finalHourmeter,
        justification: selectedRecord.justification || '',
      });
    }
  }, [selectedRecord, isDrawerOpen, reset]);

  const loadData = async () => {
    setLoading(true);
    const [recs, eqs, oprs, fms, fds, sts] = await Promise.all([
      OperationalRecordService.getAll(),
      EquipmentService.getAll(),
      OperatorService.getAll(),
      FarmService.getAll(),
      FieldService.getAll(),
      OperationalStateService.getAll()
    ]);
    setData(recs);
    setEquipments(eqs);
    setOperators(oprs);
    setFarms(fms);
    setFields(fds);
    setStates(sts);
    setLoading(false);
  };

  const handleBatchValidate = async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    for (const id of selectedIds) {
      await OperationalRecordService.validateRecord(id);
    }
    setSelectedIds([]);
    loadData();
  };

  const handleBatchIntegrate = async () => {
    if (selectedIds.length === 0) return;
    setLoading(true);
    await OperationalRecordService.integrateBatch(selectedIds);
    setSelectedIds([]);
    loadData();
  };

  const onUpdateRecord = async (formData: OperationalRecordFormData) => {
    if (!selectedRecord) return;
    try {
      await OperationalRecordService.update(selectedRecord.id, {
        ...formData,
        status: 'CORRIGIDO',
        inconsistencies: [] // Clear inconsistencies after manual correction
      });
      setIsDrawerOpen(false);
      loadData();
    } catch (error: any) { alert(error.message); }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length) setSelectedIds([]);
    else setSelectedIds(filteredData.map(r => r.id));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const filteredData = useMemo(() => {
    return data.filter(r => {
      const equipment = equipments.find(e => e.id === r.equipmentId);
      const operator = operators.find(o => o.id === r.operatorId);
      const matchesSearch =
        equipment?.code.toLowerCase().includes(search.toLowerCase()) ||
        operator?.name.toLowerCase().includes(search.toLowerCase()) ||
        r.eventId.toLowerCase().includes(search.toLowerCase());

      const matchesStatus = filterStatus === 'ALL' || r.status === filterStatus;
      const matchesOrigin = filterOrigin === 'ALL' || r.origin === filterOrigin;

      return matchesSearch && matchesStatus && matchesOrigin;
    });
  }, [data, search, filterStatus, filterOrigin, equipments, operators]);

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader
            title="Conferência Operacional"
            description="Validação e Integração de Apontamentos Externos"
          >
            <div className="flex gap-3">
               {selectedIds.length > 0 && (
                 <>
                   <button
                    onClick={handleBatchValidate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-blue-500/30 transition-all"
                   >
                     <CheckCircle2 size={14} /> Validar ({selectedIds.length})
                   </button>
                   <button
                    onClick={handleBatchIntegrate}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500 text-[#0a0e27] rounded-xl text-[10px] font-black uppercase tracking-tighter hover:scale-105 transition-transform"
                   >
                     <Database size={14} /> Integrar ({selectedIds.length})
                   </button>
                 </>
               )}
               <button className="flex items-center gap-2 px-4 py-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[10px] font-black uppercase tracking-tighter hover:bg-[#252d4a] transition-all">
                 <RefreshCw size={14} /> Sincronizar
               </button>
            </div>
          </PageHeader>

          {/* Advanced Filters */}
          <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-4 mb-6 flex flex-col md:flex-row gap-4 items-center">
             <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar por ID, Equipamento ou Operador..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#1a1f3a]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40"
                />
             </div>
             <div className="flex gap-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:border-primary/50"
                >
                  <option value="ALL">Todos Status</option>
                  <option value="PENDENTE">Pendentes</option>
                  <option value="VALIDADO">Validados</option>
                  <option value="CORRIGIDO">Corrigidos</option>
                  <option value="REJEITADO">Rejeitados</option>
                  <option value="INTEGRADO">Integrados</option>
                </select>
                <select
                  value={filterOrigin}
                  onChange={(e) => setFilterOrigin(e.target.value)}
                  className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:border-primary/50"
                >
                  <option value="ALL">Todas Origens</option>
                  <option value="APK">APK</option>
                  <option value="MQTT">MQTT</option>
                  <option value="API">API</option>
                  <option value="PLANILHA">Planilha</option>
                </select>
                <button className="p-2.5 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-primary hover:bg-[#252d4a] transition-all">
                  <Filter size={16} />
                </button>
             </div>
          </div>

          {loading ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4">
                <Loader2 size={40} className="text-primary animate-spin" />
                <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Processando Conferência...</p>
             </div>
          ) : (
            <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl overflow-hidden shadow-2xl">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-[#1a1f3a]/50 text-[10px] uppercase font-black tracking-widest text-muted-foreground border-b border-[#2d3647]">
                     <tr>
                        <th className="px-4 py-4 w-10">
                           <button onClick={toggleSelectAll} className="text-primary">
                              {selectedIds.length === filteredData.length && filteredData.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                           </button>
                        </th>
                        <th className="px-4 py-4">Data / Evento</th>
                        <th className="px-4 py-4">Equipamento</th>
                        <th className="px-4 py-4">Operação / Local</th>
                        <th className="px-4 py-4">Horímetros</th>
                        <th className="px-4 py-4">Status / Inconsistências</th>
                        <th className="px-4 py-4 text-right">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d3647]">
                     {filteredData.map(record => {
                        const eq = equipments.find(e => e.id === record.equipmentId);
                        const opr = operators.find(o => o.id === record.operatorId);
                        const state = states.find(s => s.id === record.operationTypeId);
                        const farm = farms.find(f => f.id === record.farmId);
                        const field = fields.find(f => f.id === record.fieldId);
                        const isSelected = selectedIds.includes(record.id);

                        return (
                           <tr key={record.id} className={cn("hover:bg-primary/5 transition-colors group", isSelected && "bg-primary/10")}>
                              <td className="px-4 py-4">
                                 <button onClick={() => toggleSelect(record.id)} className={cn(isSelected ? "text-primary" : "text-muted-foreground")}>
                                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                                 </button>
                              </td>
                              <td className="px-4 py-4">
                                 <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-white">{new Date(record.start).toLocaleString()}</span>
                                    <span className="text-[9px] text-muted-foreground uppercase font-medium">ID: {record.eventId}</span>
                                    <span className={cn(
                                       "text-[8px] font-black px-1.5 py-0.5 rounded w-fit mt-1",
                                       record.origin === 'APK' ? "bg-blue-500/10 text-blue-400" : "bg-purple-500/10 text-purple-400"
                                    )}>{record.origin}</span>
                                 </div>
                              </td>
                              <td className="px-4 py-4">
                                 <div className="flex flex-col">
                                    <span className="text-xs font-black italic text-primary">{eq?.code}</span>
                                    <span className="text-[9px] text-muted-foreground uppercase font-bold truncate max-w-[120px]">{opr?.name}</span>
                                 </div>
                              </td>
                              <td className="px-4 py-4">
                                 <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                       <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: state?.color }}></div>
                                       <span className="text-[10px] font-black text-white uppercase">{state?.name}</span>
                                    </div>
                                    <span className="text-[9px] text-muted-foreground font-bold mt-1 uppercase">{farm?.name} • {field?.code}</span>
                                 </div>
                              </td>
                              <td className="px-4 py-4">
                                 <div className="flex items-center gap-3">
                                    <div className="flex flex-col">
                                       <span className="text-[8px] text-muted-foreground uppercase">Ini</span>
                                       <span className="text-[10px] font-black text-white">{record.initialHourmeter.toFixed(1)}h</span>
                                    </div>
                                    <ArrowRightLeft size={10} className="text-muted-foreground" />
                                    <div className="flex flex-col">
                                       <span className="text-[8px] text-muted-foreground uppercase">Fim</span>
                                       <span className={cn("text-[10px] font-black", record.finalHourmeter && record.finalHourmeter < record.initialHourmeter ? "text-red-500" : "text-white")}>
                                          {record.finalHourmeter?.toFixed(1) || '-'}h
                                       </span>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-4 py-4">
                                 <div className="flex flex-col gap-1">
                                    <StatusBadge status={record.status} />
                                    {record.inconsistencies.map((inc, i) => (
                                       <div key={i} className="flex items-center gap-1 text-[8px] font-black text-red-400 uppercase">
                                          <AlertTriangle size={8} /> {inc}
                                       </div>
                                    ))}
                                 </div>
                              </td>
                              <td className="px-4 py-4 text-right">
                                 <div className="flex justify-end gap-1">
                                    <button
                                      onClick={() => { setSelectedRecord(record); setIsDrawerOpen(true); }}
                                      className="p-1.5 text-muted-foreground hover:text-white hover:bg-[#1a1f3a] rounded-lg transition-all"
                                    >
                                       <Edit size={14} />
                                    </button>
                                    <button className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all">
                                       <XCircle size={14} />
                                    </button>
                                 </div>
                              </td>
                           </tr>
                        )
                     })}
                  </tbody>
               </table>
            </div>
          )}
        </main>
      </div>

      {/* Conference Drawer */}
      {isDrawerOpen && selectedRecord && (
         <div className="fixed inset-0 z-[2000] flex justify-end">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
            <div className="relative w-full max-w-2xl bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
               <div className="flex items-center justify-between mb-8">
                  <div>
                     <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">Correção de Apontamento</h2>
                     <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em] mt-1">Origem: {selectedRecord.origin} • Evento: {selectedRecord.eventId}</p>
                  </div>
                  <div className="flex gap-2">
                     <button onClick={() => setViewAudit(!viewAudit)} className={cn("p-2 rounded-xl border border-[#2d3647] transition-all", viewAudit ? "bg-primary text-[#0a0e27]" : "text-muted-foreground hover:text-white")}>
                        <History size={18} />
                     </button>
                     <button onClick={() => setIsDrawerOpen(false)} className="p-2 text-white hover:bg-[#1a1f3a] rounded-xl transition-all">
                        <X size={24} />
                     </button>
                  </div>
               </div>

               <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                  {viewAudit ? (
                    <EntityAuditInfo entity={selectedRecord} />
                  ) : (
                    <form className="space-y-6" onSubmit={handleSubmit(onUpdateRecord)}>
                       <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-2xl mb-6">
                          <h4 className="text-[10px] font-black text-red-400 uppercase mb-2 flex items-center gap-2"><AlertTriangle size={12} /> Inconsistências Detectadas</h4>
                          <ul className="space-y-1">
                             {selectedRecord.inconsistencies.length === 0 ? (
                               <li className="text-[10px] text-muted-foreground font-bold">Nenhuma falha crítica detectada pelo motor de validação.</li>
                             ) : (
                               selectedRecord.inconsistencies.map((inc, i) => <li key={i} className="text-[10px] text-white font-bold list-disc ml-4">{inc}</li>)
                             )}
                          </ul>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <FormField label="Equipamento" error={errors.equipmentId?.message} required>
                             <select {...register('equipmentId')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none">
                                {equipments.map(e => <option key={e.id} value={e.id}>{e.code}</option>)}
                             </select>
                          </FormField>
                          <FormField label="Operador" error={errors.operatorId?.message} required>
                             <select {...register('operatorId')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none">
                                {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                             </select>
                          </FormField>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <FormField label="Início" error={errors.start?.message} required>
                             <input type="datetime-local" {...register('start')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" />
                          </FormField>
                          <FormField label="Fim" error={errors.end?.message}>
                             <input type="datetime-local" {...register('end')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" />
                          </FormField>
                       </div>

                       <div className="grid grid-cols-2 gap-4">
                          <FormField label="Horímetro Inicial" error={errors.initialHourmeter?.message} required>
                             <input type="number" step="0.1" {...register('initialHourmeter')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" />
                          </FormField>
                          <FormField label="Horímetro Final" error={errors.finalHourmeter?.message}>
                             <input type="number" step="0.1" {...register('finalHourmeter')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" />
                          </FormField>
                       </div>

                       <FormField label="Justificativa da Correção" error={errors.justification?.message} required>
                          <textarea {...register('justification')} rows={3} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none resize-none" placeholder="Descreva o motivo da alteração manual..." />
                       </FormField>

                       <div className="pt-6 flex gap-3">
                          <button type="button" onClick={() => setIsDrawerOpen(false)} className="flex-1 py-4 bg-transparent border border-[#2d3647] rounded-2xl text-xs font-black uppercase hover:bg-[#1a1f3a] transition-all flex items-center justify-center gap-2"><Ban size={14} /> Cancelar</button>
                          <button type="submit" disabled={isSubmitting} className="flex-1 py-4 bg-primary text-[#0a0e27] rounded-2xl text-xs font-black uppercase hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg"><Save size={14} /> Salvar e Validar</button>
                       </div>
                    </form>
                  )}
               </div>
            </div>
         </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, string> = {
    PENDENTE: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    VALIDADO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    CORRIGIDO: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    INTEGRADO: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    REJEITADO: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[9px] font-black uppercase border w-fit", configs[status] || 'bg-gray-500/10 text-gray-500 border-gray-500/20')}>
       {status}
    </span>
  );
}


