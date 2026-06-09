"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { XCircle, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export type ActionFeedbackType = 'success' | 'error' | 'warning' | 'info';

export interface ActionFeedbackMessage {
  type: ActionFeedbackType;
  message: string;
}

export function ActionFeedback({
  feedback,
  onDismiss,
}: {
  feedback: ActionFeedbackMessage | null;
  onDismiss?: () => void;
}) {
  if (!feedback) return null;

  const styles: Record<ActionFeedbackType, string> = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    error: 'border-red-500/30 bg-red-500/10 text-red-300',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    info: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  };

  const icons: Record<ActionFeedbackType, React.ReactNode> = {
    success: <CheckCircle2 size={14} />,
    error: <XCircle size={14} />,
    warning: <AlertTriangle size={14} />,
    info: <Info size={14} />,
  };

  return (
    <div className={cn('mb-4 rounded-2xl border px-4 py-3 text-xs font-bold uppercase tracking-wider flex items-start gap-2', styles[feedback.type])}>
      <span className="mt-0.5 shrink-0">{icons[feedback.type]}</span>
      <span className="flex-1">{feedback.message}</span>
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className="text-current/70 hover:text-current">
          <XCircle size={14} />
        </button>
      ) : null}
    </div>
  );
}
