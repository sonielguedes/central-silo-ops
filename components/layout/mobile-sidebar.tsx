"use client";

import React from 'react';
import { Sidebar } from './sidebar';
import { useSidebar } from '@/lib/context/sidebar-context';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export function MobileSidebar() {
  const { isOpen, close } = useSidebar();

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] lg:hidden transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={close}
      />

      {/* Sidebar Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 w-[280px] bg-[#0a0e27] z-[2001] lg:hidden transition-transform duration-300 transform border-r border-[#2d3647]",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <button
          onClick={close}
          className="absolute right-4 top-6 p-2 text-muted-foreground hover:text-white lg:hidden"
        >
          <X size={20} />
        </button>

        <Sidebar className="w-full border-none h-full" />
      </div>
    </>
  );
}
