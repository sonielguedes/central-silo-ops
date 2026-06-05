import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusMap: Record<string, { label: string, color: string }> = {
  trabalhando: { label: 'Trabalhando', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  deslocando: { label: 'Deslocando', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  parada: { label: 'Parada', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  alarme: { label: 'Alarme', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  manutencao: { label: 'Manutenção', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  offline: { label: 'Offline', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
  ativo: { label: 'Ativo', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  inativo: { label: 'Inativo', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  ferias: { label: 'Férias', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  produtivo: { label: 'Produtivo', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  em_curso: { label: 'Em Curso', color: 'bg-primary/10 text-primary border-primary/20' },
  finalizada: { label: 'Finalizada', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusMap[status.toLowerCase()] || { label: status, color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' };

  return (
    <span className={cn(
      "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border",
      config.color,
      className
    )}>
      {config.label}
    </span>
  );
}
