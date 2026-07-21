"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
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
import { useAuth } from '@/lib/context/auth-context';
import { canAccessRoute } from '@/lib/auth/rbac-shared';
import { DEMO_BADGE_LABEL, IS_DEMO_ENV } from '@/lib/environment';
import { translateUiLabel } from '@/lib/ui/labels';

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
    { icon: LayoutDashboard, label: translateUiLabel('Dashboard'), href: '/dashboard' },
    { icon: Activity, label: 'Sala Operacional', href: '/tv' },
    { icon: MapIcon, label: 'Mapa Operacional', href: '/mapa-operacional' },
    { icon: Activity, label: 'Conectividade', href: '/monitoramento/conectividade' },
  ]},
  { group: 'Frota Operacional', items: [
    { icon: Truck, label: 'Equipamentos', href: '/frota' },
    { icon: Settings, label: 'Tipos', href: '/frota/tipos' },
    { icon: FileText, label: 'Modelos', href: '/frota/modelos' },
    { icon: Users, label: 'Grupos', href: '/frota/grupos' },
    { icon: ShieldCheck, label: 'Perfis Config.', href: '/frota/perfis' },
    { icon: ClipboardList, label: 'Checklists', href: '/frota/checklists' },
    { icon: PauseCircle, label: 'Estados Oper.', href: '/frota/estados-operacionais' },
    { icon: Wrench, label: 'Implementos', href: '/frota/implementos' },
    { icon: HistoryIcon, label: 'Atividades', href: '/frota/historico-atividade' },
  ]},
  { group: 'Mestres / Frota', items: [
    { icon: UserCog, label: 'Operadores', href: '/operadores' },
    { icon: Factory, label: 'Fazendas / Talhões', href: '/fazendas-talhoes' },
    { icon: Building2, label: 'Centros de Custo', href: '/centros-custo' },
    { icon: PauseCircle, label: 'Motivos de Parada', href: '/paradas' },
  ]},
  { group: 'Operação', items: [
    { icon: Play, label: 'Operações', href: '/operacoes' },
    { icon: ClipboardList, label: 'Ordens de Serviço', href: '/ferramentas/ordens-servico' },
    { icon: FileText, label: 'Ficha Operador', href: '/ferramentas/ficha-operador' },
    { icon: Clock, label: 'Timeline', href: '/timeline' },
  ]},
  { group: 'Combustível', items: [
    { icon: Fuel, label: 'Painel', href: '/combustivel' },
    { icon: Droplets, label: 'Abastecimentos', href: '/combustivel/abastecimentos' },
    { icon: Clock3, label: 'Jornadas', href: '/combustivel/jornadas' },
    { icon: Truck, label: 'Comboios', href: '/combustivel/comboios' },
    { icon: Package, label: 'Produtos', href: '/combustivel/produtos' },
    { icon: Droplets, label: 'Compartimentos', href: '/combustivel/compartimentos' },
    { icon: BarChart2, label: 'Relatórios', href: '/combustivel/relatorios' },
  ]},
  { group: 'Relatórios', items: [
    { icon: FileText, label: 'Relatórios', href: '/relatorios' },
    { icon: Gauge, label: 'Eficiência Operacional', href: '/relatorios/eficiencia-operacional' },
    { icon: Clock, label: 'Tempo Operacional', href: '/relatorios/tempo-operacional' },
    { icon: BookOpen, label: 'Auditoria', href: '/relatorios/auditoria' },
  ]},
  { group: 'Integrações', items: [
    { icon: Database, label: 'PIMS', href: '/integracoes/pims' },
    { icon: Webhook, label: 'TOTVS', href: '/integracoes/totvs' },
    { icon: FileDown, label: 'Exportações', href: '/integracoes/exportacoes' },
    { icon: Clock3, label: 'Jobs de Integração', href: '/integracoes/jobs' },
    { icon: ScrollText, label: 'Logs de Integração', href: '/integracoes/logs' },
    { icon: Settings2, label: 'Configurações da API', href: '/integracoes/configuracoes-api' },
  ]},
  { group: 'Administração', items: [
    { icon: Building2, label: 'Empresas', href: '/administracao/empresas' },
    { icon: Users, label: 'Usuários', href: '/administracao/usuarios' },
    { icon: ShieldCheck, label: 'Grupos de Acesso', href: '/administracao/grupos-acesso' },
    { icon: Settings, label: 'Configurações', href: '/configuracoes' },
  ]},
];

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { userRole, isAuthenticated } = useAuth();

  const filteredMenu = menuItems
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessRoute(userRole, item.href)),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside className={cn("w-64 bg-[#0a0e27] border-r border-[#2d3647] flex flex-col h-screen z-[100] overflow-hidden", className)}>
      <div className="border-b border-[#2d3647]/70 bg-white/[0.02] px-5 pb-4 pt-5">
        <Link href="/dashboard" className="group flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/20 to-white/5 text-primary shadow-[0_0_20px_rgba(16,185,129,0.12)]">
            <span className="text-lg font-black italic leading-none">S</span>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[16px] font-black tracking-tighter text-white">
              SILO <span className="text-primary italic group-hover:tracking-tight transition-all">OPS</span>{' '}
              <span className="font-normal text-white/40">Central</span>
            </h1>
            <p className="mt-1 text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">
              Sistema de Inteligência Logística Operacional
            </p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 min-h-0 space-y-5 overflow-y-auto px-4 py-3 custom-scrollbar pb-8">
        {filteredMenu.map((group) => (
          <section key={group.group} className="space-y-2">
            <div className="px-3">
              <h3 className="text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground/80">
                {group.group}
              </h3>
              <div className="mt-2 h-px bg-gradient-to-r from-primary/20 via-white/10 to-transparent" />
            </div>

            <div className="space-y-1.5">
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
          </section>
        ))}
      </nav>

      <div className="mt-auto border-t border-[#2d3647] bg-[#050812]/70 p-4">
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-3 shadow-[0_12px_30px_rgba(0,0,0,0.24)]">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-primary/20">
              <span className="text-base font-black italic leading-none">S</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-black uppercase tracking-tighter text-white">
                {isAuthenticated ? userRole.replace('_', ' ') : 'SILO OPS Central'}
              </p>
              <p className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                Ambiente operacional
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                  Sync online
                </span>
                {IS_DEMO_ENV && (
                  <span className="inline-flex rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-widest text-amber-300">
                    {DEMO_BADGE_LABEL}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function NavItem({ icon, label, active = false, badge }: { icon: React.ReactNode; label: string; active?: boolean; badge?: string }) {
  return (
    <div className={cn(
      "group relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 transition-all duration-200",
      active
        ? "border-primary/20 bg-gradient-to-r from-primary/18 via-white/[0.04] to-transparent text-white shadow-[0_0_18px_rgba(16,185,129,0.08)]"
        : "border-transparent text-muted-foreground hover:border-white/5 hover:bg-white/[0.04] hover:text-white"
    )}>
      {active && <span className="absolute left-0 top-0 h-full w-1 bg-primary shadow-[0_0_12px_rgba(16,185,129,0.45)]" />}
      <span className={cn(active ? "text-primary" : "text-muted-foreground transition-colors group-hover:text-white")}>
        {icon}
      </span>
      <span className={cn("flex-1 tracking-tight text-[11px]", active ? "font-black" : "font-bold")}>{label}</span>
      {badge && (
        <span className="rounded-lg bg-red-500 px-1.5 py-0.5 text-[9px] font-black text-white animate-pulse">
          {badge}
        </span>
      )}
    </div>
  );
}
