"use client";

import React, { useState, useEffect } from 'react';
import { Truck, ChevronRight, MoreHorizontal, Play, Navigation, PauseCircle, WifiOff, AlertTriangle, Tractor, Zap, HardHat, Loader2, Radio } from 'lucide-react';
import { EquipmentService, TelemetryService, EquipmentTypeService } from '@/services/master.service';
import { Equipment, TelemetryData, EquipmentType } from '@/lib/types';
import { cn } from '@/lib/utils';

export function EquipmentTable() {
  const [data, setData] = useState<{equipment: Equipment, telemetry?: TelemetryData, type?: EquipmentType}[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const [eqs, types] = await Promise.all([
        EquipmentService.getAll(),
        EquipmentTypeService.getAll()
      ]);

      const items = await Promise.all(eqs.map(async (eq) => {
        const tel = await TelemetryService.getLatestByEquipment(eq.id);
        const type = types.find(t => t.id === eq.typeId);
        return { equipment: eq, telemetry: tel, type };
      }));

      setData(items);
      setLoading(false);
    }
    loadData();
  }, []);

  return (
    <div className="bg-[#0a0e27]/60 border border-[#2d3647] rounded-xl flex flex-col overflow-hidden h-full shadow-lg backdrop-blur-sm">
      <div className="p-4 border-b border-[#2d3647] flex items-center justify-between bg-[#1a1f3a]/20">
        <div className="flex items-center gap-2">
           <Truck size={16} className="text-primary" />
           <h3 className="font-bold text-sm text-white uppercase tracking-tighter">Frota Ativa</h3>
        </div>
        <button className="text-[10px] text-primary hover:text-primary-hover font-bold flex items-center gap-1 transition-colors uppercase tracking-tighter">
          Ver todos <ChevronRight size={12} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin text-primary" size={24} /></div>
        ) : (
          <table className="w-full text-left">
            <thead className="text-[10px] uppercase text-muted-foreground bg-[#050812]/50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 font-bold tracking-wider">Equipamento</th>
                <th className="px-4 py-3 font-bold tracking-wider">Conexão</th>
                <th className="px-4 py-3 font-bold tracking-wider">Status</th>
                <th className="px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-[#2d3647]/50">
              {data.map(({ equipment: item, telemetry, type }) => {
                const isOnline = telemetry?.isOnline ?? false;

                return (
                  <tr key={item.id} className="hover:bg-primary/5 transition-colors group cursor-pointer">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "p-2 rounded-lg bg-[#1a1f3a] border border-[#2d3647] group-hover:border-primary/50 transition-colors",
                          !isOnline && "opacity-50"
                        )}>
                          {type?.icon === 'Tractor' ? <Tractor size={16} className="text-primary" /> :
                           type?.icon === 'Truck' ? <Truck size={16} className="text-primary" /> : <Zap size={16} className="text-primary" />}
                        </div>
                        <div>
                          <p className="font-bold text-white tracking-tight uppercase">{item.code}</p>
                          <p className="text-[9px] text-muted-foreground font-medium uppercase">{type?.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                         <div className="flex items-center gap-1.5">
                            <div className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-red-500")}></div>
                            <span className={cn("text-[10px] font-black uppercase tracking-tighter", isOnline ? "text-emerald-500" : "text-red-500")}>
                               {isOnline ? 'Online' : 'Offline'}
                            </span>
                         </div>
                         <span className="text-[8px] text-muted-foreground font-bold flex items-center gap-1"><Radio size={8} /> {item.lastSignal}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-2 py-4">
                      <button className="p-1 text-muted-foreground hover:text-white transition-colors">
                        <MoreHorizontal size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { color: string, icon: any }> = {
    'trabalhando': { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: Play },
    'deslocando': { color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', icon: Navigation },
    'parada': { color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', icon: PauseCircle },
    'alarme': { color: 'text-red-400 bg-red-400/10 border-red-400/20', icon: AlertTriangle },
    'manutencao': { color: 'text-purple-400 bg-purple-400/10 border-purple-400/20', icon: HardHat },
    'offline': { color: 'text-gray-400 bg-gray-400/10 border-gray-400/20', icon: WifiOff },
  };

  const config = configs[status.toLowerCase()] || configs['offline'];
  const Icon = config.icon;

  return (
    <span className={cn(
      "px-2.5 py-1 rounded-full text-[9px] font-black border flex items-center gap-1.5 w-fit uppercase",
      config.color
    )}>
      <Icon size={10} className={status.toLowerCase() === 'deslocando' ? 'rotate-45' : ''} />
      {status}
    </span>
  );
}
