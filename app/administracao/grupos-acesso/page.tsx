"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { AccessGroupService } from '@/services/master.service';
import { AccessGroup } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { accessGroupSchema, AccessGroupFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import { EntityAuditInfo } from '@/components/shared/entity-audit-info';
import {
  ShieldCheck,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Ban,
  History,
  Lock,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';

function PerfisPage() {
  const [data, setData] = useState<AccessGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AccessGroup | null>(null);
  const [viewAudit, setViewAudit] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<AccessGroupFormData>({
    resolver: zodResolver(accessGroupSchema),
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) {
        reset({
          name: selectedItem.name,
          description: selectedItem.description || '',
          status: selectedItem.status,
        });
      } else {
        reset({
          name: '',
          description: '',
          status: 'ATIVO',
        });
      }
    } else {
      setViewAudit(false);
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    const result = await AccessGroupService.getAll();
    setData(result);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (id === 'ag-admin') {
      alert('ERRO: O grupo Administrador Full não pode ser removido.');
      return;
    }
    if (confirm('Deseja realmente arquivar este grupo de acesso?')) {
      try {
        await AccessGroupService.archive(id);
        loadData();
      } catch (e: any) { alert(e.message); }
    }
  };

  const onSubmit = async (formData: AccessGroupFormData) => {
    try {
      if (selectedItem) {
        await AccessGroupService.update(selectedItem.id, { ...formData, version: selectedItem.version });
      } else {
        await AccessGroupService.create({ ...formData, permissions: [] });
      }
      setIsDrawerOpen(false);
      loadData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Grupos de Acesso (RBAC)" description="Controle de Funções e Matriz de Permissões Multi-tenant" >
            <button onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform" >
              <Plus size={16} strokeWidth={3} /> Novo Grupo
            </button>
          </PageHeader>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4"><Loader2 size={40} className="text-primary animate-spin" /><p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Configurando Acessos...</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.map((item) => (
                <div key={item.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-6 hover:border-primary/40 transition-all group relative overflow-hidden flex flex-col h-full shadow-xl">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#1a1f3a] flex items-center justify-center text-primary shadow-lg border border-[#2d3647]">
                        <ShieldCheck size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black italic tracking-tighter text-white uppercase group-hover:text-primary transition-colors leading-none">{item.name}</h3>
                        <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest mt-1">{item.status}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }} className="p-2 text-muted-foreground hover:text-white transition-colors hover:bg-[#1a1f3a] rounded-lg"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-muted-foreground hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg disabled:opacity-30" disabled={item.id === 'ag-admin'}><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium mb-6 leading-relaxed flex-1">{item.description}</p>
                  <div className="pt-4 border-t border-[#2d3647] flex items-center justify-between">
                    <div className="flex -space-x-2">
                       {[1,2,3].map(i => <div key={i} className="w-6 h-6 rounded-full bg-[#1a1f3a] border-2 border-[#0a0e27] flex items-center justify-center"><Lock size={10} className="text-primary/50" /></div>)}
                    </div>
                    <button className="text-[10px] font-black text-primary uppercase hover:underline flex items-center gap-1.5">Matriz de Permissões <CheckCircle2 size={12} /></button>
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
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">{selectedItem ? 'Editar Grupo' : 'Novo Grupo'}</h2>
              <div className="flex gap-2">
                {selectedItem && (
                   <button onClick={() => setViewAudit(!viewAudit)} className={cn("p-2 rounded-xl border border-[#2d3647] transition-all", viewAudit ? "bg-primary text-[#0a0e27]" : "text-muted-foreground hover:text-white")}><History size={18} /></button>
                )}
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all text-white"><X size={20} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              {viewAudit && selectedItem ? (
                <EntityAuditInfo entity={selectedItem} />
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                  <FormField label="Nome do Grupo" error={errors.name?.message} required>
                    <input {...register('name')} className={cn("w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all font-bold", errors.name && "border-red-500/50")} placeholder="Ex: Supervisores de Campo" />
                  </FormField>

                  <FormField label="Status" error={errors.status?.message} required>
                    <select {...register('status')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all appearance-none uppercase font-black italic">
                      <option value="ATIVO">ATIVO</option>
                      <option value="INATIVO">INATIVO</option>
                    </select>
                  </FormField>

                  <FormField label="Descrição das Atribuições" error={errors.description?.message}>
                    <textarea {...register('description')} rows={4} className={cn("w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all resize-none", errors.description && "border-red-500/50")} placeholder="Defina as responsabilidades deste grupo..." ></textarea>
                  </FormField>

                  <div className="pt-6 flex gap-3">
                    <button type="button" onClick={() => setIsDrawerOpen(false)} className="flex-1 py-3 bg-transparent border border-[#2d3647] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#1a1f3a] transition-all flex items-center justify-center gap-2"><Ban size={14} /> Cancelar</button>
                    <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                      {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar Grupo
                    </button>
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

export default withAuth(PerfisPage, { module: 'PERFIS' });
