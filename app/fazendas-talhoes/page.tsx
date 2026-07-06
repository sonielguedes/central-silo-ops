"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MasterDataShell } from '@/components/master-data/master-data-shell';
import { MasterDataToolbar } from '@/components/master-data/master-data-toolbar';
import { FarmService, FieldService } from '@/services/api-service';
import { Farm, Field } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { farmSchema, fieldSchema, FarmFormData, FieldFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Sprout,
  Factory,
  Filter,
  Clock3,
  Leaf,
  Ruler,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';

type Tab = 'FARMS' | 'FIELDS';
type StatusKey = 'ATIVO' | 'INATIVO' | 'PENDENTE';

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon: React.ReactNode;
};

type StatusBadgeProps = {
  status: StatusKey;
};

type TerritorialFarmView = {
  raw: Farm;
  id: string;
  name: string;
  code: string;
  municipality: string;
  area: number | null;
  areaLabel: string;
  status: StatusKey;
  observations: string;
  frontLabel: string;
  updatedAt: string | null;
  searchText: string;
};

type TerritorialFieldView = {
  raw: Field;
  id: string;
  code: string;
  name: string;
  farmId: string;
  farmLabel: string;
  area: number | null;
  areaLabel: string;
  crop: string;
  status: StatusKey;
  frontLabel: string;
  updatedAt: string | null;
  searchText: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toText(value: unknown, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = toText(value);
  if (!text) return null;
  const parsed = Number(text.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  const text = toText(value).toLowerCase();
  if (!text) return null;
  if (['true', '1', 'sim', 'yes', 'ativo', 'active'].includes(text)) return true;
  if (['false', '0', 'nao', 'não', 'no', 'inativo', 'inactive'].includes(text)) return false;
  return null;
}

function toSearchText(value: unknown): string {
  return toText(value).toLowerCase();
}

function normalizeStatus(value: unknown): StatusKey {
  const raw = toText(value).toUpperCase();
  if (!raw) return 'PENDENTE';
  if (['ATIVO', 'ACTIVE', 'TRUE', '1', 'SIM'].includes(raw)) return 'ATIVO';
  if (['INATIVO', 'INACTIVE', 'FALSE', '0', 'NAO', 'NÃO'].includes(raw)) return 'INATIVO';
  return 'PENDENTE';
}

function pickText(item: unknown, keys: string[]) {
  if (!isRecord(item)) return '';
  for (const key of keys) {
    const text = toText(item[key]);
    if (text) return text;
  }
  return '';
}

function pickNumber(item: unknown, keys: string[]) {
  if (!isRecord(item)) return null;
  for (const key of keys) {
    const number = toNumber(item[key]);
    if (number !== null) return number;
  }
  return null;
}

function pickBoolean(item: unknown, keys: string[]) {
  if (!isRecord(item)) return null;
  for (const key of keys) {
    const bool = toBoolean(item[key]);
    if (bool !== null) return bool;
  }
  return null;
}

function formatNumber(value: number | null) {
  if (value === null) return 'Não informada';
  return (Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)).replace('.', ',');
}

function formatArea(value: number | null) {
  return value === null ? 'Não informada' : `${formatNumber(value)} ha`;
}

function formatRelativeDate(value: unknown) {
  const text = toText(value);
  if (!text) return 'Não informado';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  const diffMs = Date.now() - date.getTime();
  const absMinutes = Math.round(Math.abs(diffMs) / 60000);
  const absHours = Math.round(absMinutes / 60);
  const absDays = Math.round(absHours / 24);
  if (absMinutes < 2) return 'Agora';
  if (absMinutes < 60) return `há ${absMinutes} min`;
  if (absHours < 24) return `há ${absHours} h`;
  if (absDays < 7) return `há ${absDays} d`;
  return date.toLocaleDateString('pt-BR');
}

function resolveStatusForDisplay(item: unknown, fallback: StatusKey = 'PENDENTE'): StatusKey {
  const status = normalizeStatus(pickText(item, ['status']));
  if (status !== 'PENDENTE') return status;
  const active = pickBoolean(item, ['active']);
  if (active === true) return 'ATIVO';
  if (active === false) return 'INATIVO';
  return fallback;
}

function resolveFrontLabel(item: unknown) {
  return pickText(item, ['front', 'frente', 'frontName', 'frenteNome', 'zone', 'zona', 'zoneCode', 'zonaOperacional']) || 'Sem vínculo';
}

function resolveFarmView(item: Farm): TerritorialFarmView {
  const area = pickNumber(item, ['area', 'totalArea', 'hectares']);
  const status = resolveStatusForDisplay(item, 'ATIVO');
  const name = pickText(item, ['name', 'nome', 'farmName']) || 'Fazenda sem nome';
  const code = pickText(item, ['code', 'codigo', 'farmCode']) || 'Sem código';
  const municipality = pickText(item, ['municipality', 'municipio', 'city']) || 'Não informado';
  const observations = pickText(item, ['observations', 'observacao']);
  const frontLabel = resolveFrontLabel(item);

  return {
    raw: item,
    id: item.id,
    name,
    code,
    municipality,
    area,
    areaLabel: formatArea(area),
    status,
    observations,
    frontLabel,
    updatedAt: pickText(item, ['updatedAt', 'lastUpdatedAt', 'lastSyncAt']),
    searchText: [name, code, municipality, frontLabel, observations, area ?? '', status].join(' ').toLowerCase(),
  };
}

function findFarmByKeys(farms: Farm[], keys: string[]) {
  const normalizedKeys = keys.map(toSearchText).filter(Boolean);
  if (normalizedKeys.length === 0) return undefined;

  return farms.find((farm) => {
    const farmKeys = [farm.id, pickText(farm, ['code', 'codigo', 'farmCode']), pickText(farm, ['name', 'nome', 'farmName'])]
      .map(toSearchText)
      .filter(Boolean);
    return farmKeys.some((key) => normalizedKeys.includes(key));
  });
}

function resolveFieldView(item: Field, farms: Farm[]): TerritorialFieldView {
  const area = pickNumber(item, ['area', 'areaHa', 'hectares']);
  const status = resolveStatusForDisplay(item, 'ATIVO');
  const code = pickText(item, ['code', 'codigo', 'fieldCode', 'name', 'fieldName']) || 'Talhão sem identificação';
  const name = pickText(item, ['name', 'nome', 'fieldName']) || code;
  const crop = pickText(item, ['culture', 'cultura', 'crop']) || 'Não informada';
  const directFarmId = pickText(item, ['farmId']);
  const farmById = farms.find((farm) => farm.id === directFarmId);
  const farmByKeys =
    farmById ||
    findFarmByKeys(farms, [directFarmId, pickText(item, ['farmCode']), pickText(item, ['farmName'])]);
  const farmLabel = farmByKeys?.name || pickText(item, ['farmName', 'farmCode']) || 'Não informado';
  const frontLabel = resolveFrontLabel(item);
  const farmId = farmByKeys?.id || directFarmId || '';

  return {
    raw: item,
    id: item.id,
    code,
    name,
    farmId,
    farmLabel,
    area,
    areaLabel: formatArea(area),
    crop,
    status,
    frontLabel,
    updatedAt: pickText(item, ['updatedAt', 'lastUpdatedAt', 'lastSyncAt']),
    searchText: [code, name, farmLabel, farmId, crop, frontLabel, area ?? '', status].join(' ').toLowerCase(),
  };
}

function StatusBadge({ status }: StatusBadgeProps) {
  const map: Record<StatusKey, { label: string; className: string }> = {
    ATIVO: { label: 'Ativo', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
    INATIVO: { label: 'Inativo', className: 'bg-red-500/10 text-red-300 border-red-500/20' },
    PENDENTE: { label: 'Pendente', className: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
  };

  const config = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]', config.className)}>
      {config.label}
    </span>
  );
}

function StatCard({ label, value, helper, icon }: StatCardProps) {
  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.03] p-4 shadow-[0_16px_32px_rgba(0,0,0,0.2)] backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">{label}</p>
          <div className="text-2xl font-black italic tracking-tighter text-white">{value}</div>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          {icon}
        </div>
      </div>
      {helper ? <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function TerritorialCard({
  title,
  subtitle,
  icon,
  status,
  children,
  onEdit,
  onDelete,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  status: StatusKey;
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className="group rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.18)] transition-all hover:border-primary/35 hover:shadow-primary/10">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#1a1f3a] text-primary shadow-inner shadow-black/20">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Base territorial</p>
            <h3 className="truncate text-lg font-black italic tracking-tighter text-white uppercase group-hover:text-primary transition-colors">
              {title}
            </h3>
            <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-widest text-white/70">{subtitle}</p>
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
          <button
            onClick={onEdit}
            className="rounded-lg border border-white/5 bg-white/[0.03] p-2 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-white"
            title="Editar"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg border border-white/5 bg-white/[0.03] p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
            title="Excluir"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <StatusBadge status={status} />
      </div>

      {children}
    </article>
  );
}

function EmptyState({
  icon,
  title,
  description,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#2d3647] bg-[#0a0e27]/60 px-6 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="text-lg font-black uppercase tracking-tighter text-white">{title}</h3>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          onClick={onPrimary}
          className="flex items-center gap-2 rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-4 py-2 text-[10px] font-black uppercase tracking-tighter transition-all hover:bg-[#252d4a]"
        >
          <Plus size={14} /> {primaryLabel}
        </button>
        <button
          onClick={onSecondary}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-tighter text-[#0a0e27] transition-transform hover:scale-105"
        >
          <Plus size={14} strokeWidth={3} /> {secondaryLabel}
        </button>
      </div>
    </div>
  );
}

function FazendasPage() {
  const [activeTab, setActiveTab] = useState<Tab>('FARMS');
  const [farms, setFarms] = useState<Farm[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusKey | 'ALL'>('ALL');
  const [cultureFilter, setCultureFilter] = useState('ALL');
  const [frontFilter, setFrontFilter] = useState('ALL');
  const [isFarmDrawerOpen, setIsFarmDrawerOpen] = useState(false);
  const [isFieldDrawerOpen, setIsFieldDrawerOpen] = useState(false);
  const [selectedFarm, setSelectedFarm] = useState<Farm | null>(null);
  const [selectedField, setSelectedField] = useState<Field | null>(null);

  const farmForm = useForm<FarmFormData>({ resolver: zodResolver(farmSchema) });
  const fieldForm = useForm<FieldFormData>({ resolver: zodResolver(fieldSchema) });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isFarmDrawerOpen) {
      if (selectedFarm) {
        farmForm.reset({
          code: pickText(selectedFarm, ['code', 'codigo', 'farmCode']),
          name: pickText(selectedFarm, ['name', 'nome', 'farmName']),
          municipality: pickText(selectedFarm, ['municipality', 'municipio', 'city']),
          totalArea: pickNumber(selectedFarm, ['area', 'totalArea', 'hectares']) ?? 0,
          status: resolveStatusForDisplay(selectedFarm, 'ATIVO') === 'INATIVO' ? 'INATIVO' : 'ATIVO',
        });
      } else {
        farmForm.reset({ code: '', name: '', municipality: '', totalArea: 0, status: 'ATIVO' });
      }
    }
  }, [selectedFarm, isFarmDrawerOpen, farmForm]);

  useEffect(() => {
    if (isFieldDrawerOpen) {
      if (selectedField) {
        fieldForm.reset({
          code: pickText(selectedField, ['code', 'codigo', 'fieldCode', 'name', 'fieldName']),
          farmId: pickText(selectedField, ['farmId']),
          area: pickNumber(selectedField, ['area', 'areaHa', 'hectares']) ?? 0,
          crop: pickText(selectedField, ['culture', 'cultura', 'crop']),
          status: resolveStatusForDisplay(selectedField, 'ATIVO') === 'INATIVO' ? 'INATIVO' : 'ATIVO',
        });
      } else {
        fieldForm.reset({ code: '', farmId: '', area: 0, crop: '', status: 'ATIVO' });
      }
    }
  }, [selectedField, isFieldDrawerOpen, fieldForm]);

  const loadData = async () => {
    setLoading(true);
    const [famsRes, fieldsRes] = await Promise.all([FarmService.getAll(), FieldService.getAll()]);
    setFarms(Array.isArray(famsRes) ? famsRes.filter((item): item is Farm => isRecord(item)) : []);
    setFields(Array.isArray(fieldsRes) ? fieldsRes.filter((item): item is Field => isRecord(item)) : []);
    setLoading(false);
  };

  const onFarmSubmit = async (data: FarmFormData) => {
    if (selectedFarm) await FarmService.update(selectedFarm.id, data);
    else await FarmService.create(data);
    setIsFarmDrawerOpen(false);
    loadData();
  };

  const onFieldSubmit = async (data: FieldFormData) => {
    if (selectedField) await FieldService.update(selectedField.id, data);
    else await FieldService.create(data);
    setIsFieldDrawerOpen(false);
    loadData();
  };

  const farmViews = useMemo(() => farms.map(resolveFarmView), [farms]);
  const fieldViews = useMemo(() => fields.map((field) => resolveFieldView(field, farms)), [fields, farms]);

  const summary = useMemo(() => {
    const farmAreaCandidates = farmViews.map((farm) => farm.area).filter((value): value is number => value !== null);
    const fieldAreaCandidates = fieldViews.map((field) => field.area).filter((value): value is number => value !== null);
    const areaTotal =
      farmAreaCandidates.length > 0 ? farmAreaCandidates.reduce((sum, value) => sum + value, 0) : fieldAreaCandidates.reduce((sum, value) => sum + value, 0);
    const cultures = new Set(fieldViews.map((field) => field.crop).filter((value) => value && value !== 'Não informada'));
    const fronts = new Set([...farmViews, ...fieldViews].map((item) => item.frontLabel).filter((value) => value && value !== 'Sem vínculo'));
    const activeCount = [...farmViews, ...fieldViews].filter((item) => item.status === 'ATIVO').length;
    const inactiveCount = [...farmViews, ...fieldViews].filter((item) => item.status === 'INATIVO').length;
    const latestUpdate =
      [...farmViews, ...fieldViews].slice().sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())[0]?.updatedAt ?? null;

    return {
      totalFarms: farmViews.length,
      totalFields: fieldViews.length,
      areaTotal,
      cultures: cultures.size,
      fronts: fronts.size,
      activeCount,
      inactiveCount,
      latestUpdate,
    };
  }, [farmViews, fieldViews]);

  const cultureOptions = useMemo(
    () =>
      Array.from(new Set(fieldViews.map((field) => field.crop).filter((value) => value && value !== 'Não informada'))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [fieldViews],
  );

  const frontOptions = useMemo(
    () =>
      Array.from(new Set([...farmViews, ...fieldViews].map((item) => item.frontLabel).filter((value) => value && value !== 'Sem vínculo'))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [farmViews, fieldViews],
  );

  const effectiveCultureFilter = activeTab === 'FIELDS' ? cultureFilter : 'ALL';
  const hasActiveFilters = Boolean(search || statusFilter !== 'ALL' || effectiveCultureFilter !== 'ALL' || frontFilter !== 'ALL');

  const filteredFarms = useMemo(() => {
    const term = toSearchText(search);
    return farmViews.filter((farm) => {
      if (statusFilter !== 'ALL' && farm.status !== statusFilter) return false;
      if (frontFilter !== 'ALL' && farm.frontLabel !== frontFilter) return false;
      if (!term) return true;
      return farm.searchText.includes(term);
    });
  }, [farmViews, search, statusFilter, frontFilter]);

  const filteredFields = useMemo(() => {
    const term = toSearchText(search);
    return fieldViews.filter((field) => {
      if (statusFilter !== 'ALL' && field.status !== statusFilter) return false;
      if (effectiveCultureFilter !== 'ALL' && field.crop !== effectiveCultureFilter) return false;
      if (frontFilter !== 'ALL' && field.frontLabel !== frontFilter) return false;
      if (!term) return true;
      return field.searchText.includes(term);
    });
  }, [fieldViews, search, statusFilter, effectiveCultureFilter, frontFilter]);

  const activeListEmpty = activeTab === 'FARMS' ? farms.length === 0 : fields.length === 0;
  const filteredListEmpty = activeTab === 'FARMS' ? filteredFarms.length === 0 : filteredFields.length === 0;
  const searchPlaceholder =
    activeTab === 'FARMS' ? 'Buscar por fazenda, código ou município...' : 'Buscar por talhão, fazenda ou cultura...';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setCultureFilter('ALL');
    setFrontFilter('ALL');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#050812] font-sans text-white">
      <Sidebar className="hidden shrink-0 lg:flex" />
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <MasterDataShell
            title="Base Territorial"
            description="Gestão de fazendas, talhões, áreas e estrutura geográfica da operação agrícola"
            actions={
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => {
                    setSelectedFarm(null);
                    setIsFarmDrawerOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-4 py-2 text-[10px] font-black uppercase tracking-tighter transition-all hover:bg-[#252d4a]"
                >
                  <Plus size={14} /> Nova Fazenda
                </button>
                <button
                  onClick={() => {
                    setSelectedField(null);
                    setIsFieldDrawerOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-[10px] font-black uppercase tracking-tighter text-[#0a0e27] transition-transform hover:scale-105"
                >
                  <Plus size={14} strokeWidth={3} /> Novo Talhão
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-7">
              <StatCard label="Total de fazendas" value={String(summary.totalFarms)} helper="Base territorial raiz" icon={<Factory size={18} />} />
              <StatCard label="Total de talhões" value={String(summary.totalFields)} helper="Parcelas operacionais" icon={<Sprout size={18} />} />
              <StatCard label="Área total cadastrada" value={formatArea(summary.areaTotal)} helper="Somente dados reais" icon={<Ruler size={18} />} />
              <StatCard label="Culturas cadastradas" value={String(summary.cultures)} helper="Diversidade agrícola" icon={<Leaf size={18} />} />
              <StatCard label="Zonas / frentes" value={String(summary.fronts)} helper={summary.fronts > 0 ? 'Vínculos reais' : 'Sem vínculo'} icon={<MapPin size={18} />} />
              <StatCard label="Status ativos" value={String(summary.activeCount)} helper={`Inativos: ${summary.inactiveCount}`} icon={<CheckCircle2 size={18} />} />
              <StatCard label="Última atualização" value={formatRelativeDate(summary.latestUpdate)} helper="Sincronização do cadastro" icon={<Clock3 size={18} />} />
            </div>

            <div className="mt-6">
              <MasterDataToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder={searchPlaceholder}
                actions={
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="flex items-center gap-2 rounded-2xl border border-[#2d3647] bg-[#1a1f3a] px-4 py-3 text-xs font-bold transition-all hover:bg-[#252d4a]"
                  >
                    <Filter size={16} className="text-primary" /> Limpar filtros
                  </button>
                }
              />

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as StatusKey | 'ALL')}
                    className="w-full rounded-2xl border border-[#2d3647] bg-[#0a0e27]/70 px-4 py-3 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="ALL">Todos</option>
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                    <option value="PENDENTE">Pendente</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Zona / frente</span>
                  <select
                    value={frontFilter}
                    onChange={(e) => setFrontFilter(e.target.value)}
                    className="w-full rounded-2xl border border-[#2d3647] bg-[#0a0e27]/70 px-4 py-3 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="ALL">Todas</option>
                    {frontOptions.map((front) => (
                      <option key={front} value={front}>
                        {front}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                    {activeTab === 'FARMS' ? 'Município / código' : 'Cultura'}
                  </span>
                  <select
                    value={effectiveCultureFilter}
                    onChange={(e) => setCultureFilter(e.target.value)}
                    className="w-full rounded-2xl border border-[#2d3647] bg-[#0a0e27]/70 px-4 py-3 text-sm outline-none focus:border-primary/50"
                    disabled={activeTab === 'FARMS'}
                  >
                    {activeTab === 'FARMS' ? (
                      <option value="ALL">Filtro não aplicável</option>
                    ) : (
                      <>
                        <option value="ALL">Todas as culturas</option>
                        {cultureOptions.map((culture) => (
                          <option key={culture} value={culture}>
                            {culture}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
                    hasActiveFilters ? 'border-primary/25 bg-primary/10 text-primary' : 'border-white/5 bg-white/[0.03] text-white/60',
                  )}
                >
                  Filtros: {hasActiveFilters ? 'Ativos' : 'Limpos'}
                </span>
                <span className="inline-flex items-center rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/60">
                  Base: Fazendas {summary.totalFarms} · Talhões {summary.totalFields}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-4 flex flex-wrap gap-2">
                {[
                  { id: 'FARMS' as Tab, label: 'Fazendas', icon: <Factory size={14} /> },
                  { id: 'FIELDS' as Tab, label: 'Talhões', icon: <Sprout size={14} /> },
                ].map((tab) => {
                  const active = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all',
                        active
                          ? 'border-primary/25 bg-primary/10 text-primary'
                          : 'border-white/5 bg-white/[0.03] text-white/60 hover:bg-white/[0.05] hover:text-white',
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {loading ? (
                <div className="flex h-64 flex-col items-center justify-center gap-4">
                  <Loader2 size={40} className="animate-spin text-primary" />
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground">Mapeando território...</p>
                </div>
              ) : activeListEmpty ? (
                activeTab === 'FARMS' ? (
                  <EmptyState
                    icon={<Factory size={28} />}
                    title="Nenhuma fazenda cadastrada"
                    description="Cadastre fazendas para estruturar a base territorial da operação agrícola."
                    primaryLabel="Nova Fazenda"
                    secondaryLabel="Novo Talhão"
                    onPrimary={() => {
                      setSelectedFarm(null);
                      setIsFarmDrawerOpen(true);
                    }}
                    onSecondary={() => {
                      setSelectedField(null);
                      setIsFieldDrawerOpen(true);
                    }}
                  />
                ) : (
                  <EmptyState
                    icon={<Sprout size={28} />}
                    title="Nenhum talhão cadastrado"
                    description="Cadastre talhões vinculados às fazendas para organizar zonas, culturas e áreas operacionais."
                    primaryLabel="Nova Fazenda"
                    secondaryLabel="Novo Talhão"
                    onPrimary={() => {
                      setSelectedFarm(null);
                      setIsFarmDrawerOpen(true);
                    }}
                    onSecondary={() => {
                      setSelectedField(null);
                      setIsFieldDrawerOpen(true);
                    }}
                  />
                )
              ) : filteredListEmpty ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#2d3647] bg-[#0a0e27]/60 px-6 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-white/70">
                    <Filter size={28} />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tighter text-white">Nenhum registro encontrado com os filtros atuais</h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                    Ajuste os filtros ou limpe a busca para voltar a visualizar a base territorial disponível no tenant.
                  </p>
                  <button
                    onClick={clearFilters}
                    className="mt-6 flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-tighter text-[#0a0e27] shadow-lg shadow-primary/20 transition-transform hover:scale-105"
                  >
                    <Filter size={14} strokeWidth={3} /> Limpar filtros
                  </button>
                </div>
              ) : activeTab === 'FARMS' ? (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {filteredFarms.map((farm) => {
                    const fieldsCount = fieldViews.filter((field) => field.farmId === farm.id).length;

                    return (
                      <TerritorialCard
                        key={farm.id}
                        title={farm.name}
                        subtitle={`${farm.code} · ${farm.municipality}`}
                        icon={<Factory size={24} />}
                        status={farm.status}
                        onEdit={() => {
                          setSelectedFarm(farm.raw);
                          setIsFarmDrawerOpen(true);
                        }}
                        onDelete={async () => {
                          if (confirm('Excluir fazenda?')) {
                            await FarmService.archive(farm.id);
                            loadData();
                          }
                        }}
                      >
                        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Área total</p>
                            <p className="mt-1 text-xs font-bold text-white">{farm.areaLabel}</p>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Talhões</p>
                            <p className="mt-1 text-xs font-bold text-white">{fieldsCount}</p>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Zona / frente</p>
                            <p className="mt-1 truncate text-xs font-bold text-white">{farm.frontLabel}</p>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Atualização</p>
                            <p className="mt-1 text-xs font-bold text-white">{formatRelativeDate(farm.updatedAt)}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#2d3647] pt-4">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Observação</p>
                            <p className="mt-1 text-xs font-bold text-white">{farm.observations || 'Não informada'}</p>
                          </div>
                        </div>
                      </TerritorialCard>
                    );
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {filteredFields.map((field) => (
                    <TerritorialCard
                      key={field.id}
                      title={field.name}
                      subtitle={`${field.code} · ${field.farmLabel}`}
                      icon={<Sprout size={24} />}
                      status={field.status}
                      onEdit={() => {
                        setSelectedField(field.raw);
                        setIsFieldDrawerOpen(true);
                      }}
                      onDelete={async () => {
                        if (confirm('Excluir talhão?')) {
                          await FieldService.archive(field.id);
                          loadData();
                        }
                      }}
                    >
                      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Fazenda vinculada</p>
                          <p className="mt-1 truncate text-xs font-bold text-white">{field.farmLabel}</p>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Área</p>
                          <p className="mt-1 text-xs font-bold text-white">{field.areaLabel}</p>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Cultura</p>
                          <p className="mt-1 truncate text-xs font-bold text-white">{field.crop}</p>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Zona / frente</p>
                          <p className="mt-1 truncate text-xs font-bold text-white">{field.frontLabel}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-[#2d3647] pt-4">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Atualização</p>
                          <p className="mt-1 text-xs font-bold text-white">{formatRelativeDate(field.updatedAt)}</p>
                        </div>
                      </div>
                    </TerritorialCard>
                  ))}
                </div>
              )}
            </div>
          </MasterDataShell>
        </main>
      </div>

      {isFarmDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsFarmDrawerOpen(false)} />
          <div className="relative flex h-full w-full max-w-md flex-col border-l border-[#2d3647] bg-[#0a0e27] p-8 shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">{selectedFarm ? 'Editar Fazenda' : 'Nova Fazenda'}</h2>
              <button onClick={() => setIsFarmDrawerOpen(false)} className="rounded-xl p-2 transition-all hover:bg-[#1a1f3a]">
                <X size={20} />
              </button>
            </div>
            <form className="space-y-6" onSubmit={farmForm.handleSubmit(onFarmSubmit)}>
              <FormField label="Código" error={farmForm.formState.errors.code?.message} required>
                <input {...farmForm.register('code')} className="w-full rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm outline-none focus:border-primary" placeholder="Ex: FAZ-001" />
              </FormField>
              <FormField label="Nome da fazenda" error={farmForm.formState.errors.name?.message} required>
                <input {...farmForm.register('name')} className="w-full rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm outline-none focus:border-primary" placeholder="Ex: Fazenda Santa Rita" />
              </FormField>
              <FormField label="Município" error={farmForm.formState.errors.municipality?.message} required>
                <input {...farmForm.register('municipality')} className="w-full rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm outline-none focus:border-primary" placeholder="Ex: Sorriso - MT" />
              </FormField>
              <FormField label="Área total (ha)" error={farmForm.formState.errors.totalArea?.message} required>
                <input type="number" step="0.1" {...farmForm.register('totalArea')} className="w-full rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm outline-none focus:border-primary" placeholder="0,0" />
              </FormField>
              <FormField label="Status" error={farmForm.formState.errors.status?.message} required>
                <select {...farmForm.register('status')} className="w-full appearance-none rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm outline-none focus:border-primary">
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </FormField>
              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setIsFarmDrawerOpen(false)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#2d3647] bg-transparent py-3 text-xs font-black uppercase tracking-widest transition-all hover:bg-[#1a1f3a]"
                >
                  <X size={14} /> Cancelar
                </button>
                <button
                  type="submit"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black uppercase tracking-widest text-[#0a0e27] shadow-lg shadow-primary/20"
                >
                  <Save size={14} /> Salvar Fazenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isFieldDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsFieldDrawerOpen(false)} />
          <div className="relative flex h-full w-full max-w-md flex-col border-l border-[#2d3647] bg-[#0a0e27] p-8 shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="mb-8 flex items-center justify-between">
              <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">{selectedField ? 'Editar Talhão' : 'Novo Talhão'}</h2>
              <button onClick={() => setIsFieldDrawerOpen(false)} className="rounded-xl p-2 transition-all hover:bg-[#1a1f3a]">
                <X size={20} />
              </button>
            </div>
            <form className="space-y-6" onSubmit={fieldForm.handleSubmit(onFieldSubmit)}>
              <FormField label="Fazenda" error={fieldForm.formState.errors.farmId?.message} required>
                <select {...fieldForm.register('farmId')} className="w-full appearance-none rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm outline-none focus:border-primary">
                  <option value="">Selecione a fazenda</option>
                  {farms.map((farm) => (
                    <option key={farm.id} value={farm.id}>
                      {pickText(farm, ['name', 'nome', 'farmName']) || 'Fazenda sem nome'}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Código / nome do talhão" error={fieldForm.formState.errors.code?.message} required>
                <input {...fieldForm.register('code')} className="w-full rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm outline-none focus:border-primary" placeholder="Ex: T-01" />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Área (ha)" error={fieldForm.formState.errors.area?.message} required>
                  <input type="number" step="0.1" {...fieldForm.register('area')} className="w-full rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm outline-none focus:border-primary" placeholder="0,0" />
                </FormField>
                <FormField label="Cultura" error={fieldForm.formState.errors.crop?.message} required>
                  <input {...fieldForm.register('crop')} className="w-full rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm outline-none focus:border-primary" placeholder="Ex: Soja" />
                </FormField>
              </div>
              <FormField label="Status" error={fieldForm.formState.errors.status?.message} required>
                <select {...fieldForm.register('status')} className="w-full appearance-none rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm outline-none focus:border-primary">
                  <option value="ATIVO">Ativo</option>
                  <option value="INATIVO">Inativo</option>
                </select>
              </FormField>
              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setIsFieldDrawerOpen(false)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#2d3647] bg-transparent py-3 text-xs font-black uppercase tracking-widest transition-all hover:bg-[#1a1f3a]"
                >
                  <X size={14} /> Cancelar
                </button>
                <button
                  type="submit"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black uppercase tracking-widest text-[#0a0e27] shadow-lg shadow-primary/20"
                >
                  <Save size={14} /> Salvar Talhão
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default withAuth(FazendasPage, { module: 'FAZENDAS' });
