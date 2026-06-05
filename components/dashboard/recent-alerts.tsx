import React from 'react';
import { Bell, MoreVertical, AlertCircle, AlertTriangle, Info, Clock, ChevronRight } from 'lucide-react';
import { ALERTS_DATA } from '@/lib/mock/dashboard-data';
import { cn } from '@/lib/utils';

export function RecentAlerts() {
  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-xl p-4 flex flex-col h-full shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
           <div className="p-1.5 bg-red-500/10 rounded-lg">
             <Bell size={16} className="text-red-500" />
           </div>
           <h3 className="font-bold text-sm text-white">Alertas Recentes</h3>
        </div>
        <button className="text-[10px] text-primary hover:text-primary-hover font-bold flex items-center gap-1 transition-colors uppercase">
          Ver todos <ChevronRight size={12} />
        </button>
      </div>

      <div className="space-y-3 flex-1">
        {ALERTS_DATA.map((alert) => (
          <div key={alert.id} className="flex items-start gap-4 p-3 hover:bg-[#1a1f3a]/40 rounded-xl transition-all group cursor-pointer border border-transparent hover:border-[#2d3647]">
            <div className={cn(
              "p-2.5 rounded-lg bg-opacity-10 mt-0.5 shadow-sm group-hover:scale-110 transition-transform",
              alert.severity === 'error' ? "bg-red-500 text-red-500" :
              alert.severity === 'warning' ? "bg-amber-500 text-amber-500" :
              "bg-blue-500 text-blue-500"
            )}>
              {alert.severity === 'error' ? <AlertCircle size={16} /> :
               alert.severity === 'warning' ? <AlertTriangle size={16} /> :
               <Info size={16} />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-white truncate pr-2 tracking-tight group-hover:text-primary transition-colors">
                  {alert.title}
                </p>
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground whitespace-nowrap bg-[#050812] px-1.5 py-0.5 rounded">
                  <Clock size={10} />
                  {alert.time}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground font-medium mb-1.5">{alert.equipment} • {alert.location}</p>
              <span className={cn(
                "text-[9px] font-black uppercase tracking-widest",
                alert.severity === 'error' ? "text-red-500" :
                alert.severity === 'warning' ? "text-amber-500" :
                "text-blue-500"
              )}>
                {alert.type}
              </span>
            </div>

            <button className="p-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
