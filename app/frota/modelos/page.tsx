"use client";
/* ─────────────────────────────────────────────────────────────────────────────
 * SILO OPS — /frota/modelos
 * Catálogo técnico de modelos de frota por fabricante.
 * C4.8 — campos técnicos completos + seed de 50 modelos.
 * ────────────────────────────────────────────────────────────────────────── */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Sidebar }           from '@/components/layout/sidebar';
import { Header }            from '@/components/layout/header';
import { PageHeader }        from '@/components/shared/page-header';
import { EquipmentModelService } from '@/services/api-service';
import type { EquipmentModel, PrimaryMetric, FuelType } from '@/lib/types';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver }       from '@hookform/resolvers/zod';
import { equipmentModelSchema, EquipmentModelFormData } from '@/lib/validations/master-schemas';
import { FormField }         from '@/components/shared/form-field';
import { EquipmentIcon }     from '@/components/icons/equipment-icons';
import { EquipmentIconPicker } from '@/components/icons/equipment-icon-picker';
import { resolveIconType, EQUIPMENT_ICON_LABELS } from '@/lib/equipment-icon-types';
import { cn } from '@/lib/utils';
import { ActionFeedback, type ActionFeedbackMessage } from '@/components/shared/action-feedback';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  Plus, Edit, Trash2, Loader2, X, Save, Search,
  Filter, ChevronDown, Wifi, Cpu, Smartphone, Activity,
  CheckCircle2, XCircle, Settings2,
} from 'lucide-react';

/* ── Helpers ──────────────────────────────────────────────────────────── */

const PRIMARY_METRIC_OPTIONS: { value: PrimaryMetric; label: string }[] = [
  { value: 'HORIMETRO', label: 'Horímetro (h)' },
  { value: 'KM',        label: 'Quilometragem (km)' },
  { value: 'HORAS',     label: 'Horas' },
  { value: 'UNIDADE',   label: 'Unidade' },
];

const FUEL_TYPE_OPTIONS: { value: FuelType; label: string }[] = [
  { value: 'DIESEL',    label: 'Diesel' },
  { value: 'GASOLINA',  label: 'Gasolina' },
  { value: 'ETANOL',    label: 'Etanol' },
  { value: 'FLEX',      label: 'Flex' },
  { value: 'ELETRICO',  label: 'Elétrico' },
  { value: 'NAO_APLICA',label: 'Não se aplica' },
];

const CATEGORY_OPTIONS = ['Agrícola', 'Rodoviário', 'Construção', 'Apoio', 'Implemento'];

const METRIC_BADGE: Record<string, string> = {
  HORIMETRO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  KM:        'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  HORAS:     'bg-purple-500/10 text-purple-400 border-purple-500/20',
  UNIDADE:   'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

const CATEGORY_BADGE: Record<string, string> = {
  'Agrícola':   'bg-green-500/10 text-green-400 border-green-500/20',
  'Rodoviário': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Construção': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Apoio':      'bg-purple-500/10 text-purple-400 border-purple-500/20',
  'Implemento': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
};

function resolveModel(m: EquipmentModel) {
  return {
    manufacturer: m.manufacturer || m.brand  || '—',
    model:        m.model        || m.name   || '—',
    iconType:     resolveIconType(m.iconType),
    category:     m.category     || '—',
    primaryMetric:m.primaryMetric|| 'HORIMETRO',
    active:       m.active       !== false,
    telemetry:    m.telemetryEnabled || false,
    can:          m.canEnabled       || false,
    mobile:       m.mobileEnabled    !== false,
    operationalType: m.operationalType || m.name || '—',
  };
}

/* ── Toggle chip ──────────────────────────────────────────────────────── */
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={cn(
      'px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase border transition-all',
      active ? 'bg-primary/15 border-primary/40 text-primary' : 'bg-[#1a1f3a]/50 border-[#2d3647] text-muted-foreground hover:border-primary/30',
    )}>
      {active ? <CheckCircle2 size={9} className="inline mr-1" /> : null}{label}
    </button>
  );
}

/* ── BoolIcon ─────────────────────────────────────────────────────────── */
function BoolIcon({ ok }: { ok: boolean }) {
  return ok
    ? <CheckCircle2 size={14} className="text-emerald-400" />
    : <XCircle     size={14} className="text-muted-foreground/30" />;
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function FleetModelsPage() {
  const [data,        setData]        = useState<EquipmentModel[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [filterCat,   setFilterCat]   = useState('');
  const [filterMetric,setFilterMetric]= useState('');
  const [filterActive,setFilterActive]= useState<'' | 'true' | 'false'>('');
  const [showFilters, setShowFilters] = useState(false);
  const [isDrawerOpen,setIsDrawerOpen]= useState(false);
  const [selected,    setSelected]    = useState<EquipmentModel | null>(null);
  const [feedback, setFeedback] = useState<ActionFeedbackMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<EquipmentModel | null>(null);

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } =
    useForm<EquipmentModelFormData>({ resolver: zodResolver(equipmentModelSchema) });

  const loadData = useCallback(async () => {
    setLoading(true);
    const models = await EquipmentModelService.getAll();
    setData(models);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!isDrawerOpen) return;
    if (selected) {
      reset({
        name:             selected.name   || selected.model   || '',
        brand:            selected.brand  || selected.manufacturer || '',
        typeId:           selected.typeId || '',
        iconType:         resolveIconType(selected.iconType),
        description:      selected.description   || '',
        manufacturer:     selected.manufacturer  || selected.brand || '',
        model:            selected.model         || selected.name  || '',
        operationalType:  selected.operationalType || '',
        category:         selected.category || '',
        primaryMetric:    selected.primaryMetric || 'HORIMETRO',
        nominalCapacity:  selected.nominalCapacity,
        averageConsumption: selected.averageConsumption,
        workingWidth:     selected.workingWidth,
        fuelType:         selected.fuelType,
        telemetryEnabled: selected.telemetryEnabled ?? false,
        canEnabled:       selected.canEnabled       ?? false,
        mobileEnabled:    selected.mobileEnabled    ?? true,
        notes:            selected.notes || '',
        active:           selected.active !== false,
      });
    } else {
      reset({
        name: '', brand: '', typeId: '', iconType: 'PADRAO_GENERICO',
        description: '', manufacturer: '', model: '', operationalType: '',
        category: '', primaryMetric: 'HORIMETRO',
        telemetryEnabled: false, canEnabled: false, mobileEnabled: true, active: true,
        notes: '',
      });
    }
  }, [selected, isDrawerOpen, reset]);

  const onSubmit = async (formData: EquipmentModelFormData) => {
    const payload = {
      ...formData,
      // manter aliases sincronizados
      manufacturer: formData.brand,
      model: formData.name,
      iconType: resolveIconType(formData.iconType),
    };
    try {
      if (selected) await EquipmentModelService.update(selected.id, payload);
      else          await EquipmentModelService.create(payload);
      setIsDrawerOpen(false);
      loadData();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Erro ao salvar' });
    }
  };

  const filtered = useMemo(() => {
    let r = data;
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(m => {
        const d = resolveModel(m);
        return (
          d.manufacturer.toLowerCase().includes(q) ||
          d.model.toLowerCase().includes(q) ||
          d.operationalType.toLowerCase().includes(q)
        );
      });
    }
    if (filterCat)    r = r.filter(m => (m.category || '') === filterCat);
    if (filterMetric) r = r.filter(m => (m.primaryMetric || 'HORIMETRO') === filterMetric);
    if (filterActive === 'true')  r = r.filter(m => m.active !== false);
    if (filterActive === 'false') r = r.filter(m => m.active === false);
    return r;
  }, [data, search, filterCat, filterMetric, filterActive]);

  const activeFilterCount = [filterCat, filterMetric, filterActive].filter(Boolean).length;

  const openNew  = () => { setSelected(null); setIsDrawerOpen(true); };
  const openEdit = (m: EquipmentModel) => { setSelected(m); setIsDrawerOpen(true); };
  const doDelete = async (m: EquipmentModel) => {
    setConfirmDelete(m);
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await EquipmentModelService.archive(confirmDelete.id);
      setFeedback({ type: 'success', message: 'Modelo arquivado com sucesso' });
      setConfirmDelete(null);
      loadData();
    } catch (error: any) {
      setConfirmDelete(null);
      setFeedback({ type: 'error', message: error?.message || 'Falha ao arquivar modelo' });
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">

          <PageHeader
            title="Modelos de Frota"
            description="Configurações Técnicas por Fabricante e Modelo"
          >
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg"
            >
              <Plus size={16} strokeWidth={3} /> Novo Modelo
            </button>
          </PageHeader>

          <ActionFeedback feedback={feedback} onDismiss={() => setFeedback(null)} />

          {/* ── Barra de busca + filtros ──────────────────────────── */}
          <div className="mb-6 flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Fabricante, modelo, tipo..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-primary/50 text-white placeholder:text-muted-foreground/40"
              />
            </div>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 border rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all',
                showFilters ? 'bg-primary/10 border-primary/40 text-primary' : 'bg-[#0a0e27]/60 border-[#2d3647] hover:border-primary/30',
              )}
            >
              <Filter size={14} /> Filtros
              {activeFilterCount > 0 && (
                <span className="px-1.5 py-0.5 bg-primary/20 rounded-full text-[9px] font-black text-primary">{activeFilterCount}</span>
              )}
              <ChevronDown size={12} className={cn('transition-transform', showFilters && 'rotate-180')} />
            </button>
            <span className="text-[11px] text-muted-foreground font-bold uppercase ml-auto">
              {filtered.length} / {data.length} modelos
            </span>
          </div>

          {/* ── Painel de filtros ─────────────────────────────────── */}
          {showFilters && (
            <div className="mb-6 p-4 bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl flex flex-wrap gap-4 animate-in slide-in-from-top-2 duration-200">
              {/* Categoria */}
              <div>
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-2">Categoria</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORY_OPTIONS.map(c => (
                    <Chip key={c} label={c} active={filterCat === c}
                      onClick={() => setFilterCat(filterCat === c ? '' : c)} />
                  ))}
                </div>
              </div>
              {/* Métrica */}
              <div>
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-2">Unidade Principal</p>
                <div className="flex flex-wrap gap-1.5">
                  {PRIMARY_METRIC_OPTIONS.map(o => (
                    <Chip key={o.value} label={o.label} active={filterMetric === o.value}
                      onClick={() => setFilterMetric(filterMetric === o.value ? '' : o.value)} />
                  ))}
                </div>
              </div>
              {/* Status */}
              <div>
                <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest mb-2">Status</p>
                <div className="flex gap-1.5">
                  <Chip label="Ativo"   active={filterActive === 'true'}  onClick={() => setFilterActive(filterActive === 'true'  ? '' : 'true')}  />
                  <Chip label="Inativo" active={filterActive === 'false'} onClick={() => setFilterActive(filterActive === 'false' ? '' : 'false')} />
                </div>
              </div>
              {activeFilterCount > 0 && (
                <div className="self-end ml-auto">
                  <button onClick={() => { setFilterCat(''); setFilterMetric(''); setFilterActive(''); }}
                    className="px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg text-[10px] font-black uppercase text-red-400 hover:bg-red-500/20 transition-all">
                    Limpar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Tabela ───────────────────────────────────────────── */}
          {loading ? (
            <div className="flex justify-center p-12"><Loader2 size={40} className="text-primary animate-spin" /></div>
          ) : (
            <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-3xl overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[900px]">
                  <thead className="bg-[#1a1f3a]/50 text-[9px] uppercase font-black tracking-widest text-muted-foreground border-b border-[#2d3647]">
                    <tr>
                      <th className="px-4 py-4 w-12">Ícone</th>
                      <th className="px-4 py-4">Fabricante</th>
                      <th className="px-4 py-4">Modelo</th>
                      <th className="px-4 py-4">Tipo</th>
                      <th className="px-4 py-4">Categoria</th>
                      <th className="px-4 py-4">Unidade</th>
                      <th className="px-4 py-4 text-center">Tele</th>
                      <th className="px-4 py-4 text-center">CAN</th>
                      <th className="px-4 py-4 text-center">Mobile</th>
                      <th className="px-4 py-4 text-center">Status</th>
                      <th className="px-4 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d3647]">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-6 py-12 text-center text-muted-foreground text-xs font-bold uppercase">
                          Nenhum modelo encontrado
                        </td>
                      </tr>
                    ) : filtered.map(item => {
                      const d = resolveModel(item);
                      return (
                        <tr key={item.id} className="hover:bg-primary/5 transition-colors group">
                          {/* Ícone */}
                          <td className="px-4 py-3">
                            <div className="w-9 h-9 rounded-xl bg-[#1a1f3a] flex items-center justify-center text-primary border border-[#2d3647] group-hover:border-primary/30 transition-colors">
                              <EquipmentIcon type={d.iconType} size={20} />
                            </div>
                          </td>
                          {/* Fabricante */}
                          <td className="px-4 py-3">
                            <span className="text-xs font-bold text-white uppercase tracking-tighter">{d.manufacturer}</span>
                          </td>
                          {/* Modelo */}
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className="text-xs font-black italic text-primary leading-tight">{d.model}</span>
                              <span className="text-[9px] text-muted-foreground uppercase font-bold">
                                {EQUIPMENT_ICON_LABELS[d.iconType] || d.iconType}
                              </span>
                            </div>
                          </td>
                          {/* Tipo operacional */}
                          <td className="px-4 py-3">
                            <span className="text-[10px] text-muted-foreground uppercase font-bold">{d.operationalType}</span>
                          </td>
                          {/* Categoria */}
                          <td className="px-4 py-3">
                            <span className={cn('px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border', CATEGORY_BADGE[d.category] || 'bg-[#1a1f3a] text-muted-foreground border-[#2d3647]')}>
                              {d.category}
                            </span>
                          </td>
                          {/* Unidade principal */}
                          <td className="px-4 py-3">
                            <span className={cn('px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border', METRIC_BADGE[d.primaryMetric] || 'bg-[#1a1f3a] text-muted-foreground border-[#2d3647]')}>
                              {d.primaryMetric}
                            </span>
                          </td>
                          {/* Telemetria */}
                          <td className="px-4 py-3 text-center"><BoolIcon ok={d.telemetry} /></td>
                          {/* CAN */}
                          <td className="px-4 py-3 text-center"><BoolIcon ok={d.can} /></td>
                          {/* Mobile */}
                          <td className="px-4 py-3 text-center"><BoolIcon ok={d.mobile} /></td>
                          {/* Status */}
                          <td className="px-4 py-3 text-center">
                            <span className={cn('text-[9px] font-black uppercase px-2 py-0.5 rounded-full border', d.active ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20')}>
                              {d.active ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          {/* Ações */}
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button onClick={() => openEdit(item)} className="p-2 text-muted-foreground hover:text-white hover:bg-[#1a1f3a] rounded-lg transition-all" title="Editar">
                                <Edit size={14} />
                              </button>
                              <button onClick={() => doDelete(item)} className="p-2 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all" title="Arquivar">
                                <Trash2 size={14} />
                              </button>
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

      {/* ── Drawer ───────────────────────────────────────────────────── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative w-full max-w-lg bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-[#2d3647] shrink-0">
              <div>
                <h2 className="text-lg font-black italic tracking-tighter uppercase text-white">
                  {selected ? 'Editar Modelo' : 'Novo Modelo'}
                </h2>
                <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-widest mt-0.5">
                  Configuração técnica de frota
                </p>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all text-muted-foreground hover:text-white">
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form
              className="flex-1 overflow-y-auto custom-scrollbar px-8 py-6 space-y-5"
              onSubmit={handleSubmit(onSubmit)}
            >
              {/* ── Identificação ─────────────────────────────────── */}
              <SectionTitle icon={<Settings2 size={14} />} label="Identificação" />

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Fabricante" error={errors.brand?.message} required>
                  <input {...register('brand')} placeholder="John Deere, Scania..."
                    className={inputCls} />
                </FormField>
                <FormField label="Modelo" error={errors.name?.message} required>
                  <input {...register('name')} placeholder="7200J, R 450..."
                    className={inputCls} />
                </FormField>
              </div>

              <FormField label="Descrição">
                <input {...register('description')} placeholder="Descrição resumida do modelo..."
                  className={inputCls} />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Tipo Operacional" error={errors.operationalType?.message}>
                  <input {...register('operationalType')} placeholder="TRATOR, COLHEDORA..."
                    className={inputCls} />
                </FormField>
                <FormField label="Categoria">
                  <select {...register('category')} className={selectCls}>
                    <option value="">Selecione...</option>
                    {CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FormField>
              </div>

              {/* ── Ícone ─────────────────────────────────────────── */}
              <SectionTitle icon={<Activity size={14} />} label="Ícone Operacional" />
              <FormField label="Ícone" error={errors.iconType?.message} required>
                <Controller
                  name="iconType"
                  control={control}
                  render={({ field }) => (
                    <EquipmentIconPicker value={field.value} onChange={(v) => field.onChange(v)} />
                  )}
                />
              </FormField>

              {/* ── Métricas ──────────────────────────────────────── */}
              <SectionTitle icon={<Activity size={14} />} label="Métricas & Consumo" />

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Unidade Principal" error={errors.primaryMetric?.message} required>
                  <select {...register('primaryMetric')} className={selectCls}>
                    {PRIMARY_METRIC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </FormField>
                <FormField label="Combustível">
                  <select {...register('fuelType')} className={selectCls}>
                    <option value="">Selecione...</option>
                    {FUEL_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <FormField label="Cap. Nominal">
                  <input {...register('nominalCapacity')} type="number" min="0" step="0.1" placeholder="t/h ou m³"
                    className={inputCls} />
                </FormField>
                <FormField label="Cons. Médio (L/h)">
                  <input {...register('averageConsumption')} type="number" min="0" step="0.1" placeholder="0.0"
                    className={inputCls} />
                </FormField>
                <FormField label="Larg. Trabalho (m)">
                  <input {...register('workingWidth')} type="number" min="0" step="0.01" placeholder="0.00"
                    className={inputCls} />
                </FormField>
              </div>

              {/* ── Conectividade ─────────────────────────────────── */}
              <SectionTitle icon={<Wifi size={14} />} label="Conectividade" />
              <div className="grid grid-cols-3 gap-3">
                <ToggleField label="Telemetria" icon={<Wifi size={12} />}
                  name="telemetryEnabled" register={register} />
                <ToggleField label="CAN Bus"    icon={<Cpu size={12} />}
                  name="canEnabled"       register={register} />
                <ToggleField label="Mobile"     icon={<Smartphone size={12} />}
                  name="mobileEnabled"    register={register} />
              </div>

              {/* ── Observações + Status ───────────────────────────── */}
              <FormField label="Observações">
                <textarea {...register('notes')} rows={2} placeholder="Informações adicionais..."
                  className={cn(inputCls, 'resize-none')} />
              </FormField>

              <FormField label="Status">
                <Controller
                  name="active"
                  control={control}
                  render={({ field }) => (
                    <button type="button"
                      onClick={() => field.onChange(!field.value)}
                      className={cn(
                        'flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-black uppercase tracking-widest transition-all w-full',
                        field.value
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                          : 'bg-gray-500/10 border-gray-500/30 text-gray-400',
                      )}>
                      {field.value ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                      {field.value ? 'Ativo' : 'Inativo'}
                    </button>
                  )}
                />
              </FormField>
            </form>

            {/* Footer */}
            <div className="px-8 py-5 border-t border-[#2d3647] shrink-0 flex gap-3">
              <button type="button" onClick={() => setIsDrawerOpen(false)}
                className="flex-1 py-3 bg-[#1a1f3a] border border-[#2d3647] text-muted-foreground rounded-xl text-xs font-black uppercase hover:text-white transition-all">
                Cancelar
              </button>
              <button
                onClick={handleSubmit(onSubmit)}
                disabled={isSubmitting}
                className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-transform disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar Modelo
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Arquivar modelo?"
        description={`Deseja realmente arquivar o modelo ${confirmDelete?.name || confirmDelete?.model || 'selecionado'}?`}
        confirmLabel="Arquivar"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={executeDelete}
      />
    </div>
  );
}

/* ── Sub-componentes internos ─────────────────────────────────────────── */

const inputCls =
  'w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none text-white placeholder:text-muted-foreground/40 font-medium transition-colors';

const selectCls =
  'w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none appearance-none text-white font-medium';

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 pt-2">
      <span className="text-primary">{icon}</span>
      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
      <div className="flex-1 h-px bg-[#2d3647]" />
    </div>
  );
}

function ToggleField({
  label, icon, name, register,
}: {
  label: string;
  icon: React.ReactNode;
  name: 'telemetryEnabled' | 'canEnabled' | 'mobileEnabled';
  register: ReturnType<typeof useForm<EquipmentModelFormData>>['register'];
}) {
  return (
    <label className="flex flex-col items-center gap-1.5 p-3 bg-[#1a1f3a]/40 border border-[#2d3647] rounded-xl cursor-pointer hover:border-primary/30 transition-all select-none">
      <input type="checkbox" {...register(name)} className="sr-only peer" />
      <span className="peer-checked:text-primary text-muted-foreground transition-colors">{icon}</span>
      <span className="text-[9px] font-black uppercase tracking-tight text-muted-foreground peer-checked:text-primary transition-colors">{label}</span>
      <div className="w-8 h-4 rounded-full bg-[#2d3647] peer-checked:bg-primary/30 transition-colors relative">
        <div className="absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-muted-foreground peer-checked:bg-primary peer-checked:translate-x-4 transition-all" />
      </div>
    </label>
  );
}
