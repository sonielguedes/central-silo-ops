"use client";

import React from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';

interface CombustivelPageHeaderProps {
  title: string;
  subtitle: string;
  currentPage: string;
  actions?: React.ReactNode;
}

export function CombustivelPageHeader({
  title,
  subtitle,
  currentPage,
  actions,
}: CombustivelPageHeaderProps) {
  return (
    <div className="px-8 pt-6 pb-4 border-b border-[#2d3647]">
      {/* Linha superior: botão voltar + breadcrumb */}
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0d1426] border border-[#2d3647] text-[11px] font-bold text-muted-foreground hover:text-white hover:border-blue-500/40 hover:bg-blue-500/5 transition-all group"
        >
          <ChevronLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
          Painel Central
        </Link>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <LayoutDashboard size={11} className="shrink-0 opacity-50" />
          <Link href="/dashboard" className="hover:text-white transition-colors">Central</Link>
          <ChevronRight size={11} className="opacity-40 shrink-0" />
          <Link href="/combustivel" className="hover:text-white transition-colors">Gestão de Combustível</Link>
          {currentPage !== 'Painel' && (
            <>
              <ChevronRight size={11} className="opacity-40 shrink-0" />
              <span className="text-white/70 font-bold">{currentPage}</span>
            </>
          )}
          {currentPage === 'Painel' && (
            <>
              <ChevronRight size={11} className="opacity-40 shrink-0" />
              <span className="text-white/70 font-bold">Painel</span>
            </>
          )}
        </nav>
      </div>

      {/* Título + ações */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-white">{title}</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
