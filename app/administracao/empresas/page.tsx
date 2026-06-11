"use client";

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { CompanyService } from '@/services/master.service';
import type { CompanyCreateResult, CompanyTokenRotateResult } from '@/services/master.service';
import { Company } from '@/lib/mock/master-data';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { companySchema, CompanyFormData } from '@/lib/validations/master-schemas';
import { companyFormToCompanyPayload } from '@/lib/company-form';
import { FormField } from '@/components/shared/form-field';
import { EntityAuditInfo } from '@/components/shared/entity-audit-info';
import { StatusBadge } from '@/components/shared/status-badge';
import { ActionFeedback, type ActionFeedbackMessage } from '@/components/shared/action-feedback';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { useAuth } from '@/lib/context/auth-context';
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
  Globe,
  Radio,
  Server,
  KeyRound,
  Copy,
  RefreshCw,
  Eye,
  EyeOff,
  ShieldAlert,
  CheckCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { withAuth } from '@/components/shared/with-auth';

const API_PORT_START = 3001;
const MQTT_PORT_START = 18831;

function findNextFreePort(usedPorts: Array<number | undefined>, startAt: number) {
  const used = new Set<number>();
  usedPorts.forEach((port) => {
    const candidate = port ?? 0;
    if (Number.isInteger(candidate) && candidate > 0) used.add(candidate);
  });
  let candidate = startAt;
  while (used.has(candidate)) candidate += 1;
  return candidate;
}

// ── Token modal ───────────────────────────────────────────────────────────────

interface TokenModalProps {
  token: string;
  title: string;
  onClose: () => void;
}

function TokenModal({ token, title, onClose }: TokenModalProps) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <div className="relative w-full max-w-lg bg-[#0a0e27] border border-red-500/40 rounded-3xl p-8 shadow-2xl shadow-red-500/10 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
            <ShieldAlert size={20} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tighter text-white">{title}</h3>
            <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">Acao irreversivel</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-2 hover:bg-[#1a1f3a] rounded-xl transition-all text-muted-foreground hover:text-white"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Warning */}
        <div className="mb-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
          <p className="text-[11px] font-bold text-yellow-300 leading-relaxed">
            Salve este token agora. Depois sera exibido apenas parcialmente.
            Nenhuma outra tela mostrara o valor completo.
          </p>
        </div>

        {/* Token display */}
        <div className="mb-5">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Company Token</p>
          <div className="flex gap-2">
            <div className="flex-1 min-w-0 rounded-xl border border-[#2d3647] bg-[#050812] px-3 py-3">
              <p className="break-all font-mono text-xs text-white select-all" data-testid="token-value">
                {visible ? token : `${token.slice(0, 6)}••••••••••••${token.slice(-4)}`}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setVisible((v) => !v)}
                className="rounded-xl border border-[#2d3647] px-3 py-3 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors"
                title={visible ? 'Mascarar token' : 'Exibir token'}
                aria-label={visible ? 'Mascarar token' : 'Exibir token'}
              >
                {visible ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
              <button
                onClick={handleCopy}
                className={cn(
                  "rounded-xl border px-3 py-3 transition-colors",
                  copied
                    ? "border-green-500/40 bg-green-500/10 text-green-400"
                    : "border-[#2d3647] text-muted-foreground hover:border-primary/40 hover:text-primary"
                )}
                title="Copiar token"
                aria-label="Copiar token"
                data-testid="copy-token-btn"
              >
                {copied ? <CheckCheck size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
          {copied && (
            <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-green-400">Copiado!</p>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-primary/20"
          data-testid="close-token-modal"
        >
          Entendi, salvei o token
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

function EmpresasPage() {
  const { accessGroup, checkPermission } = useAuth();
  const [data, setData] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Company | null>(null);
  const [viewAudit, setViewAudit] = useState(false);
  const [feedback, setFeedback] = useState<ActionFeedbackMessage | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'regenerate'; item: Company } | null>(null);

  // Token modal — holds the ONE-TIME full token (provisioning or rotation)
  const [tokenModal, setTokenModal] = useState<{ token: string; title: string } | null>(null);

  // Loading states for async token operations
  const [isRotatingToken, setIsRotatingToken] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CompanyFormData>({
    resolver: zodResolver(companySchema),
    mode: 'onChange',
    reValidateMode: 'onChange',
  });

  const portaApi = watch('portaApi');
  const portaMqtt = watch('portaMqtt');
  const existingPorts = useMemo(() => data.filter((item) => item.status !== 'INATIVO'), [data]);
  const suggestedApiPort = useMemo(
    () => findNextFreePort(existingPorts.map((item) => item.apiPort), API_PORT_START),
    [existingPorts],
  );
  const suggestedMqttPort = useMemo(
    () => findNextFreePort(existingPorts.map((item) => item.mqttPort), MQTT_PORT_START),
    [existingPorts],
  );
  const normalizedApiPort = Number(portaApi || selectedItem?.apiPort || 0);
  const normalizedMqttPort = Number(portaMqtt || selectedItem?.mqttPort || 0);
  const generatedApiBaseUrl = normalizedApiPort
    ? `https://api.siloops.com.br:${normalizedApiPort}`
    : 'https://api.siloops.com.br:{portaApi}';
  const generatedMqttUrl = normalizedMqttPort
    ? `mqtt.siloops.com.br:${normalizedMqttPort}`
    : 'mqtt.siloops.com.br:{portaMqtt}';
  const apiPortConflict = data.some(
    (item) => item.id !== selectedItem?.id && Number(item.apiPort) === normalizedApiPort,
  );
  const mqttPortConflict = data.some(
    (item) => item.id !== selectedItem?.id && Number(item.mqttPort) === normalizedMqttPort,
  );
  const apiPortSuggestion = apiPortConflict
    ? findNextFreePort(data.map((item) => item.apiPort), normalizedApiPort || API_PORT_START)
    : suggestedApiPort;
  const mqttPortSuggestion = mqttPortConflict
    ? findNextFreePort(data.map((item) => item.mqttPort), normalizedMqttPort || MQTT_PORT_START)
    : suggestedMqttPort;
  const canRegenerateToken = accessGroup?.id === 'ag-admin' || checkPermission('ALL', 'administrar');

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await CompanyService.getAllGlobal();
      setData(result);
    } catch (err: any) {
      setLoadError(err?.message || 'Erro ao carregar empresas.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Run once on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (isDrawerOpen) {
      if (selectedItem) {
        reset({
          code: selectedItem.code,
          tradingName: selectedItem.tradingName,
          corporateName: selectedItem.corporateName,
          cnpj: selectedItem.cnpj,
          domain: selectedItem.domain || '',
          portaApi: selectedItem.apiPort || ('' as unknown as number),
          portaMqtt: selectedItem.mqttPort || ('' as unknown as number),
          apiBaseUrl: selectedItem.apiBaseUrl || '',
          mqttUrl: selectedItem.mqttUrl || '',
          companyToken: '',     // never pre-fill with raw token
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
          portaApi: suggestedApiPort as unknown as number,
          portaMqtt: suggestedMqttPort as unknown as number,
          apiBaseUrl: '',
          mqttUrl: '',
          companyToken: '',
          plan: 'PILOTO',
          status: 'ATIVO',
        });
      }
    } else {
      setViewAudit(false);
    }
  }, [selectedItem, reset, isDrawerOpen, suggestedApiPort, suggestedMqttPort]);

  const handleDelete = (id: string) => {
    const item = data.find((current) => current.id === id);
    if (!item) return;
    setConfirmAction({ type: 'delete', item });
  };

  const upsertCompanyInView = (company: Company) => {
    setData((current) => {
      const exists = current.some((item) => item.id === company.id);
      return exists
        ? current.map((item) => (item.id === company.id ? company : item))
        : [company, ...current];
    });
  };

  const onSubmit = async (formData: CompanyFormData) => {
    try {
      const payload = companyFormToCompanyPayload(formData);
      const nextApiPort = Number(payload.apiPort);
      const nextMqttPort = Number(payload.mqttPort);
      const duplicateApi = data.some(
        (item) => item.id !== selectedItem?.id && Number(item.apiPort) === nextApiPort,
      );
      const duplicateMqtt = data.some(
        (item) => item.id !== selectedItem?.id && Number(item.mqttPort) === nextMqttPort,
      );
      if (duplicateApi) {
        throw new Error(
          `Porta API ja esta em uso. Sugestao: ${findNextFreePort(data.map((item) => item.apiPort), nextApiPort || API_PORT_START)}`,
        );
      }
      if (duplicateMqtt) {
        throw new Error(
          `Porta MQTT ja esta em uso. Sugestao: ${findNextFreePort(data.map((item) => item.mqttPort), nextMqttPort || MQTT_PORT_START)}`,
        );
      }

      if (selectedItem) {
        // EDIT — PATCH, never touches token
        const updated = await CompanyService.update(selectedItem.id, {
          ...payload,
          version: selectedItem.version,
        });
        if (updated) {
          setSelectedItem(updated);
          upsertCompanyInView(updated);
        }
        setIsDrawerOpen(false);
        setFeedback({ type: 'success', message: 'Instancia atualizada com sucesso' });
      } else {
        // CREATE — POST, capture provisioningToken
        const result: CompanyCreateResult = await CompanyService.create(
          payload as Omit<Company, keyof import('@/lib/types').BaseEntity>,
        );
        upsertCompanyInView(result.company);
        setIsDrawerOpen(false);
        // Reload list to get fresh tokenPreview from server
        await loadData();
        // Show the one-time token modal
        setTokenModal({
          token: result.provisioningToken,
          title: 'Token de provisionamento gerado',
        });
        setFeedback({ type: 'success', message: 'Instancia criada com sucesso' });
      }
    } catch (error: any) {
      setFeedback({ type: 'error', message: error.message || 'Falha ao salvar instancia' });
    }
  };

  const handleRegenerateCompanyToken = async () => {
    if (!selectedItem || !canRegenerateToken) return;
    setConfirmAction({ type: 'regenerate', item: selectedItem });
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;

    try {
      if (confirmAction.type === 'delete') {
        await CompanyService.archive(confirmAction.item.id);
        await loadData();
        setFeedback({ type: 'success', message: 'Empresa arquivada com sucesso' });
      } else {
        // TOKEN ROTATION — explicit endpoint only
        setIsRotatingToken(true);
        const result: CompanyTokenRotateResult = await CompanyService.regenerateCompanyToken(
          confirmAction.item.id,
        );
        // Update view with refreshed company (tokenPreview only)
        upsertCompanyInView(result.company);
        if (selectedItem?.id === result.company.id) {
          setSelectedItem(result.company);
        }
        await loadData();
        // Show the one-time new token modal
        setTokenModal({
          token: result.newToken,
          title: 'Token regenerado com sucesso',
        });
        setFeedback({ type: 'success', message: 'Token da empresa regenerado com sucesso' });
      }
    } catch (error: any) {
      setFeedback({ type: 'error', message: error.message || 'Falha na operacao' });
    } finally {
      setIsRotatingToken(false);
      setConfirmAction(null);
    }
  };

  const handleGenerateFirstToken = async () => {
    if (!selectedItem) return;
    setConfirmAction({ type: 'regenerate', item: selectedItem });
  };

  const closeTokenModal = () => {
    // Clear full token from state when user explicitly closes the modal
    setTokenModal(null);
  };

  const filteredData = data.filter(
    (item) =>
      item.tradingName.toLowerCase().includes(search.toLowerCase()) ||
      item.cnpj.includes(search),
  );

  const applySuggestedPorts = () => {
    reset({
      ...getValues(),
      portaApi: apiPortSuggestion as unknown as number,
      portaMqtt: mqttPortSuggestion as unknown as number,
    });
  };

  // tokenPreview field on a company (server returns it instead of raw token)
  const getTokenPreview = (item: Company) => (item as any).tokenPreview as string | undefined;

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6">
          <PageHeader
            title="Empresas / Tenants"
            description="Administracao Global de Instancias de Producao"
          >
            <button
              onClick={() => { setSelectedItem(null); setIsDrawerOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform shadow-lg shadow-primary/20"
            >
              <Plus size={16} strokeWidth={3} /> Nova Instancia
            </button>
          </PageHeader>

          <ActionFeedback feedback={feedback} onDismiss={() => setFeedback(null)} />

          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Buscar por nome fantasia, razao social ou CNPJ..."
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
          ) : loadError ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Building2 size={40} className="text-red-400" />
              <p className="text-xs text-red-400 font-black uppercase tracking-[0.2em]">{loadError}</p>
              <button
                onClick={loadData}
                className="px-4 py-2 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-tighter hover:scale-105 transition-transform"
              >
                Tentar novamente
              </button>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
              <Building2 size={40} className="text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">
                {search ? 'Nenhuma empresa encontrada para esta busca.' : 'Nenhuma empresa cadastrada.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredData.map((item) => {
                const preview = getTokenPreview(item);
                return (
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 min-w-0">
                          <Server size={10} className="text-primary shrink-0" />
                          <span className="truncate">{item.apiBaseUrl || 'API nao configurada'}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 min-w-0">
                          <Radio size={10} className="text-primary shrink-0" />
                          <span className="truncate">{item.mqttUrl || 'MQTT nao configurado'}</span>
                        </p>
                      </div>
                      {/* Token preview in card — always masked, no toggle */}
                      <div className="mt-2 flex max-w-full items-center gap-1 rounded-lg border border-[#2d3647] bg-[#050812]/70 px-2 py-1 text-[10px] text-muted-foreground">
                        <KeyRound size={10} className="shrink-0" />
                        <span className="truncate font-mono" data-testid={`token-preview-${item.id}`}>
                          {preview || 'sem token'}
                        </span>
                      </div>
                      {item.status === 'ATIVO' && !preview && (
                        <p className="text-[10px] font-black uppercase tracking-tight text-red-300">Token obrigatorio para APK</p>
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
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* ── Drawer ── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-[2000] flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDrawerOpen(false)} />
          <div className="relative w-full max-w-xl bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">
                  {selectedItem ? 'Editar Instancia' : 'Nova Instancia'}
                </h2>
                {selectedItem && (
                  <p className="text-[10px] text-primary font-bold uppercase">
                    v{selectedItem.version} • {selectedItem.id}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                {selectedItem && (
                  <button
                    onClick={() => setViewAudit(!viewAudit)}
                    className={cn("p-2 rounded-xl border border-[#2d3647]", viewAudit ? "bg-primary text-[#0a0e27]" : "text-muted-foreground")}
                  >
                    <History size={18} />
                  </button>
                )}
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-[#1a1f3a] rounded-xl transition-all">
                  <X size={20} />
                </button>
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

                  <FormField label="Razao Social" error={errors.corporateName?.message} required>
                    <input {...register('corporateName')} className={cn("w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all", errors.corporateName && "border-red-500/50")} placeholder="Ex: Agropecuaria Modelo LTDA" />
                  </FormField>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="CNPJ" error={errors.cnpj?.message} required>
                      <input {...register('cnpj')} className={cn("w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all", errors.cnpj && "border-red-500/50")} placeholder="00.000.000/0000-00" />
                    </FormField>
                    <FormField label="Cod. Interno" error={errors.code?.message} required>
                      <input {...register('code')} className={cn("w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all uppercase font-black italic", errors.code && "border-red-500/50")} placeholder="SC01" />
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Dominio" error={errors.domain?.message}>
                      <input {...register('domain')} className={cn("w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all", errors.domain && "border-red-500/50")} placeholder="empresa.com" />
                    </FormField>
                    <FormField label="Plano de Servico" error={errors.plan?.message} required>
                      <select {...register('plan')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all appearance-none">
                        <option value="PILOTO">PILOTO</option>
                        <option value="PRO">PRO</option>
                        <option value="ENTERPRISE">ENTERPRISE</option>
                      </select>
                    </FormField>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField label="Porta API" error={errors.portaApi?.message} required>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        {...register('portaApi')}
                        className={cn("w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all font-black", errors.portaApi && "border-red-500/50")}
                        placeholder={String(suggestedApiPort)}
                      />
                      {!selectedItem && (
                        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Sugestao: {suggestedApiPort}
                        </p>
                      )}
                      {apiPortConflict && (
                        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-red-300">
                          Porta API ja esta em uso. Sugestao: {apiPortSuggestion}
                        </p>
                      )}
                    </FormField>
                    <FormField label="Porta MQTT" error={errors.portaMqtt?.message} required>
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        {...register('portaMqtt')}
                        className={cn("w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all font-black", errors.portaMqtt && "border-red-500/50")}
                        placeholder={String(suggestedMqttPort)}
                      />
                      {!selectedItem && (
                        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Sugestao: {suggestedMqttPort}
                        </p>
                      )}
                      {mqttPortConflict && (
                        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-red-300">
                          Porta MQTT ja esta em uso. Sugestao: {mqttPortSuggestion}
                        </p>
                      )}
                    </FormField>
                  </div>

                  {!selectedItem && (
                    <button
                      type="button"
                      onClick={applySuggestedPorts}
                      className="w-full flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/15 transition-colors"
                    >
                      Usar proxima porta livre
                    </button>
                  )}

                  <div className="space-y-3 rounded-xl border border-[#2d3647] bg-[#050812]/70 p-4">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                      <Server size={14} /> Endpoints gerados
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">API URL</p>
                        <p className="break-all rounded-lg bg-[#1a1f3a] px-3 py-2 text-xs font-mono text-white">{generatedApiBaseUrl}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">MQTT URL</p>
                        <p className="break-all rounded-lg bg-[#1a1f3a] px-3 py-2 text-xs font-mono text-white">{generatedMqttUrl}</p>
                      </div>
                      {/* Company Token section — behaviour differs for new vs existing */}
                      <div>
                        <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Company Token</p>
                        {selectedItem ? (
                          /* Editing existing company — show tokenPreview only */
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 rounded-lg bg-[#1a1f3a] px-3 py-2">
                              <KeyRound size={12} className="shrink-0 text-primary" />
                              <span className="flex-1 font-mono text-xs text-white truncate" data-testid="drawer-token-preview">
                                {getTokenPreview(selectedItem) || 'sem token'}
                              </span>
                            </div>
                            {getTokenPreview(selectedItem) ? (
                              <p className="text-[10px] font-black uppercase tracking-widest text-green-400 flex items-center gap-1">
                                <CheckCheck size={10} /> Token configurado
                              </p>
                            ) : (
                              <p className="text-[10px] font-black uppercase tracking-widest text-red-300">
                                Token obrigatorio para APK
                              </p>
                            )}
                            {/* Regenerate only when editing, and only by ADMIN */}
                            {canRegenerateToken && (
                              <button
                                type="button"
                                onClick={handleRegenerateCompanyToken}
                                disabled={isRotatingToken}
                                className="flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-300 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed"
                                data-testid="regenerate-token-btn"
                              >
                                {isRotatingToken ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <RefreshCw size={12} />
                                )}
                                Regenerar token ADMIN
                              </button>
                            )}
                            {/* Generate first token if missing */}
                            {!getTokenPreview(selectedItem) && (
                              <button
                                type="button"
                                onClick={handleGenerateFirstToken}
                                disabled={isRotatingToken}
                                className="flex items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 disabled:opacity-50"
                                data-testid="generate-token-btn"
                              >
                                {isRotatingToken ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : (
                                  <KeyRound size={12} />
                                )}
                                Gerar token
                              </button>
                            )}
                          </div>
                        ) : (
                          /* New company — server will generate the token */
                          <div className="rounded-lg bg-[#1a1f3a] px-3 py-2 text-xs font-mono text-muted-foreground italic">
                            Sera gerado pelo servidor ao criar
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <FormField label="Status" error={errors.status?.message} required>
                    <select {...register('status')} className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none transition-all appearance-none">
                      <option value="ATIVO">Ativo</option>
                      <option value="INATIVO">Inativo</option>
                    </select>
                  </FormField>

                  <div className="pt-6 flex gap-3">
                    <button type="button" onClick={() => setIsDrawerOpen(false)} className="flex-1 py-3 bg-transparent border border-[#2d3647] rounded-xl text-xs font-black uppercase tracking-widest hover:bg-[#1a1f3a] transition-all flex items-center justify-center gap-2">
                      <Ban size={14} /> Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-3 bg-primary text-[#0a0e27] rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-transform flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                      data-testid="save-btn"
                    >
                      {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Salvar Instancia
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Token modal (one-time display) ── */}
      {tokenModal && (
        <TokenModal
          token={tokenModal.token}
          title={tokenModal.title}
          onClose={closeTokenModal}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.type === 'delete' ? 'Arquivar empresa?' : 'Regenerar token da empresa?'}
        description={
          confirmAction?.type === 'delete'
            ? `Esta acao ocultara todos os dados vinculados ao tenant ${confirmAction?.item.tradingName}.`
            : 'O APK configurado com o token antigo deixara de autenticar. O novo token sera exibido uma unica vez.'
        }
        confirmLabel={confirmAction?.type === 'delete' ? 'Arquivar' : 'Regenerar'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={executeConfirmAction}
      />
    </div>
  );
}

export default withAuth(EmpresasPage, { module: 'EMPRESAS', action: 'administrar' });
