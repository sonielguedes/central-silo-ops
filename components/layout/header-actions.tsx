"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, User, Building2, KeyRound, Settings, LogOut, RefreshCw, X, Eye, EyeOff, AlertTriangle, Info, ChevronDown } from 'lucide-react';
import { useAuth } from '@/lib/context/auth-context';
import { getCsrfTokenFromDocument } from '@/lib/auth/csrf-client';
import { DEMO_BADGE_LABEL, IS_DEMO_ENV } from '@/lib/environment';
import { cn } from '@/lib/utils';

type MenuMode = 'user' | 'notifications' | null;

interface NotificationItem {
  id: string;
  severity: 'CRITICO' | 'ATENCAO' | 'INFORMATIVO';
  title: string;
  description: string;
  createdAt: string;
  readAt?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  status: string;
  fleetCode?: string;
}

interface CompanyData {
  id: string;
  tenantId: string;
  code: string;
  tradingName: string;
  corporateName: string;
  status: string;
  apiPort?: number;
  mqttPort?: number;
  apiBaseUrl?: string;
  mqttUrl?: string;
  domain?: string;
  createdAt?: string;
}

function roleLabel(role?: string) {
  switch (role) {
    case 'SUPER_ADMIN_SILO': return 'Admin Plataforma';
    case 'ADMIN_EMPRESA': return 'Admin Empresa';
    case 'SUPORTE': return 'Suporte';
    case 'GESTOR_COA': return 'Gestor COA';
    case 'GESTOR': return 'Gestor';
    case 'COA': return 'COA';
    case 'CONSULTA': return 'Consulta';
    default: return 'Acesso';
  }
}

function severityMeta(severity: NotificationItem['severity']) {
  switch (severity) {
    case 'CRITICO':
      return { label: 'Crítico', icon: AlertTriangle, tone: 'text-red-400 border-red-500/30 bg-red-500/10' };
    case 'ATENCAO':
      return { label: 'Atenção', icon: AlertTriangle, tone: 'text-amber-400 border-amber-500/30 bg-amber-500/10' };
    default:
      return { label: 'Informativo', icon: Info, tone: 'text-sky-400 border-sky-500/30 bg-sky-500/10' };
  }
}

function formatTime(value?: string | null) {
  if (!value) return 'Sem registro';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatShortAgo(value?: string | null) {
  if (!value) return 'agora';
  const diff = Date.now() - new Date(value).getTime();
  if (diff <= 0) return 'agora';
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  return `${hours}h`;
}

function Surface({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-3xl border border-[#2d3647] bg-[#0a0e27] shadow-2xl shadow-black/40 backdrop-blur-xl', className)}>
      {children}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl">
        <Surface className="overflow-hidden">
          <div className="flex items-start justify-between gap-4 border-b border-[#2d3647] px-6 py-5">
            <div>
              <h3 className="text-lg font-black italic tracking-tighter uppercase text-white">{title}</h3>
              {subtitle && <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-2 text-white hover:border-primary/40">
              <X size={16} />
            </button>
          </div>
          <div className="p-6">{children}</div>
        </Surface>
      </div>
    </div>
  );
}

export function HeaderActions() {
  const router = useRouter();
  const { user, userRole, logout, canRoute } = useAuth();
  const rootRef = useRef<HTMLDivElement>(null);
  const [activeMenu, setActiveMenu] = useState<MenuMode>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [currentCompany, setCurrentCompany] = useState<CompanyData | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [actionError, setActionError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoadingNotifications(true);
    setActionError(null);
    try {
      const res = await fetch('/api/notifications', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar notificações.');
      const data = await res.json().catch(() => null) as { unreadCount?: number; alerts?: NotificationItem[] } | null;
      setNotifications(Array.isArray(data?.alerts) ? data!.alerts : []);
      setUnreadCount(Number(data?.unreadCount || 0));
    } catch (error: any) {
      setActionError(error?.message || 'Falha ao carregar notificações.');
    } finally {
      setLoadingNotifications(false);
    }
  }, [user]);

  const loadCompany = useCallback(async () => {
    if (!user || (userRole !== 'SUPER_ADMIN_SILO' && userRole !== 'ADMIN_EMPRESA')) return;
    setLoadingCompany(true);
    setActionError(null);
    try {
      const res = await fetch('/api/company/current', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) throw new Error('Falha ao carregar dados da empresa.');
      const data = await res.json().catch(() => null) as { company?: CompanyData } | null;
      setCurrentCompany(data?.company || null);
    } catch (error: any) {
      setActionError(error?.message || 'Falha ao carregar dados da empresa.');
    } finally {
      setLoadingCompany(false);
    }
  }, [user, userRole]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (user) {
      void loadNotifications();
    }
  }, [user, loadNotifications]);

  useEffect(() => {
    setNotifications([]);
    setUnreadCount(0);
    setCurrentCompany(null);
    setActiveMenu(null);
    setProfileOpen(false);
    setCompanyOpen(false);
    setPasswordOpen(false);
  }, [user?.id]);

  useEffect(() => {
    if (activeMenu === 'notifications') {
      void loadNotifications();
    }
    if (profileOpen || companyOpen) {
      void loadCompany();
    }
  }, [activeMenu, profileOpen, companyOpen, loadNotifications, loadCompany]);

  const openUserMenu = () => {
    setActiveMenu((current) => (current === 'user' ? null : 'user'));
    setActionError(null);
  };

  const openNotifications = () => {
    setActiveMenu((current) => (current === 'notifications' ? null : 'notifications'));
    setActionError(null);
  };

  const openProfile = () => {
    setActiveMenu(null);
    setProfileOpen(true);
  };

  const openCompany = () => {
    setActiveMenu(null);
    setCompanyOpen(true);
  };

  const openPassword = () => {
    setActiveMenu(null);
    setPasswordOpen(true);
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  const handleLogout = useCallback(async () => {
    setActiveMenu(null);
    setProfileOpen(false);
    setCompanyOpen(false);
    setPasswordOpen(false);
    try {
      await logout();
    } finally {
      window.location.replace('/login');
    }
  }, [logout]);

  const markRead = async (ids?: string[]) => {
    const csrf = getCsrfTokenFromDocument();
    const res = await fetch('/api/notifications/read', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'x-csrf-token': csrf } : {}),
      },
      body: JSON.stringify(ids && ids.length ? { ids } : { all: true }),
    });
    if (!res.ok) {
      throw new Error('Falha ao atualizar notificações.');
    }
    await loadNotifications();
    setActionError(null);
  };

  const safeMarkRead = async (ids?: string[]) => {
    try {
      await markRead(ids);
    } catch (error: any) {
      setActionError(error?.message || 'Falha ao atualizar notificações.');
    }
  };

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (passwordForm.newPassword.length < 8) {
      setPasswordError('A nova senha precisa ter no minimo 8 caracteres.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('A confirmacao da nova senha nao confere.');
      return;
    }

    setSavingPassword(true);
    try {
      const csrf = getCsrfTokenFromDocument();
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'x-csrf-token': csrf } : {}),
        },
        body: JSON.stringify(passwordForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Falha ao alterar a senha.');
      }
      setPasswordSuccess('Senha atualizada com sucesso. As sessoes antigas foram invalidadas.');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      setPasswordError(error?.message || 'Falha ao alterar a senha.');
    } finally {
      setSavingPassword(false);
    }
  };

  const menuOptions = useMemo(() => {
    const items: Array<{ label: string; icon: React.ElementType; action: () => void; tone?: string }> = [
      { label: 'Meu perfil', icon: User, action: openProfile },
    ];

    if (userRole === 'SUPER_ADMIN_SILO' || userRole === 'ADMIN_EMPRESA') {
      items.push({ label: 'Dados da empresa', icon: Building2, action: openCompany });
    }

    items.push({ label: 'Trocar senha', icon: KeyRound, action: openPassword });

    if (canRoute('/configuracoes')) {
      items.push({ label: 'Configurações', icon: Settings, action: () => router.push('/configuracoes') });
    }

    items.push({ label: 'Sair', icon: LogOut, action: handleLogout, tone: 'text-red-400' });
    return items;
  }, [userRole, canRoute, router, handleLogout]);

  const notificationItems = useMemo(() => notifications.filter((item) => item.status !== 'RESOLVIDO').slice(0, 6), [notifications]);

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={openNotifications}
          className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2d3647] bg-white/[0.03] text-muted-foreground transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-white focus:outline-none focus:ring-1 focus:ring-primary/25"
          aria-label="Abrir notificações"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 min-w-4 h-4 px-1 rounded-full border border-[#0a0e27] bg-red-500 text-[9px] flex items-center justify-center font-bold text-white shadow-[0_0_10px_rgba(239,68,68,0.35)]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {activeMenu === 'notifications' && (
          <div className="absolute right-0 top-12 z-50 w-[24rem]">
            <Surface className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#2d3647] px-4 py-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white">Notificações</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{unreadCount} não lidas</p>
                </div>
                <button type="button" onClick={() => void loadNotifications()} className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] p-2 text-muted-foreground hover:text-white">
                  <RefreshCw size={14} className={loadingNotifications ? 'animate-spin' : ''} />
                </button>
              </div>
              <div className="max-h-[28rem] overflow-y-auto">
                {notificationItems.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                    Nenhuma notificação no momento.
                  </div>
                ) : (
                  <div className="space-y-2 p-3">
                    {notificationItems.map((item) => {
                      const meta = severityMeta(item.severity);
                      const Icon = meta.icon;
                      return (
                        <div key={item.id} className="rounded-2xl border border-[#2d3647] bg-[#050812]/80 p-3">
                          <div className="flex items-start gap-3">
                            <div className={cn('mt-0.5 rounded-xl border p-2', meta.tone)}>
                              <Icon size={14} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-white">{meta.label}</p>
                                <span className="text-[9px] uppercase text-muted-foreground">{formatShortAgo(item.createdAt)}</span>
                              </div>
                              <p className="mt-1 text-xs font-bold text-white">{item.title}</p>
                              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{item.description}</p>
                              <div className="mt-3 flex items-center gap-2">
                                {!item.readAt && (
                                  <button
                                    type="button"
                                    onClick={() => void safeMarkRead([item.id])}
                                    className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white hover:border-primary/40"
                                  >
                                    Marcar como lido
                                  </button>
                                )}
                                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Frota {item.fleetCode || '-'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-[#2d3647] px-4 py-3">
                <Link href="/alertas" onClick={() => setActiveMenu(null)} className="text-[10px] font-black uppercase tracking-widest text-primary hover:brightness-110">
                  Ver todos os alertas
                </Link>
                <button
                  type="button"
                  onClick={() => void safeMarkRead()}
                  className="rounded-xl border border-[#2d3647] bg-[#1a1f3a] px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white hover:border-primary/40"
                >
                  Marcar tudo como lido
                </button>
              </div>
            </Surface>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={openUserMenu}
        className="group flex items-center gap-3 rounded-2xl border border-[#2d3647] bg-white/[0.03] px-3 py-2 transition-all hover:border-primary/30 hover:bg-white/[0.06] focus:outline-none focus:ring-1 focus:ring-primary/25"
      >
        <div className="hidden min-w-0 text-right md:block">
          <p className="truncate text-[13px] font-black text-white">{user?.name || 'Carregando...'}</p>
          <p className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{roleLabel(user?.role)}</p>
        </div>
        <ChevronDown size={14} className="hidden text-muted-foreground md:block" />
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#2d3647] bg-gradient-to-tr from-[#1a1f3a] to-[#2d3647] p-0.5 shadow-[0_0_18px_rgba(0,0,0,0.15)]">
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#0a0e27]">
            <User size={18} className="text-muted-foreground transition-colors group-hover:text-white" />
          </div>
        </div>
      </button>

      {activeMenu === 'user' && (
        <div className="absolute right-0 top-14 z-50 w-72">
          <Surface className="overflow-hidden">
            <div className="border-b border-[#2d3647] px-4 py-3">
              <p className="text-sm font-black text-white">{user?.name || 'Usuário'}</p>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{user?.email}</p>
            </div>
            <div className="p-2">
              {menuOptions.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.action}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-bold text-white hover:bg-[#1a1f3a] transition-colors',
                      item.tone || 'text-white',
                    )}
                  >
                    <Icon size={16} className={item.tone || 'text-primary'} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            {IS_DEMO_ENV && (
              <div className="border-t border-[#2d3647] px-4 py-3">
                <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-amber-300">
                  {DEMO_BADGE_LABEL}
                </span>
              </div>
            )}
          </Surface>
        </div>
      )}

      {profileOpen && (
        <Modal title="Meu perfil" subtitle="Somente visualização" onClose={() => setProfileOpen(false)}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome" value={user?.name || '-'} />
            <Field label="E-mail" value={user?.email || '-'} />
            <Field label="Perfil de acesso" value={roleLabel(user?.role)} />
            <Field label="Empresa / Tenant" value={currentCompany?.tradingName || user?.defaultTenantId || '-'} />
            <Field label="Status" value={user ? 'ATIVO' : '-'} />
            <Field label="Último login" value={formatTime(user?.lastLoginAt || null)} />
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={() => setProfileOpen(false)} className="rounded-2xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-[#0a0e27]">
              Fechar
            </button>
          </div>
        </Modal>
      )}

      {companyOpen && (
        <Modal title="Dados da empresa" subtitle="Tenant ativo da sessão" onClose={() => setCompanyOpen(false)}>
          {loadingCompany ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <RefreshCw className="animate-spin" size={18} />
            </div>
          ) : currentCompany ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome da empresa" value={currentCompany.tradingName} />
              <Field label="Código da empresa" value={currentCompany.code} />
              <Field label="Tenant ID" value={currentCompany.tenantId} />
              <Field label="Status" value={currentCompany.status} />
              <Field label="Ambiente" value="Produção" />
              <Field label="URL da Central" value={process.env.NEXT_PUBLIC_CENTRAL_URL || 'https://central.siloops.com.br'} />
              <Field label="Data de ativação" value={formatTime(currentCompany.createdAt || null)} />
              <Field label="Domínio" value={currentCompany.domain || '-'} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Empresa não encontrada para a sessão atual.</p>
          )}
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={() => setCompanyOpen(false)} className="rounded-2xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-[#0a0e27]">
              Fechar
            </button>
          </div>
        </Modal>
      )}

      {passwordOpen && (
        <Modal title="Trocar senha" subtitle="Sua nova senha encerra o ciclo anterior" onClose={() => setPasswordOpen(false)}>
          <form onSubmit={submitPassword} className="space-y-4">
            {passwordError && <Notice tone="error" message={passwordError} />}
            {passwordSuccess && <Notice tone="success" message={passwordSuccess} />}
            <PasswordField
              label="Senha atual"
              value={passwordForm.currentPassword}
              visible={showCurrentPassword}
              onToggle={() => setShowCurrentPassword((value) => !value)}
              onChange={(value) => setPasswordForm((prev) => ({ ...prev, currentPassword: value }))}
            />
            <PasswordField
              label="Nova senha"
              value={passwordForm.newPassword}
              visible={showNewPassword}
              onToggle={() => setShowNewPassword((value) => !value)}
              onChange={(value) => setPasswordForm((prev) => ({ ...prev, newPassword: value }))}
            />
            <PasswordField
              label="Confirmar nova senha"
              value={passwordForm.confirmPassword}
              visible={showConfirmPassword}
              onToggle={() => setShowConfirmPassword((value) => !value)}
              onChange={(value) => setPasswordForm((prev) => ({ ...prev, confirmPassword: value }))}
            />
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setPasswordOpen(false)} className="rounded-2xl border border-[#2d3647] bg-[#1a1f3a] px-4 py-2 text-xs font-black uppercase tracking-widest text-white">
                Cancelar
              </button>
              <button type="submit" disabled={savingPassword} className="rounded-2xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-widest text-[#0a0e27] disabled:opacity-60">
                {savingPassword ? 'Atualizando...' : 'Atualizar senha'}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {actionError && (
        <div className="fixed bottom-6 right-6 z-[400] max-w-sm rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 shadow-2xl">
          {actionError}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#2d3647] bg-[#050812]/80 p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function PasswordField({
  label,
  value,
  visible,
  onToggle,
  onChange,
}: {
  label: string;
  value: string;
  visible: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-2xl border border-[#2d3647] bg-[#050812]/80 px-4 py-3 pr-12 text-sm text-white outline-none focus:border-primary/50"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function Notice({ tone, message }: { tone: 'error' | 'success'; message: string }) {
  return (
    <div className={cn('rounded-2xl border px-4 py-3 text-sm font-medium', tone === 'error' ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200')}>
      {message}
    </div>
  );
}
