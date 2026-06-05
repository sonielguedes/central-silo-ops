import React from 'react';
import { Factory, ChevronDown, TrendingUp } from 'lucide-react';
import { PRODUCTIVITY_DATA } from '@/lib/mock/dashboard-data';
import { cn } from '@/lib/utils';

export function ProductivityChart() {
  const maxValue = 10000;

  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-xl p-4 flex flex-col h-full shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
           <div className="p-1.5 bg-emerald-500/10 rounded-lg">
             <Factory size={16} className="text-emerald-500" />
           </div>
           <h3 className="font-bold text-sm text-white">Produtividade Diária</h3>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 bg-[#1a1f3a] rounded-lg text-[10px] border border-[#2d3647] text-white font-bold cursor-pointer hover:bg-[#252d4a] transition-colors">
          <span>SOJA</span>
          <ChevronDown size={12} className="text-muted-foreground" />
        </div>
      </div>

      <div className="flex items-end gap-3 mb-6">
        <div className="flex flex-col">
          <span className="text-3xl font-black italic text-white tracking-tighter">
            8.450 <span className="text-xs font-bold not-italic text-muted-foreground ml-1 uppercase">t</span>
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
              <TrendingUp size={10} /> 12% ↑
            </span>
            <span className="text-[9px] text-muted-foreground font-medium">vs ontem (7.540t)</span>
          </div>
        </div>
      </div>

      {/* Simplified Bar Chart */}
      <div className="flex-1 flex items-end justify-between gap-1.5 px-2 pb-2 group/chart">
        {PRODUCTIVITY_DATA.map((item, i) => {
          const height = item.value ? (item.value / maxValue) * 100 : 0;
          const isCurrent = i === 4; // Mocking 16:00 as current

          return (
            <div key={item.time} className="flex-1 flex flex-col items-center gap-2 h-full">
              <div className="flex-1 w-full bg-[#1a1f3a]/30 rounded-t-lg relative overflow-hidden">
                {item.value && (
                  <div
                    className={cn(
                      "absolute bottom-0 w-full rounded-t-lg transition-all duration-1000 ease-out",
                      isCurrent ? "bg-primary shadow-[0_0_15px_rgba(16,185,129,0.4)]" : "bg-primary/40 group-hover/chart:bg-primary/60"
                    )}
                    style={{ height: `${height}%` }}
                  >
                    {isCurrent && (
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-black text-[8px] font-black px-1 rounded shadow-lg">
                        NOW
                      </div>
                    )}
                  </div>
                )}
              </div>
              <span className="text-[8px] text-muted-foreground font-bold tracking-tighter uppercase">{item.time}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
