"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Smartphone,
  QrCode,
  Copy,
  RefreshCw,
  Ban,
  CheckCircle2,
  CheckCheck,
  Loader2,
  ShieldAlert,
  Server,
  Radio,
  Fingerprint,
  KeyRound,
  Clock,
  Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCsrfTokenFromDocument } from '@/lib/auth/csrf-client';

// ── Tipos ──────────────────────────────────────────────────────────────────

export interface MobileConfigData {
  companyId: string;
  companyName: string;
  companyCode: string;
  tenantId: string;
  apiBaseUrl: string;
  apiPort: number | null;
  mqttUrl: string;
  mqttHost: string;
  mqttPort: number | null;
  protocol: 'HTTPS' | 'HTTP';
  tokenPreview: string;
  hasToken: boolean;
  mobileEnabled: boolean;
  mobileStatus: 'ATIVO' | 'DESATIVADO' | 'SEM_TOKEN';
  lastConnection: string | null;
  companyStatus: 'ATIVO' | 'INATIVO';
}

/** Estrutura EXATA gravada no QR Code lido pelo APK. */
export interface MobileQrPayload {
  type: 'SILO_OPS_MOBILE_CONFIG';
  version: 1;
  companyName: string;
  companyCode: string;
  tenantId: string;
  apiBaseUrl: string;
  mqttHost: string;
  mqttPort: number;
  protocol: 'HTTPS' | 'HTTP';
  companyToken: string;
}

interface MobileConfigModalProps {
  companyId: string;
  /** Apenas administradores podem gerar QR Code / regenerar / desativar. */
  isAdmin: boolean;
  onClose: () => void;
  onFeedback: (type: 'success' | 'error' | 'info', message: string) => void;
  /** Chamado após mudanças que afetam a listagem (rotação de token / toggle mobile). */
  onChanged?: () => void;
}

// ── Helpers de UI ────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null): string {
  if (!iso) return 'Nunca conectado';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-[#2d3647] bg-[#050812]/60 px-3 py-2.5">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1 flex items-center gap-1.5">
        {icon} {label}
      </p>
      <p className={cn('text-xs text-white break-all', mono && 'font-mono')}>{value}</p>
    </div>
  );
}

function MobileStatusPill({ status }: { status: MobileConfigData['mobileStatus'] }) {
  const map = {
    ATIVO: { label: 'Ativo', cls: 'bg-green-500/10 text-green-400 border-green-500/30' },
    DESATIVADO: { label: 'Desativado', cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
    SEM_TOKEN: { label: 'Sem token', cls: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30' },
  } as const;
  const it = map[status];
  return (
    <span className={cn('px-2 py-0.5 rounded text-[9px] font-black uppercase border', it.cls)}>
      {it.label}
    </span>
  );
}

// ── Componente ───────────────────────────────────────────────────────────────

export function MobileConfigModal({ companyId, isAdmin, onClose, onFeedback, onChanged }: MobileConfigModalProps) {
  const [config, setConfig] = useState<MobileConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isGeneratingQr, setIsGeneratingQr] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [newTokenNotice, setNewTokenNotice] = useState<string | null>(null);
  const [confirmRotate, setConfirmRotate] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/mobile`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Falha ao carregar configuração (HTTP ${res.status}).`);
      }
      const data = (await res.json()) as MobileConfigData;
      if (mountedRef.current) setConfig(data);
    } catch (err) {
      if (mountedRef.current) setLoadError((err as Error).message || 'Erro ao carregar configuração mobile.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  /** Busca o token COMPLETO (auditado no servidor). purpose registra a intenção. */
  const fetchFullToken = useCallback(async (purpose: 'qr' | 'copy'): Promise<string | null> => {
    try {
      const res = await fetch(`/api/admin/companies/${companyId}/token?purpose=${purpose}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Falha ao obter token completo.');
      }
      const data = (await res.json()) as { companyToken: string };
      return data.companyToken;
    } catch (err) {
      onFeedback('error', (err as Error).message || 'Erro ao obter token.');
      return null;
    }
  }, [companyId, onFeedback]);

  const buildPayload = useCallback((cfg: MobileConfigData, fullToken: string): MobileQrPayload => ({
    type: 'SILO_OPS_MOBILE_CONFIG',
    version: 1,
    companyName: cfg.companyName,
    companyCode: cfg.companyCode,
    tenantId: cfg.tenantId,
    apiBaseUrl: cfg.apiBaseUrl,
    mqttHost: cfg.mqttHost,
    mqttPort: cfg.mqttPort ?? 0,
    protocol: cfg.protocol,
    companyToken: fullToken,
  }), []);

  const handleGenerateQr = useCallback(async () => {
    if (!config || !isAdmin) return;
    if (!config.hasToken) {
      onFeedback('error', 'Empresa sem token. Gere um token antes de criar o QR Code.');
      return;
    }
    setIsGeneratingQr(true);
    try {
      const fullToken = await fetchFullToken('qr');
      if (!fullToken) return;
      const payload = buildPayload(config, fullToken);
      const json = JSON.stringify(payload);
      const QRCode = (await import('qrcode')).default;
      const url = await QRCode.toDataURL(json, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: { dark: '#0a0e27', light: '#ffffff' },
      });
      if (mountedRef.current) {
        setQrDataUrl(url);
        onFeedback('success', 'QR Code gerado. Aponte a câmera do APK para configurar.');
      }
    } catch (err) {
      onFeedback('error', (err as Error).message || 'Falha ao gerar QR Code.');
    } finally {
      if (mountedRef.current) setIsGeneratingQr(false);
    }
  }, [config, isAdmin, fetchFullToken, buildPayload, onFeedback]);

  const handleCopyConfig = useCallback(async () => {
    if (!config || !isAdmin) return;
    if (!config.hasToken) {
      onFeedback('error', 'Empresa sem token. Gere um token antes de copiar a configuração.');
      return;
    }
    setIsCopying(true);
    try {
      const fullToken = await fetchFullToken('copy');
      if (!fullToken) return;
      const payload = buildPayload(config, fullToken);
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      if (mountedRef.current) {
        setCopied(true);
        setTimeout(() => mountedRef.current && setCopied(false), 2500);
        onFeedback('success', 'Configuração copiada para a área de transferência.');
      }
    } catch (err) {
      onFeedback('error', (err as Error).message || 'Falha ao copiar configuração.');
    } finally {
      if (mountedRef.current) setIsCopying(false);
    }
  }, [config, isAdmin, fetchFullToken, buildPayload, onFeedback]);

  const handleRegenerateToken = useCallback(async () => {
    if (!config || !isAdmin) return;
    setConfirmRotate(false);
    setIsRotating(true);
    try {
      const csrfToken = getCsrfTokenFromDocument();
      const res = await fetch(`/api/admin/companies/${companyId}/token`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}) },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Falha ao regenerar token.');
      }
      const data = (await res.json()) as { newToken: string };
      if (mountedRef.current) {
        setNewTokenNotice(data.newToken);
        setQrDataUrl(null); // QR antigo ficou inválido
        onFeedback('success', 'Token regenerado. O token anterior foi invalidado.');
      }
      await loadConfig();
      onChanged?.();
    } catch (err) {
      onFeedback('error', (err as Error).message || 'Falha ao regenerar token.');
    } finally {
      if (mountedRef.current) setIsRotating(false);
    }
  }, [config, isAdmin, companyId, loadConfig, onChanged, onFeedback]);

  const handleToggleMobile = useCallback(async () => {
    if (!config || !isAdmin) return;
    const action = config.mobileEnabled ? 'disable' : 'enable';
    setIsToggling(true);
    try {
      const csrfToken = getCsrfTokenFromDocument();
      const res = await fetch(`/api/admin/companies/${companyId}/mobile`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}) },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || 'Falha ao atualizar acesso mobile.');
      }
      if (mountedRef.current) {
        if (action === 'disable') setQrDataUrl(null);
        onFeedback('success', action === 'disable' ? 'Acesso mobile desativado.' : 'Acesso mobile reativado.');
      }
      await loadConfig();
      onChanged?.();
    } catch (err) {
      onFeedback('error', (err as Error).message || 'Falha ao atualizar acesso mobile.');
    } finally {
      if (mountedRef.current) setIsToggling(false);
    }
  }, [config, isAdmin, companyId, loadConfig, onChanged, onFeedback]);

  const busy = isGeneratingQr || isCopying || isRotating || isToggling;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div
        className="relative w-full max-w-2xl bg-[#0a0e27] border border-primary/40 rounded-3xl p-8 shadow-2xl shadow-primary/10 animate-in zoom-in-95 duration-200 overflow-y-auto max-h-[92vh]"
        data-testid="mobile-config-modal"
      >
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Smartphone size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tighter text-white">Configuração Mobile</h3>
            <p className="text-[10px] text-primary font-bold uppercase tracking-widest">Provisionamento do APK</p>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="ml-auto p-2 hover:bg-[#1a1f3a] rounded-xl transition-all text-muted-foreground hover:text-white disabled:opacity-40"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="animate-spin" size={28} />
            <p className="text-[10px] font-black uppercase tracking-widest">Carregando configuração…</p>
          </div>
        ) : loadError ? (
          <div className="py-12 text-center">
            <p className="text-xs text-red-400 font-bold">{loadError}</p>
            <button onClick={loadConfig} className="mt-4 text-[10px] font-black uppercase tracking-widest text-primary hover:underline">
              Tentar novamente
            </button>
          </div>
        ) : config ? (
          <>
            {/* Status / última conexão */}
            <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#2d3647] bg-[#050812]/60 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Status Mobile</span>
                <MobileStatusPill status={config.mobileStatus} />
              </div>
              <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Clock size={12} className="text-primary" />
                <span className="font-bold uppercase tracking-widest">Última conexão:</span>
                <span className="text-white">{formatDateTime(config.lastConnection)}</span>
              </div>
            </div>

            {/* Grid de informações */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <InfoRow icon={<Building2 size={10} className="text-primary" />} label="Nome da empresa" value={config.companyName} />
              <InfoRow icon={<Fingerprint size={10} className="text-primary" />} label="Código da empresa" value={config.companyCode} mono />
              <InfoRow icon={<Fingerprint size={10} className="text-primary" />} label="Tenant ID" value={config.tenantId} mono />
              <InfoRow icon={<KeyRound size={10} className="text-primary" />} label="Token Mobile" value={config.tokenPreview} mono />
              <InfoRow icon={<Server size={10} className="text-primary" />} label="API URL" value={config.apiBaseUrl || 'não configurado'} mono />
              <InfoRow
                icon={<Radio size={10} className="text-primary" />}
                label="MQTT URL"
                value={config.mqttPort ? `${config.mqttHost}:${config.mqttPort}` : config.mqttHost}
                mono
              />
            </div>

            {/* Aviso de token regenerado */}
            {newTokenNotice && (
              <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3" data-testid="rotate-notice">
                <p className="text-[11px] font-bold text-red-300 leading-relaxed mb-2 flex items-center gap-1.5">
                  <ShieldAlert size={13} /> Token anterior invalidado. Reconfigure os dispositivos com o novo token (gere um novo QR Code).
                </p>
                <p className="break-all font-mono text-[11px] text-white select-all bg-[#050812] rounded-lg px-3 py-2 border border-[#2d3647]">
                  {newTokenNotice}
                </p>
              </div>
            )}

            {/* QR Code */}
            {qrDataUrl && (
              <div className="mb-5 flex flex-col items-center gap-2 rounded-2xl border border-[#2d3647] bg-white p-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="QR Code de configuração mobile" className="w-56 h-56" data-testid="mobile-qr-image" />
                <p className="text-[10px] font-black uppercase tracking-widest text-[#0a0e27]">Aponte a câmera do APK</p>
              </div>
            )}

            {/* Aviso somente leitura para não-admin */}
            {!isAdmin && (
              <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
                <p className="text-[11px] font-bold text-yellow-300">
                  Somente usuários com permissão administrativa podem gerar QR Code, regenerar token ou desativar o acesso mobile.
                </p>
              </div>
            )}

            {/* Ações */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={handleGenerateQr}
                disabled={!isAdmin || busy || !config.hasToken}
                data-testid="btn-generate-qr"
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-widest text-[#0a0e27] transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isGeneratingQr ? <Loader2 size={15} className="animate-spin" /> : <QrCode size={15} />}
                Gerar QR Code
              </button>

              <button
                onClick={handleCopyConfig}
                disabled={!isAdmin || busy || !config.hasToken}
                data-testid="btn-copy-config"
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-40',
                  copied
                    ? 'border-green-500/40 bg-green-500/10 text-green-400'
                    : 'border-[#2d3647] text-white hover:border-primary/40 hover:text-primary',
                )}
              >
                {isCopying ? <Loader2 size={15} className="animate-spin" /> : copied ? <CheckCheck size={15} /> : <Copy size={15} />}
                {copied ? 'Copiado!' : 'Copiar configuração'}
              </button>

              <button
                onClick={() => setConfirmRotate(true)}
                disabled={!isAdmin || busy}
                data-testid="btn-regenerate-token"
                className="flex items-center justify-center gap-2 rounded-xl border border-[#2d3647] px-4 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:border-yellow-500/40 hover:text-yellow-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isRotating ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                Regenerar token
              </button>

              <button
                onClick={handleToggleMobile}
                disabled={!isAdmin || busy || (!config.hasToken && !config.mobileEnabled)}
                data-testid="btn-toggle-mobile"
                className={cn(
                  'flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black uppercase tracking-widest transition-all disabled:cursor-not-allowed disabled:opacity-40',
                  config.mobileEnabled
                    ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                    : 'border-green-500/30 text-green-400 hover:bg-green-500/10',
                )}
              >
                {isToggling ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : config.mobileEnabled ? (
                  <Ban size={15} />
                ) : (
                  <CheckCircle2 size={15} />
                )}
                {config.mobileEnabled ? 'Desativar mobile' : 'Ativar mobile'}
              </button>
            </div>

            {/* Confirmação inline de rotação */}
            {confirmRotate && (
              <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3">
                <p className="text-[11px] font-bold text-yellow-300 mb-3">
                  Regenerar o token invalidará o token atual. Todos os dispositivos precisarão ler um novo QR Code. Confirmar?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleRegenerateToken}
                    className="flex-1 rounded-lg bg-yellow-500 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-[#0a0e27] hover:opacity-90"
                  >
                    Sim, regenerar
                  </button>
                  <button
                    onClick={() => setConfirmRotate(false)}
                    className="flex-1 rounded-lg border border-[#2d3647] px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground hover:text-white"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
