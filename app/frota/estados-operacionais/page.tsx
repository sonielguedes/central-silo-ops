"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { OperationalStateService } from '@/services/master.service';
import { OperationalState } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { operationalStateSchema, OperationalStateFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import { EntityAuditInfo } from '@/components/shared/entity-audit-info';
import {
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Ban,
  Search,
  Download,
  History,
  ChevronLeft,
  ChevronRight,
  Settings2,
  AlertTriangle,
  Activity,
  Move,
  Clock,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function OperationalStatesPage() {
  const [data, setData] = useState<OperationalState[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<OperationalState | null>(null);
  const [viewAudit, setViewAudit] = useState(false);

  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<OperationalStateFormData>({
    resolver: zodResolver(operationalStateSchema),
  });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) {
        reset({
          code: selectedItem.code,
          name: selectedItem.name,
          abbreviation: selectedItem.abbreviation,
          color: selectedItem.color,
          category: selectedItem.category,
          type: selectedItem.type,
          accountsProduction: selectedItem.accountsProduction,
          accountsAvailability: selectedItem.accountsAvailability,
          accountsOperationalHourmeter: selectedItem.accountsOperationalHourmeter,
          requiresStopReason: selectedItem.requiresStopReason,
          allowsMovement: selectedItem.allowsMovement,
          order: selectedItem.order,
          description: selectedItem.description || '',
        });
      } else {
        reset({
          code: '',
          name: '',
          abbreviation: '',
          color: '#10b981',
          category: 'TRABALHO',
          type: 'PRODUTIVO',
          accountsProduction: true,
          accountsAvailability: true,
          accountsOperationalHourmeter: true,
          requiresStopReason: false,
          allowsMovement: true,
          order: 0,
          description: '',
        });
      }
    } else {
      setViewAudit(false);
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    const result = await OperationalStateService.getAll(true); // Include archived for internal filter handling
    setData(result);
    setLoading(false);
  };

  const onSubmit = async (formData: OperationalStateFormData) => {
    try {
      if (selectedItem) {
        await OperationalStateService.update(selectedItem.id, formData);
      } else {
        await OperationalStateService.create(formData);
      }
      setIsDrawerOpen(false);
      loadData();
    } catch (error: any) { alert(error.message); }
  };

  const handleArchive = async (id: string) => {
    if (confirm('Deseja realmente arquivar este estado operacional? Ele não poderá ser excluído permanentemente se houver registros vinculados.')) {
      try {
        await OperationalStateService.archive(id);
        loadData();
      } catch (error: any) { alert(error.message); }
    }
  };

  const exportCSV = () => {
    const headers = ['Cód', 'Nome', 'Sigla', 'Categoria', 'Tipo', 'Produtivo', 'Exige Motivo', 'Permite Movimento'];
    const rows = filteredData.map(item => [
      item.code,
      item.name,
      item.abbreviation,
      item.category,
      item.type,
      item.accountsProduction ? 'Sim' : 'Não',
      item.requiresStopReason ? 'Sim' : 'Não',
      item.allowsMovement ? 'Sim' : 'Não'
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `estados_operacionais_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredData = useMemo(() => {
    return data.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) ||
                           item.code.toLowerCase().includes(search.toLowerCase()) ||
                           item.abbreviation.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = filterCategory === 'ALL' || item.category === filterCategory;
      const matchesType = filterType === 'ALL' || item.type === filterType;
      const matchesStatus = filterStatus === 'ALL' || item.entityStatus === filterStatus;

      return matchesSearch && matchesCategory && matchesType && matchesStatus;
    });
  }, [data, search, filterCategory, filterType, filterStatus]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader
            title="Estados Operacionais"
            description="Configuração de Matriz de Produtividade e Utilização de Ativos"
          >
            <div className="flex gap-3">
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-xs font-bold hover:bg-[#252d4a] transition-all"
              >
                <Download size={16} className="text-primary" /> Exportar
              </button>
              <button
                onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"
              >
                <Plus size={16} strokeWidth={3} /> Novo Estado
              </button>
            </div>
          </PageHeader>

          {/* Advanced Filters */}
          <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl p-4 mb-6 space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Pesquisar por nome, código ou sigla..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="w-full bg-[#1a1f3a]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={filterCategory}
                  onChange={(e) => { setFilterCategory(e.target.value); setCurrentPage(1); }}
                  className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-primary/50"
                >
                  <option value="ALL">Todas Categorias</option>
                  <option value="TRABALHO">Trabalho</option>
                  <option value="TRANSPORTE">Transporte</option>
                  <option value="PARADA_PLANEJADA">Parada Planejada</option>
                  <option value="PARADA_NAO_PLANEJADA">Parada Não Planejada</option>
                  <option value="MANUTENCAO">Manutenção</option>
                </select>
                <select
                  value={filterType}
                  onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }}
                  className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-primary/50"
                >
                  <option value="ALL">Todos Tipos</option>
                  <option value="PRODUTIVO">Produtivo</option>
                  <option value="IMPRODUTIVO">Improdutivo</option>
                  <option value="NEUTRO">Neutro</option>
                </select>
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setCurrentPage(1); }}
                  className="bg-[#1a1f3a] border border-[#2d3647] rounded-xl px-4 py-2 text-xs font-bold outline-none focus:border-primary/50"
                >
                  <option value="ALL">Todos Status</option>
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                  <option value="ARQUIVADO">Arquivado</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Loader2 size={40} className="text-primary animate-spin" />
              <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Sincronizando Estados...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-[#2d3647] rounded-3xl opacity-50">
               <Settings2 size={48} className="mb-4 text-muted-foreground" />
               <p className="text-sm font-bold uppercase">Nenhum estado operacional encontrado</p>
            </div>
          ) : (
            <>
              <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl overflow-hidden shadow-2xl">
                 <table className="w-full text-left border-collapse">
                    <thead className="bg-[#1a1f3a]/50 text-[10px] uppercase font-black tracking-widest text-muted-foreground border-b border-[#2d3647]">
                       <tr>
                          <th className="px-6 py-4">Cód / Sigla</th>
                          <th className="px-6 py-4">Estado Operacional</th>
                          <th className="px-6 py-4">Categoria</th>
                          <th className="px-6 py-4">Tipo</th>
                          <th className="px-6 py-4">Indicadores</th>
                          <th className="px-6 py-4 text-right">Ações</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2d3647]">
                       {paginatedData.map(item => (
                          <tr key={item.id} className="hover:bg-primary/5 transition-colors group">
                             <td className="px-6 py-4">
                                <div className="flex flex-col">
                                   <span className="text-xs font-black italic text-primary">{item.code}</span>
                                   <span className="text-[10px] font-bold text-muted-foreground uppercase">{item.abbreviation}</span>
                                </div>
                             </td>
                             <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                   <div className="w-8 h-8 rounded-xl border flex items-center justify-center shadow-lg" style={{ backgroundColor: `${item.color}20`, borderColor: `${item.color}40` }}>
                                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                                   </div>
                                   <div className="flex flex-col">
                                      <span className="text-xs font-bold text-white uppercase tracking-tight">{item.name}</span>
                                      <span className="text-[9px] text-muted-foreground uppercase font-medium">Ordem: {item.order}</span>
                                   </div>
                                </div>
                             </td>
                             <td className="px-6 py-4">
                                <span className="text-[10px] text-white/70 font-black uppercase bg-[#1a1f3a] px-2 py-0.5 rounded border border-[#2d3647]">
                                   {item.category.replace('_', ' ')}
                                </span>
                             </td>
                             <td className="px-6 py-4">
                                {item.type === 'PRODUTIVO' ? (
                                   <span className="flex items-center gap-1.5 text-[10px] font-black text-emerald-500 uppercase">
                                      <Activity size={12} /> {item.type}
                                   </span>
                                ) : item.type === 'IMPRODUTIVO' ? (
                                   <span className="flex items-center gap-1.5 text-[10px] font-black text-red-400 uppercase">
                                      <Zap size={12} /> {item.type}
                                   </span>
                                ) : (
                                   <span className="flex items-center gap-1.5 text-[10px] font-black text-blue-400 uppercase">
                                      <ShieldCheck size={12} /> {item.type}
                                   </span>
                                )}
                             </td>
                             <td className="px-6 py-4">
                                <div className="flex gap-2">
                                   {item.accountsProduction && <IndicatorIcon icon={<Activity size={12} />} label="Prod" color="text-emerald-500" />}
                                   {item.accountsAvailability && <IndicatorIcon icon={<ShieldCheck size={12} />} label="Disp" color="text-blue-500" />}
                                   {item.accountsOperationalHourmeter && <IndicatorIcon icon={<Clock size={12} />} label="Hr" color="text-amber-500" />}
                                   {item.requiresStopReason && <IndicatorIcon icon={<AlertTriangle size={12} />} label="Motivo" color="text-red-500" />}
                                   {item.allowsMovement && <IndicatorIcon icon={<Move size={12} />} label="Mov" color="text-primary" />}
                                </div>
                             </td>
                             <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                   <button
                                      onClick={() => { setSelectedItem(item); setIsDrawerOpen(true); }}
                                      className="p-2 text-muted-foreground hover:text-white transition-colors hover:bg-[#1a1f3a] rounded-lg"
                                      title="Editar"
                                   >
                                      <Edit size={16} />
                                   </button>
                                   <button
                                      onClick={() => handleArchive(item.id)}
                                      className="p-2 text-muted-foreground hover:text-red-500 transition-colors hover:bg-red-500/10 rounded-lg"
                                      title="Arquivar"
                                   >
                                      <Trash2 size={16} />
                                   </button>
                                </div>
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>

              {/* Pagination UI */}
              <div className="mt-6 flex items-center justify-between">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
                   Exibindo <span className="text-white">{paginatedData.length}</span> de <span className="text-white">{filteredData.length}</span> estados
                </p>
                <div className="flex gap-2">
                   <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(prev => prev - 1)}
                    className="p-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-muted-foreground hover:text-white disabled:opacity-30 transition-all"
                   >
                     <ChevronLeft size={18} />
                   </button>
                   <div className="flex items-center px-4 bg-[#1a1f3a] border border-[#2d3647] rounded-xl">
                      <span className="text-xs font-black text-primary uppercase italic">Pág. {currentPage} / {totalPages || 1}</span>
                   </div>
                   <button
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(prev => prev + 1)}
                    className="p-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-muted-foreground hover:text-white disabled:opacity-30 transition-all"
                   >
                     <ChevronRight size={18} />
                   </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {/* Side Drawer Enterprise */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="relative w-full max-w-xl bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
             <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">
                    {selectedItem ? 'Configurar Estado Operacional' : 'Novo Estado Operacional'}
                  </h2>
                  {selectedItem && (
                    <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em] mt-1">
                      Registro: {selectedItem.id}
                    </p>
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
                       <History size={18} />
                     </button>
                  )}
                  <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all text-white">
                    <X size={24} />
                  </button>
                </div>
             </div>

             <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {viewAudit && selectedItem ? (
                  <EntityAuditInfo entity={selectedItem} />
                ) : (
                  <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                    <div className="grid grid-cols-2 gap-4">
                       <FormField label="Código (Numérico)" error={errors.code?.message} required>
                          <input {...register('code')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none font-black italic text-primary" placeholder="Ex: 10" />
                       </FormField>
                       <FormField label="Sigla" error={errors.abbreviation?.message} required>
                          <input {...register('abbreviation')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none uppercase font-bold" placeholder="Ex: EF" />
                       </FormField>
                    </div>

                    <FormField label="Nome do Estado" error={errors.name?.message} required>
                      <input {...register('name')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none font-bold uppercase" placeholder="Ex: TRABALHANDO EFETIVO" />
                    </FormField>

                    <div className="grid grid-cols-2 gap-4">
                       <FormField label="Categoria Operacional" error={errors.category?.message} required>
                        <select {...register('category')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                          <option value="TRABALHO">Trabalho (Efetivo)</option>
                          <option value="TRANSPORTE">Transporte / Deslocamento</option>
                          <option value="PARADA_PLANEJADA">Parada Planejada</option>
                          <option value="PARADA_NAO_PLANEJADA">Parada Não Planejada</option>
                          <option value="MANUTENCAO">Manutenção</option>
                        </select>
                      </FormField>
                      <FormField label="Tipo de Produtividade" error={errors.type?.message} required>
                        <select {...register('type')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none">
                          <option value="PRODUTIVO">Produtivo</option>
                          <option value="IMPRODUTIVO">Improdutivo</option>
                          <option value="NEUTRO">Neutro (Não contabiliza)</option>
                        </select>
                      </FormField>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <FormField label="Cor de Identificação" error={errors.color?.message} required>
                          <div className="flex gap-3">
                             <input type="color" {...register('color')} className="w-12 h-12 rounded-xl bg-transparent border-none cursor-pointer" />
                             <input type="text" {...register('color')} className="flex-1 bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none font-mono uppercase" />
                          </div>
                       </FormField>
                       <FormField label="Ordem de Exibição" error={errors.order?.message} required>
                          <input type="number" {...register('order')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none" />
                       </FormField>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-[#2d3647]">
                       <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Configurações e Regras</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <SwitchField id="accProd" label="Contabiliza Produção" {...register('accountsProduction')} />
                          <SwitchField id="accAvail" label="Contabiliza Disponibilidade" {...register('accountsAvailability')} />
                          <SwitchField id="accHr" label="Contabiliza Horímetro Oper." {...register('accountsOperationalHourmeter')} />
                          <SwitchField id="reqMot" label="Exige Motivo de Parada" {...register('requiresStopReason')} />
                          <SwitchField id="allMov" label="Permite Movimento" {...register('allowsMovement')} />
                       </div>
                    </div>

                    <FormField label="Descrição Técnica" error={errors.description?.message}>
                      <textarea {...register('description')} rows={3} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none resize-none" placeholder="..." />
                    </FormField>

                    <div className="pt-6 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setIsDrawerOpen(false)}
                        className="flex-1 py-4 bg-transparent border border-[#2d3647] rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-[#1a1f3a] transition-all flex items-center justify-center gap-2"
                      >
                        <Ban size={14} /> Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 py-4 bg-primary text-[#0a0e27] rounded-2xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                      >
                        {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {selectedItem ? 'Atualizar Estado' : 'Criar Estado'}
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

function IndicatorIcon({ icon, label, color }: { icon: any, label: string, color: string }) {
  return (
    <div className={cn("flex items-center gap-1 px-2 py-0.5 bg-[#1a1f3a] rounded border border-[#2d3647] transition-all hover:border-primary/30 group cursor-default")} title={label}>
       <span className={cn(color)}>{icon}</span>
       <span className="text-[8px] font-black text-muted-foreground group-hover:text-white uppercase">{label}</span>
    </div>
  );
}

const SwitchField = React.forwardRef<HTMLInputElement, any>(({ label, id, ...props }, ref) => (
  <div className="flex items-center gap-3 bg-[#1a1f3a]/40 p-3 rounded-2xl border border-[#2d3647] hover:border-primary/30 transition-all group">
     <div className="relative inline-flex items-center h-6 rounded-full w-11 transition-colors cursor-pointer outline-none ring-0">
        <input type="checkbox" id={id} ref={ref} {...props} className="sr-only peer" />
        <div className="w-11 h-6 bg-[#2d3647] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
     </div>
     <label htmlFor={id} className="text-[10px] font-bold text-white/60 uppercase group-hover:text-white cursor-pointer select-none">{label}</label>
  </div>
));
SwitchField.displayName = 'SwitchField';
