import React from 'react';
import { BaseEntity } from '@/lib/mock/master-data';
import { Clock, User, Hash, Info, History } from 'lucide-react';

interface EntityAuditInfoProps {
  entity: BaseEntity;
}

export function EntityAuditInfo({ entity }: EntityAuditInfoProps) {
  return (
    <div className="space-y-6 mt-8 pt-8 border-t border-[#2d3647]">
      <div className="grid grid-cols-2 gap-4">
        <AuditItem icon={<Clock size={12} />} label="Criado em" value={new Date(entity.createdAt).toLocaleString()} />
        <AuditItem icon={<User size={12} />} label="Criado por" value={entity.createdBy} />
        <AuditItem icon={<Clock size={12} />} label="Atualizado em" value={new Date(entity.updatedAt).toLocaleString()} />
        <AuditItem icon={<User size={12} />} label="Atualizado por" value={entity.updatedBy} />
        <AuditItem icon={<Hash size={12} />} label="Versão" value={`v${entity.version}`} />
        <AuditItem icon={<Info size={12} />} label="Status Sistema" value={entity.entityStatus} />
      </div>

      <div className="space-y-3">
        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
          <History size={12} className="text-primary" /> Histórico de Alterações
        </h4>
        <div className="space-y-2">
          {entity.history.slice().reverse().map((entry, idx) => (
            <div key={idx} className="bg-[#1a1f3a]/30 border border-[#2d3647]/50 rounded-lg p-3 text-[10px]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-black text-white italic">{entry.action}</span>
                <span className="text-muted-foreground">{new Date(entry.timestamp).toLocaleString()}</span>
              </div>
              <p className="text-muted-foreground font-bold">Por: {entry.user}</p>
              {entry.changes && Object.keys(entry.changes).length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#2d3647]/30 space-y-1">
                  {Object.entries(entry.changes).map(([key, change]) => (
                    <p key={key} className="truncate">
                      <span className="text-primary/70">{key}:</span>
                      <span className="line-through text-red-500/50 mx-1">{String(change.old)}</span>
                      <span className="text-emerald-500 font-bold">{String(change.new)}</span>
                    </p>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AuditItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[8px] font-black uppercase text-muted-foreground flex items-center gap-1.5">
        {icon} {label}
      </p>
      <p className="text-[10px] font-bold text-white/80">{value}</p>
    </div>
  );
}
