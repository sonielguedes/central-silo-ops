"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, KeyRound, ShieldCheck } from 'lucide-react';
import { getCsrfTokenFromDocument } from '@/lib/auth/csrf-client';

/**
 * /trocar-senha — mandatory password change screen.
 *
 * Shown when user.mustChangePassword === true (set by admin when provisioning).
 * On success: calls refreshSession() so in-memory state reflects mustChangePassword=false,
 * then redirects to /dashboard.
 *
 * This page does NOT use withAuth() because withAuth would redirect away from this
 * page (loop) while mustChangePassword=true. Guards are handled manually below.
 */
export default function TrocarSenhaPage() {
  const { user, isAuthenticated, isLoading, refreshSession } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Guard: not authenticated → go to login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Guard: already changed → no need to be here
  useEffect(() => {
    if (!isLoading && isAuthenticated && user && !user.mustChangePassword) {
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('A confirmacao da senha nao confere.');
      return;
    }
    if (newPassword.length < 8) {
      setError('A nova senha deve ter no minimo 8 caracteres.');
      return;
    }

    setSubmitting(true);
    try {
      const csrfToken = getCsrfTokenFromDocument();
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken ? { 'x-csrf-token': csrfToken } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const body = await res.json().catch(() => ({})) as { error?: string; ok?: boolean };

      if (!res.ok) {
        setError(body.error || 'Erro ao alterar a senha.');
        return;
      }

      setSuccess(true);
      // Refresh in-memory session so mustChangePassword becomes false, then go to dashboard.
      await refreshSession();
      router.push('/dashboard');
    } catch {
      setError('Erro de comunicacao. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#050812]">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !user) return null;

  return (
    <div className="flex h-screen items-center justify-center bg-[#050812] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 blur-[200px] rounded-full -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 blur-[150px] rounded-full translate-y-1/3 -translate-x-1/4" />

      <div className="w-full max-w-md p-8 z-10">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-amber-500/10 rounded-[32px] flex items-center justify-center text-amber-400 mx-auto mb-6 border border-amber-500/20 shadow-2xl shadow-amber-500/10">
            <KeyRound size={40} />
          </div>
          <h1 className="text-2xl font-black italic tracking-tighter text-white uppercase">
            Alterar Senha
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.25em] mt-2">
            Defina uma senha segura para continuar
          </p>
          <div className="mt-4 inline-flex text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
            Troca obrigatoria na primeira sessao
          </div>
        </div>

        {success ? (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-8 text-center">
            <ShieldCheck className="text-emerald-400 mx-auto mb-3" size={32} />
            <p className="text-emerald-400 font-black uppercase text-sm tracking-widest">
              Senha alterada com sucesso!
            </p>
            <p className="text-muted-foreground text-xs mt-2">Redirecionando...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Current password */}
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Senha atual (temporaria)"
                className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all text-white placeholder:text-muted-foreground/40"
                autoComplete="current-password"
                maxLength={128}
                spellCheck={false}
                required
                data-testid="current-password"
              />
            </div>

            {/* New password */}
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nova senha (min. 8 caracteres)"
                className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all text-white placeholder:text-muted-foreground/40"
                autoComplete="new-password"
                maxLength={128}
                spellCheck={false}
                required
                data-testid="new-password"
              />
            </div>

            {/* Confirm password */}
            <div className="relative">
              <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirme a nova senha"
                className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all text-white placeholder:text-muted-foreground/40"
                autoComplete="new-password"
                maxLength={128}
                spellCheck={false}
                required
                data-testid="confirm-password"
              />
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold uppercase tracking-tight text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary text-[#0a0e27] py-4 rounded-2xl font-black italic uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
              data-testid="submit-change-password"
            >
              {submitting
                ? <Loader2 className="animate-spin" size={20} />
                : 'Definir Nova Senha'}
            </button>

            <p className="text-center text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
              Logado como {user.name} · {user.email}
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
