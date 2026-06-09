"use client";

import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[4000] flex items-center justify-center px-4">
      <button aria-label="Fechar confirmação" type="button" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-3xl border border-[#2d3647] bg-[#0a0e27] p-6 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 text-amber-300">
            <AlertTriangle size={18} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black uppercase tracking-widest text-white">{title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-[#2d3647] px-4 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-[#1a1f3a]">
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} className="flex-1 rounded-xl bg-primary px-4 py-3 text-xs font-black uppercase tracking-widest text-[#0a0e27]">
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
