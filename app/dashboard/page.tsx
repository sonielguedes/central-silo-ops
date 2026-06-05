"use client";

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { KPICard } from '@/components/dashboard/kpi-card';
import { OperationalMap } from '@/components/dashboard/operational-map';
import { EquipmentTable } from '@/components/dashboard/equipment-table';
import { RecentAlerts } from '@/components/dashboard/recent-alerts';
import { ProductivityChart } from '@/components/dashboard/productivity-chart';
import { SyncPanel } from '@/components/dashboard/sync-panel';
import { EquipmentService, OperationService, AlertService, TelemetryService } from '@/services/master.service';
import { Truck, Play, AlertCircle, PauseCircle, Factory } from 'lucide-react';
import { withAuth } from '@/components/shared/with-auth';

function DashboardPage() {
  const [stats, setStats] = useState({
    online: 0,
    total: 0,
    activeOps: 0,
    alerts: 0,
    stops: 0
  });

  useEffect(() => {
    async function loadStats() {
      const [eqs, ops, alerts] = await Promise.all([
        EquipmentService.getAll(),
        OperationService.getAll(),
        AlertService.getAll()
      ]);

      const telemetryData = await Promise.all(
        eqs.map(e => TelemetryService.getLatestByEquipment(e.id))
      );

      const onlineCount = telemetryData.filter(t => t?.isOnline).length;

      setStats({
        online: onlineCount,
        total: eqs.length,
        activeOps: ops.filter(o => o.status === 'EM_CURSO').length,
        alerts: alerts.filter(a => a.status === 'ATIVO' && a.severity === 'CRITICAL').length,
        stops: eqs.filter(e => e.status === 'parada').length
      });
    }
    loadStats();
  }, []);

  const KPI_CARDS = [
    { key: 'online', title: 'Máquinas Online', value: stats.online.toString(), suffix: `de ${stats.total}`, color: 'emerald', icon: Truck, trend: stats.online.toString() },
    { key: 'ops', title: 'Operações Ativas', value: stats.activeOps.toString(), color: 'emerald', icon: Play, trend: stats.activeOps.toString() },
    { key: 'alerts', title: 'Alertas Críticos', value: stats.alerts.toString(), color: stats.alerts > 0 ? 'red' : 'emerald', icon: AlertCircle, trend: stats.alerts.toString() },
    { key: 'stops', title: 'Paradas em Aberto', value: stats.stops.toString(), color: 'amber', icon: PauseCircle, trend: stats.stops.toString() },
    { key: 'prod', title: 'Produção (Dia)', value: '8.450', suffix: 't', color: 'emerald', icon: Factory, trend: '8.450' },
  ];

  return (
    <div className="flex h-screen bg-[#050812] text-white overflow-hidden font-sans selection:bg-primary/30">
      <Sidebar className="hidden lg:flex shrink-0" />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[150px] -z-10 rounded-full"></div>
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-blue-500/5 blur-[100px] -z-10 rounded-full"></div>
        <Header />
        <main className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {KPI_CARDS.map((kpi) => (
              <KPICard
                key={kpi.key}
                title={kpi.title}
                value={kpi.value}
                suffix={kpi.suffix}
                color={kpi.color as any}
                icon={kpi.icon}
                trend={kpi.trend}
              />
            ))}
          </section>
          <section className="grid grid-cols-12 gap-6">
            <div className="col-span-12 xl:col-span-8">
              <OperationalMap />
            </div>
            <div className="col-span-12 xl:col-span-4 min-h-[450px]">
              <EquipmentTable />
            </div>
          </section>
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-[380px]">
              <RecentAlerts />
            </div>
            <div className="h-[380px]">
              <ProductivityChart />
            </div>
            <div className="h-[380px]">
              <SyncPanel />
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default withAuth(DashboardPage);
