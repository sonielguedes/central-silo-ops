"use client";

import React from 'react';
import {
  LayoutDashboard,
  Map as MapIcon,
  Truck,
  Users,
  Factory,
  Play,
  PauseCircle,
  Building2,
  ShieldCheck,
  UserCog,
  Fuel,
  RefreshCw,
  Bell,
  FileText,
  ClipboardList,
  Settings,
  Activity,
  BarChart2,
  History as HistoryIcon,
  Clock,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';
import type { LucideIcon } from 'lucide-react';

interface SidebarProps {
  className?: string;
}

interface MenuItem {
  icon: LucideIcon;
  label: string;
  href: string;
  badge?: string;
}

interface MenuGroup {
  group: string;
  items: MenuItem[];
}

const menuItems: MenuGroup[] = [
  { group: 'Monitoramento', items: [
    { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
    { icon: MapIcon, label: 'Mapa Operacional', href: '/mapa-operacional' },
    { icon: Activity, label: 'Conectividade', href: '/monitoramento/conectividade' },
  ]},
  { group: 'Frota Operacional', items: [
    { icon: Truck, label: 'Equipamentos', href: '/frota' },
    { icon: Settings, label: 'Tipos', href: '/frota/tipos' },
    { icon: FileText, label: 'Modelos', href: '/frota/modelos' },
    { icon: Users, label: 'Grupos', href: '/frota/grupos' },
    { icon: ShieldCheck, label: 'Perfis Config.', href: '/frota/perfis' },
    { icon: FileText, label: 'Checklists', href: '/frota/checklists' },
    { icon: PauseCircle, label: 'Estados Oper.', href: '/frota/estados-operacionais' },
    { icon: Truck, label: 'Implementos', href: '/frota/implementos' },
    { icon: RefreshCw, label: 'Atividades', href: '/frota/historico-atividade' },
  ]},
  { group: 'Mestres / Frota', items: [
    { icon: Users, label: 'Operadores', href: '/operadores' },
    { icon: Factory, label: 'Fazendas / Talhoes', href: '/fazendas-talhoes' },
    { icon: PauseCircle, label: 'Motivos de Parada', href: '/paradas' },
  ]},
  { group: 'Operacional', items: [
    { icon: BarChart2, label: 'Painel Operacional', href: '/operacional/painel' },
    { icon: Play, label: 'Operacoes', href: '/operacoes' },
    { icon: HistoryIcon, label: 'Timeline', href: '/operacoes/timeline' },
    { icon: Fuel, label: 'Abastecimentos', href: '/abastecimentos' },
    { icon: RefreshCw, label: 'Sincronizacao', href: '/sincronizacao' },
    { icon: Bell, label: 'Alertas', href: '/alertas' },
  ]},
  { group: 'Ferramentas', items: [
    { icon: FileText, label: 'Conf. Operacional', href: '/ferramentas/conferencia-operacional' },
    { icon: ClipboardList, label: 'Ficha Operador', href: '/ferramentas/ficha-operador' },
    { icon: RefreshCw, label: 'Integracoes', href: '/ferramentas/integracoes' },
    { icon: Settings, label: 'Ordens de Servico', href: '/ferramentas/ordens-servico' },
  ]},
  { group: 'Administracao', items: [
    { icon: Building2, label: 'Empresas / Tenants', href: '/administracao/empresas' },
    { icon: UserCog, label: 'Usuarios', href: '/administracao/usuarios' },
    { icon: ShieldCheck, label: 'Perfis / RBAC', href: '/administracao/grupos-acesso' },
    { icon: Activity, label: 'Intelligence', href: '/relatorios/intelligence' },
    { icon: FileText, label: 'Relatorios', href: '/relatorios' },
    { icon: Clock, label: 'Tempo Operacional', href: '/relatorios/tempo-operacional' },
    { icon: Gauge, label: 'Eficiencia Operacional', href: '/relatorios/eficiencia-operacional' },
    { icon: Settings, label: 'Configuracoes', href: '/configuracoes' },
  ]}
];

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { canRoute, userRole, isAuthenticated } = useAuth();

  // Filter menu items by role permissions
  const filteredMenu = menuItems
    .map(group => ({
      ...group,
      items: group.items.filter(item => canRoute(item.href)),
    }))
    .filter(group => group.items.length > 0);

  return (
    <aside className={cn("w-64 bg-[#0a0e27] border-r border-[#2d3647] flex flex-col h-screen z-[100]", className)}>
      <div className="p-6">
        <Link href="/dashboard" className="flex items-center gap-2 mb-1 group">
          <h1 className="text-xl font-black tracking-tighter text-white">
            SILO <span className="text-primary italic group-hover:scale-110 transition-transform">OPS</span> <span className="text-white opacity-40 font-normal">Central</span>
          </h1>
        </Link>
        <p className="text-[9px] text-muted-foreground uppercase tracking-widest leading-tight font-black">
          Inteligencia Logistica
        </p>
      </div>

      <nav className="flex-1 px-4 py-2 space-y-6 overflow-y-auto custom-scrollbar pb-10">
        {filteredMenu.map((group) => (
          <div key={group.group}>
            <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3 px-3">
              {group.group}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || (pathname === '/' && item.href === '/dashboard');
                return (
                  <Link key={item.label} href={item.href}>
                    <NavItem
                      icon={<item.icon size={18} />}
                      label={item.label}
                      active={isActive}
                      badge={item.badge}
                    />
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-6 mt-auto border-t border-[#2d3647] bg-[#050812]/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center shadow-lg shadow-primary/10">
             <span className="font-black italic text-white text-lg leading-none">S</span>
          </div>
          <div>
            <p className="text-xs font-black italic tracking-tighter text-white uppercase leading-none">SILO <span className="text-primary">OPS</span></p>
            <p className="text-[8px] text-muted-foreground font-bold mt-1 uppercase">
              {isAuthenticated ? userRole.replace('_', ' ') : 'v0.9-piloto'}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active = false, badge }: { icon: React.ReactNode, label: string, active?: boolean, badge?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 group",
      active
        ? "bg-primary/10 text-primary border border-primary/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
        : "text-muted-foreground hover:bg-[#1a1f3a] hover:text-white"
    )}>
      <span className={cn(active ? "text-primary" : "text-muted-foreground group-hover:text-white transition-colors")}>
        {icon}
      </span>
      <span className="text-[11px] font-bold flex-1 tracking-tight">{label}</span>
      {badge && (
        <span className="px-1.5 py-0.5 bg-red-500 rounded-lg text-[9px] text-white font-black animate-pulse">
          {badge}
        </span>
      )}
    </div>
  );
}
