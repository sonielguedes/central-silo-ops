"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { PageHeader } from '@/components/shared/page-header';
import { CompanyService } from '@/services/master.service';
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
  EyeOff
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

function EmpresasPage() {
  const { accessGroup, checkPermission } = useAuth();
  const [data, setData] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Company | null>(null);
  const [viewAudit, setViewAudit] = useState(false);
  const [visibleCompanyTokens, setVisibleCompanyTokens] = useState<Record<string, boolean>>({});
  const [feedback, setFeedback] = useState<ActionFeedbackMessage | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'regenerate'; item: Company } | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    formState: { errors, isSubmitting }
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
  const generatedApiBaseUrl = normalizedApiPort ? `https://api.siloops.com.br:${normalizedApiPort}` : 'https://api.siloops.com.br:{portaApi}';
  const generatedMqttUrl = normalizedMqttPort ? `mqtt.siloops.com.br:${normalizedMqttPort}` : 'mqtt.siloops.com.br:{portaMqtt}';
  const apiPortConflict = data.some((item) => item.id !== selectedItem?.id && Number(item.apiPort) === normalizedApiPort);
  const mqttPortConflict = data.some((item) => item.id !== selectedItem?.id && Number(item.mqttPort) === normalizedMqttPort);
  const apiPortSuggestion = apiPortConflict ? findNextFreePort(data.map((item) => item.apiPort), normalizedApiPort || API_PORT_START) : suggestedApiPort;
  const mqttPortSuggestion = mqttPortConflict ? findNextFreePort(data.map((item) => item.mqttPort), normalizedMqttPort || MQTT_PORT_START) : suggestedMqttPort;
  const canRegenerateToken = accessGroup?.id === 'ag-admin' || checkPermission('ALL', 'administrar');

  const maskCompanyToken = (token?: string) => {
    if (!token) return 'Token pendente';
    if (token.length <= 8) return '••••••••';
    return `${token.slice(0, 4)}••••••••••••${token.slice(-4)}`;
  };

  const toggleCompanyTokenVisibility = (id: string) => {
    setVisibleCompanyTokens(current => ({ ...current, [id]: !current[id] }));
  };

  const maskedCompanyTokenLabel = (token?: string) => {
    void maskCompanyToken;
    if (!token) return 'Token pendente';
    return 'CTK-••••••••';
  };

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
          portaApi: selectedItem.apiPort || ('' as unknown as number),
          portaMqtt: selectedItem.mqttPort || ('' as unknown as number),
          apiBaseUrl: selectedItem.apiBaseUrl || '',
          mqttUrl: selectedItem.mqttUrl || '',
          companyToken: selectedItem.companyToken || '',
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


  const loadData = async () => {
    setLoading(true);
    // Para Empresas, mostramos todas (Global Admin View)
    const result = await CompanyService.getAllGlobal();
    setData(result);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const item = data.find((current) => current.id === id);
    if (!item) return;
    setConfirmAction({ type: 'delete', item });
  };

  const upsertCompanyInView = (company: Company) => {
    setData(current => {
      const exists = current.some(item => item.id === company.id);
      return exists
        ? current.map(item => item.id === company.id ? company : item)
        : [company, ...current];
    });
  };

  const onSubmit = async (formData: CompanyFormData) => {
    try {
      const payload = companyFormToCompanyPayload(formData);
      const nextApiPort = Number(payload.apiPort);
      const nextMqttPort = Number(payload.mqttPort);
      const duplicateApi = data.some((item) => item.id !== selectedItem?.id && Number(item.apiPort) === nextApiPort);
      const duplicateMqtt = data.some((item) => item.id !== selectedItem?.id && Number(item.mqttPort) === nextMqttPort);
      if (duplicateApi) {
        throw new Error(`Porta API já está em uso por outra empresa. Sugestão: ${findNextFreePort(data.map((item) => item.apiPort), nextApiPort || API_PORT_START)}`);
      }
      if (duplicateMqtt) {
        throw new Error(`Porta MQTT já está em uso por outra empresa. Sugestão: ${findNextFreePort(data.map((item) => item.mqttPort), nextMqttPort || MQTT_PORT_START)}`);
      }
      let saved: Company | undefined;
      if (selectedItem) {
        saved = await CompanyService.update(selectedItem.id, { ...payload, version: selectedItem.version });
      } else {
        saved = await CompanyService.create(payload as Omit<Company, keyof import('@/lib/types').BaseEntity>);
      }
      if (saved) {
        setSelectedItem(saved);
        upsertCompanyInView(saved);
      }
      setIsDrawerOpen(false);
      setFeedback({ type: 'success', message: selectedItem ? 'Instância atualizada com sucesso' : 'Instância criada com sucesso' });
    } catch (error: any) {
      setFeedback({ type: 'error', message: error.message || 'Falha ao salvar instância' });
    }
  };

  const copyCompanyToken = async (token?: string) => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
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
        const updated = await CompanyService.regenerateCompanyToken(confirmAction.item.id);
        if (updated) {
          setSelectedItem(updated);
          upsertCompanyInView(updated);
          setVisibleCompanyTokens(current => ({ ...current, [updated.id]: false }));
        }
        setFeedback({ type: 'success', message: 'Token da empresa regenerado com sucesso' });
      }
      setConfirmAction(null);
    } catch (error: any) {
      setConfirmAction(null);
      setFeedback({ type: 'error', message: error.message || 'Falha na operação' });
    }
  };

  const handleGenerateCompanyToken = async () => {
    if (!selectedItem) return;

    try {
      const formValues = getValues();
      const apiPortValue = Number(formValues.portaApi || selectedItem.apiPort);
      const mqttPortValue = Number(formValues.portaMqtt || selectedItem.mqttPort);

      if (!apiPortValue) {
        setFeedback({ type: 'error', message: 'Porta API obrigatoria para gerar token.' });
        return;
      }

      if (!mqttPortValue) {
        setFeedback({ type: 'error', message: 'Porta MQTT obrigatoria para gerar token.' });
        return;
      }

      const updated = await CompanyService.generateMissingCompanyToken({
        ...selectedItem,
        ...formValues,
        id: selectedItem.id,
        tenantId: selectedItem.tenantId,
        apiPort: apiPortValue,
        mqttPort: mqttPortValue,
        apiBaseUrl: `https://api.siloops.com.br:${apiPortValue}`,
        mqttUrl: mqttPortValue ? `mqtt.siloops.com.br:${mqttPortValue}` : selectedItem.mqttUrl,
        companyToken: selectedItem.companyToken || formValues.companyToken,
      });
      if (updated) {
        setSelectedItem(updated);
        upsertCompanyInView(updated);
        setVisibleCompanyTokens(current => ({ ...current, [updated.id]: false }));
      }
    } catch (error: any) {
      setFeedback({ type: 'error', message: error.message || 'Falha ao gerar token' });
    }
  };

  const filteredData = data.filter(item =>
    item.tradingName.toLowerCase().includes(search.toLowerCase()) ||
    item.cnpj.includes(search)
  );

  const applySuggestedPorts = () => {
    reset({
      ...getValues(),
      portaApi: apiPortSuggestion as unknown as number,
      portaMqtt: mqttPortSuggestion as unknown as number,
    });
  };

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

          <ActionFeedback feedback={feedback} onDismiss={() => setFeedback(null)} />

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
                     <div className="mt-2 flex max-w-full items-center gap-1 rounded-lg border border-[#2d3647] bg-[#050812]/70 px-2 py-1 text-[10px] text-muted-foreground">
                       <KeyRound size={10} className="shrink-0" />
                       <span className="truncate font-mono">
                         {visibleCompanyTokens[item.id] ? item.companyToken : maskedCompanyTokenLabel(item.companyToken)}
                       </span>
                       {item.companyToken && (
                         <>
                           <button type="button" onClick={() => toggleCompanyTokenVisibility(item.id)} className="shrink-0 hover:text-primary">
                             {visibleCompanyTokens[item.id] ? <EyeOff size={10} /> : <Eye size={10} />}
                           </button>
                           <button type="button" onClick={() => copyCompanyToken(item.companyToken)} className="shrink-0 hover:text-primary">
                             <Copy size={10} />
                           </button>
                         </>
                       )}
                     </div>
                     {item.status === 'ATIVO' && !item.companyToken && (
                       <p className="text-[10px] font-black uppercase tracking-tight text-red-300">Token obrigatório para APK</p>
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
          <div className="relative w-full max-w-xl bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
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
                          Sugestão: {suggestedApiPort}
                        </p>
                      )}
                      {apiPortConflict && (
                        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-red-300">
                          Porta API já está em uso por outra empresa. Sugestão: {apiPortSuggestion}
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
                          Sugestão: {suggestedMqttPort}
                        </p>
                      )}
                      {mqttPortConflict && (
                        <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-red-300">
                          Porta MQTT já está em uso por outra empresa. Sugestão: {mqttPortSuggestion}
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
                      Usar próxima porta livre
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
                      <div>
                        <p className="text-[9px] font-black uppercase text-muted-foreground mb-1">Company Token</p>
                        <div className="flex gap-2">
                          <p className="min-w-0 flex-1 break-all rounded-lg bg-[#1a1f3a] px-3 py-2 text-xs font-mono text-white">
                            {selectedItem?.companyToken
                              ? visibleCompanyTokens[selectedItem.id]
                                ? selectedItem.companyToken
                                : maskedCompanyTokenLabel(selectedItem.companyToken)
                              : 'Sera gerado ao salvar'}
                          </p>
                          {selectedItem?.companyToken && (
                            <>
                              <button
                                type="button"
                                onClick={() => toggleCompanyTokenVisibility(selectedItem.id)}
                                className="rounded-lg border border-[#2d3647] px-3 text-muted-foreground hover:border-primary/40 hover:text-primary"
                                title={visibleCompanyTokens[selectedItem.id] ? 'Mascarar token' : 'Exibir token'}
                              >
                                {visibleCompanyTokens[selectedItem.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => copyCompanyToken(selectedItem.companyToken)}
                                className="rounded-lg border border-[#2d3647] px-3 text-muted-foreground hover:border-primary/40 hover:text-primary"
                                title="Copiar token"
                              >
                                <Copy size={14} />
                              </button>
                            </>
                          )}
                        </div>
                        {selectedItem?.status === 'ATIVO' && !selectedItem.companyToken && (
                          <p className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-300">
                            Token obrigatório para APK
                          </p>
                        )}
                        {selectedItem && !selectedItem.companyToken && (
                          <button
                            type="button"
                            onClick={handleGenerateCompanyToken}
                            className="mt-2 flex items-center gap-2 rounded-lg border border-primary/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10"
                          >
                            <KeyRound size={12} /> Gerar token
                          </button>
                        )}
                        {selectedItem?.companyToken && canRegenerateToken && (
                          <button
                            type="button"
                            onClick={handleRegenerateCompanyToken}
                            className="mt-2 flex items-center gap-2 rounded-lg border border-red-500/30 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-red-300 hover:bg-red-500/10"
                          >
                            <RefreshCw size={12} /> Regenerar token ADMIN
                          </button>
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

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.type === 'delete' ? 'Arquivar empresa?' : 'Regenerar token da empresa?'}
        description={confirmAction?.type === 'delete'
          ? `Esta ação ocultará todos os dados vinculados ao tenant ${confirmAction?.item.tradingName}.`
          : 'O APK configurado com o token antigo deixará de autenticar.'}
        confirmLabel={confirmAction?.type === 'delete' ? 'Arquivar' : 'Regenerar'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={executeConfirmAction}
      />
    </div>
  );
}

export default withAuth(EmpresasPage, { module: 'EMPRESAS', action: 'administrar' });
