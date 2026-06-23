"use client";
/* ─────────────────────────────────────────────────────────────────────────────
 * SILO OPS — Equipment Icon Picker
 * Grid selecionável com busca, preview e dark theme.
 * ────────────────────────────────────────────────────────────────────────── */

import React, { useState, useMemo, memo } from 'react';
import { Search, X } from 'lucide-react';
import {
  EQUIPMENT_ICON_TYPES,
  EQUIPMENT_ICON_LABELS,
  EQUIPMENT_ICON_CATEGORIES,
  type EquipmentIconType,
} from '@/lib/equipment-icon-types';
import { EquipmentIcon } from './equipment-icons';

interface EquipmentIconPickerProps {
  value: EquipmentIconType | string | null | undefined;
  onChange: (type: EquipmentIconType) => void;
  /** Se true, exibe em modo compacto inline (sem modal) */
  compact?: boolean;
}

export const EquipmentIconPicker = memo<EquipmentIconPickerProps>(({
  value,
  onChange,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let items = activeCategory
      ? (EQUIPMENT_ICON_CATEGORIES[activeCategory] || [])
      : [...EQUIPMENT_ICON_TYPES];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter(t =>
        EQUIPMENT_ICON_LABELS[t].toLowerCase().includes(q) ||
        t.toLowerCase().includes(q)
      );
    }
    return items;
  }, [search, activeCategory]);

  const categories = Object.keys(EQUIPMENT_ICON_CATEGORIES).filter(cat => EQUIPMENT_ICON_CATEGORIES[cat].length > 0);

  const currentLabel = value && EQUIPMENT_ICON_LABELS[value as EquipmentIconType]
    ? EQUIPMENT_ICON_LABELS[value as EquipmentIconType]
    : 'Selecionar ícone';

  /* ── Trigger button ────────────────────────────────────────────────────── */
  if (!compact && !isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-3 w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl p-3 text-sm hover:border-primary/50 transition-all"
      >
        <div className="w-8 h-8 rounded-lg bg-[#050812] flex items-center justify-center text-primary border border-[#2d3647]">
          <EquipmentIcon type={value} size={20} />
        </div>
        <span className="text-white font-bold uppercase text-xs tracking-wider flex-1 text-left">
          {currentLabel}
        </span>
        <span className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">Alterar</span>
      </button>
    );
  }

  /* ── Grid panel ────────────────────────────────────────────────────────── */
  const grid = (
    <div className={compact ? '' : 'fixed inset-0 z-[3000] flex items-center justify-center'}>
      {!compact && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
      )}
      <div className={
        compact
          ? 'bg-[#0a0e27] border border-[#2d3647] rounded-2xl p-4 w-full'
          : 'relative w-full max-w-lg bg-[#0a0e27] border border-[#2d3647] rounded-3xl shadow-2xl p-6 max-h-[80vh] flex flex-col animate-in zoom-in-95 duration-200'
      }>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black italic tracking-tighter uppercase text-white">
            Ícone Operacional
          </h3>
          {!compact && (
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 hover:bg-[#1a1f3a] rounded-lg transition-colors text-muted-foreground"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Preview do ícone selecionado */}
        {!compact && value && EQUIPMENT_ICON_LABELS[value as EquipmentIconType] && (
          <div className="flex items-center gap-3 mb-3 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
            <div className="w-10 h-10 rounded-lg bg-[#050812] border border-primary/30 flex items-center justify-center shrink-0">
              <EquipmentIcon type={value} size={26} color="var(--color-primary, #22c55e)" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Selecionado</p>
              <p className="text-xs font-black text-primary">{EQUIPMENT_ICON_LABELS[value as EquipmentIconType]}</p>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tipo..."
            className="w-full bg-[#1a1f3a] border border-[#2d3647] rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:border-primary/50 text-white placeholder:text-muted-foreground/40"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 mb-3 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
              !activeCategory ? 'bg-primary text-[#0a0e27]' : 'bg-[#1a1f3a] text-muted-foreground hover:text-white border border-[#2d3647]'
            }`}
          >
            Todos
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
              className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                activeCategory === cat ? 'bg-primary text-[#0a0e27]' : 'bg-[#1a1f3a] text-muted-foreground hover:text-white border border-[#2d3647]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {filtered.map(iconType => {
              const isSelected = value === iconType;
              return (
                <button
                  key={iconType}
                  type="button"
                  onClick={() => {
                    onChange(iconType);
                    if (!compact) setIsOpen(false);
                  }}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-primary/10 border-primary/60 shadow-lg shadow-primary/10'
                      : 'bg-[#1a1f3a]/30 border-[#2d3647] hover:border-primary/40 hover:bg-[#1a1f3a]/60'
                  }`}
                  title={EQUIPMENT_ICON_LABELS[iconType]}
                >
                  <div className={`text-${isSelected ? 'primary' : 'white/70'}`}>
                    <EquipmentIcon
                      type={iconType}
                      size={28}
                      color={isSelected ? 'var(--color-primary, #22c55e)' : 'currentColor'}
                    />
                  </div>
                  <span className={`text-[7px] font-black uppercase tracking-tighter leading-tight text-center ${
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                  }`}>
                    {EQUIPMENT_ICON_LABELS[iconType]}
                  </span>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="flex flex-col items-center py-8 text-center">
              <Search size={24} className="text-muted-foreground/30 mb-2" />
              <p className="text-[10px] text-muted-foreground font-bold uppercase">Nenhum ícone encontrado</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return grid;
});

EquipmentIconPicker.displayName = 'EquipmentIconPicker';
