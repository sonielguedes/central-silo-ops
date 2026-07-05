import React from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MasterDataToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  actions?: React.ReactNode;
  className?: string;
}

export function MasterDataToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  actions,
  className,
}: MasterDataToolbarProps) {
  return (
    <div className={cn('flex flex-col lg:flex-row gap-4 items-stretch lg:items-center', className)}>
      <div className="relative flex-1">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-[#0a0e27]/60 border border-[#2d3647] rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-muted-foreground/40 shadow-inner"
        />
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </div>
  );
}
