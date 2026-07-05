"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import {
  EquipmentService,
  EquipmentTypeService,
  EquipmentModelService,
  EquipmentGroupService,
} from '@/services/api-service';
import { Equipment, EquipmentType, EquipmentModel, EquipmentGroup } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { equipmentSchema, EquipmentFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import { EntityAuditInfo } from '@/components/shared/entity-audit-info';
import { EquipmentIcon } from '@/components/icons/equipment-icons';
import { ActionFeedback, type ActionFeedbackMessage } from '@/components/shared/action-feedback';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { MasterDataShell } from '@/components/master-data/master-data-shell';
import { MasterDataToolbar } from '@/components/master-data/master-data-toolbar';
import { MasterDataStatusBadge } from '@/components/master-data/master-data-status-badge';
import {
  Truck,
  Filter,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Ban,
  History as HistoryIcon,
  Activity,
  Wifi,
  WifiOff,
  MapPin,
  Clock3,
  MapPinned,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';

type ConnectivityFilter = 'ALL' | 'MOBILE_ENABLED' | 'MOBILE_DISABLED' | 'TELEMETRY_ACTIVE' | 'WAITING_LINK' | 'NO_LINK' | 'NO_CONFIG';

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon: React.ReactNode;
};

function normalizeKey(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_');
}

function formatMetricLabel(value?: string | null) {
  const key = normalizeKey(value);
  if (!key) return 'Não informado';
  const labels: Record<string, string> = {
    horimetro: 'Horímetro',
    km: 'KM',
    horas: 'Horas',
    unidade: 'Unidade',
    ambos: 'Horímetro + KM',
  };
  return labels[key] ?? String(value);
}

function formatRelativeDate(value?: string | null) {
  if (!value) return 'Não informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não informado';
  const diffMs = date.getTime() - Date.now();
  const absMinutes = Math.round(Math.abs(diffMs) / 60000);
  const absHours = Math.round(absMinutes / 60);
  const absDays = Math.round(absHours / 24);
  if (absMinutes < 2) return 'Agora';
  if (absMinutes < 60) return `há ${absMinutes} min`;
  if (absHours < 24) return `há ${absHours} h`;
  if (absDays < 7) return `há ${absDays} d`;
  return date.toLocaleDateString('pt-BR');
}

function readOptionalText(item: Equipment, keys: string[]) {
  const record = item as Equipment & Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function readOptionalBoolean(item: Equipment, keys: string[]) {
  const record = item as Equipment & Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }
  }
  return undefined;
}

function resolveEquipmentCode(item: Equipment) {
  return readOptionalText(item, ['code', 'fleetCode', 'equipmentCode', 'name']) || '—';
}

function resolveEquipmentTitle(item: Equipment, type?: EquipmentType, model?: EquipmentModel) {
  return (
    readOptionalText(item, ['brand', 'description', 'name', 'model']) ||
    model?.name ||
    type?.name ||
    'Não informado'
  );
}

function resolveEquipmentStatus(item: Equipment) {
  const raw = readOptionalText(item, ['entityStatus', 'status']);
  if (raw) return raw;
  const active = readOptionalBoolean(item, ['active']);
  return active === false ? 'INATIVO' : 'ATIVO';
}

function resolveFrontFilterKey(item: Equipment) {
  return readOptionalText(item, ['groupId', 'frontId', 'frenteId', 'frontCode']) || '';
}

function resolveFrontLabel(item: Equipment, group?: EquipmentGroup) {
  return group?.name || readOptionalText(item, ['front', 'frente', 'frontName', 'frontLabel']) || 'Não informado';
}

function resolveOperationalStatus(status?: string) {
  const key = normalizeKey(status);
  const config: Record<string, { label: string; className: string }> = {
    ativo: { label: 'Ativo', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
    inativo: { label: 'Inativo', className: 'bg-slate-500/10 text-slate-300 border-slate-500/20' },
    trabalhando: { label: 'Trabalhando', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' },
    deslocando: { label: 'Deslocando', className: 'bg-sky-500/10 text-sky-300 border-sky-500/20' },
    parada: { label: 'Parada', className: 'bg-amber-500/10 text-amber-300 border-amber-500/20' },
    alarme: { label: 'Alerta', className: 'bg-rose-500/10 text-rose-300 border-rose-500/20' },
    manutencao: { label: 'Manutenção', className: 'bg-orange-500/10 text-orange-300 border-orange-500/20' },
    offline: { label: 'Offline', className: 'bg-slate-500/10 text-slate-300 border-slate-500/20' },
  };

  return config[key] ?? { label: status || 'Não informado', className: 'bg-white/5 text-white/70 border-white/10' };
}

function getConnectivityInfo(item: Equipment, type?: EquipmentType) {
  const hasTelemetryConfig = readOptionalBoolean(item, ['telemetryEnabled', 'telemetryEnabledDefault']) ?? Boolean(type?.telemetryEnabledDefault);
  const mobileEnabled = readOptionalBoolean(item, ['mobileEnabled']);
  const heartbeat = readOptionalText(item, ['lastHeartbeat', 'lastSyncAt', 'lastSignalAt']);

  if (!hasTelemetryConfig) {
    return {
      label: 'Não configurada',
      helper: 'Tipo sem telemetria padrão',
      className: 'bg-white/5 text-white/70 border-white/10',
      icon: <WifiOff size={12} />,
    };
  }

  if (mobileEnabled === false) {
    return {
      label: 'Sem vínculo',
      helper: 'Mobile desabilitado',
      className: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
      icon: <WifiOff size={12} />,
    };
  }

  if (heartbeat) {
    return {
      label: 'Ativa',
      helper: `Último sinal ${formatRelativeDate(heartbeat)}`,
      className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      icon: <Wifi size={12} />,
    };
  }

  return {
    label: 'Aguardando vínculo',
    helper: 'Mobile habilitado sem sinal',
    className: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    icon: <Wifi size={12} />,
  };
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

function EquipamentosPage() {
  const [data, setData] = useState<Equipment[]>([]);
  const [types, setTypes] = useState<EquipmentType[]>([]);
  const [models, setModels] = useState<EquipmentModel[]>([]);
  const [groups, setGroups] = useState<EquipmentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ATIVO' | 'INATIVO'>('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [frontFilter, setFrontFilter] = useState('ALL');
  const [connectivityFilter, setConnectivityFilter] = useState<ConnectivityFilter>('ALL');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
  const [viewAudit, setViewAudit] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedbackMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Equipment | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) {
        reset({
          code: selectedItem.code,
          typeId: selectedItem.typeId,
          modelId: selectedItem.modelId,
          groupId: selectedItem.groupId || '',
          profileId: selectedItem.profileId || '',
          brand: selectedItem.brand,
          plateOrSerial: selectedItem.plateOrSerial || '',
          status: selectedItem.status,
          hourmeter: selectedItem.hourmeter,
          observations: selectedItem.observations || '',
          mobileEnabled: selectedItem.mobileEnabled || false,
        });
      } else {
        reset({
          code: '',
          typeId: '',
          modelId: '',
          groupId: '',
          profileId: '',
          brand: '',
          plateOrSerial: '',
          status: 'ATIVO',
          hourmeter: 0,
          observations: '',
          mobileEnabled: false,
        });
      }
    } else {
      setViewAudit(false);
    }
  }, [selectedItem, reset, isDrawerOpen]);

  const loadData = async () => {
    setLoading(true);
    const [fleet, t, m, g] = await Promise.all([
      EquipmentService.getAll(),
      EquipmentTypeService.getAll(),
      EquipmentModelService.getAll(),
      EquipmentGroupService.getAll(),
    ]);
    setData(fleet);
    setTypes(t);
    setModels(m);
    setGroups(g);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const item = data.find((equipment) => equipment.id === id);
    if (!item) return;
    setConfirmDelete(item);
  };

  const onSubmit = async (formData: EquipmentFormData) => {
    try {
      if (selectedItem) {
        await EquipmentService.update(selectedItem.id, {
          ...formData,
          version: selectedItem.version,
        });
      } else {
        if (data.some((e) => e.code === formData.code && e.entityStatus !== 'ARQUIVADO')) {
          throw new Error('Código de frota já cadastrado e ativo.');
        }
        await EquipmentService.create({ ...formData, lastSignal: 'Agora' });
      }
      setIsDrawerOpen(false);
      loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao salvar equipamento';
      setFeedback({ type: 'error', message });
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      await EquipmentService.archive(confirmDelete.id);
      setFeedback({ type: 'success', message: 'Equipamento arquivado com sucesso' });
      setConfirmDelete(null);
      loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao arquivar equipamento';
      setConfirmDelete(null);
      setFeedback({ type: 'error', message });
    }
  };

  const stats = useMemo(() => {
    const activeCount = data.filter((item) => resolveEquipmentStatus(item) === 'ATIVO').length;
    const inactiveCount = data.filter((item) => resolveEquipmentStatus(item) === 'INATIVO').length;
    const mobileEnabledCount = data.filter((item) => readOptionalBoolean(item, ['mobileEnabled']) !== false).length;
    const telemetryActiveCount = data.filter((item) => {
      const type = types.find((t) => t.id === item.typeId);
      return getConnectivityInfo(item, type).label === 'Ativa';
    }).length;
    const frontCount = new Set(data.map((item) => item.groupId).filter(Boolean)).size;
    const latestUpdate = data
      .slice()
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];

    return {
      total: data.length,
      activeCount,
      inactiveCount,
      mobileEnabledCount,
      telemetryActiveCount,
      frontCount,
      latestUpdate: latestUpdate?.updatedAt ?? null,
    };
  }, [data, types]);

  const filteredData = useMemo(() => {
    const term = search.trim().toLowerCase();

    return data.filter((item) => {
      const type = types.find((t) => t.id === item.typeId);
      const model = models.find((m) => m.id === item.modelId);
      const group = groups.find((g) => g.id === item.groupId);
      const connectivity = getConnectivityInfo(item, type);
      const itemStatus = resolveEquipmentStatus(item);

      if (statusFilter !== 'ALL' && itemStatus !== statusFilter) return false;
      if (typeFilter !== 'ALL' && item.typeId !== typeFilter) return false;
      if (frontFilter !== 'ALL' && resolveFrontFilterKey(item) !== frontFilter && item.groupId !== frontFilter) return false;
      if (connectivityFilter !== 'ALL') {
        const key =
          connectivityFilter === 'MOBILE_ENABLED' ? (readOptionalBoolean(item, ['mobileEnabled']) !== false ? 'ok' : 'no') :
          connectivityFilter === 'MOBILE_DISABLED' ? (readOptionalBoolean(item, ['mobileEnabled']) === false ? 'ok' : 'no') :
          connectivityFilter === 'TELEMETRY_ACTIVE' ? (connectivity.label === 'Ativa' ? 'ok' : 'no') :
          connectivityFilter === 'WAITING_LINK' ? (connectivity.label === 'Aguardando vínculo' ? 'ok' : 'no') :
          connectivityFilter === 'NO_LINK' ? (connectivity.label === 'Sem vínculo' ? 'ok' : 'no') :
          connectivityFilter === 'NO_CONFIG' ? (connectivity.label === 'Não configurada' ? 'ok' : 'no') :
          'ok';
        if (key !== 'ok') return false;
      }

      if (!term) return true;

      const haystack = [
        resolveEquipmentCode(item),
        resolveEquipmentTitle(item, type, model),
        readOptionalText(item, ['description', 'name', 'fleetCode', 'equipmentCode']),
        type?.name,
        model?.name,
        resolveFrontLabel(item, group),
        item.plateOrSerial,
        item.status,
        item.entityStatus,
        itemStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [data, types, models, groups, search, statusFilter, typeFilter, frontFilter, connectivityFilter]);

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <MasterDataShell
            title="Frota Operacional"
            description="Gestão técnica e monitoramento de ativos agrícolas"
            actions={
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setIsDrawerOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"
              >
                <Plus size={16} strokeWidth={3} /> Integrar Equipamento
              </button>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
              <StatCard
                label="Total de equipamentos"
                value={String(stats.total)}
                helper={`Ativos: ${stats.activeCount} · Inativos: ${stats.inactiveCount}`}
                icon={<Truck size={18} />}
              />
              <StatCard
                label="Ativos"
                value={String(stats.activeCount)}
                helper="Prontos para operação"
                icon={<Activity size={18} />}
              />
              <StatCard
                label="Inativos"
                value={String(stats.inactiveCount)}
                helper="Fora da operação"
                icon={<Ban size={18} />}
              />
              <StatCard
                label="Mobile habilitado"
                value={String(stats.mobileEnabledCount)}
                helper="Com acesso ao APK"
                icon={<Wifi size={18} />}
              />
              <StatCard
                label="Telemetria ativa"
                value={String(stats.telemetryActiveCount)}
                helper="Com vínculo sinalizando"
                icon={<MapPinned size={18} />}
              />
              <StatCard
                label="Frentes vinculadas"
                value={String(stats.frontCount)}
                helper={stats.latestUpdate ? `Última atualização: ${formatRelativeDate(stats.latestUpdate)}` : 'Última atualização: não informado'}
                icon={<Clock3 size={18} />}
              />
            </div>

            <ActionFeedback feedback={feedback} onDismiss={() => setFeedback(null)} />

            <div className="mt-2">
              <MasterDataToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Buscar por frota, código, tipo ou modelo..."
                actions={
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('ALL');
                      setTypeFilter('ALL');
                      setFrontFilter('ALL');
                      setConnectivityFilter('ALL');
                    }}
                    className="flex items-center gap-2 px-4 py-3 bg-[#1a1f3a] border border-[#2d3647] rounded-2xl text-xs font-bold hover:bg-[#252d4a] transition-all"
                  >
                    <Filter size={16} className="text-primary" /> Limpar filtros
                  </button>
                }
              />

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ATIVO' | 'INATIVO')}
                    className="w-full bg-[#0a0e27]/70 border border-[#2d3647] rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="ALL">Todos</option>
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Tipo</span>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="w-full bg-[#0a0e27]/70 border border-[#2d3647] rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="ALL">Todos os tipos</option>
                    {types.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Frente</span>
                  <select
                    value={frontFilter}
                    onChange={(e) => setFrontFilter(e.target.value)}
                    className="w-full bg-[#0a0e27]/70 border border-[#2d3647] rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="ALL">Todas as frentes</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Mobile / Telemetria</span>
                  <select
                    value={connectivityFilter}
                    onChange={(e) => setConnectivityFilter(e.target.value as ConnectivityFilter)}
                    className="w-full bg-[#0a0e27]/70 border border-[#2d3647] rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="ALL">Tudo</option>
                    <option value="MOBILE_ENABLED">Mobile habilitado</option>
                    <option value="MOBILE_DISABLED">Mobile desabilitado</option>
                    <option value="TELEMETRY_ACTIVE">Telemetria ativa</option>
                    <option value="WAITING_LINK">Aguardando vínculo</option>
                    <option value="NO_LINK">Sem vínculo</option>
                    <option value="NO_CONFIG">Não configurada</option>
                  </select>
                </label>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <Loader2 size={40} className="text-primary animate-spin" />
                <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Sincronizando frota...</p>
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[340px] border border-dashed border-[#2d3647] rounded-3xl bg-[#0a0e27]/60 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
                  <Truck size={28} />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tighter text-white">Nenhum equipamento cadastrado</h3>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
                  Cadastre frotas e equipamentos para iniciar jornadas, telemetria, abastecimentos e rastreio operacional.
                </p>
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    setIsDrawerOpen(true);
                  }}
                  className="mt-6 flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"
                >
                  <Plus size={14} strokeWidth={3} /> Novo Equipamento
                </button>
              </div>
            ) : filteredData.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[340px] border border-dashed border-[#2d3647] rounded-3xl bg-[#0a0e27]/60 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 mb-4">
                  <Filter size={28} />
                </div>
                <h3 className="text-lg font-black uppercase tracking-tighter text-white">Nenhum equipamento encontrado com os filtros atuais</h3>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
                  Ajuste os filtros ou limpe a busca para voltar a visualizar a frota operacional disponível no tenant.
                </p>
                <button
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('ALL');
                    setTypeFilter('ALL');
                    setFrontFilter('ALL');
                    setConnectivityFilter('ALL');
                  }}
                  className="mt-6 flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"
                >
                  <Filter size={14} strokeWidth={3} /> Limpar filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-5">
                {filteredData.map((item) => {
                  const type = types.find((t) => t.id === item.typeId);
                  const model = models.find((m) => m.id === item.modelId);
                  const group = groups.find((g) => g.id === item.groupId);
                  const connectivity = getConnectivityInfo(item, type);
                  const operational = resolveOperationalStatus(item.status);
                  const iconType = item.iconType || model?.iconType || type?.iconType || 'PADRAO_GENERICO';
                  const frontLabel = resolveFrontLabel(item, group);
                  const syncLabel = readOptionalText(item, ['lastSyncAt', 'lastHeartbeat']) || item.lastSignal || 'Não informado';
                  const measureLabel = formatMetricLabel(item.measurementMode || type?.primaryMetric || null);
                  const technicalLink = readOptionalText(item, ['deviceId', 'trackerId']);
                  const code = resolveEquipmentCode(item);
                  const title = resolveEquipmentTitle(item, type, model);
                  const operationalStatus = resolveEquipmentStatus(item);

                  return (
                    <article key={item.id} className="group rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.18)] transition-all hover:border-primary/35 hover:shadow-primary/10">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4 min-w-0">
                          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#1a1f3a] text-primary shadow-inner shadow-black/20">
                            <EquipmentIcon type={iconType} size={30} />
                          </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Frota</p>
                              <h3 className="truncate text-lg font-black italic tracking-tighter text-white uppercase group-hover:text-primary transition-colors">
                              {code}
                              </h3>
                              <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-widest text-white/70">
                              {type?.name || 'Tipo não informado'} · {model?.name || 'Modelo não informado'}
                              </p>
                            {title ? (
                              <p className="mt-1 truncate text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                                {title}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex shrink-0 gap-1">
                          <button
                            onClick={() => {
                              setSelectedItem(item);
                              setIsDrawerOpen(true);
                            }}
                            className="rounded-lg border border-white/5 bg-white/[0.03] p-2 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-white"
                            title="Editar"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="rounded-lg border border-white/5 bg-white/[0.03] p-2 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-400"
                            title="Arquivar"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <MasterDataStatusBadge status={operationalStatus} />
                        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]', operational.className)}>
                          {operational.label}
                        </span>
                        <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]', connectivity.className)}>
                          {connectivity.icon}
                          {connectivity.label}
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Frente</p>
                          <p className="mt-1 truncate text-xs font-bold text-white">{frontLabel}</p>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Mobile</p>
                          <p className="mt-1 text-xs font-bold text-white">{readOptionalBoolean(item, ['mobileEnabled']) === false ? 'Não habilitado' : 'Habilitado'}</p>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Telemetria</p>
                          <p className="mt-1 text-xs font-bold text-white">{connectivity.label}</p>
                        </div>
                        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Último sinal</p>
                          <p className="mt-1 text-xs font-bold text-white">{item.lastSignal || 'Não informado'}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#2d3647] pt-4">
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Medição</p>
                          <p className="mt-1 text-xs font-bold text-white">{measureLabel}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Horímetro / KM</p>
                          <p className="mt-1 text-xs font-black italic text-primary tracking-tighter">
                            {Number.isFinite(item.hourmeter) ? `${item.hourmeter.toFixed(1)}` : '0.0'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Atualização</p>
                          <p className="mt-1 text-xs font-bold text-white">{formatRelativeDate(item.updatedAt)}</p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#2d3647] pt-4">
                        <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-1">
                            <MapPin size={12} /> {frontLabel}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-1">
                            <Clock3 size={12} /> {syncLabel}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {technicalLink ? (
                            <span className="rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/70">
                              {technicalLink}
                            </span>
                          ) : (
                            <span className="rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-white/50">
                              Vínculo técnico não informado
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </MasterDataShell>
        </main>
      </div>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative flex h-full w-full max-w-md flex-col border-l border-[#2d3647] bg-[#0a0e27] p-8 shadow-2xl animate-in slide-in-from-right duration-300">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">
                  {selectedItem ? 'Editar Equipamento' : 'Novo Equipamento'}
                </h2>
                {selectedItem ? (
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                    Versão {selectedItem.version}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                {selectedItem ? (
                  <button
                    onClick={() => setViewAudit(!viewAudit)}
                    className={cn(
                      'rounded-xl border border-[#2d3647] p-2 transition-all',
                      viewAudit ? 'bg-primary text-[#0a0e27]' : 'text-muted-foreground hover:bg-[#1a1f3a]'
                    )}
                    title="Histórico"
                  >
                    <HistoryIcon size={18} />
                  </button>
                ) : null}
                <button onClick={() => setIsDrawerOpen(false)} className="rounded-xl p-2 transition-all hover:bg-[#1a1f3a]">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
              {viewAudit && selectedItem ? (
                <EntityAuditInfo entity={selectedItem} />
              ) : (
                <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
                  <FormField label="Código da frota" error={errors.code?.message} required>
                    <input
                      {...register('code')}
                      className={cn(
                        'w-full rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm font-bold uppercase tracking-widest text-white outline-none transition-all focus:border-primary',
                        errors.code && 'border-red-500/50'
                      )}
                      placeholder="Ex: 605112"
                    />
                  </FormField>

                  <FormField label="Descrição" error={errors.brand?.message} required>
                    <input
                      {...register('brand')}
                      className={cn(
                        'w-full rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm text-white outline-none transition-all focus:border-primary',
                        errors.brand && 'border-red-500/50'
                      )}
                      placeholder="Ex: John Deere"
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Tipo" error={errors.typeId?.message} required>
                      <select
                        {...register('typeId')}
                        className="w-full appearance-none rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm text-white outline-none transition-all focus:border-primary"
                      >
                        <option value="">Selecione...</option>
                        {types.map((type) => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Modelo" error={errors.modelId?.message} required>
                      <select
                        {...register('modelId')}
                        className="w-full appearance-none rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm text-white outline-none transition-all focus:border-primary"
                      >
                        <option value="">Selecione...</option>
                        {models.map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Frente" error={errors.groupId?.message}>
                      <select
                        {...register('groupId')}
                        className="w-full appearance-none rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm text-white outline-none transition-all focus:border-primary"
                      >
                        <option value="">Sem frente</option>
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Série / Placa" error={errors.plateOrSerial?.message}>
                      <input
                        {...register('plateOrSerial')}
                        className={cn(
                          'w-full rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm text-white outline-none transition-all focus:border-primary',
                          errors.plateOrSerial && 'border-red-500/50'
                        )}
                        placeholder="Ex: ABC-1234"
                      />
                    </FormField>
                  </div>

                  <FormField label="Horímetro atual" error={errors.hourmeter?.message} required>
                    <input
                      type="number"
                      step="0.1"
                      {...register('hourmeter')}
                      className={cn(
                        'w-full rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm text-white outline-none transition-all focus:border-primary',
                        errors.hourmeter && 'border-red-500/50'
                      )}
                      placeholder="0.0"
                    />
                  </FormField>

                  <FormField label="Status operacional" error={errors.status?.message} required>
                    <select
                      {...register('status')}
                      className="w-full appearance-none rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm text-white outline-none transition-all focus:border-primary"
                    >
                      <option value="ATIVO">Ativo</option>
                      <option value="INATIVO">Inativo</option>
                      <option value="manutencao">Manutenção</option>
                      <option value="trabalhando">Trabalhando</option>
                      <option value="deslocando">Deslocando</option>
                      <option value="parada">Parada</option>
                      <option value="alarme">Alerta</option>
                      <option value="offline">Offline</option>
                    </select>
                  </FormField>

                  <div className="space-y-4 border-t border-[#2d3647] pt-4">
                    <div className="flex items-center justify-between rounded-xl border border-[#2d3647] bg-[#1a1f3a]/40 p-3">
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white">Mobile habilitado</span>
                        <span className="text-[8px] font-bold uppercase text-muted-foreground">Sincronização com o APK</span>
                      </div>
                      <input
                        type="checkbox"
                        {...register('mobileEnabled')}
                        className="h-4 w-4 rounded border-[#2d3647] bg-[#1a1f3a] text-primary focus:ring-primary"
                      />
                    </div>

                    {selectedItem ? (
                      <div className="grid grid-cols-1 gap-3">
                        <div className="rounded-xl border border-[#2d3647] bg-[#050812] p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Conectividade</p>
                          <p className="mt-1 text-xs font-bold uppercase text-white">
                            {readOptionalBoolean(selectedItem, ['mobileEnabled']) === false ? 'Mobile desabilitado' : 'Mobile habilitado'}
                          </p>
                        </div>
                        <div className="rounded-xl border border-[#2d3647] bg-[#050812] p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Último sinal</p>
                          <p className="mt-1 text-xs font-bold uppercase text-white">{selectedItem.lastSignal || 'Não informado'}</p>
                        </div>
                        <div className="rounded-xl border border-[#2d3647] bg-[#050812] p-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Última atualização</p>
                          <p className="mt-1 text-xs font-bold uppercase text-white">{formatRelativeDate(selectedItem.updatedAt)}</p>
                        </div>
                        {readOptionalText(selectedItem, ['deviceId', 'trackerId']) ? (
                          <div className="rounded-xl border border-[#2d3647] bg-[#050812] p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Vínculo técnico</p>
                            <p className="mt-1 text-xs font-bold uppercase text-white">{readOptionalText(selectedItem, ['deviceId', 'trackerId'])}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>

                  <FormField label="Observações" error={errors.observations?.message}>
                    <textarea
                      {...register('observations')}
                      rows={4}
                      className="w-full resize-none rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-3 text-sm text-white outline-none transition-all focus:border-primary"
                      placeholder="Notas adicionais sobre o equipamento..."
                    />
                  </FormField>

                  <div className="flex gap-3 pt-6">
                    <button
                      type="button"
                      onClick={() => setIsDrawerOpen(false)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#2d3647] bg-transparent py-3 text-xs font-black uppercase tracking-widest transition-all hover:bg-[#1a1f3a]"
                    >
                      <Ban size={14} /> Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-3 text-xs font-black uppercase tracking-widest text-[#0a0e27] transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {selectedItem ? 'Salvar alterações' : 'Criar equipamento'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Arquivar equipamento?"
        description={`Deseja realmente arquivar ${confirmDelete?.code || 'este equipamento'}?`}
        confirmLabel="Arquivar"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={executeDelete}
      />
    </div>
  );
}

export default withAuth(EquipamentosPage, { module: 'EQUIPAMENTOS' });
