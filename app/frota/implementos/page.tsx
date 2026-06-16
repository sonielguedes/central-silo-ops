"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { ImplementService, EquipmentTypeService, EquipmentModelService } from '@/services/api-service';
import { Implement, EquipmentType, EquipmentModel } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormField } from '@/components/shared/form-field';
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Search,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Modelo e opcional — nao existe regra de jornada que exija modelo para criar implemento.
// Se o tenant nao tiver modelos cadastrados, o campo fica visivel mas sem bloqueio.
const implementDrawerSchema = z.object({
  code:    z.string().min(1, 'Codigo e obrigatorio'),
  name:    z.string().min(2, 'Nome e obrigatorio'),
  typeId:  z.string().min(1, 'Tipo e obrigatorio'),
  modelId: z.string().optional(),
});

type ImplementDrawerFormData = z.infer<typeof implementDrawerSchema>;

export default function ImplementsPage() {
  const [data, setData] = useState<Implement[]>([]);
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [models, setModels] = useState<EquipmentModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Implement | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ImplementDrawerFormData>({
    resolver: zodResolver(implementDrawerSchema),
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      setFeedback(null);
      if (selectedItem) {
        reset({
          code:    selectedItem.code    ?? '',
          name:    selectedItem.name    ?? '',
          typeId:  selectedItem.typeId  ?? '',
          modelId: selectedItem.modelId ?? '',
        });
      }
      else reset({ code: '', name: '', typeId: '', modelId: '' });
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [implementsRes, t, m] = await Promise.all([
        ImplementService.getAll(),
        EquipmentTypeService.getAll(),
        EquipmentModelService.getAll(),
      ]);
      setData(implementsRes);
      setTypes(t);
      setModels(m);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (formData: ImplementDrawerFormData) => {
    // Resolve nomes de tipo e modelo para armazenar no registro
    const typeName  = types.find(t => t.id === formData.typeId)?.name  ?? formData.typeId;
    const modelName = formData.modelId
      ? (models.find(m => m.id === formData.modelId)?.name ?? formData.modelId)
      : undefined;

    const payload = {
      code:         formData.code.trim().toUpperCase(),
      name:         formData.name.trim().toUpperCase(),
      typeId:       formData.typeId,
      type:         typeName,
      ...(formData.modelId ? { modelId: formData.modelId } : {}),
      ...(modelName        ? { model:   modelName }        : {}),
      status:       'ATIVO',
      entityStatus: 'ATIVO',
    };

    try {
      const saved = selectedItem
        ? await ImplementService.update(selectedItem.id, payload)
        : await ImplementService.create(payload);
      if (!saved) throw new Error('Resposta vazia do servidor.');
      const implementsRes = await ImplementService.getAll();
      setData(implementsRes);
      reset({ code: '', name: '', typeId: '', modelId: '' });
      setFeedback({ type: 'success', message: 'Implemento salvo com sucesso' });
      setIsDrawerOpen(false);
      setSelectedItem(null);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Falha ao salvar implemento',
      });
    }
  };

  const filteredData = data.filter(
    item =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Implementos Agrícolas" description="Cadastro de Acoplamentos, Plataformas e Acessórios">
            <button
              onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg"
            >
              <Plus size={16} strokeWidth={3} /> Novo Implemento
            </button>
          </PageHeader>

          {feedback && (
            <div className={cn(
              "mb-4 rounded-2xl border px-4 py-3 text-xs font-bold uppercase tracking-wider",
              feedback.type === 'success'
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/30 bg-red-500/10 text-red-300"
            )}>
              {feedback.message}
            </div>
          )}

          <div className="mb-6 relative w-full max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filtrar implementos..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 shadow-inner"
            />
          </div>

          {loading ? (
            <div className="flex justify-center p-12"><Loader2 size={40} className="text-primary animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredData.map(item => (
                <div key={item.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl p-4 flex flex-col group hover:border-primary/40 transition-all">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[#1a1f3a] border border-[#2d3647] flex items-center justify-center text-primary">
                      <Zap size={20} />
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }}
                        className="p-1.5 text-muted-foreground hover:text-white transition-colors hover:bg-[#1a1f3a] rounded-lg"
                      ><Edit size={14} /></button>
                      <button
                        onClick={async () => {
                          if (confirm('Excluir implemento?')) {
                            await ImplementService.archive(item.id);
                            loadData();
                          }
                        }}
                        className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg"
                      ><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <h3 className="text-sm font-black italic tracking-tighter text-white uppercase group-hover:text-primary transition-colors leading-none">{item.code}</h3>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1.5">{item.name}</p>
                  <div className="mt-4 pt-3 border-t border-[#2d3647] flex items-center justify-between">
                    <span className={cn(
                      "text-[9px] font-black uppercase flex items-center gap-1.5",
                      (item.status === 'DISPONIVEL' || (item.status as string) === 'ATIVO')
                        ? "text-emerald-500"
                        : item.status === 'VINCULADO'
                        ? "text-blue-500"
                        : "text-red-400"
                    )}>
                      {(item.status === 'DISPONIVEL' || (item.status as string) === 'ATIVO')
                        ? <CheckCircle2 size={10} />
                        : <AlertCircle size={10} />}
                      {item.status ?? item.entityStatus ?? 'ATIVO'}
                    </span>
                    <button className="text-[10px] text-primary font-black uppercase hover:underline">Vincular</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative w-full max-w-md bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">
                {selectedItem ? 'Configurar Implemento' : 'Novo Implemento'}
              </h2>
              <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all"><X size={20} /></button>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
              {feedback?.type === 'error' && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold uppercase tracking-wider text-red-300">
                  {feedback.message}
                </div>
              )}

              <FormField label="Código de Identificação" error={errors.code?.message} required>
                <input
                  {...register('code')}
                  className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none uppercase font-bold"
                />
              </FormField>

              <FormField label="Nome / Descritivo" error={errors.name?.message} required>
                <input
                  {...register('name')}
                  className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Tipo" error={errors.typeId?.message} required>
                  <select
                    {...register('typeId')}
                    className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none"
                  >
                    <option value="">Selecione...</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </FormField>

                <FormField label="Modelo (opcional)" error={errors.modelId?.message}>
                  {models.length === 0 ? (
                    <div className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-xs text-muted-foreground italic">
                      Nenhum modelo cadastrado
                    </div>
                  ) : (
                    <select
                      {...register('modelId')}
                      className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none"
                    >
                      <option value="">Nenhum</option>
                      {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  )}
                </FormField>
              </div>

              <div className="pt-6 flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar Implemento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
