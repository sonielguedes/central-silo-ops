"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { StatusBadge } from '@/components/shared/status-badge';
import { EquipmentService, EquipmentTypeService, EquipmentModelService, EquipmentGroupService, OperatorService } from '@/services/api-service';
import { Equipment, EquipmentType, EquipmentModel, EquipmentGroup, Operator } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { equipmentSchema, EquipmentFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import { EntityAuditInfo } from '@/components/shared/entity-audit-info';
import { ChecklistExecutionDrawer } from '@/components/checklist/checklist-execution-drawer';
import {
  Truck,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Ban,
  Tractor,
  Zap,
  ChevronRight,
  ClipboardCheck
} from 'lucide-react';

import { withAuth } from '@/components/shared/with-auth';

function FleetPage() {
  const [data, setData] = useState<Equipment[]>([]);
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [models, setModels] = useState<EquipmentModel[]>([]);
  const [groups, setGroups] = useState<EquipmentGroup[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isChecklistOpen, setIsChecklistOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
  const [viewAudit, setViewAudit] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) {
        reset({
          code: selectedItem.code,
          typeId: selectedItem.typeId,
          modelId: selectedItem.modelId,
          groupId: selectedItem.groupId || '',
          profileId: selectedItem.profileId || '',
          brand: selectedItem.brand,
          plateOrSerial: selectedItem.plateOrSerial || '',
          status: selectedItem.status,
          hourmeter: selectedItem.hourmeter,
          observations: selectedItem.observations || '',
          mobileEnabled: selectedItem.mobileEnabled || false,
        });
      } else {
        reset({
          code: '',
          typeId: '',
          modelId: '',
          groupId: '',
          profileId: '',
          brand: '',
          plateOrSerial: '',
          status: 'ATIVO',
          hourmeter: 0,
          observations: '',
          mobileEnabled: false,
        });
      }
    } else {
      setViewAudit(false);
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    const [fleet, t, m, g, o] = await Promise.all([
      EquipmentService.getAll(),
      EquipmentTypeService.getAll(),
      EquipmentModelService.getAll(),
      EquipmentGroupService.getAll(),
      OperatorService.getAll()
    ]);
    setData(fleet);
    setTypes(t);
    setModels(m);
    setGroups(g);
    setOperators(o);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      if (confirm('Deseja realmente arquivar este equipamento?')) {
        await EquipmentService.archive(id);
        loadData();
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  const onSubmit = async (formData: EquipmentFormData) => {
    try {
      if (selectedItem) {
        await EquipmentService.update(selectedItem.id, {
          ...formData,
          version: selectedItem.version
        });
      } else {
        await EquipmentService.create({ ...formData, lastSignal: 'Agora' });
      }
      setIsDrawerOpen(false);
      loadData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const filteredData = data.filter(item => {
    const type = types.find(t => t.id === item.typeId)?.name || '';
    const model = models.find(m => m.id === item.modelId)?.name || '';
    return item.code.toLowerCase().includes(search.toLowerCase()) ||
           type.toLowerCase().includes(search.toLowerCase()) ||
           model.toLowerCase().includes(search.toLowerCase());
  });

  const getIcon = (typeId: string) => {
    const type = types.find(t => t.id === typeId);
    switch (type?.icon) {
      case 'Tractor': return <Tractor size={24} />;
      case 'Truck': return <Truck size={24} />;
      case 'Zap': return <Zap size={24} />;
      default: return <Truck size={24} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader
            title="Frota Operacional"
            description="Gestão Técnica e Monitoramento de Ativos Agrícolas"
          >
            <button
              onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"
            >
              <Plus size={16} strokeWidth={3} /> Integrar Equipamento
            </button>
          </PageHeader>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por código, tipo ou modelo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 shadow-inner"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-xs font-bold hover:bg-[#252d4a] transition-all">
              <Filter size={16} className="text-primary" /> Filtros Avançados
            </button>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 size={40} className="text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Escaneando Frota...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredData.map((item) => {
                const type = types.find(t => t.id === item.typeId);
                const model = models.find(m => m.id === item.modelId);
                const group = groups.find(g => g.id === item.groupId);

                return (
                  <div key={item.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl p-4 hover:border-primary/40 transition-all group relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#1a1f3a] flex items-center justify-center text-primary border border-[#2d3647]">
                          {getIcon(item.typeId)}
                        </div>
                        <div>
                          <h3 className="text-sm font-black italic tracking-tighter text-white uppercase group-hover:text-primary transition-colors leading-none">{item.code}</h3>
                          <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest mt-1">{type?.name} • {model?.name}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                         <button onClick={() => { setSelectedItem(item); setIsChecklistOpen(true); }} className="p-1.5 text-muted-foreground hover:text-primary transition-colors hover:bg-primary/10 rounded-lg" title="Executar Checklist"><ClipboardCheck size={14} /></button>
                         <button onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }} className="p-1.5 text-muted-foreground hover:text-white transition-colors hover:bg-[#1a1f3a] rounded-lg"><Edit size={14} /></button>
                         <button onClick={() => handleDelete(item.id)} className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {group && (
                         <div className="flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full" style={{ backgroundColor: group.color || '#6b7280' }}></div>
                           <span className="text-[9px] font-black uppercase tracking-widest text-white/60">{group.name}</span>
                         </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-muted-foreground uppercase font-black">Horímetro</span>
                        <span className="text-[11px] font-black italic text-primary tracking-tighter">{item.hourmeter}h</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] text-muted-foreground uppercase font-black">Status</span>
                        <StatusBadge status={item.status} />
                      </div>
                    </div>

                    <div className="pt-3 border-t border-[#2d3647] flex items-center justify-between">
                       <p className="text-[8px] text-muted-foreground font-bold uppercase">Último Sinal: {item.lastSignal}</p>
                       <button className="p-1 hover:bg-[#1a1f3a] rounded-lg text-muted-foreground hover:text-primary transition-all"><ChevronRight size={14} /></button>
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
              <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">
                {selectedItem ? 'Configurar Ativo' : 'Novo Ativo de Frota'}
              </h2>
              <button onClick={() => setIsDrawerOpen(false)} className="text-white hover:opacity-70 transition-opacity">
                <X size={24} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              {viewAudit && selectedItem ? (
                <EntityAuditInfo entity={selectedItem} />
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                  <FormField label="Código de Identificação" error={errors.code?.message} required>
                    <input
                      {...register('code')}
                      className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-2xl p-4 text-sm focus:border-primary outline-none transition-all text-white font-bold tracking-widest"
                      placeholder="1004"
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-6">
                    <FormField label="Tipo de Equipamento" error={errors.typeId?.message} required>
                      <select
                        {...register('typeId')}
                        className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-2xl p-4 text-sm focus:border-primary outline-none appearance-none text-white font-bold uppercase"
                      >
                        <option value="">Selecione...</option>
                        {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Modelo" error={errors.modelId?.message} required>
                      <select
                        {...register('modelId')}
                        className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-2xl p-4 text-sm focus:border-primary outline-none appearance-none text-white font-bold"
                      >
                        <option value="">Selecione...</option>
                        {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <FormField label="Grupo / Frente" error={errors.groupId?.message}>
                      <select
                        {...register('groupId')}
                        className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-2xl p-4 text-sm focus:border-primary outline-none appearance-none text-white font-bold uppercase"
                      >
                        <option value="">Nenhum</option>
                        {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </FormField>
                    <FormField label="Fabricante" error={errors.brand?.message} required>
                      <input
                        {...register('brand')}
                        className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-2xl p-4 text-sm focus:border-primary outline-none transition-all text-white font-bold"
                        placeholder="John Deere"
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                     <FormField label="Série / Placa" error={errors.plateOrSerial?.message}>
                        <input
                          {...register('plateOrSerial')}
                          className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-2xl p-4 text-sm focus:border-primary outline-none transition-all text-white font-bold"
                          placeholder="000"
                        />
                     </FormField>
                     <FormField label="Horímetro Atual" error={errors.hourmeter?.message} required>
                        <input
                          type="number"
                          step="0.1"
                          {...register('hourmeter')}
                          className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-2xl p-4 text-sm focus:border-primary outline-none transition-all text-white font-bold"
                          placeholder="0"
                        />
                     </FormField>
                  </div>

                  <FormField label="SITUAÇÃO" error={errors.status?.message} required>
                    <select
                      {...register('status')}
                      className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-2xl p-4 text-sm focus:border-primary outline-none appearance-none text-white font-bold"
                    >
                      <option value="ATIVO">ATIVO</option>
                      <option value="INATIVO">INATIVO</option>
                      <option value="manutencao">MANUTENÇÃO</option>
                    </select>
                  </FormField>

                  {/* APK Integration Section */}
                  <div className="pt-6 border-t border-[#2d3647] space-y-6">
                    <div className="flex items-center justify-between bg-[#1a1f3a]/40 p-4 rounded-2xl border border-[#2d3647]">
                      <div className="flex flex-col">
                        <span className="text-xs font-black uppercase text-white tracking-widest">Comunicação Mobile</span>
                        <span className="text-[10px] text-muted-foreground font-bold mt-1 uppercase">Habilitar sincronização com APK</span>
                      </div>
                      <input
                        type="checkbox"
                        {...register('mobileEnabled')}
                        className="w-5 h-5 rounded border-[#2d3647] bg-[#1a1f3a] text-primary focus:ring-primary"
                      />
                    </div>

                    {selectedItem?.mobileEnabled && (
                      <div className="space-y-4">
                        <div className="bg-[#050812] p-4 rounded-2xl border border-[#2d3647] border-dashed">
                          <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Token de Acesso Mobile</span>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-mono font-black text-primary tracking-widest">{selectedItem.mobileToken || 'PENDENTE'}</span>
                            <button type="button" className="text-[10px] font-black text-white/40 uppercase hover:text-white transition-colors">Copiar</button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-[#1a1f3a]/20 p-3 rounded-xl border border-[#2d3647]">
                            <span className="text-[9px] text-muted-foreground font-black uppercase block mb-1">Último Heartbeat</span>
                            <span className="text-[10px] text-white font-bold uppercase">{selectedItem.lastHeartbeat || 'Sem sinal'}</span>
                          </div>
                          <div className="bg-[#1a1f3a]/20 p-3 rounded-xl border border-[#2d3647]">
                            <span className="text-[9px] text-muted-foreground font-black uppercase block mb-1">Localização</span>
                            <span className="text-[10px] text-white font-bold uppercase">
                              {selectedItem.lastLocation ? `${selectedItem.lastLocation.latitude.toFixed(4)}, ${selectedItem.lastLocation.longitude.toFixed(4)}` : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <FormField label="Notas Técnicas" error={errors.observations?.message}>
                    <textarea
                      {...register('observations')}
                      rows={4}
                      className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-2xl p-4 text-sm focus:border-primary outline-none transition-all resize-none text-white font-medium"
                      placeholder="..."
                    />
                  </FormField>

                  <div className="pt-8 flex gap-4">
                    <button
                      type="button"
                      onClick={() => setIsDrawerOpen(false)}
                      className="flex-1 py-4 bg-transparent border border-[#2d3647] rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[#1a1f3a] transition-all flex items-center justify-center gap-2 text-white"
                    >
                      <Ban size={18} /> CANCELAR
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-4 bg-[#10b981] text-[#0a0e27] rounded-2xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#10b981]/20"
                    >
                      {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                      {selectedItem ? 'SALVAR ATIVO' : 'CRIAR ATIVO'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {isChecklistOpen && selectedItem && operators[0] && (
         <ChecklistExecutionDrawer
            equipment={selectedItem}
            operator={operators[0]}
            onClose={() => setIsChecklistOpen(false)}
            onSuccess={() => {
               setIsChecklistOpen(false);
               loadData();
            }}
         />
      )}
    </div>
  );
}

export default withAuth(FleetPage, { module: 'FROTA' });
