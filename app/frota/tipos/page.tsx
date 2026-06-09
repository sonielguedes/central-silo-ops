"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { FormField } from '@/components/shared/form-field';
import { EquipmentIconPicker } from '@/components/icons/equipment-icon-picker';
import { EquipmentIcon } from '@/components/icons/equipment-icons';
import { ActionFeedback, type ActionFeedbackMessage } from '@/components/shared/action-feedback';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EquipmentTypeService } from '@/services/api-service';
import { EquipmentType } from '@/lib/types';
import { withAuth } from '@/components/shared/with-auth';
import { cn } from '@/lib/utils';
import { resolveIconType, EQUIPMENT_ICON_LABELS } from '@/lib/equipment-icon-types';
import {
  DEFAULT_PRIMARY_METRIC_BY_CATEGORY,
  DEFAULT_GROUP_BY_CATEGORY,
  FLEET_OPERATIONAL_GROUPS,
  FLEET_TYPE_CATEGORIES,
  PRIMARY_METRIC_OPTIONS,
  resolveDefaultOperationalGroup,
  resolveDefaultPrimaryMetric,
} from '@/lib/fleet-type-catalog';
import { equipmentTypeSchema, EquipmentTypeFormData } from '@/lib/validations/master-schemas';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Filter,
  ChevronDown,
  CheckCircle2,
  XCircle,
  MapPinned,
  Layers3,
} from 'lucide-react';

const booleanChip = (value: boolean) => (
  value
    ? <CheckCircle2 size={14} className="text-emerald-400" />
    : <XCircle size={14} className="text-zinc-600" />
);

const CATEGORY_BADGE: Record<string, string> = {
  'Agrícola': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  'Implemento': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Rodoviário': 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  'Apoio': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  'Infraestrutura': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  'Construção': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Tecnologia': 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  'Outros': 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

const METRIC_BADGE: Record<string, string> = {
  HORIMETRO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  KM: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  HORAS: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  UNIDADE: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

function TypesPage() {
  const [data, setData] = useState<EquipmentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterMetric, setFilterMetric] = useState('');
  const [filterIcon, setFilterIcon] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterActive, setFilterActive] = useState<'' | 'true' | 'false'>('');
  const [showFilters, setShowFilters] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<EquipmentType | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedbackMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EquipmentType | null>(null);

  const { register, handleSubmit, reset, control, watch, setValue, formState: { errors, isSubmitting } } =
    useForm<EquipmentTypeFormData>({ resolver: zodResolver(equipmentTypeSchema) });

  const category = watch('category');

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    if (selected) {
      reset({
        code: selected.code,
        name: selected.name,
        description: selected.description || '',
        category: selected.category,
        iconType: resolveIconType(selected.iconType),
        primaryMetric: selected.primaryMetric,
        telemetryEnabledDefault: selected.telemetryEnabledDefault,
        canEnabledDefault: selected.canEnabledDefault,
        mobileEnabledDefault: selected.mobileEnabledDefault,
        mapEnabled: selected.mapEnabled,
        operationalGroup: selected.operationalGroup,
        active: selected.active,
        notes: selected.notes || '',
      });
      return;
    }
    const initialCategory = 'Agrícola';
    reset({
      code: '',
      name: '',
      description: '',
      category: initialCategory,
      iconType: 'PADRAO_GENERICO',
      primaryMetric: resolveDefaultPrimaryMetric(initialCategory),
      telemetryEnabledDefault: true,
      canEnabledDefault: true,
      mobileEnabledDefault: true,
      mapEnabled: true,
      operationalGroup: resolveDefaultOperationalGroup(initialCategory),
      active: true,
      notes: '',
    });
  }, [drawerOpen, selected, reset]);

  useEffect(() => {
    if (!drawerOpen || selected) return;
    const nextMetric = DEFAULT_PRIMARY_METRIC_BY_CATEGORY[category as keyof typeof DEFAULT_PRIMARY_METRIC_BY_CATEGORY];
    const nextGroup = DEFAULT_GROUP_BY_CATEGORY[category as keyof typeof DEFAULT_GROUP_BY_CATEGORY];
    if (nextMetric) setValue('primaryMetric', nextMetric);
    if (nextGroup) setValue('operationalGroup', nextGroup);
  }, [category, drawerOpen, selected, setValue]);

  async function loadData() {
    setLoading(true);
    try {
      const result = await EquipmentTypeService.getAll();
      setData(result);
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setSelected(null);
    setDrawerOpen(true);
  }

  function openEdit(item: EquipmentType) {
    setSelected(item);
    setDrawerOpen(true);
  }

  async function onSubmit(formData: EquipmentTypeFormData) {
    const code = formData.code.trim().toUpperCase();
    const duplicate = data.some((item) => item.code.toUpperCase() === code && item.id !== selected?.id);
    if (duplicate) throw new Error('Código já cadastrado.');

    const payload = {
      ...formData,
      code,
      iconType: resolveIconType(formData.iconType),
      primaryMetric: formData.primaryMetric || resolveDefaultPrimaryMetric(formData.category),
      operationalGroup: formData.operationalGroup || resolveDefaultOperationalGroup(formData.category),
    };

    if (selected) await EquipmentTypeService.update(selected.id, payload);
    else await EquipmentTypeService.create(payload);
    setDrawerOpen(false);
    await loadData();
  }

  async function handleSave(formData: EquipmentTypeFormData) {
    try {
      await onSubmit(formData);
    } catch (error: any) {
      setFeedback({ type: 'error', message: error?.message || 'Erro ao salvar' });
    }
  }

  async function archiveItem(item: EquipmentType) {
    setConfirmDelete(item);
  }

  async function executeDelete() {
    if (!confirmDelete) return;
    try {
      await EquipmentTypeService.archive(confirmDelete.id);
      setFeedback({ type: 'success', message: 'Tipo arquivado com sucesso' });
      setConfirmDelete(null);
      await loadData();
    } catch (error: any) {
      setConfirmDelete(null);
      setFeedback({ type: 'error', message: error?.message || 'Falha ao arquivar tipo' });
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((item) => {
      const haystack = [item.code, item.name, item.description || ''].join(' ').toLowerCase();
      const matchesSearch = !q || haystack.includes(q);
      const matchesCategory = !filterCategory || item.category === filterCategory;
      const matchesMetric = !filterMetric || item.primaryMetric === filterMetric;
      const matchesIcon = !filterIcon || resolveIconType(item.iconType) === filterIcon;
      const matchesGroup = !filterGroup || item.operationalGroup === filterGroup;
      const matchesActive = !filterActive ||
        (filterActive === 'true' ? item.active !== false : item.active === false);
      return matchesSearch && matchesCategory && matchesMetric && matchesIcon && matchesGroup && matchesActive;
    });
  }, [data, search, filterCategory, filterMetric, filterIcon, filterGroup, filterActive]);

  const activeFilterCount = [filterCategory, filterMetric, filterIcon, filterGroup, filterActive].filter(Boolean).length;

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader
            title="Tipos de Frota"
            description="Classificação Operacional dos Equipamentos"
          >
            <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20">
              <Plus size={16} strokeWidth={3} /> Novo Tipo
            </button>
          </PageHeader>

          <ActionFeedback feedback={feedback} onDismiss={() => setFeedback(null)} />

          <div className="flex flex-col xl:flex-row gap-3 mb-6">
            <div className="relative flex-1 min-w-[260px]">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por código, nome ou descrição..."
                className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40"
              />
            </div>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 border rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all',
                showFilters ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-[#0a0e27]/60 border-[#2d3647] hover:border-primary/30',
              )}
            >
              <Filter size={14} /> Filtros
              {activeFilterCount > 0 && <span className="px-1.5 py-0.5 bg-primary/20 rounded-full text-[9px] font-black text-primary">{activeFilterCount}</span>}
              <ChevronDown size={12} className={cn('transition-transform', showFilters && 'rotate-180')} />
            </button>
            <span className="text-[11px] text-muted-foreground font-bold uppercase xl:ml-auto self-center">
              {filtered.length} / {data.length} tipos
            </span>
          </div>

          {showFilters && (
            <div className="mb-6 p-4 bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl flex flex-wrap gap-5 animate-in slide-in-from-top-2 duration-200">
              <FilterGroup title="Categoria" items={FLEET_TYPE_CATEGORIES} value={filterCategory} onChange={setFilterCategory} />
              <FilterGroup title="Unidade principal" items={PRIMARY_METRIC_OPTIONS} value={filterMetric} onChange={setFilterMetric} />
              <FilterGroup title="Ícone" items={[...new Set(data.map((item) => resolveIconType(item.iconType)))]} value={filterIcon} onChange={setFilterIcon} labelMap={EQUIPMENT_ICON_LABELS} />
              <FilterGroup title="Grupo operacional" items={FLEET_OPERATIONAL_GROUPS} value={filterGroup} onChange={setFilterGroup} />
              <div>
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-2">Status</p>
                <div className="flex gap-1.5">
                  <Chip label="Ativo" active={filterActive === 'true'} onClick={() => setFilterActive(filterActive === 'true' ? '' : 'true')} />
                  <Chip label="Inativo" active={filterActive === 'false'} onClick={() => setFilterActive(filterActive === 'false' ? '' : 'false')} />
                </div>
              </div>
              {activeFilterCount > 0 && (
                <button onClick={() => { setFilterCategory(''); setFilterMetric(''); setFilterIcon(''); setFilterGroup(''); setFilterActive(''); }} className="self-end ml-auto px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-[10px] font-black uppercase text-red-400 hover:bg-red-500/20 transition-all">
                  Limpar
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center p-12"><Loader2 size={40} className="text-primary animate-spin" /></div>
          ) : (
            <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1250px]">
                  <thead className="bg-[#1a1f3a]/50 text-[9px] uppercase font-black tracking-widest text-muted-foreground border-b border-[#2d3647]">
                    <tr>
                      <th className="px-4 py-4 w-12">Ícone</th>
                      <th className="px-4 py-4">Código</th>
                      <th className="px-4 py-4">Nome</th>
                      <th className="px-4 py-4">Categoria</th>
                      <th className="px-4 py-4">Unidade principal</th>
                      <th className="px-4 py-4">Grupo operacional</th>
                      <th className="px-4 py-4 text-center">Telemetria</th>
                      <th className="px-4 py-4 text-center">CAN</th>
                      <th className="px-4 py-4 text-center">Mobile</th>
                      <th className="px-4 py-4 text-center">Mapa</th>
                      <th className="px-4 py-4 text-center">Status</th>
                      <th className="px-4 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d3647]">
                    {filtered.length === 0 ? (
                      <tr><td colSpan={12} className="px-6 py-12 text-center text-muted-foreground text-xs font-bold uppercase">Nenhum tipo encontrado</td></tr>
                    ) : filtered.map((item) => {
                      const iconType = resolveIconType(item.iconType);
                      return (
                        <tr key={item.id} className="hover:bg-primary/5 transition-colors group">
                          <td className="px-4 py-3"><div className="w-9 h-9 rounded-xl bg-[#1a1f3a] flex items-center justify-center text-primary border border-[#2d3647]"><EquipmentIcon type={iconType} size={20} /></div></td>
                          <td className="px-4 py-3"><span className="text-xs font-black text-white uppercase tracking-widest">{item.code}</span></td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-xs font-black italic text-primary leading-tight">{item.name}</span>
                              <span className="text-[9px] text-muted-foreground uppercase font-bold">{item.description || EQUIPMENT_ICON_LABELS[iconType] || iconType}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border', CATEGORY_BADGE[item.category] || 'bg-[#1a1f3a] text-muted-foreground border-[#2d3647]')}>{item.category}</span></td>
                          <td className="px-4 py-3"><span className={cn('px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border', METRIC_BADGE[item.primaryMetric] || 'bg-[#1a1f3a] text-muted-foreground border-[#2d3647]')}>{item.primaryMetric}</span></td>
                          <td className="px-4 py-3"><span className="text-[10px] font-bold uppercase text-white/80">{item.operationalGroup}</span></td>
                          <td className="px-4 py-3 text-center">{booleanChip(item.telemetryEnabledDefault)}</td>
                          <td className="px-4 py-3 text-center">{booleanChip(item.canEnabledDefault)}</td>
                          <td className="px-4 py-3 text-center">{booleanChip(item.mobileEnabledDefault)}</td>
                          <td className="px-4 py-3 text-center">{item.mapEnabled ? <MapPinned size={14} className="mx-auto text-emerald-400" /> : <XCircle size={14} className="mx-auto text-zinc-600" />}</td>
                          <td className="px-4 py-3 text-center"><span className={cn('text-[9px] font-black uppercase px-2 py-0.5 rounded-full border', item.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20')}>{item.active ? 'Ativo' : 'Inativo'}</span></td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => openEdit(item)} className="p-2 text-muted-foreground hover:text-white hover:bg-[#1a1f3a] rounded-lg transition-all" title="Editar"><Edit size={14} /></button>
                              <button onClick={() => archiveItem(item)} className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Arquivar"><Trash2 size={14} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-8 py-6 border-b border-[#2d3647] shrink-0">
              <div>
                <h2 className="text-lg font-black italic tracking-tighter uppercase text-white">{selected ? 'Editar Tipo' : 'Novo Tipo'}</h2>
                <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">Cadastro mestre operacional</p>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all text-muted-foreground hover:text-white"><X size={20} /></button>
            </div>

            <form className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6 space-y-5" onSubmit={handleSubmit(handleSave)}>
              <FormField label="Código" error={errors.code?.message} required>
                <input {...register('code')} placeholder="TRATOR" className={inputCls} />
              </FormField>
              <FormField label="Nome" error={errors.name?.message} required>
                <input {...register('name')} placeholder="Trator" className={inputCls} />
              </FormField>
              <FormField label="Descrição" error={errors.description?.message}>
                <textarea {...register('description')} rows={2} placeholder="Descrição operacional..." className={cn(inputCls, 'resize-none')} />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Categoria" error={errors.category?.message} required>
                  <select {...register('category')} className={selectCls}>
                    {FLEET_TYPE_CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </FormField>
                <FormField label="Unidade principal" error={errors.primaryMetric?.message} required>
                  <select {...register('primaryMetric')} className={selectCls}>
                    {PRIMARY_METRIC_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </FormField>
              </div>

              <FormField label="Ícone" error={errors.iconType?.message} required>
                <Controller name="iconType" control={control} render={({ field }) => <EquipmentIconPicker value={field.value} onChange={field.onChange} />} />
              </FormField>

              <FormField label="Grupo operacional" error={errors.operationalGroup?.message} required>
                <select {...register('operationalGroup')} className={selectCls}>
                  {FLEET_OPERATIONAL_GROUPS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <Toggle label="Telemetria padrão" name="telemetryEnabledDefault" register={register} />
                <Toggle label="CAN padrão" name="canEnabledDefault" register={register} />
                <Toggle label="Mobile padrão" name="mobileEnabledDefault" register={register} />
                <Toggle label="Exibir no mapa" name="mapEnabled" register={register} />
                <Toggle label="Ativo" name="active" register={register} />
              </div>

              <FormField label="Observações">
                <textarea {...register('notes')} rows={3} placeholder="Anotações internas..." className={cn(inputCls, 'resize-none')} />
              </FormField>
            </form>

            <div className="px-8 py-5 border-t border-[#2d3647] shrink-0 flex gap-3">
              <button type="button" onClick={() => setDrawerOpen(false)} className="flex-1 py-3 bg-[#1a1f3a] border border-[#2d3647] text-muted-foreground rounded-xl text-xs font-black uppercase hover:text-white transition-all">
                Cancelar
              </button>
              <button type="button" onClick={handleSubmit(handleSave)} disabled={isSubmitting} className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg">
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Arquivar tipo?"
        description={`Deseja realmente arquivar o tipo ${confirmDelete?.name || confirmDelete?.code || 'selecionado'}?`}
        confirmLabel="Arquivar"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={executeDelete}
      />
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn('px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all', active ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-[#1a1f3a]/50 border-[#2d3647] text-muted-foreground hover:border-primary/30')}>
      {label}
    </button>
  );
}

function FilterGroup({
  title,
  items,
  value,
  onChange,
  labelMap,
}: {
  title: string;
  items: readonly string[];
  value: string;
  onChange: (value: string) => void;
  labelMap?: Record<string, string>;
}) {
  return (
    <div>
      <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-2">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <Chip
            key={item}
            label={labelMap?.[item] || item}
            active={value === item}
            onClick={() => onChange(value === item ? '' : item)}
          />
        ))}
      </div>
    </div>
  );
}

function Toggle({
  label,
  name,
  register,
}: {
  label: string;
  name: 'telemetryEnabledDefault' | 'canEnabledDefault' | 'mobileEnabledDefault' | 'mapEnabled' | 'active';
  register: ReturnType<typeof useForm<EquipmentTypeFormData>>['register'];
}) {
  return (
    <label className="flex flex-col items-center gap-1.5 p-3 bg-[#1a1f3a]/40 border border-[#2d3647] rounded-xl cursor-pointer hover:border-primary/30 transition-all select-none">
      <input type="checkbox" {...register(name)} className="sr-only peer" />
      <Layers3 size={12} className="peer-checked:text-primary text-muted-foreground transition-colors" />
      <span className="text-[9px] font-black uppercase tracking-tight text-muted-foreground peer-checked:text-primary transition-colors text-center">{label}</span>
      <div className="w-8 h-4 rounded-full bg-[#2d3647] peer-checked:bg-primary/30 transition-colors relative">
        <div className="absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-muted-foreground peer-checked:bg-primary peer-checked:translate-x-4 transition-all" />
      </div>
    </label>
  );
}

const inputCls = 'w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none text-white placeholder:text-muted-foreground/40 font-medium transition-colors';
const selectCls = 'w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none text-white font-medium';

export default withAuth(TypesPage, { module: 'TIPOS' });
