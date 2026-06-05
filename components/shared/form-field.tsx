import React from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle } from 'lucide-react';

interface FormFieldProps {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
  required?: boolean;
}

export function FormField({ label, error, children, className, required }: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5 flex-1", className)}>
      <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1">
        {label}
        {required && <span className="text-primary">*</span>}
      </label>

      <div className="relative">
        {children}
      </div>

      {error && (
        <div className="flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
          <AlertCircle size={10} className="text-red-500" />
          <p className="text-[9px] text-red-500 font-bold uppercase tracking-tight">{error}</p>
        </div>
      )}
    </div>
  );
}
