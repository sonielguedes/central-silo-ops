"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { IntegrationService } from '@/services/master.service';
import { IntegrationConfig } from '@/lib/types';
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Search,
  Database,
  Globe,
  Activity,
  CheckCircle2,
  AlertCircle,
  Wifi,
  Terminal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { integrationConfigSchema, IntegrationConfigFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';

export default function IntegrationsPage() {
  const [data, setData] = useState<IntegrationConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<IntegrationConfig | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<IntegrationConfigFormData>({
    resolver: zodResolver(integrationConfigSchema),
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) reset(selectedItem);
      else reset({ name: '', type: 'REST', endpoint: '', status: 'ATIVO' });
    }
  }, [selectedItem, isDrawerOpen, reset]);

  const loadData = async () => {
    setLoading(true);
    const result = await IntegrationService.getAll();
    setData(result);
    setLoading(false);
  };

  const onSubmit = async (formData: IntegrationConfigFormData) => {
    try {
      if (selectedItem) await IntegrationService.update(selectedItem.id, formData);
      else await IntegrationService.create(formData);
      setIsDrawerOpen(false);
      loadData();
    } catch (error: any) { alert(error.message); }
  };

  const filteredData = data.filter(item => item.name.toLowerCase().includes(search.toLowerCase()));

  const getIcon = (type: string) => {
    switch (type) {
      case 'REST': return <Globe size={24} />;
      case 'MQTT': return <Wifi size={24} />;
      case 'SQL': return <Database size={24} />;
      case 'SAP': return <Terminal size={24} />;
      default: return <Activity size={24} />;
    }
  };

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader title="Integrações" description="Gestão de Conectores e Fluxos de Dados Externos">
            <button onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"><Plus size={16} strokeWidth={3} /> Nova Integração</button>
          </PageHeader>

          <div className="mb-6 relative w-full max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" placeholder="Filtrar integrações..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50" />
          </div>

          {loading ? (
             <div className="flex justify-center p-12"><Loader2 size={40} className="text-primary animate-spin" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredData.map(item => (
                <div key={item.id} className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-6 group hover:border-primary/40 transition-all flex flex-col">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#1a1f3a] border border-[#2d3647] flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                       {getIcon(item.type)}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }} className="p-2 text-muted-foreground hover:text-white transition-colors hover:bg-[#1a1f3a] rounded-lg"><Edit size={16} /></button>
                      <button onClick={async () => { if(confirm('Remover integração?')) { await IntegrationService.archive(item.id); loadData(); } }} className="p-2 text-muted-foreground hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <h3 className="text-lg font-black italic tracking-tighter uppercase text-white group-hover:text-primary transition-colors">{item.name}</h3>
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">Conector {item.type}</p>

                  <div className="mt-4 bg-[#050812] border border-[#2d3647] rounded-xl p-3">
                     <span className="text-[8px] text-muted-foreground uppercase font-black">Endpoint</span>
                     <p className="text-[10px] font-mono text-white truncate mt-1">{item.endpoint}</p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#2d3647] flex items-center justify-between">
                     <div className={cn(
                        "flex items-center gap-1.5 text-[9px] font-black uppercase",
                        item.status === 'ATIVO' ? "text-emerald-500" : "text-red-400"
                     )}>
                        {item.status === 'ATIVO' ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                        {item.status}
                     </div>
                     <span className="text-[8px] text-muted-foreground font-bold uppercase">Último Sinal: {item.lastSync || 'Nunca'}</span>
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
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">{selectedItem ? 'Editar Conector' : 'Novo Conector'}</h2>
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all"><X size={20} /></button>
             </div>
             <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                <FormField label="Nome da Integração" error={errors.name?.message} required><input {...register('name')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" placeholder="Ex: SAP Records" /></FormField>
                <FormField label="Tipo de Protocolo" error={errors.type?.message} required>
                  <select {...register('type')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                    <option value="REST">REST API</option>
                    <option value="MQTT">MQTT Broker</option>
                    <option value="SQL">SQL Database</option>
                    <option value="SAP">SAP RFC/RFC</option>
                  </select>
                </FormField>
                <FormField label="Endpoint / Connection String" error={errors.endpoint?.message} required><input {...register('endpoint')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm font-mono focus:border-primary outline-none" placeholder="https://api..." /></FormField>
                <FormField label="Status" error={errors.status?.message} required>
                  <select {...register('status')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </FormField>
                <div className="pt-6 flex gap-3">
                  <button type="submit" disabled={isSubmitting} className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">{isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar Conector</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
