"use client";

import React, { useState, useEffect } from 'react';
import { ChecklistModel, ChecklistExecution, Equipment, Operator, ChecklistAnswer } from '@/lib/types';
import { ChecklistModelService, ChecklistExecutionService } from '@/services/master.service';
import { X, Loader2, Save, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChecklistExecutionDrawerProps {
  equipment: Equipment;
  operator: Operator;
  onClose: () => void;
  onSuccess: (execution: ChecklistExecution) => void;
}

export function ChecklistExecutionDrawer({ equipment, operator, onClose, onSuccess }: ChecklistExecutionDrawerProps) {
  const [model, setModel] = useState<ChecklistModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<Record<string, ChecklistAnswer>>({});

  useEffect(() => {
    async function loadModel() {
      const models = await ChecklistModelService.getAll();
      const match = models.find(m => m.equipmentTypeId === equipment.typeId && m.isActive);
      if (match) {
        setModel(match);
        const initialAnswers: Record<string, ChecklistAnswer> = {};
        match.questions.forEach(q => {
          initialAnswers[q.id] = { questionId: q.id, value: q.type === 'YES_NO' ? false : '', isOk: false };
        });
        setAnswers(initialAnswers);
      }
      setLoading(false);
    }
    loadModel();
  }, [equipment.typeId]);

  const handleAnswerChange = (qId: string, value: any, isOk: boolean) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: { ...prev[qId], value, isOk }
    }));
  };

  const handleSave = async () => {
    if (!model) return;
    setSaving(true);
    try {
      const execution = await ChecklistExecutionService.create({
        modelId: model.id,
        equipmentId: equipment.id,
        operatorId: operator.id,
        timestamp: new Date().toISOString(),
        answers: Object.values(answers),
        status: 'CONCLUIDO', // Will be overridden by service if critical fails
      });
      onSuccess(execution);
    } catch (error: any) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-xl bg-[#0a0e27] border-l border-[#2d3647] shadow-2xl p-8 flex flex-col h-full animate-in slide-in-from-right duration-300">
        <div className="flex items-center justify-between mb-8">
          <div>
             <h2 className="text-xl font-black italic tracking-tighter uppercase text-white">Inspeção Técnica</h2>
             <p className="text-[10px] text-primary font-bold uppercase tracking-widest mt-1">{equipment.code} • {operator.name}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-[#1a1f3a] rounded-xl text-white transition-all"><X size={24} /></button>
        </div>

        {loading ? (
           <div className="flex flex-col items-center justify-center flex-1 gap-4"><Loader2 size={40} className="text-primary animate-spin" /><p className="text-xs text-muted-foreground font-black uppercase tracking-[0.2em]">Carregando Formulário...</p></div>
        ) : !model ? (
           <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
              <AlertTriangle size={48} className="text-amber-500 opacity-50" />
              <p className="text-xs font-black uppercase text-white">Nenhum checklist configurado</p>
              <p className="text-[10px] text-muted-foreground uppercase">Para este tipo de equipamento ({equipment.typeId})</p>
           </div>
        ) : (
           <div className="flex-1 flex flex-col overflow-hidden">
              <div className="bg-[#1a1f3a]/40 border border-[#2d3647] p-4 rounded-2xl mb-6 flex items-center gap-3">
                 <Info size={16} className="text-primary" />
                 <p className="text-[10px] text-white/70 font-medium leading-none uppercase">{model.name}</p>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
                 {model.questions.map(q => (
                    <div key={q.id} className="bg-[#1a1f3a]/20 border border-[#2d3647] p-6 rounded-3xl group hover:border-primary/30 transition-all">
                       <div className="flex items-start justify-between gap-4 mb-4">
                          <h4 className="text-sm font-bold text-white leading-tight uppercase">{q.text} {q.isCritical && <span className="text-red-500 ml-1">*</span>}</h4>
                          {q.isCritical && <div className="p-1 bg-red-500/10 text-red-500 rounded"><AlertTriangle size={12} /></div>}
                       </div>

                       {q.type === 'YES_NO' && (
                          <div className="flex gap-2">
                             <button
                                onClick={() => handleAnswerChange(q.id, true, true)}
                                className={cn(
                                  "flex-1 py-3 rounded-xl border font-black text-[10px] uppercase transition-all",
                                  answers[q.id]?.value === true ? "bg-emerald-500 border-emerald-500 text-[#0a0e27]" : "bg-[#1a1f3a] border-[#2d3647] text-white/40 hover:border-emerald-500/50"
                                )}
                             >Conforme</button>
                             <button
                                onClick={() => handleAnswerChange(q.id, false, false)}
                                className={cn(
                                  "flex-1 py-3 rounded-xl border font-black text-[10px] uppercase transition-all",
                                  answers[q.id]?.value === false ? "bg-red-500 border-red-500 text-[#0a0e27]" : "bg-[#1a1f3a] border-[#2d3647] text-white/40 hover:border-red-500/50"
                                )}
                             >Não Conforme</button>
                          </div>
                       )}

                       {q.type === 'NUMERIC' && (
                          <input
                            type="number"
                            className="w-full bg-[#0a0e27] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none"
                            placeholder="Insira o valor medido..."
                            onChange={(e) => handleAnswerChange(q.id, e.target.value, true)}
                          />
                       )}

                       {q.type === 'TEXT' && (
                          <textarea
                            className="w-full bg-[#0a0e27] border border-[#2d3647] rounded-xl p-3 text-sm focus:border-primary outline-none resize-none"
                            rows={3}
                            placeholder="Observações..."
                            onChange={(e) => handleAnswerChange(q.id, e.target.value, true)}
                          />
                       )}
                    </div>
                 ))}
              </div>

              <div className="pt-8 border-t border-[#2d3647] flex gap-4">
                 <button onClick={onClose} className="flex-1 py-4 bg-transparent border border-[#2d3647] rounded-2xl text-xs font-black uppercase hover:bg-[#1a1f3a] text-white">Cancelar</button>
                 <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-4 bg-primary text-[#0a0e27] rounded-2xl text-xs font-black uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-all flex items-center justify-center gap-2"
                 >
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} Finalizar Inspeção
                 </button>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}
