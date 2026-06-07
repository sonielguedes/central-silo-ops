import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage, MobileEvent } from '@/lib/server-storage';
import { CadastroStorage } from '@/lib/cadastro-storage';

export const dynamic = 'force-dynamic';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FleetStatusCounts {
  OPERANDO:   number;
  ONLINE:     number;
  PARADO:     number;
  FINALIZADO: number;
  OFFLINE:    number;
}

export interface RecentAlert {
  id:          string;
  title:       string;
  description: string;
  severity:    string;
  status:      string;
  timestamp:   string;
  equipmentId?: string;
}

export interface ActiveFleetItem {
  equipmentId:       string;
  fleetCode:         string;
  status:            string;
  currentOperation?: string;
  operationCode?:    string;
  operationName?:    string;
  currentOperator?:  string;
  operatorName?:     string;
  stopCode?:         string;
  stopDescription?:  string;
  stopStartedAt?:    string;
  hourmeterCurrent?: number;
  lastHeartbeatAt?:  string;
  lastGpsAt?:        string;
  latitude?:         number;
  longitude?:        number;
}

export interface SyncSummary {
  totalEventsToday: number;
  lastEventAt:      string | null;
  machinesWithData: number;
}

export interface DashboardSummary {
  onlineCount:       number;
  totalFleet:        number;
  activeOperations:  number;
  criticalAlerts:    number;
  openStops:         number;
  productionToday:   number;          // productive hours today
  fleetStatusCounts: FleetStatusCounts;
  recentAlerts:      RecentAlert[];   // latest 5
  productivitySeries: number[];       // 24 values, hours per hour-of-day (today)
  syncSummary:       SyncSummary;
  activeFleet:       ActiveFleetItem[];
  generatedAt:       string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAX_HB_GAP_H = 10 / 60;

function todayRange(): { from: Date; to: Date } {
  const now  = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  return { from, to: now };
}

function inRange(ts: string | undefined, from: Date, to: Date): boolean {
  if (!ts) return false;
  const t = new Date(ts).getTime();
  return t >= from.getTime() && t <= to.getTime();
}

function diffHours(a: string | Date, b: string | Date | null): number {
  const ta = typeof a === 'string' ? new Date(a).getTime() : a.getTime();
  const tb = b ? (typeof b === 'string' ? new Date(b).getTime() : b.getTime()) : Date.now();
  if (!Number.isFinite(ta) || !Number.isFinite(tb) || tb <= ta) return 0;
  return (tb - ta) / 3_600_000;
}

interface ProductivityAccum {
  totalH: number;
  hourly: number[];
}

function computeProductivity(events: MobileEvent[]): ProductivityAccum {
  const hourly = new Array<number>(24).fill(0);
  let totalH   = 0;

  const heartbeats = events
    .filter(e => e.type === 'HEARTBEAT' || e.type === 'OPERATION_CHANGE')
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  for (let i = 0; i < heartbeats.length; i++) {
    const hb = heartbeats[i];
    const p  = hb.payload as Record<string, unknown> | null | undefined;
    const stopCode = String(p?.stopCode ?? '').trim();
    const opCode   = String(p?.operationCode ?? p?.operation ?? '').trim();
    if (stopCode || !opCode) continue;

    const next  = heartbeats[i + 1];
    const iH    = next
      ? Math.min(diffHours(hb.timestamp, next.timestamp), MAX_HB_GAP_H)
      : MAX_HB_GAP_H / 2;
    if (iH <= 0) continue;

    totalH += iH;
    const hr = new Date(hb.timestamp).getHours();
    hourly[hr] = (hourly[hr] ?? 0) + iH;
  }

  return { totalH, hourly };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const tenantId = ServerStorage.resolveTenantId(req.headers);
    const { from, to } = todayRange();

    // ── Live fleet ──────────────────────────────────────────────────────────
    const fleet = ServerStorage.getLiveFleet(tenantId);

    const totalFleet      = fleet.length;
    const onlineCount     = fleet.filter(m => m.status !== 'OFFLINE').length;
    const activeOperations = fleet.filter(m => m.status === 'OPERANDO').length;
    const openStops       = fleet.filter(m => m.status === 'PARADO' && m.stopCode).length;

    const fleetStatusCounts: FleetStatusCounts = {
      OPERANDO:   0,
      ONLINE:     0,
      PARADO:     0,
      FINALIZADO: 0,
      OFFLINE:    0,
    };
    for (const m of fleet) {
      const k = m.status as keyof FleetStatusCounts;
      if (k in fleetStatusCounts) fleetStatusCounts[k]++;
    }

    // ── Alerts ──────────────────────────────────────────────────────────────
    interface RawAlert {
      id: string;
      title: string;
      description: string;
      severity: string;
      status: string;
      timestamp: string;
      equipmentId?: string;
    }
    const allAlerts = CadastroStorage.getAll(tenantId, 'alerts') as unknown as RawAlert[];
    const criticalAlerts = allAlerts.filter(
      a => a.severity === 'CRITICAL' && a.status === 'ATIVO'
    ).length;

    const recentAlerts: RecentAlert[] = allAlerts
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 5)
      .map(a => ({
        id:          a.id,
        title:       a.title,
        description: a.description,
        severity:    a.severity,
        status:      a.status,
        timestamp:   a.timestamp,
        equipmentId: a.equipmentId,
      }));

    // ── Events (today) ──────────────────────────────────────────────────────
    const allEvents    = ServerStorage.getEvents(tenantId);
    const todayEvents  = allEvents.filter(e => inRange(e.timestamp, from, to));

    // Productive hours + hourly series
    const { totalH: productionToday, hourly: productivitySeries } =
      computeProductivity(todayEvents);

    // Sync summary
    const machinesWithData = new Set(todayEvents.map(e => e.equipmentId)).size;
    const lastEventAt      = todayEvents.length > 0
      ? todayEvents.reduce((latest, e) =>
          e.timestamp > latest ? e.timestamp : latest, '')
      : null;

    const syncSummary: SyncSummary = {
      totalEventsToday: todayEvents.length,
      lastEventAt,
      machinesWithData,
    };

    // ── Active fleet detail ─────────────────────────────────────────────────
    const activeFleet: ActiveFleetItem[] = fleet
      .filter(m => m.status !== 'OFFLINE')
      .map(m => ({
        equipmentId:       m.equipmentId,
        fleetCode:         m.fleetCode,
        status:            m.status,
        currentOperation:  m.currentOperation,
        operationCode:     m.operationCode,
        operationName:     m.operationName,
        currentOperator:   m.currentOperator,
        operatorName:      m.operatorName,
        stopCode:          m.stopCode,
        stopDescription:   m.stopDescription,
        stopStartedAt:     m.stopStartedAt,
        hourmeterCurrent:  m.hourmeterCurrent,
        lastHeartbeatAt:   m.lastHeartbeatAt,
        lastGpsAt:         m.lastGpsAt,
        latitude:          m.latitude,
        longitude:         m.longitude,
      }));

    const summary: DashboardSummary = {
      onlineCount,
      totalFleet,
      activeOperations,
      criticalAlerts,
      openStops,
      productionToday:    Math.round(productionToday * 100) / 100,
      fleetStatusCounts,
      recentAlerts,
      productivitySeries: productivitySeries.map(h => Math.round(h * 100) / 100),
      syncSummary,
      activeFleet,
      generatedAt: new Date().toISOString(),
    };

    console.info(
      '[dashboard/summary] tenant=' + tenantId +
      ' fleet=' + totalFleet + ' online=' + onlineCount +
      ' ops=' + activeOperations + ' alerts=' + criticalAlerts,
    );

    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[dashboard/summary] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
