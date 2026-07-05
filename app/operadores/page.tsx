"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MasterDataShell } from '@/components/master-data/master-data-shell';
import { MasterDataToolbar } from '@/components/master-data/master-data-toolbar';
import { OperatorService } from '@/services/api-service';
import { Operator } from '@/lib/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { operatorSchema, OperatorFormData } from '@/lib/validations/master-schemas';
import { FormField } from '@/components/shared/form-field';
import { EntityAuditInfo } from '@/components/shared/entity-audit-info';
import {
  User,
  Users,
  UserCheck,
  UserX,
  BadgeInfo,
  Plus,
  Edit,
  Trash2,
  Loader2,
  X,
  Save,
  Ban,
  Briefcase,
  Filter,
  CalendarClock,
  History,
  CheckCircle2,
  CircleDashed,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { withAuth } from '@/components/shared/with-auth';

type OperatorStatusFilter = 'ALL' | 'ATIVO' | 'INATIVO' | 'PENDENTE';
type OperatorRoleFilter = 'ALL' | 'MOTORISTA' | 'OPERADOR_MAQUINA' | 'OUTROS';

type StatCardProps = {
  label: string;
  value: string;
  helper?: string;
  icon: React.ReactNode;
};

type OperatorStatusMeta = {
  key: 'ATIVO' | 'INATIVO' | 'PENDENTE';
  label: string;
  className: string;
};

type OperatorRoleMeta = {
  key: 'MOTORISTA' | 'OPERADOR_MAQUINA' | 'OUTROS';
  label: string;
};

function normalizeKey(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readOptionalText(item: unknown, keys: string[]) {
  if (!isRecord(item)) return undefined;
  const record = item;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function readOptionalBoolean(item: unknown, keys: string[]) {
  if (!isRecord(item)) return undefined;
  const record = item;
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

function resolveOperatorName(item: unknown) {
  return readOptionalText(item, ['name', 'nome', 'operatorName']) || 'Sem nome informado';
}

function resolveOperatorRegistration(item: unknown) {
  return readOptionalText(item, ['registration', 'matricula', 'operatorRegistration']) || 'Sem matr?cula';
}

function resolveOperatorRole(item: unknown): OperatorRoleMeta {
  const raw = readOptionalText(item, ['role', 'funcao', 'function', 'cargo', 'position', 'title']) || '';
  const key = normalizeKey(raw);
  if (key.includes('motorista') || key.includes('driver') || key.includes('condutor')) {
    return { key: 'MOTORISTA', label: 'Motorista' };
  }
  if (
    key.includes('operador') ||
    key.includes('tratorista') ||
    key.includes('maquinista') ||
    key.includes('colhedor') ||
    key.includes('piloto') ||
    key.includes('maquina')
  ) {
    return { key: 'OPERADOR_MAQUINA', label: raw || 'Operador de m?quina' };
  }
  return { key: 'OUTROS', label: raw || 'N?o informada' };
}

function resolveOperatorShift(item: unknown) {
  return readOptionalText(item, ['shift', 'turno']) || 'N?o informado';
}

function resolveOperatorPhone(item: unknown) {
  return readOptionalText(item, ['phone', 'telefone']) || 'N?o informado';
}

function resolveOperatorStatus(item: unknown): OperatorStatusMeta {
  const rawStatus = readOptionalText(item, ['status']);
  const normalized = normalizeKey(rawStatus);
  const active = readOptionalBoolean(item, ['active']);

  if (normalized === 'inativo' || (active === false && normalized !== 'ferias' && normalized !== 'afastado')) {
    return {
      key: 'INATIVO',
      label: 'Inativo',
      className: 'bg-red-500/10 text-red-300 border-red-500/20',
    };
  }

  if (normalized === 'ferias' || normalized === 'afastado') {
    return {
      key: 'PENDENTE',
      label: 'Pendente',
      className: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    };
  }

  if (normalized === 'ativo' || active === true || !normalized) {
    return {
      key: 'ATIVO',
      label: 'Ativo',
      className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    };
  }

  return {
    key: 'PENDENTE',
    label: 'Pendente',
    className: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  };
}

function resolveOperatorOperationalState(item: unknown) {
  const status = resolveOperatorStatus(item);
  if (status.key === 'ATIVO') return { label: 'Apto para jornada', className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' };
  if (status.key === 'INATIVO') return { label: 'Bloqueado', className: 'bg-red-500/10 text-red-300 border-red-500/20' };
  return { label: 'Pendente', className: 'bg-amber-500/10 text-amber-300 border-amber-500/20' };
}

function formatRelativeDate(value?: string | null) {
  if (!value) return 'N?o informado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'N?o informado';
  const diffMs = Date.now() - date.getTime();
  const absMinutes = Math.round(Math.abs(diffMs) / 60000);
  const absHours = Math.round(absMinutes / 60);
  const absDays = Math.round(absHours / 24);
  if (absMinutes < 2) return 'Agora';
  if (absMinutes < 60) return `h? ${absMinutes} min`;
  if (absHours < 24) return `h? ${absHours} h`;
  if (absDays < 7) return `h? ${absDays} d`;
  return date.toLocaleDateString('pt-BR');
}

function resolveUpdateDate(item: unknown) {
  return readOptionalText(item, ['updatedAt', 'lastUpdatedAt', 'lastSyncAt', 'lastSeenAt']);
}

function resolveLastJourney(item: unknown) {
  return readOptionalText(item, ['lastJourney', 'journey', 'lastOperation', 'lastUsage', 'lastUsedEquipment']) || 'Sem jornada recente';
}

function resolveLastLink(item: unknown) {
  return readOptionalText(item, ['lastFleet', 'lastEquipment', 'currentFleet', 'currentEquipment']) || 'N?o informado';
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

function FilterChip({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.16em]',
        active ? 'border-primary/25 bg-primary/10 text-primary' : 'border-white/5 bg-white/[0.03] text-white/60',
      )}
    >
      {label}
    </span>
  );
}

function OperadoresPage() {
  const [data, setData] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<OperatorStatusFilter>('ALL');
  const [roleFilter, setRoleFilter] = useState<OperatorRoleFilter>('ALL');
  const [shiftFilter, setShiftFilter] = useState('ALL');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Operator | null>(null);
  const [viewAudit, setViewAudit] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
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
          registration: resolveOperatorRegistration(selectedItem),
          name: resolveOperatorName(selectedItem),
          phone: resolveOperatorPhone(selectedItem),
          role: readOptionalText(selectedItem, ['role', 'funcao', 'function', 'cargo', 'position', 'title']) || 'Operador',
          status: (readOptionalText(selectedItem, ['status']) as OperatorFormData['status']) || 'ATIVO',
          shift: resolveOperatorShift(selectedItem),
          observations: readOptionalText(selectedItem, ['observations']) || '',
        });
      } else {
        reset({
          registration: '',
          name: '',
          phone: '',
          role: 'Operador',
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
    setData(Array.isArray(result) ? result.filter((item): item is Operator => isRecord(item)) : []);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    try {
      if (confirm('Deseja realmente arquivar este operador?')) {
        await OperatorService.archive(id);
        loadData();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao arquivar operador';
      alert(message);
    }
  };

  const onSubmit = async (formData: OperatorFormData) => {
    try {
      if (selectedItem) {
        await OperatorService.update(selectedItem.id, {
          ...formData,
          version: selectedItem.version,
        });
      } else {
        await OperatorService.create(formData);
      }
      setIsDrawerOpen(false);
      loadData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Falha ao salvar operador';
      alert(message);
    }
  };

  const summary = useMemo(() => {
    const activeCount = data.filter((item) => resolveOperatorStatus(item).key === 'ATIVO').length;
    const inactiveCount = data.filter((item) => resolveOperatorStatus(item).key === 'INATIVO').length;
    const pendingCount = data.filter((item) => resolveOperatorStatus(item).key === 'PENDENTE').length;
    const drivers = data.filter((item) => resolveOperatorRole(item).key === 'MOTORISTA').length;
    const machineOperators = data.filter((item) => resolveOperatorRole(item).key === 'OPERADOR_MAQUINA').length;
    const shifts = new Set(data.map((item) => resolveOperatorShift(item)).filter((value) => value && value !== 'Não informado')).size;
    const latestUpdate = data
      .slice()
      .sort((a, b) => new Date(resolveUpdateDate(b) || b.updatedAt).getTime() - new Date(resolveUpdateDate(a) || a.updatedAt).getTime())[0];

    return {
      total: data.length,
      activeCount,
      inactiveCount,
      pendingCount,
      drivers,
      machineOperators,
      shifts,
      latestUpdate: resolveUpdateDate(latestUpdate),
    };
  }, [data]);

  const shiftOptions = useMemo(() => {
    const shifts = new Set<string>();
    data.forEach((item) => {
      const shift = resolveOperatorShift(item);
      if (shift && shift !== 'Não informado') shifts.add(shift);
    });
    return Array.from(shifts).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [data]);

  const filteredData = useMemo(() => {
    const term = search.trim().toLowerCase();

    return data.filter((item) => {
      const name = resolveOperatorName(item);
      const registration = resolveOperatorRegistration(item);
      const role = resolveOperatorRole(item);
      const shift = resolveOperatorShift(item);
      const status = resolveOperatorStatus(item);
      const phone = resolveOperatorPhone(item);

      if (statusFilter !== 'ALL' && status.key !== statusFilter) return false;
      if (roleFilter !== 'ALL' && role.key !== roleFilter) return false;
      if (shiftFilter !== 'ALL' && shift !== shiftFilter) return false;

      if (!term) return true;

      const haystack = [name, registration, role.label, shift, phone, status.label, readOptionalText(item, ['observations'])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [data, search, statusFilter, roleFilter, shiftFilter]);

  const hasActiveFilters = Boolean(search || statusFilter !== 'ALL' || roleFilter !== 'ALL' || shiftFilter !== 'ALL');

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <MasterDataShell
            title="Equipe Operacional"
            description="Gestão de operadores autorizados para jornadas, apontamentos e abastecimentos"
            actions={
              <button
                onClick={() => {
                  setSelectedItem(null);
                  setIsDrawerOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"
              >
                <Plus size={16} strokeWidth={3} /> Novo Operador
              </button>
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
              <StatCard label="Total de operadores" value={String(summary.total)} helper="Base operacional cadastrada" icon={<Users size={18} />} />
              <StatCard label="Ativos" value={String(summary.activeCount)} helper="Liberados para jornada" icon={<UserCheck size={18} />} />
              <StatCard label="Inativos" value={String(summary.inactiveCount)} helper="Bloqueados ou desligados" icon={<UserX size={18} />} />
              <StatCard label="Motoristas" value={String(summary.drivers)} helper="Perfil de condução" icon={<BadgeInfo size={18} />} />
              <StatCard label="Operadores de máquina" value={String(summary.machineOperators)} helper="Perfil operacional" icon={<Briefcase size={18} />} />
              <StatCard label="Turnos cadastrados" value={String(summary.shifts)} helper={summary.latestUpdate ? `Última atualização: ${formatRelativeDate(summary.latestUpdate)}` : 'Última atualização: não informado'} icon={<CalendarClock size={18} />} />
              <StatCard label="Pendentes" value={String(summary.pendingCount)} helper="Férias ou afastados" icon={<CircleDashed size={18} />} />
            </div>

            <div className="mt-6">
              <MasterDataToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Buscar por nome, matrícula, função ou turno..."
                actions={
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('ALL');
                      setRoleFilter('ALL');
                      setShiftFilter('ALL');
                    }}
                    className="flex items-center gap-2 px-4 py-3 bg-[#1a1f3a] border border-[#2d3647] rounded-2xl text-xs font-bold hover:bg-[#252d4a] transition-all"
                  >
                    <Filter size={16} className="text-primary" /> Limpar filtros
                  </button>
                }
              />

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as OperatorStatusFilter)}
                    className="w-full bg-[#0a0e27]/70 border border-[#2d3647] rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="ALL">Todos</option>
                    <option value="ATIVO">Ativo</option>
                    <option value="INATIVO">Inativo</option>
                    <option value="PENDENTE">Pendente</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Função</span>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as OperatorRoleFilter)}
                    className="w-full bg-[#0a0e27]/70 border border-[#2d3647] rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="ALL">Todas</option>
                    <option value="MOTORISTA">Motorista</option>
                    <option value="OPERADOR_MAQUINA">Operador de máquina</option>
                    <option value="OUTROS">Outros</option>
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Turno</span>
                  <select
                    value={shiftFilter}
                    onChange={(e) => setShiftFilter(e.target.value)}
                    className="w-full bg-[#0a0e27]/70 border border-[#2d3647] rounded-2xl px-4 py-3 text-sm outline-none focus:border-primary/50"
                  >
                    <option value="ALL">Todos os turnos</option>
                    {shiftOptions.map((shift) => (
                      <option key={shift} value={shift}>
                        {shift}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <FilterChip label={`Filtro ativo: ${hasActiveFilters ? 'Sim' : 'Não'}`} active={hasActiveFilters} />
                <FilterChip label={`Base total: ${summary.total}`} active={summary.total > 0} />
                <FilterChip label={`Status pendentes: ${summary.pendingCount}`} active={summary.pendingCount > 0} />
              </div>
            </div>

            <div className="mt-6">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-4">
                  <Loader2 size={40} className="text-primary animate-spin" />
                  <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Carregando equipe...</p>
                </div>
              ) : data.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[340px] border border-dashed border-[#2d3647] rounded-3xl bg-[#0a0e27]/60 px-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4">
                    <User size={28} />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tighter text-white">Nenhum operador cadastrado</h3>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
                    Cadastre operadores para iniciar jornadas, registrar apontamentos, abastecimentos e eventos operacionais.
                  </p>
                  <button
                    onClick={() => {
                      setSelectedItem(null);
                      setIsDrawerOpen(true);
                    }}
                    className="mt-6 flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"
                  >
                    <Plus size={14} strokeWidth={3} /> Novo Operador
                  </button>
                </div>
              ) : filteredData.length === 0 ? (
                <div className="flex flex-col items-center justify-center min-h-[340px] border border-dashed border-[#2d3647] rounded-3xl bg-[#0a0e27]/60 px-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/70 mb-4">
                    <Filter size={28} />
                  </div>
                  <h3 className="text-lg font-black uppercase tracking-tighter text-white">Nenhum operador encontrado com os filtros atuais</h3>
                  <p className="mt-2 max-w-xl text-sm text-muted-foreground leading-relaxed">
                    Ajuste os filtros ou limpe a busca para voltar a visualizar a equipe operacional disponível no tenant.
                  </p>
                  <button
                    onClick={() => {
                      setSearch('');
                      setStatusFilter('ALL');
                      setRoleFilter('ALL');
                      setShiftFilter('ALL');
                    }}
                    className="mt-6 flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"
                  >
                    <Filter size={14} strokeWidth={3} /> Limpar filtros
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredData.map((item) => {
                    const role = resolveOperatorRole(item);
                    const status = resolveOperatorStatus(item);
                    const operational = resolveOperatorOperationalState(item);
                    const name = resolveOperatorName(item);
                    const registration = resolveOperatorRegistration(item);
                    const shift = resolveOperatorShift(item);
                    const phone = resolveOperatorPhone(item);
                    const updateLabel = formatRelativeDate(resolveUpdateDate(item));
                    const lastJourney = resolveLastJourney(item);
                    const lastLink = resolveLastLink(item);
                    const active = status.key === 'ATIVO';

                    return (
                      <article key={item.id} className="group rounded-3xl border border-[#2d3647] bg-[#0a0e27]/70 p-5 shadow-[0_20px_40px_rgba(0,0,0,0.18)] transition-all hover:border-primary/35 hover:shadow-primary/10">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 min-w-0">
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-[#1a1f3a] text-primary shadow-inner shadow-black/20">
                              <User size={28} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground">Equipe</p>
                              <h3 className="truncate text-lg font-black italic tracking-tighter text-white uppercase group-hover:text-primary transition-colors">
                                {name}
                              </h3>
                              <p className="mt-1 truncate text-[11px] font-bold uppercase tracking-widest text-white/70">
                                Matrícula: {registration}
                              </p>
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
                          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]', status.className)}>
                            {status.label}
                          </span>
                          <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]', operational.className)}>
                            {active ? <CheckCircle2 size={12} /> : <CircleDashed size={12} />}
                            {operational.label}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/5 bg-white/[0.03] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white/70">
                            {role.label}
                          </span>
                        </div>

                        <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Função</p>
                            <p className="mt-1 truncate text-xs font-bold text-white">{role.label}</p>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Turno</p>
                            <p className="mt-1 truncate text-xs font-bold text-white">{shift}</p>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Telefone</p>
                            <p className="mt-1 truncate text-xs font-bold text-white">{phone}</p>
                          </div>
                          <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3">
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Última jornada</p>
                            <p className="mt-1 truncate text-xs font-bold text-white">{lastJourney}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-[#2d3647] pt-4">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Último vínculo</p>
                            <p className="mt-1 truncate text-xs font-bold text-white">{lastLink}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Atualização</p>
                            <p className="mt-1 text-xs font-bold text-white">{updateLabel}</p>
                          </div>
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">Observação</p>
                            <p className="mt-1 truncate text-xs font-bold text-white">{readOptionalText(item, ['observations']) || 'Não informada'}</p>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </MasterDataShell>
        </main>
      </div>

      {isDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative w-full max-w-md bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">
                  {selectedItem ? 'Editar Operador' : 'Novo Operador'}
                </h2>
                {selectedItem ? (
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                    Última atualização: {formatRelativeDate(resolveUpdateDate(selectedItem))}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                {selectedItem ? (
                  <button
                    onClick={() => setViewAudit(!viewAudit)}
                    className={cn(
                      'rounded-xl border border-[#2d3647] p-2 transition-all',
                      viewAudit ? 'bg-primary text-[#0a0e27]' : 'text-muted-foreground hover:bg-[#1a1f3a]',
                    )}
                    title="Histórico"
                  >
                    <History size={18} />
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
                  <FormField label="Matrícula" error={errors.registration?.message} required>
                    <input
                      {...register('registration')}
                      className={cn(
                        'w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all font-bold',
                        errors.registration && 'border-red-500/50',
                      )}
                      placeholder="Ex: 1001"
                    />
                  </FormField>

                  <FormField label="Nome completo" error={errors.name?.message} required>
                    <input
                      {...register('name')}
                      className={cn(
                        'w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all',
                        errors.name && 'border-red-500/50',
                      )}
                      placeholder="Ex: João da Silva"
                    />
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Função" error={errors.role?.message} required>
                      <input
                        {...register('role')}
                        className={cn(
                          'w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all',
                          errors.role && 'border-red-500/50',
                        )}
                        placeholder="Ex: Operador"
                      />
                    </FormField>

                    <FormField label="Telefone" error={errors.phone?.message}>
                      <input
                        {...register('phone')}
                        className={cn(
                          'w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all',
                          errors.phone && 'border-red-500/50',
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
                    />
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
                      {selectedItem ? 'Salvar alterações' : 'Criar Operador'}
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
