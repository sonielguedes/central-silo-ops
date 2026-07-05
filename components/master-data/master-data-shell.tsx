import React from 'react';
import { cn } from '@/lib/utils';

interface MasterDataShellProps {
  title: string;
  description: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function MasterDataShell({
  title,
  description,
  actions,
  children,
  className,
}: MasterDataShellProps) {
  return (
    <section className={cn('space-y-6', className)}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="space-y-1">
          <h1 className="text-2xl font-black italic tracking-tighter uppercase text-white">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
            {description}
          </p>
        </div>
        {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}
