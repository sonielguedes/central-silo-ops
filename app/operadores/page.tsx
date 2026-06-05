"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { OperatorService } from '@/services/master.service';
import { Operator } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { operatorSchema, OperatorFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import { EntityAuditInfo } from '@/components/shared/entity-audit-info';
import {
  User,
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Ban,
  Phone,
  Briefcase,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { withAuth } from '@/components/shared/with-auth';

function OperadoresPage() {
  const [data, setData] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Operator | null>(null);
  const [viewAudit, setViewAudit] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<OperatorFormData>({
    resolver: zodResolver(operatorSchema),
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) {
        reset({
          registration: selectedItem.registration,
          name: selectedItem.name,
          phone: selectedItem.phone || '',
          role: selectedItem.role,
          status: selectedItem.status,
          shift: selectedItem.shift,
          observations: selectedItem.observations || '',
        });
      } else {
        reset({
          registration: '',
          name: '',
          phone: '',
          role: '',
          status: 'ATIVO',
          shift: 'Turno A',
          observations: '',
        });
      }
    } else {
      setViewAudit(false);
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    const result = await OperatorService.getAll();
    setData(result);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      if (confirm('Deseja realmente arquivar este operador?')) {
        await OperatorService.archive(id);
        loadData();
      }
    } catch (error: any) {
      alert(error.message);
    }
  };

  const onSubmit = async (formData: OperatorFormData) => {
    try {
      if (selectedItem) {
        await OperatorService.update(selectedItem.id, {
          ...formData,
          version: selectedItem.version
        });
      } else {
        await OperatorService.create(formData);
      }
      setIsDrawerOpen(false);
      loadData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const filteredData = data.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.registration.toLowerCase().includes(search.toLowerCase()) ||
    item.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader
            title="Operadores"
            description="Gestão de Equipe e Recursos Humanos Operacionais"
          >
            <button
              onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"
            >
              <Plus size={16} strokeWidth={3} /> Novo Operador
            </button>
          </PageHeader>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por matrícula, nome ou função..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 shadow-inner"
              />
            </div>
          </div>

          {loading ? (
             <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 size={40} className="text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Carregando Equipe...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-[#2d3647] rounded-3xl">
              <User size={48} className="text-muted-foreground mb-4 opacity-20" />
              <p className="text-muted-foreground font-bold uppercase text-xs">Nenhum operador encontrado</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredData.map((item) => (
                <div key={item.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-5 hover:border-primary/40 transition-all group relative overflow-hidden">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-[#1a1f3a] flex items-center justify-center text-primary shadow-lg border border-[#2d3647]">
                        <User size={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black italic tracking-tighter text-white uppercase group-hover:text-primary transition-colors">{item.name}</h3>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Matrícula: {item.registration}</p>
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
                    <div className="flex items-center gap-3 text-xs text-white/80">
                       <Briefcase size={14} className="text-primary" />
                       <span className="font-bold uppercase tracking-tight">{item.role}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-white/80">
                       <Clock size={14} className="text-primary" />
                       <span className="font-bold uppercase tracking-tight">{item.shift}</span>
                    </div>
                    {item.phone && (
                      <div className="flex items-center gap-3 text-xs text-white/80">
                         <Phone size={14} className="text-primary" />
                         <span className="font-bold tracking-tight">{item.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#2d3647] flex items-center justify-between">
                    <div className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase border",
                      item.status === 'ATIVO' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" :
                      item.status === 'FERIAS' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                      "bg-amber-500/10 text-amber-500 border-amber-500/20"
                    )}>
                      {item.status}
                    </div>
                    <button className="text-[10px] font-black text-primary uppercase hover:underline">Histórico</button>
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
              <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">
                {selectedItem ? 'Editar Operador' : 'Novo Operador'}
              </h2>
              <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
               {viewAudit && selectedItem ? (
                <EntityAuditInfo entity={selectedItem} />
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                   <FormField label="Matrícula" error={errors.registration?.message} required>
                    <input
                      {...register('registration')}
                      className={cn(
                        "w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all font-bold",
                        errors.registration && "border-red-500/50"
                      )}
                      placeholder="Ex: 1001"
                    />
                  </FormField>

                  <FormField label="Nome Completo" error={errors.name?.message} required>
                    <input
                      {...register('name')}
                      className={cn(
                        "w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all",
                        errors.name && "border-red-500/50"
                      )}
                      placeholder="Ex: João da Silva"
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Função" error={errors.role?.message} required>
                      <input
                        {...register('role')}
                        className={cn(
                          "w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all",
                          errors.role && "border-red-500/50"
                        )}
                        placeholder="Ex: Operador"
                      />
                    </FormField>

                    <FormField label="Telefone" error={errors.phone?.message}>
                      <input
                        {...register('phone')}
                        className={cn(
                          "w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all",
                          errors.phone && "border-red-500/50"
                        )}
                        placeholder="(00) 00000-0000"
                      />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Status" error={errors.status?.message} required>
                      <select
                        {...register('status')}
                        className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all appearance-none"
                      >
                        <option value="ATIVO">Ativo</option>
                        <option value="FERIAS">Férias</option>
                        <option value="AFASTADO">Afastado</option>
                        <option value="INATIVO">Inativo</option>
                      </select>
                    </FormField>

                    <FormField label="Turno" error={errors.shift?.message} required>
                      <select
                        {...register('shift')}
                        className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all appearance-none"
                      >
                        <option value="Turno A">Turno A</option>
                        <option value="Turno B">Turno B</option>
                        <option value="Turno C">Turno C</option>
                        <option value="Administrativo">Administrativo</option>
                      </select>
                    </FormField>
                  </div>

                  <FormField label="Observações" error={errors.observations?.message}>
                    <textarea
                      {...register('observations')}
                      rows={4}
                      className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all resize-none"
                      placeholder="Notas adicionais sobre o colaborador..."
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
                      {selectedItem ? 'Salvar Alterações' : 'Criar Operador'}
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

export default withAuth(OperadoresPage, { module: 'OPERADORES' });
