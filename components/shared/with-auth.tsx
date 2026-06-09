"use client";

import React, { useEffect } from 'react';
import { useAuth } from '@/lib/context/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2, ShieldAlert } from 'lucide-react';
import { MODULE_ALIAS } from '@/lib/auth/rbac-shared';

interface WithAuthOptions {
  /** Module name — accepts uppercase or lowercase (normalized internally) */
  module?: string;
  /** Action — defaults to 'visualizar' */
  action?: string;
}

function normalizeModule(mod: string): string {
  const upper = mod.toUpperCase();
  if (MODULE_ALIAS[upper]) return MODULE_ALIAS[upper];
  return mod.toLowerCase();
}

export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: WithAuthOptions
) {
  return function ProtectedRoute(props: P) {
    const { isAuthenticated, isLoading, checkPermission, userRole } = useAuth();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
      if (!isLoading && !isAuthenticated && pathname !== '/login') {
        router.push('/login');
      }
    }, [isLoading, isAuthenticated, router, pathname]);

    if (isLoading) {
      return (
        <div className="flex h-screen items-center justify-center bg-[#050812]">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      );
    }

    if (!isAuthenticated) return null;

    if (options?.module) {
      const normalizedModule = normalizeModule(options.module);
      const action = options.action || 'visualizar';
      if (!checkPermission(normalizedModule, action)) {
        return (
          <div className="flex h-screen flex-col items-center justify-center bg-[#050812] text-white p-6 text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500 mb-6 border border-red-500/20">
              <ShieldAlert size={40} />
            </div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter mb-2">Acesso Negado</h1>
            <p className="text-muted-foreground text-sm uppercase font-bold tracking-widest max-w-md">
              Seu papel ({userRole.replace('_', ' ')}) nao possui permissao para acessar este modulo.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-8 px-6 py-2 bg-[#1a1f3a] border border-[#2d3647] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#252d4a] transition-all"
            >
              Voltar ao Dashboard
            </button>
          </div>
        );
      }
    }

    return <WrappedComponent {...props} />;
  };
}
