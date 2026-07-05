import React from 'react';
import { cn } from '@/lib/utils';

interface MasterDataStatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_STYLES: Record<string, { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  inativo: { label: 'Inativo', className: 'bg-red-500/10 text-red-400 border-red-500/20' },
  férias: { label: 'Férias', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  ferias: { label: 'Férias', className: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  afastado: { label: 'Afastado', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  concluido: { label: 'Concluído', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  concluída: { label: 'Concluída', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  em_andamento: { label: 'Em andamento', className: 'bg-primary/10 text-primary border-primary/20' },
  pendente: { label: 'Pendente', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  offline: { label: 'Offline', className: 'bg-slate-500/10 text-slate-300 border-slate-500/20' },
};

function normalizeKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_');
}

export function MasterDataStatusBadge({ status, className }: MasterDataStatusBadgeProps) {
  const key = normalizeKey(status);
  const config = STATUS_STYLES[key] ?? {
    label: status,
    className: 'bg-slate-500/10 text-slate-300 border-slate-500/20',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
