"use client";

import React from 'react';
import {
  LayoutDashboard,
  Map as MapIcon,
  Activity,
  Truck,
  Settings,
  FileText,
  Users,
  ShieldCheck,
  ClipboardList,
  PauseCircle,
  Wrench,
  History as HistoryIcon,
  UserCog,
  Factory,
  Building2,
  Play,
  Clock,
  Fuel,
  Droplets,
  Package,
  BarChart2,
  Gauge,
  BookOpen,
  Database,
  Webhook,
  FileDown,
  Clock3,
  ScrollText,
  Settings2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/context/auth-context';
import { canAccessRoute } from '@/lib/auth/rbac-shared';
import { DEMO_BADGE_LABEL, IS_DEMO_ENV } from '@/lib/environment';
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
    { icon: LayoutDashboard, label: 'Dashboard',         href: '/dashboard' },
    { icon: MapIcon,         label: 'Mapa Operacional',  href: '/mapa-operacional' },
    { icon: Activity,        label: 'Conectividade',     href: '/monitoramento/conectividade' },
  ]},
  { group: 'Frota Operacional', items: [
    { icon: Truck,         label: 'Equipamentos',          href: '/frota' },
    { icon: Settings,      label: 'Tipos',                 href: '/frota/tipos' },
    { icon: FileText,      label: 'Modelos',               href: '/frota/modelos' },
    { icon: Users,         label: 'Grupos',                href: '/frota/grupos' },
    { icon: ShieldCheck,   label: 'Perfis Config.',        href: '/frota/perfis' },
    { icon: ClipboardList, label: 'Checklists',            href: '/frota/checklists' },
    { icon: PauseCircle,   label: 'Estados Oper.',         href: '/frota/estados-operacionais' },
    { icon: Wrench,        label: 'Implementos',           href: '/frota/implementos' },
    { icon: HistoryIcon,   label: 'Atividades',            href: '/frota/historico-atividade' },
  ]},
  { group: 'Mestres / Frota', items: [
    { icon: UserCog,     label: 'Operadores',         href: '/operadores' },
    { icon: Factory,     label: 'Fazendas / Talhões', href: '/fazendas-talhoes' },
    { icon: Building2,   label: 'Centros de Custo',   href: '/centros-custo' },
    { icon: PauseCircle, label: 'Motivos de Parada',  href: '/paradas' },
  ]},
  { group: 'Operação', items: [
    { icon: Play,          label: 'Operações',         href: '/operacoes' },
    { icon: ClipboardList, label: 'Ordens de Serviço', href: '/ferramentas/ordens-servico' },
    { icon: FileText,      label: 'Ficha Operador',    href: '/ferramentas/ficha-operador' },
    { icon: Clock,         label: 'Timeline',          href: '/timeline' },
  ]},
  { group: 'Combustível', items: [
    { icon: Fuel,      label: 'Painel',         href: '/combustivel' },
    { icon: Droplets,  label: 'Abastecimentos', href: '/combustivel/abastecimentos' },
    { icon: Truck,     label: 'Comboios',       href: '/combustivel/comboios' },
    { icon: Package,   label: 'Produtos',       href: '/combustivel/produtos' },
    { icon: Droplets,  label: 'Compartimentos', href: '/combustivel/compartimentos' },
    { icon: BarChart2, label: 'Relatórios',     href: '/combustivel/relatorios' },
  ]},
  { group: 'Relatórios', items: [
    { icon: FileText, label: 'Relatórios',             href: '/relatorios' },
    { icon: Gauge,    label: 'Eficiência Operacional', href: '/relatorios/eficiencia-operacional' },
    { icon: Clock,    label: 'Tempo Operacional',      href: '/relatorios/tempo-operacional' },
    { icon: BookOpen, label: 'Auditoria',              href: '/relatorios/auditoria' },
  ]},
  { group: 'Integrações', items: [
    { icon: Database,   label: 'PIMS',               href: '/integracoes/pims' },
    { icon: Webhook,    label: 'TOTVS',              href: '/integracoes/totvs' },
    { icon: FileDown,   label: 'Exportações',        href: '/integracoes/exportacoes' },
    { icon: Clock3,     label: 'Jobs de Integração', href: '/integracoes/jobs' },
    { icon: ScrollText, label: 'Logs de Integração', href: '/integracoes/logs' },
    { icon: Settings2,  label: 'Configurações API',  href: '/integracoes/configuracoes-api' },
  ]},
  { group: 'Administração', items: [
    { icon: Building2,   label: 'Empresas',        href: '/administracao/empresas' },
    { icon: Users,       label: 'Usuários',        href: '/administracao/usuarios' },
    { icon: ShieldCheck, label: 'Grupos de Acesso', href: '/administracao/grupos-acesso' },
    { icon: Settings,    label: 'Configurações',   href: '/configuracoes' },
  ]},
];

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { userRole, isAuthenticated } = useAuth();

  // Filtrar itens por permissão de role
  const filteredMenu = menuItems
    .map(group => ({
      ...group,
      items: group.items.filter(item => canAccessRoute(userRole, item.href)),
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
          Sistema de Inteligência Logística Operacional
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
                  <Link key={item.href} href={item.href}>
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
              {isAuthenticated ? userRole.replace('_', ' ') : 'SILO OPS Central'}
            </p>
            {IS_DEMO_ENV && (
              <span className="mt-2 inline-flex text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                {DEMO_BADGE_LABEL}
              </span>
            )}
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
