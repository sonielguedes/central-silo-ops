"use client";

import React from 'react';
import { Search, Menu, ChevronDown } from 'lucide-react';
import { useSidebar } from '@/lib/context/sidebar-context';
import { HeaderActions } from './header-actions';
import { DEMO_BADGE_LABEL, IS_DEMO_ENV, getAppVersionLabel } from '@/lib/environment';

export function Header() {
  const { toggle } = useSidebar();

  return (
    <header className="h-16 border-b border-[#2d3647] bg-[#0a0e27]/40 backdrop-blur-md flex items-center justify-between px-6 shrink-0 z-20">
      <div className="flex items-center gap-4">
        <button
          onClick={toggle}
          className="lg:hidden p-2 hover:bg-[#1a1f3a] rounded-lg text-muted-foreground hover:text-white transition-colors"
        >
          <Menu size={20} />
        </button>

        <div className="flex items-center gap-2 px-3 py-1.5 bg-[#1a1f3a] rounded-md border border-[#2d3647] text-sm cursor-pointer hover:bg-[#252d4a] transition-all group hidden sm:flex">
          <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(16,185,129,0.5)] group-hover:scale-110 transition-transform"></div>
          <span className="text-white font-medium">Produção</span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </div>
        <div className="h-4 w-[1px] bg-[#2d3647] hidden sm:block"></div>
        <span className="text-[10px] text-muted-foreground font-mono bg-[#1a1f3a] px-2 py-0.5 rounded border border-[#2d3647]/50 hidden sm:block">
          {getAppVersionLabel()}
        </span>
        {IS_DEMO_ENV && (
          <span className="hidden sm:inline-flex text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
            {DEMO_BADGE_LABEL}
          </span>
        )}
      </div>

      <div className="flex items-center gap-6">
        <div className="relative group hidden lg:block">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <input
            type="text"
            placeholder="Buscar equipamento, operador, fazenda..."
            className="bg-[#1a1f3a]/50 border border-[#2d3647] rounded-full py-1.5 pl-10 pr-10 text-xs w-80 focus:outline-none focus:border-primary transition-all focus:ring-1 focus:ring-primary/20 text-white placeholder:text-muted-foreground/50"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
             <kbd className="text-[9px] bg-[#0a0e27] border border-[#2d3647] px-1.5 py-0.5 rounded text-muted-foreground font-sans">Ctrl</kbd>
             <kbd className="text-[9px] bg-[#0a0e27] border border-[#2d3647] px-1.5 py-0.5 rounded text-muted-foreground font-sans">K</kbd>
          </div>
        </div>

        <HeaderActions />
      </div>
    </header>
  );
}

