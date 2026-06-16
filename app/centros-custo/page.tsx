"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { CostCenterService } from '@/services/api-service';
import { CostCenter } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormField } from '@/components/shared/form-field';
import { ActionFeedback, type ActionFeedbackMessage } from '@/components/shared/action-feedback';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  Building2,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Search,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { withAuth } from '@/components/shared/with-auth';

const costCenterSchema = z.object({
  code:        z.string().min(1, 'Codigo e obrigatorio'),
  name:        z.string().min(2, 'Nome e obrigatorio'),
  description: z.string().optional(),
  status:      z.enum(['ATIVO', 'INATIVO']).default('ATIVO'),
});

type CostCenterFormData = z.infer<typeof costCenterSchema>;

function CentrosCustoPage() {
  const [data, setData] = useState<CostCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<CostCenter | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedbackMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<CostCenter | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CostCenterFormData>({
    resolver: zodResolver(costCenterSchema),
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) {
        reset({
          code:        selectedItem.code        ?? '',
          name:        selectedItem.name        ?? '',
          description: selectedItem.description ?? '',
          status:      selectedItem.status      ?? 'ATIVO',
        });
      } else {
        reset({ code: '', name: '', description: '', status: 'ATIVO' });
      }
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    const result = await CostCenterService.getAll();
    setData(result);
    setLoading(false);
  };

  const onSubmit = async (formData: CostCenterFormData) => {
    try {
      const payload = {
        ...formData,
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        entityStatus: 'ATIVO' as const,
      };
      if (selectedItem) {
        await CostCenterService.update(selectedItem.id, payload);
      } else {
        await CostCenterService.create(payload);
      }
      setIsDrawerOpen(false);
      setSelectedItem(null);
      loadData();
      setFeedback({
        type: 'success',
        message: selectedItem ? 'Centro de custo atualizado com sucesso' : 'Centro de custo criado com sucesso',
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Falha ao salvar centro de custo';
      setFeedback({ type: 'error', message: msg });
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await CostCenterService.archive(confirmDelete.id);
      setFeedback({ type: 'success', message: 'Centro de custo arquivado com sucesso' });
      setConfirmDelete(null);
      loadData();
    } catch {
      setConfirmDelete(null);
      setFeedback({ type: 'error', message: 'Falha ao arquivar centro de custo' });
    }
  };

  const filtered = data.filter(
    (item) =>
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Centros de Custo" description="Classificacao e Gestao de Centros de Custo Operacionais">
            <button
              onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"
            >
              <Plus size={16} strokeWidth={3} /> Novo Centro de Custo
            </button>
          </PageHeader>

          <ActionFeedback feedback={feedback} onDismiss={() => setFeedback(null)} />

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por codigo ou nome..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 shadow-inner"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 size={40} className="text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Carregando Centros de Custo...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Building2 size={40} className="text-muted-foreground/30" />
              <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">
                {search ? 'Nenhum resultado encontrado' : 'Nenhum centro de custo cadastrado'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-5 hover:border-primary/40 transition-all group relative overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg border border-[#2d3647] bg-primary/10 text-primary">
                        <Building2 size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black italic tracking-tighter text-white uppercase group-hover:text-primary transition-colors">
                          {item.name}
                        </h3>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                          Codigo: {item.code}
                        </p>
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
                        onClick={() => setConfirmDelete(item)}
                        className="p-2 text-muted-foreground hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {item.description && (
                    <p className="text-xs text-muted-foreground mb-4 line-clamp-2">{item.description}</p>
                  )}

                  <div className="flex items-center gap-2 mt-auto pt-3 border-t border-[#2d3647]">
                    {item.status === 'ATIVO' ? (
                      <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-500">
                        <CheckCircle2 size={10} /> Ativo
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[9px] font-black uppercase text-red-400">
                        <AlertCircle size={10} /> Inativo
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsDrawerOpen(false)}
          />
          <div className="relative w-full max-w-md bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">
                {selectedItem ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
              </h2>
              <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            <form className="space-y-6 flex-1 overflow-y-auto pr-2 custom-scrollbar" onSubmit={handleSubmit(onSubmit)}>
              <FormField label="Codigo" error={errors.code?.message} required>
                <input
                  {...register('code')}
                  className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none uppercase font-bold"
                />
              </FormField>

              <FormField label="Nome" error={errors.name?.message} required>
                <input
                  {...register('name')}
                  className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none"
                />
              </FormField>

              <FormField label="Descricao" error={errors.description?.message}>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none resize-none"
                />
              </FormField>

              <FormField label="Status" error={errors.status?.message} required>
                <select
                  {...register('status')}
                  className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none"
                >
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </FormField>

              <div className="pt-6 flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-60"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Arquivar centro de custo?"
        description={`Deseja realmente arquivar ${confirmDelete?.name || 'este centro de custo'}?`}
        confirmLabel="Arquivar"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={executeDelete}
      />
    </div>
  );
}

export default withAuth(CentrosCustoPage, { module: 'CENTROS_CUSTO' });
