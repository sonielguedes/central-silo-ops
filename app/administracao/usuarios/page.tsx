"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { UserService, AccessGroupService, UnitService } from '@/services/master.service';
import { User, AccessGroup, Unit } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { userSchema, UserFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import { EntityAuditInfo } from '@/components/shared/entity-audit-info';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Ban,
  ShieldCheck,
  History,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';

function UsuariosPage() {
  const [data, setData] = useState<User[]>([]);
  const [accessGroups, setAccessGroups] = useState<AccessGroup[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<User | null>(null);
  const [viewAudit, setViewAudit] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) {
        reset({
          name: selectedItem.name,
          username: selectedItem.username,
          email: selectedItem.email,
          password: selectedItem.password || '',
          phone: selectedItem.phone || '',
          jobTitle: selectedItem.jobTitle || '',
          accessGroupId: selectedItem.accessGroupId,
          unitId: selectedItem.unitId || '',
          isADValidated: selectedItem.isADValidated,
          requirePasswordChange: selectedItem.requirePasswordChange,
          status: selectedItem.status,
        });
      } else {
        reset({
          name: '',
          username: '',
          email: '',
          password: '',
          phone: '',
          jobTitle: '',
          accessGroupId: '',
          unitId: '',
          isADValidated: false,
          requirePasswordChange: false,
          status: 'ATIVO',
        });
      }
    } else {
      setViewAudit(false);
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadAllData = async () => {
    setLoading(true);
    const [u, g, un] = await Promise.all([
      UserService.getAll(),
      AccessGroupService.getAll(),
      UnitService.getAll()
    ]);
    setData(u);
    setAccessGroups(g);
    setUnits(un);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente arquivar este usuário?')) {
      try {
        await UserService.archive(id);
        loadAllData();
      } catch (e: any) { alert(e.message); }
    }
  };

  const onSubmit = async (formData: UserFormData) => {
    try {
      if (selectedItem) {
        await UserService.update(selectedItem.id, { ...formData, version: selectedItem.version });
      } else {
        await UserService.create(formData);
      }
      setIsDrawerOpen(false);
      loadAllData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const filteredData = data.filter(item =>
    item.name.toLowerCase().includes(search.toLowerCase()) ||
    item.email.toLowerCase().includes(search.toLowerCase()) ||
    item.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Usuários do Sistema" description="Gestão de Acessos, Grupos e Segurança de Dados" >
            <button onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20" >
              <Plus size={16} strokeWidth={3} /> Criar Usuário
            </button>
          </PageHeader>

          <div className="bg-[#0a0e27]/40 border border-[#2d3647] rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-[#2d3647] bg-[#1a1f3a]/10 flex items-center justify-between gap-4">
              <div className="relative flex-1 max-w-md">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Pesquisar por nome, login ou e-mail..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl py-2.5 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/50 shadow-inner" />
              </div>
            </div>

            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4"><Loader2 size={40} className="text-primary animate-spin" /></div>
              ) : (
                <table className="w-full text-left">
                  <thead className="text-[10px] uppercase text-muted-foreground font-black tracking-widest bg-[#050812]/50 border-b border-[#2d3647]">
                    <tr>
                      <th className="px-6 py-4">Colaborador</th>
                      <th className="px-6 py-4">Grupo / Cargo</th>
                      <th className="px-6 py-4">Unidade / Local</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d3647]/30 text-sm">
                    {filteredData.map((u) => {
                      const group = accessGroups.find(g => g.id === u.accessGroupId);
                      const unit = units.find(un => un.id === u.unitId);
                      return (
                        <tr key={u.id} className="hover:bg-primary/5 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-black italic text-primary group-hover:scale-110 transition-transform">
                                {u.name[0]}
                              </div>
                              <div>
                                <p className="font-bold text-white group-hover:text-primary transition-colors uppercase text-xs tracking-tight">{u.name}</p>
                                <p className="text-[10px] text-muted-foreground font-medium lowercase italic">{u.username}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex flex-col">
                               <div className="flex items-center gap-2">
                                 <ShieldCheck size={14} className="text-primary/60" />
                                 <span className="text-xs font-black italic text-white/80">{group?.name || 'N/A'}</span>
                               </div>
                               <span className="text-[9px] font-bold text-muted-foreground uppercase mt-1">{u.jobTitle || 'Cargo não informado'}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex flex-col">
                               <div className="flex items-center gap-2">
                                 <Globe size={14} className="text-primary/60" />
                                 <span className="text-xs font-bold text-white/70 uppercase">{unit?.name || 'Global'}</span>
                               </div>
                               <span className="text-[9px] text-muted-foreground font-bold mt-1 uppercase">{unit?.city} {unit?.state ? `• ${unit.state}` : ''}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={u.status} />
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => { setSelectedItem(u); setIsDrawerOpen(true); }} className="p-2 text-muted-foreground hover:text-white transition-colors hover:bg-[#1a1f3a] rounded-lg"><Edit size={16} /></button>
                              <button onClick={() => handleDelete(u.id)} className="p-2 text-muted-foreground hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg"><Trash2 size={16} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </main>
      </div>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="relative w-full max-w-md bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">{selectedItem ? 'Configurar Usuário' : 'Novo Usuário'}</h2>
                {selectedItem && <p className="text-[10px] text-primary font-bold uppercase mt-1">Reg: {selectedItem.id}</p>}
              </div>
              <div className="flex gap-2">
                {selectedItem && (
                   <button onClick={() => setViewAudit(!viewAudit)} className={cn("p-2 rounded-xl border border-[#2d3647] transition-all", viewAudit ? "bg-primary text-[#0a0e27]" : "text-muted-foreground hover:text-white")}><History size={18} /></button>
                )}
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 text-white hover:bg-[#1a1f3a] rounded-xl transition-all"><X size={20} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              {viewAudit && selectedItem ? (
                <EntityAuditInfo entity={selectedItem} />
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                  <FormField label="Nome Completo" error={errors.name?.message} required>
                    <input {...register('name')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all font-bold" placeholder="Ex: João da Silva" />
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Usuário / Login" error={errors.username?.message} required>
                      <input {...register('username')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all font-mono" placeholder="joao.silva" />
                    </FormField>
                    <FormField label="Senha (Mín. 6)" error={errors.password?.message}>
                      <input {...register('password')} type="password" className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all" placeholder="******" />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Cargo" error={errors.jobTitle?.message}>
                      <input {...register('jobTitle')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all" placeholder="Ex: Operador COA" />
                    </FormField>
                    <FormField label="Status" error={errors.status?.message} required>
                      <select {...register('status')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                        <option value="ATIVO">Ativo</option>
                        <option value="BLOQUEADO">Bloqueado</option>
                      </select>
                    </FormField>
                  </div>

                  <FormField label="Grupo de Acesso (RBAC)" error={errors.accessGroupId?.message} required>
                    <select {...register('accessGroupId')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                      <option value="">Selecionar Grupo...</option>
                      {accessGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </FormField>

                  <FormField label="Unidade Vinculada" error={errors.unitId?.message}>
                    <select {...register('unitId')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                      <option value="">Global / Todas</option>
                      {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                    </select>
                  </FormField>

                  <div className="space-y-4 pt-4 border-t border-[#2d3647]">
                     <div className="flex items-center gap-3">
                        <input type="checkbox" {...register('isADValidated')} id="adValid" className="w-4 h-4 rounded border-[#2d3647] bg-[#1a1f3a] text-primary" />
                        <label htmlFor="adValid" className="text-xs font-black uppercase text-white/70">Validar via AD/SSO</label>
                     </div>
                     <div className="flex items-center gap-3">
                        <input type="checkbox" {...register('requirePasswordChange')} id="passChange" className="w-4 h-4 rounded border-[#2d3647] bg-[#1a1f3a] text-primary" />
                        <label htmlFor="passChange" className="text-xs font-black uppercase text-white/70">Exigir troca de senha</label>
                     </div>
                  </div>

                  <div className="pt-6 flex gap-3">
                    <button type="button" onClick={() => setIsDrawerOpen(false)} className="flex-1 py-4 bg-transparent border border-[#2d3647] rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[#1a1f3a] transition-all flex items-center justify-center gap-2"><Ban size={14} /> Cancelar</button>
                    <button type="submit" disabled={isSubmitting} className="flex-1 py-4 bg-primary text-[#0a0e27] rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                      {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar Usuário
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

export default withAuth(UsuariosPage, { module: 'USUARIOS' });
