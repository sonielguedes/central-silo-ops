import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string;
  suffix?: string;
  trend: string;
  trendDown?: boolean;
  color: 'emerald' | 'red' | 'amber' | 'blue';
  icon: LucideIcon;
}

export function KPICard({ title, value, suffix, trend, trendDown = false, color, icon: Icon }: KPICardProps) {
  const colorMap = {
    emerald: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    red: 'text-red-500 bg-red-500/10 border-red-500/20',
    amber: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    blue: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
  };

  const textColor = {
    emerald: 'text-emerald-500',
    red: 'text-red-500',
    amber: 'text-amber-500',
    blue: 'text-blue-500',
  }[color];

  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] p-4 rounded-xl hover:border-primary/40 transition-all group relative overflow-hidden backdrop-blur-sm">
      <div className={cn("absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-30 group-hover:scale-125 transition-all", textColor)}>
        <Icon size={24} />
      </div>

      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-2 font-semibold">{title}</p>

      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-3xl font-black italic tracking-tighter", textColor)}>
          {value}
        </span>
        {suffix && <span className="text-sm text-muted-foreground font-medium">{suffix}</span>}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className={cn(
          "text-[10px] px-2 py-0.5 rounded-full font-bold border",
          trendDown ? colorMap.red : colorMap.emerald
        )}>
          {trend} {trendDown ? '↓' : '↑'}
        </span>

        <div className="w-16 h-8 opacity-40 group-hover:opacity-80 transition-opacity">
           <svg viewBox="0 0 100 40" className="w-full h-full preserve-3d">
             <path
               d={trendDown ? "M0 10 L20 15 L40 12 L60 25 L80 20 L100 35" : "M0 35 L20 30 L40 32 L60 15 L80 18 L100 5"}
               fill="none"
               stroke="currentColor"
               strokeWidth="3"
               strokeLinecap="round"
               strokeLinejoin="round"
               className={trendDown ? "text-red-500" : textColor}
             />
           </svg>
        </div>
      </div>
    </div>
  );
}
