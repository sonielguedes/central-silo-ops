"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { OperationService } from '@/services/api-service';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FormField } from '@/components/shared/form-field';
import {
  BookOpen, Plus, Edit, Trash2, Loader2, X, Save, Search,
  CheckCircle2, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';

const catalogSchema = z.object({
  code:        z.string().min(1, 'Codigo e obrigatorio'),
  name:        z.string().min(2, 'Nome e obrigatorio'),
  description: z.string().optional(),
  status:      z.enum(['ATIVO', 'INATIVO']).default('ATIVO'),
});

type CatalogFormData = z.infer<typeof catalogSchema>;

// Minimal shape expected from the operacoes entity for master catalog records
interface OperationCatalogItem {
  id: string;
  code?: string;
  name?: string;
  description?: string;
  status?: string;
  entityStatus?: string;
  isMasterCatalog?: boolean;
  [key: string]: unknown;
}

function CatalogosOperacionaisPage() {
  const [all, setAll] = useState<OperationCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OperationCatalogItem | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<CatalogFormData>({
    resolver: zodResolver(catalogSchema),
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      setFeedback(null);
      if (selectedItem) {
        reset({
          code:        selectedItem.code        ?? '',
          name:        selectedItem.name        ?? '',
          description: selectedItem.description ?? '',
          status:      (selectedItem.status as 'ATIVO' | 'INATIVO') ?? 'ATIVO',
        });
      } else {
        reset({ code: '', name: '', description: '', status: 'ATIVO' });
      }
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch all operacoes and keep only master catalog records.
      // ensureOperationsCatalogForTenant is called server-side before returning.
      const raw = (await OperationService.getAll()) as unknown as OperationCatalogItem[];
      // isMasterCatalog flag distinguishes catalog types from active operation records
      const masterOnly = raw.filter(
        r => r.isMasterCatalog === true || (!r.equipmentId && !r.operatorId && !r.start)
      );
      setAll(masterOnly);
    } catch {
      setAll([]);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (formData: CatalogFormData) => {
    const payload = {
      code:            formData.code.trim().toUpperCase(),
      name:            formData.name.trim(),
      description:     formData.description?.trim() ?? '',
      status:          formData.status,
      entityStatus:    formData.status,
      isMasterCatalog: true,
    };
    try {
      if (selectedItem) {
        await OperationService.update(selectedItem.id, payload);
      } else {
        await OperationService.create(payload);
      }
      setFeedback({ type: 'success', message: 'Tipo de operacao salvo com sucesso' });
      setIsDrawerOpen(false);
      setSelectedItem(null);
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Falha ao salvar tipo de operacao',
      });
    }
  };

  const handleArchive = async (item: OperationCatalogItem) => {
    if (!confirm('Arquivar este tipo de operacao?')) return;
    try {
      await OperationService.archive(item.id);
      await loadData();
    } catch {
      setFeedback({ type: 'error', message: 'Falha ao arquivar' });
    }
  };

  const data = all.filter(
    item =>
      String(item.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      String(item.code ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader
            title="Catalogos Operacionais"
            description="Tipos mestres de operacao agricola — Preparo de Solo, Plantio, Colheita..."
          >
            <button
              onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg"
            >
              <Plus size={16} strokeWidth={3} /> Novo Tipo
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
              placeholder="Filtrar tipos de operacao..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 shadow-inner"
            />
          </div>

          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 size={40} className="text-primary animate-spin" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <BookOpen size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm font-bold uppercase tracking-widest">Nenhum tipo de operacao cadastrado</p>
              <p className="text-xs mt-2 opacity-60">Clique em &ldquo;Novo Tipo&rdquo; para adicionar</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[#2d3647]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2d3647] bg-[#0a0e27]/80">
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Codigo</th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Nome</th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground hidden md:table-cell">Descricao</th>
                    <th className="text-left px-4 py-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {data.map(item => (
                    <tr key={item.id} className="border-b border-[#2d3647] hover:bg-[#1a1f3a]/40 transition-colors">
                      <td className="px-4 py-3 font-black text-primary">{item.code ?? '—'}</td>
                      <td className="px-4 py-3 font-bold">{item.name ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">{item.description ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-[9px] font-black uppercase flex items-center gap-1",
                          item.status === 'ATIVO'
                            ? "text-emerald-500"
                            : "text-red-400"
                        )}>
                          {item.status === 'ATIVO' ? <CheckCircle2 size={10} /> : <AlertCircle size={10} />}
                          {item.status ?? 'ATIVO'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }}
                            className="p-1.5 text-muted-foreground hover:text-white transition-colors hover:bg-[#1a1f3a] rounded-lg"
                          ><Edit size={14} /></button>
                          <button
                            onClick={() => handleArchive(item)}
                            className="p-1.5 text-muted-foreground hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg"
                          ><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                {selectedItem ? 'Editar Tipo' : 'Novo Tipo de Operacao'}
              </h2>
              <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            <form className="space-y-6 flex-1 overflow-y-auto" onSubmit={handleSubmit(onSubmit)}>
              {feedback?.type === 'error' && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold uppercase tracking-wider text-red-300">
                  {feedback.message}
                </div>
              )}

              <FormField label="Codigo" error={errors.code?.message} required>
                <input
                  {...register('code')}
                  placeholder="Ex: 1001"
                  className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none font-bold uppercase"
                />
              </FormField>

              <FormField label="Nome" error={errors.name?.message} required>
                <input
                  {...register('name')}
                  placeholder="Ex: Preparo de Solo"
                  className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none"
                />
              </FormField>

              <FormField label="Descricao" error={errors.description?.message}>
                <input
                  {...register('description')}
                  placeholder="Descricao opcional"
                  className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none"
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

              <div className="pt-6">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg"
                >
                  {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Salvar Tipo de Operacao
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(CatalogosOperacionaisPage, { module: 'cadastros' });
