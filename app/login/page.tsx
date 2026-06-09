"use client";

import React, { useState } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import { useRouter } from 'next/navigation';
import { Loader2, Lock, Mail, ShieldCheck } from 'lucide-react';
import { DEMO_BADGE_LABEL, IS_DEMO_ENV, getAppVersionLabel } from '@/lib/environment';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Falha na autenticaÃ§Ã£o');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-[#050812] relative overflow-hidden">
      {/* Abstract Background */}
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/5 blur-[200px] rounded-full -translate-y-1/2 translate-x-1/4"></div>
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 blur-[150px] rounded-full translate-y-1/3 -translate-x-1/4"></div>

      <div className="w-full max-w-md p-8 z-10">
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-primary/10 rounded-[32px] flex items-center justify-center text-primary mx-auto mb-6 border border-primary/20 shadow-2xl shadow-primary/10">
            <ShieldCheck size={40} />
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter text-white uppercase">
            SILO <span className="text-primary">OPS</span>
          </h1>
          <p className="text-[10px] text-muted-foreground uppercase font-black tracking-[0.3em] mt-2">
            Sistema de Inteligencia Logistica Operacional
          </p>
          {IS_DEMO_ENV && (
            <div className="mt-4 inline-flex text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
              {DEMO_BADGE_LABEL}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-mail Corporativo"
                className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all text-white placeholder:text-muted-foreground/40"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Senha de Acesso"
                className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all text-white placeholder:text-muted-foreground/40"
                required
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-xs font-bold uppercase tracking-tight text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-[#0a0e27] py-4 rounded-2xl font-black italic uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Entrar no Sistema'}
          </button>

          <div className="flex items-center justify-between text-[10px] font-black uppercase text-muted-foreground px-2">
            <button type="button" className="hover:text-white transition-colors">Esqueci minha senha</button>
            <span className="text-white/10">|</span>
            <button type="button" className="hover:text-white transition-colors">Solicitar acesso</button>
          </div>
        </form>

        <div className="mt-20 text-center">
           <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-widest leading-none">
             Ambiente Seguro & Monitorado
           </p>
           <p className="text-[8px] text-white/20 font-mono mt-2 uppercase">
             {getAppVersionLabel()} â€¢ silo-ops-core
           </p>
        </div>
      </div>
    </div>
  );
}

