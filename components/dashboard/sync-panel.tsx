import React from 'react';
import { RefreshCw, CheckCircle2, Cloud, Clock, Wifi, ChevronRight } from 'lucide-react';
import { SYNC_DATA } from '@/lib/mock/dashboard-data';
import { cn } from '@/lib/utils';

export function SyncPanel() {
  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-xl p-4 flex flex-col h-full shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
           <div className="p-1.5 bg-blue-500/10 rounded-lg">
             <RefreshCw size={16} className="text-blue-500" />
           </div>
           <h3 className="font-bold text-sm text-white">Sincronização</h3>
        </div>
        <button className="text-[10px] text-primary hover:text-primary-hover font-bold flex items-center gap-1 transition-colors uppercase">
          Detalhes <ChevronRight size={12} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <SyncCard
          icon={<CheckCircle2 size={16} />}
          label="Eventos Recebidos"
          value={SYNC_DATA.receivedEvents.toLocaleString()}
          trend={SYNC_DATA.receivedTrend}
          color="emerald"
        />
        <SyncCard
          icon={<Cloud size={16} />}
          label="Pendentes"
          value={SYNC_DATA.pendingEvents.toString()}
          trend={SYNC_DATA.pendingTrend}
          color="amber"
        />
      </div>

      <div className="mt-auto space-y-3">
        <div className="bg-[#050812]/50 rounded-xl p-3 border border-[#2d3647]/50">
           <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-2">Histórico 24h</p>
           <div className="flex gap-1 h-3">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className={cn(
                  "flex-1 rounded-sm transition-all hover:scale-y-125",
                  i % 6 === 0 ? "bg-red-500/50" : "bg-primary/50"
                )}></div>
              ))}
           </div>
        </div>

        <div className="pt-3 border-t border-[#2d3647]/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
             <div className="relative">
                <Wifi size={14} className="text-primary" />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full animate-ping opacity-75"></div>
             </div>
             <span className="text-[10px] text-white font-bold tracking-tight">{SYNC_DATA.status}</span>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium">
              <Clock size={10} />
              <span>{SYNC_DATA.lastSync}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SyncCard({ icon, label, value, trend, color }: any) {
  const colors = {
    emerald: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-500 bg-amber-500/10 border-amber-500/20"
  }[color as 'emerald' | 'amber'];

  return (
    <div className="bg-[#1a1f3a]/40 p-3 rounded-xl border border-[#2d3647] hover:border-primary/30 transition-all group">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("p-1.5 rounded-lg", colors)}>
          {icon}
        </div>
        <span className="text-[9px] text-muted-foreground uppercase font-black tracking-tighter truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-black text-white italic">{value}</span>
        <span className={cn("text-[9px] font-bold", color === 'emerald' ? "text-emerald-500" : "text-amber-500")}>
          {trend}
        </span>
      </div>
    </div>
  );
}
