"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { CompanyService } from '@/services/master.service';
import { Company } from '@/lib/mock/master-data';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { companySchema, CompanyFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import { EntityAuditInfo } from '@/components/shared/entity-audit-info';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  Building2,
  Search,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Ban,
  History,
  Fingerprint,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';

function EmpresasPage() {
  const [data, setData] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Company | null>(null);
  const [viewAudit, setViewAudit] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) {
        reset({
          code: selectedItem.code,
          tradingName: selectedItem.tradingName,
          corporateName: selectedItem.corporateName,
          cnpj: selectedItem.cnpj,
          domain: selectedItem.domain || '',
          plan: selectedItem.plan,
          status: selectedItem.status || 'ATIVO',
        });
      } else {
        reset({
          code: '',
          tradingName: '',
          corporateName: '',
          cnpj: '',
          domain: '',
          plan: 'PILOTO',
          status: 'ATIVO',
        });
      }
    } else {
      setViewAudit(false);
    }
  }, [selectedItem, reset, isDrawerOpen]);


  const loadData = async () => {
    setLoading(true);
    // Para Empresas, mostramos todas (Global Admin View)
    const result = await CompanyService.getAllGlobal();
    setData(result);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deseja realmente arquivar esta empresa? Esta ação oculta todos os dados vinculados a este tenant.')) {
      try {
        await CompanyService.archive(id);
        loadData();
      } catch (e: any) { alert(e.message); }
    }
  };

  const onSubmit = async (formData: CompanyFormData) => {
    try {
      if (selectedItem) {
        await CompanyService.update(selectedItem.id, { ...formData, version: selectedItem.version });
      } else {
        await CompanyService.create(formData);
      }
      setIsDrawerOpen(false);
      loadData();
    } catch (error: any) {
      alert(error.message);
    }
  };

  const filteredData = data.filter(item =>
    item.tradingName.toLowerCase().includes(search.toLowerCase()) ||
    item.cnpj.includes(search)
  );

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader
            title="Empresas / Tenants"
            description="Administração Global de Instâncias de Produção"
          >
            <button
              onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"
            >
              <Plus size={16} strokeWidth={3} /> Nova Instância
            </button>
          </PageHeader>

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome fantasia, razão social ou CNPJ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 size={40} className="text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Consultando Nodes Global...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredData.map((item) => (
                <div key={item.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-6 hover:border-primary/40 transition-all group relative overflow-hidden flex flex-col h-full shadow-xl">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-[#1a1f3a] flex items-center justify-center text-primary shadow-lg border border-[#2d3647]">
                        <Building2 size={28} />
                      </div>
                      <div>
                        <h3 className="text-xl font-black italic tracking-tighter text-white uppercase group-hover:text-primary transition-colors leading-none">{item.tradingName}</h3>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1.5 flex items-center gap-1.5 leading-none">
                           <Fingerprint size={10} className="text-primary" /> {item.code} • {item.cnpj}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }} className="p-2 text-muted-foreground hover:text-white transition-colors hover:bg-[#1a1f3a] rounded-lg"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-2 text-muted-foreground hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2 mb-6">
                     <p className="text-[10px] font-bold text-white/40 uppercase tracking-tight">{item.corporateName}</p>
                     {item.domain && (
                       <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                         <Globe size={10} /> {item.domain}
                       </p>
                     )}
                  </div>

                  <div className="pt-4 border-t border-[#2d3647] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <span className={cn(
                         "px-2 py-0.5 rounded text-[9px] font-black uppercase border",
                         item.plan === 'ENTERPRISE' ? "bg-primary/10 text-primary border-primary/30" : "bg-[#1a1f3a] text-white/50 border-white/10"
                       )}>
                         Plano {item.plan}
                       </span>
                       <StatusBadge status={item.status} />
                    </div>
                    <button className="text-[10px] font-black text-primary uppercase hover:underline flex items-center gap-1">
                      Acessar Console <Globe size={12} />
                    </button>
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
              <div>
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">{selectedItem ? 'Editar Instância' : 'Nova Instância'}</h2>
                {selectedItem && <p className="text-[10px] text-primary font-bold uppercase">v{selectedItem.version} • {selectedItem.id}</p>}
              </div>
              <div className="flex gap-2">
                {selectedItem && (
                   <button onClick={() => setViewAudit(!viewAudit)} className={cn("p-2 rounded-xl border border-[#2d3647]", viewAudit ? "bg-primary text-[#0a0e27]" : "text-muted-foreground")}><History size={18} /></button>
                )}
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all"><X size={20} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              {viewAudit && selectedItem ? (
                <EntityAuditInfo entity={selectedItem} />
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                  <FormField label="Nome Fantasia" error={errors.tradingName?.message} required>
                    <input {...register('tradingName')} className={cn("w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all font-bold", errors.tradingName && "border-red-500/50")} placeholder="Ex: Fazenda Santa Clara" />
                  </FormField>

                  <FormField label="Razão Social" error={errors.corporateName?.message} required>
                    <input {...register('corporateName')} className={cn("w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all", errors.corporateName && "border-red-500/50")} placeholder="Ex: Agropecuária Modelo LTDA" />
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="CNPJ" error={errors.cnpj?.message} required>
                      <input {...register('cnpj')} className={cn("w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all", errors.cnpj && "border-red-500/50")} placeholder="00.000.000/0000-00" />
                    </FormField>
                    <FormField label="Cód. Interno" error={errors.code?.message} required>
                      <input {...register('code')} className={cn("w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all uppercase font-black italic", errors.code && "border-red-500/50")} placeholder="SC01" />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Domínio" error={errors.domain?.message}>
                      <input {...register('domain')} className={cn("w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all", errors.domain && "border-red-500/50")} placeholder="empresa.com" />
                    </FormField>
                    <FormField label="Plano de Serviço" error={errors.plan?.message} required>
                      <select {...register('plan')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all appearance-none">
                        <option value="PILOTO">PILOTO</option>
                        <option value="PRO">PRO</option>
                        <option value="ENTERPRISE">ENTERPRISE</option>
                      </select>
                    </FormField>
                  </div>

                  <FormField label="Status" error={errors.status?.message} required>
                    <select {...register('status')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all appearance-none">
                      <option value="ATIVO">Ativo</option>
                      <option value="INATIVO">Inativo</option>
                    </select>
                  </FormField>

                  <div className="pt-6 flex gap-3">
                    <button type="button" onClick={() => setIsDrawerOpen(false)} className="flex-1 py-3 bg-transparent border border-[#2d3647] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1a1f3a] transition-all flex items-center justify-center gap-2"><Ban size={14} /> Cancelar</button>
                    <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-primary/20">
                      {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Salvar Instância
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

export default withAuth(EmpresasPage, { module: 'EMPRESAS', action: 'administrar' });
