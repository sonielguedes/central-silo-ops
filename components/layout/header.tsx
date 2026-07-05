"use client";

import React from 'react';
import { Search, Menu, ChevronDown, Radar, ShieldCheck } from 'lucide-react';
import { useSidebar } from '@/lib/context/sidebar-context';
import { HeaderActions } from './header-actions';
import { DEMO_BADGE_LABEL, IS_DEMO_ENV, IS_PRODUCTION_ENV, getAppVersionLabel } from '@/lib/environment';
import { cn } from '@/lib/utils';

function environmentLabel() {
  if (IS_PRODUCTION_ENV) return 'Produção';
  if (IS_DEMO_ENV) return 'Demo';
  return 'Piloto';
}

function environmentTone() {
  if (IS_PRODUCTION_ENV) return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  if (IS_DEMO_ENV) return 'border-amber-500/20 bg-amber-500/10 text-amber-300';
  return 'border-sky-500/20 bg-sky-500/10 text-sky-300';
}

export function Header() {
  const { toggle } = useSidebar();

  return (
    <header className="z-20 flex h-16 shrink-0 items-center justify-between border-b border-[#2d3647] bg-[#0a0e27]/55 px-5 shadow-[0_12px_30px_rgba(0,0,0,0.18)] backdrop-blur-xl">
      <div className="flex min-w-0 items-center gap-3">
        <button
          onClick={toggle}
          className="rounded-xl border border-white/5 bg-white/[0.03] p-2 text-muted-foreground transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-white lg:hidden"
        >
          <Menu size={20} />
        </button>

        <div className={cn(
          "hidden items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] sm:flex",
          environmentTone(),
        )}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-45" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-current" />
          </span>
          <span>{environmentLabel()}</span>
          <ChevronDown size={13} className="opacity-80" />
        </div>

        <div className="hidden h-4 w-px bg-[#2d3647] sm:block" />

        <span className="hidden items-center gap-1 rounded-full border border-[#2d3647] bg-[#1a1f3a]/60 px-2.5 py-1 font-mono text-[10px] text-muted-foreground sm:inline-flex">
          <Radar size={11} className="text-primary" />
          {getAppVersionLabel()}
        </span>

        {IS_DEMO_ENV && (
          <span className="hidden items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-amber-300 sm:inline-flex">
            <ShieldCheck size={11} />
            {DEMO_BADGE_LABEL}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative group hidden lg:block">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
          <input
            type="text"
            placeholder="Buscar frota, operador, fazenda ou jornada..."
            className="w-80 rounded-full border border-[#2d3647] bg-white/[0.04] py-2 pl-10 pr-10 text-xs text-white placeholder:text-muted-foreground/60 outline-none transition-all focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
          />
          <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1">
            <kbd className="rounded-md border border-[#2d3647] bg-[#0a0e27] px-1.5 py-0.5 font-sans text-[9px] text-muted-foreground">Ctrl</kbd>
            <kbd className="rounded-md border border-[#2d3647] bg-[#0a0e27] px-1.5 py-0.5 font-sans text-[9px] text-muted-foreground">K</kbd>
          </div>
        </div>

        <HeaderActions />
      </div>
    </header>
  );
}
