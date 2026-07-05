"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { EquipmentService, EquipmentTypeService, EquipmentModelService } from '@/services/master.service';
import { Equipment, EquipmentType, EquipmentModel } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { equipmentSchema, EquipmentFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import { EntityAuditInfo } from '@/components/shared/entity-audit-info';
import { EquipmentIcon } from '@/components/icons/equipment-icons';
import { ActionFeedback, type ActionFeedbackMessage } from '@/components/shared/action-feedback';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { MasterDataShell } from '@/components/master-data/master-data-shell';
import { MasterDataToolbar } from '@/components/master-data/master-data-toolbar';
import { MasterDataStatusBadge } from '@/components/master-data/master-data-status-badge';
import {
  Truck,
  Filter,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Ban,
  History as HistoryIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { withAuth } from '@/components/shared/with-auth';

function EquipamentosPage() {
  const [data, setData] = useState<Equipment[]>([]);
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [models, setModels] = useState<EquipmentModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
  const [viewAudit, setViewAudit] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedbackMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Equipment | null>(null);

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
    const [fleet, t, m] = await Promise.all([
      EquipmentService.getAll(),
      EquipmentTypeService.getAll(),
      EquipmentModelService.getAll()
    ]);
    setData(fleet);
    setTypes(t);
    setModels(m);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const item = data.find((equipment) => equipment.id === id);
    if (!item) return;
    setConfirmDelete(item);
  };

  const onSubmit = async (formData: EquipmentFormData) => {
    try {
      if (selectedItem) {
        await EquipmentService.update(selectedItem.id, {
          ...formData,
          version: selectedItem.version
        });
      } else {
        const all = await EquipmentService.getAll(true);
        if (all.some(e => e.code === formData.code && e.entityStatus !== 'ARQUIVADO')) {
           throw new Error('CÃ³digo de frota jÃ¡ cadastrado e ativo.');
        }
        await EquipmentService.create({ ...formData, lastSignal: 'Agora' });
      }
      setIsDrawerOpen(false);
      loadData();
    } catch (error: any) {
      setFeedback({ type: 'error', message: error.message || 'Falha ao salvar equipamento' });
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await EquipmentService.archive(confirmDelete.id);
      setFeedback({ type: 'success', message: 'Equipamento arquivado com sucesso' });
      setConfirmDelete(null);
      loadData();
    } catch (error: any) {
      setConfirmDelete(null);
      setFeedback({ type: 'error', message: error.message || 'Falha ao arquivar equipamento' });
    }
  };

  const filteredData = data.filter(item => {
    const type = types.find(t => t.id === item.typeId)?.name || '';
    const model = models.find(m => m.id === item.modelId)?.name || '';
    return item.code.toLowerCase().includes(search.toLowerCase()) ||
           model.toLowerCase().includes(search.toLowerCase()) ||
           type.toLowerCase().includes(search.toLowerCase());
  });

  /** Resolve iconType: equipamento override > modelo > fallback */
  const getEquipmentIconType = (item: Equipment): string => {
    if (item.iconType) return item.iconType;
    const model = models.find(m => m.id === item.modelId);
    if (model?.iconType) return model.iconType;
    return 'PADRAO_GENERICO';
  };

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">          <MasterDataShell
            title="Equipamentos"
            description="Gestão de Ativos e Telemetria de Frota"
            actions={
              <button
                onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"
              >
                <Plus size={16} strokeWidth={3} /> Novo Equipamento
              </button>
            }
          >

          <ActionFeedback feedback={feedback} onDismiss={() => setFeedback(null)} />

          <MasterDataToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Buscar por código, modelo ou tipo..."
            actions={
              <button className="flex items-center gap-2 px-4 py-3 bg-[#1a1f3a] border border-[#2d3647] rounded-2xl text-xs font-bold hover:bg-[#252d4a] transition-all">
                <Filter size={16} className="text-primary" /> Filtros
              </button>
            }
          />

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 size={40} className="text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Sincronizando Frota...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-[#2d3647] rounded-3xl bg-[#0a0e27]/60">
              <Truck size={48} className="text-muted-foreground mb-4 opacity-20" />
              <p className="text-muted-foreground font-bold uppercase text-xs">Nenhum equipamento encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredData.map((item) => {
                const type = types.find(t => t.id === item.typeId);
                const model = models.find(m => m.id === item.modelId);
                const iconType = getEquipmentIconType(item);
                return (
                  <div key={item.id} className="bg-[#0a0e27]/70 border border-[#2d3647] rounded-3xl p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 transition-all group relative overflow-hidden">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-4">
                        <div className={cn("w-12 h-12 rounded-2xl bg-[#1a1f3a] flex items-center justify-center text-primary shadow-lg border border-[#2d3647]")}>
                          <EquipmentIcon type={iconType} size={28} />
                        </div>
                        <div>
                          <h3 className="text-lg font-black italic tracking-tighter text-white uppercase group-hover:text-primary transition-colors">{item.code}</h3>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{item.brand} {model?.name}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }}
                          className="p-2 text-muted-foreground hover:text-white transition-colors hover:bg-[#1a1f3a] rounded-lg"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-2 text-muted-foreground hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-3 mb-6">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground uppercase font-black">Tipo</span>
                        <span className="text-xs font-bold text-white uppercase">{type?.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground uppercase font-black">SÃ©rie/Placa</span>
                        <span className="text-xs font-bold text-white uppercase">{item.plateOrSerial || '-'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground uppercase font-black">HorÃ­metro</span>
                        <span className="text-xs font-black italic text-primary tracking-tighter">{item.hourmeter}h</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground uppercase font-black">Status</span>
                        <MasterDataStatusBadge status={item.status} />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-[#2d3647] flex items-center justify-between">
                      <span className="text-[9px] text-muted-foreground font-bold uppercase">Ãšltimo Sinal: {item.lastSignal}</span>
                      <button className="text-[10px] font-black text-primary uppercase hover:underline">Telemetria</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </MasterDataShell>
        </main>
      </div>

      {/* Drawer Enterprise */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="relative w-full max-w-md bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">
                  {selectedItem ? 'Editar Equipamento' : 'Novo Equipamento'}
                </h2>
                {selectedItem && (
                   <p className="text-[10px] text-primary font-bold uppercase">VersÃ£o {selectedItem.version}</p>
                )}
              </div>
              <div className="flex gap-2">
                {selectedItem && (
                   <button
                    onClick={() => setViewAudit(!viewAudit)}
                    className={cn(
                      "p-2 rounded-xl transition-all border border-[#2d3647]",
                      viewAudit ? "bg-primary text-[#0a0e27]" : "hover:bg-[#1a1f3a] text-muted-foreground"
                    )}
                   >
                     <HistoryIcon size={18} />
                   </button>
                )}
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              {viewAudit && selectedItem ? (
                <EntityAuditInfo entity={selectedItem} />
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                  <FormField label="CÃ³digo da Frota" error={errors.code?.message} required>
                    <input
                      {...register('code')}
                      className={cn(
                        "w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all uppercase font-bold tracking-widest",
                        errors.code && "border-red-500/50"
                      )}
                      placeholder="Ex: 605112"
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Tipo" error={errors.typeId?.message} required>
                      <select
                        {...register('typeId')}
                        className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all appearance-none"
                      >
                        <option value="">Selecione...</option>
                        {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </FormField>

                    <FormField label="Fabricante" error={errors.brand?.message} required>
                      <input
                        {...register('brand')}
                        className={cn(
                          "w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all",
                          errors.brand && "border-red-500/50"
                        )}
                        placeholder="Ex: John Deere"
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Modelo" error={errors.modelId?.message} required>
                      <select
                        {...register('modelId')}
                        className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all appearance-none"
                      >
                        <option value="">Selecione...</option>
                        {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </FormField>

                    <FormField label="SÃ©rie / Placa" error={errors.plateOrSerial?.message}>
                       <input
                        {...register('plateOrSerial')}
                        className={cn(
                          "w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all",
                          errors.plateOrSerial && "border-red-500/50"
                        )}
                        placeholder="Ex: ABC-1234"
                      />
                    </FormField>
                  </div>

                  <FormField label="HorÃ­metro Atual" error={errors.hourmeter?.message} required>
                    <input
                      type="number"
                      step="0.1"
                      {...register('hourmeter')}
                      className={cn(
                        "w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all",
                        errors.hourmeter && "border-red-500/50"
                      )}
                      placeholder="0.0"
                    />
                  </FormField>

                  <FormField label="Status Operacional" error={errors.status?.message} required>
                    <select
                      {...register('status')}
                      className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all appearance-none"
                    >
                      <option value="ATIVO">ATIVO</option>
                      <option value="INATIVO">INATIVO</option>
                      <option value="manutencao">MANUTENÃ‡ÃƒO</option>
                      <option value="trabalhando">Trabalhando</option>
                      <option value="deslocando">Deslocando</option>
                      <option value="parada">Parada</option>
                      <option value="alarme">Alarme</option>
                      <option value="offline">Offline</option>
                    </select>
                  </FormField>

                  {/* APK Integration Section */}
                  <div className="pt-4 border-t border-[#2d3647] space-y-4">
                    <div className="flex items-center justify-between bg-[#1a1f3a]/40 p-3 rounded-xl border border-[#2d3647]">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-white tracking-widest">ComunicaÃ§Ã£o Mobile</span>
                        <span className="text-[8px] text-muted-foreground font-bold uppercase">Habilitar APK</span>
                      </div>
                      <input
                        type="checkbox"
                        {...register('mobileEnabled')}
                        className="w-4 h-4 rounded border-[#2d3647] bg-[#1a1f3a] text-primary focus:ring-primary"
                      />
                    </div>

                    {selectedItem?.mobileEnabled && (
                      <div className="space-y-3">
                        <div className="bg-[#050812] p-3 rounded-xl border border-[#2d3647] border-dashed">
                          <span className="text-[8px] text-muted-foreground font-black uppercase tracking-widest">Token Mobile</span>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs font-mono font-black text-primary">{selectedItem.mobileToken || 'PENDENTE'}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <FormField label="ObservaÃ§Ãµes" error={errors.observations?.message}>
                    <textarea
                      {...register('observations')}
                      rows={4}
                      className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all resize-none"
                      placeholder="Notas adicionais sobre o equipamento..."
                    ></textarea>
                  </FormField>

                  <div className="pt-6 flex gap-3">
                    <button
                      type="button"
                      onClick={() => setIsDrawerOpen(false)}
                      className="flex-1 py-3 bg-transparent border border-[#2d3647] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1a1f3a] transition-all flex items-center justify-center gap-2"
                    >
                      <Ban size={14} /> Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                    >
                      {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {selectedItem ? 'Salvar AlteraÃ§Ãµes' : 'Criar Equipamento'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Arquivar equipamento?"
        description={`Deseja realmente arquivar ${confirmDelete?.code || 'este equipamento'}?`}
        confirmLabel="Arquivar"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={executeDelete}
      />
    </div>
  );
}

export default withAuth(EquipamentosPage, { module: 'EQUIPAMENTOS' });







