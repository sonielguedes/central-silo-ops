/**
 * alertas-builder.ts — Alert generation from real operational state.
 * Sources: live-state, mobile-events, equipment heartbeat/GPS, journey status.
 * No mocks. All alerts derived from actual data.
 */

import fs from 'fs';
import path from 'path';
import { ServerStorage, MobileEvent } from '@/lib/server-storage';
import { EquipmentLiveState } from '@/lib/types';

// ── Types ───────────────────────────────────────────────────────────────────

export type AlertSeverity = 'CRITICO' | 'ATENCAO' | 'INFORMATIVO';
export type AlertStatus = 'ABERTO' | 'RECONHECIDO' | 'RESOLVIDO';

export interface AlertRecord {
  id: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  fleetCode: string;
  equipmentId: string;
  source: string;
  createdAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  readAt?: string | null;
  status: AlertStatus;
}

export interface AuditLogEntry {
  alertId: string;
  action: 'ACKNOWLEDGE' | 'RESOLVE';
  performedAt: string;
  previousStatus: AlertStatus;
  newStatus: AlertStatus;
}

// ── Thresholds ──────────────────────────────────────────────────────────────

const HEARTBEAT_CRITICAL_MS = 10 * 60 * 1000;   // 10 min
const GPS_CRITICAL_MS       = 10 * 60 * 1000;   // 10 min
const STOP_ATTENTION_MS     = 30 * 60 * 1000;   // 30 min

// ── Persistence helpers ─────────────────────────────────────────────────────

const DATA_ROOT = process.env.SILO_STORAGE_DIR || process.env.SILO_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/app/data' : './data');

function alertsFile(tenantId: string): string {
  const dir = path.join(DATA_ROOT, tenantId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'alerts.json');
}

function auditFile(tenantId: string): string {
  const dir = path.join(DATA_ROOT, tenantId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'alerts-audit.json');
}

function loadAlerts(tenantId: string): AlertRecord[] {
  const file = alertsFile(tenantId);
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export function readAlertStore(tenantId: string): AlertRecord[] {
  return loadAlerts(tenantId);
}

function saveAlerts(tenantId: string, alerts: AlertRecord[]): void {
  fs.writeFileSync(alertsFile(tenantId), JSON.stringify(alerts, null, 2));
}

export function writeAlertStore(tenantId: string, alerts: AlertRecord[]): void {
  saveAlerts(tenantId, alerts);
}

function loadAuditLog(tenantId: string): AuditLogEntry[] {
  const file = auditFile(tenantId);
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

function saveAuditLog(tenantId: string, log: AuditLogEntry[]): void {
  fs.writeFileSync(auditFile(tenantId), JSON.stringify(log, null, 2));
}

// ── Dedup key: unique per fleet + source + title ────────────────────────────

function alertKey(fleetCode: string, source: string, title: string): string {
  return `${fleetCode}::${source}::${title}`;
}

// ── Generator ───────────────────────────────────────────────────────────────

export function generateAlerts(tenantId: string): AlertRecord[] {
  const now = Date.now();
  const nowIso = new Date().toISOString();
  const fleet: EquipmentLiveState[] = ServerStorage.getLiveFleet(tenantId);
  const events: MobileEvent[] = ServerStorage.getEvents(tenantId);

  // Load persisted alerts for dedup + merge
  const persisted = loadAlerts(tenantId);
  const existingKeys = new Set(
    persisted
      .filter(a => a.status !== 'RESOLVIDO')
      .map(a => alertKey(a.fleetCode, a.source, a.title))
  );

  const newAlerts: AlertRecord[] = [];
  let counter = persisted.length;

  function addAlert(
    severity: AlertSeverity,
    title: string,
    description: string,
    fleetCode: string,
    equipmentId: string,
    source: string,
  ): void {
    const key = alertKey(fleetCode, source, title);
    if (existingKeys.has(key)) return; // no duplicate
    existingKeys.add(key);
    counter++;
    newAlerts.push({
      id: `ALR-${String(counter).padStart(5, '0')}`,
      severity,
      title,
      description,
      fleetCode,
      equipmentId,
      source,
      createdAt: nowIso,
      acknowledgedAt: null,
      resolvedAt: null,
      readAt: null,
      status: 'ABERTO',
    });
  }

  // Track active journeys (from events) for context
  const activeJourneyFleets = new Set<string>();
  for (const eq of fleet) {
    if (eq.status === 'OPERANDO' || eq.status === 'PARADO' || eq.status === 'ONLINE') {
      if (eq.journeyId) activeJourneyFleets.add(eq.fleetCode);
    }
  }

  for (const eq of fleet) {
    const fc = eq.fleetCode;
    const eqId = eq.equipmentId;
    const hasActiveJourney = activeJourneyFleets.has(fc) ||
      eq.status === 'OPERANDO' || eq.status === 'PARADO';

    // ── CRITICO: heartbeat desatualizado > 10min em jornada ativa ──
    if (hasActiveJourney && eq.lastHeartbeatAt) {
      const hbAge = now - new Date(eq.lastHeartbeatAt).getTime();
      if (hbAge > HEARTBEAT_CRITICAL_MS) {
        const mins = Math.round(hbAge / 60000);
        addAlert(
          'CRITICO',
          'Heartbeat desatualizado em jornada ativa',
          `Frota ${fc} sem heartbeat há ${mins} minutos durante jornada ativa.`,
          fc, eqId, 'heartbeat',
        );
      }
    }

    // ── CRITICO: GPS desatualizado > 10min ──
    if (hasActiveJourney && eq.lastGpsAt) {
      const gpsAge = now - new Date(eq.lastGpsAt).getTime();
      if (gpsAge > GPS_CRITICAL_MS) {
        const mins = Math.round(gpsAge / 60000);
        addAlert(
          'CRITICO',
          'GPS desatualizado',
          `Frota ${fc} sem sinal GPS há ${mins} minutos.`,
          fc, eqId, 'gps',
        );
      }
    }

    // ── CRITICO: horímetro inconsistente ──
    if (eq.hourmeterInconsistent) {
      addAlert(
        'CRITICO',
        'Horímetro inconsistente',
        `Frota ${fc}: ${eq.hourmeterInconsistencyReason || 'inconsistência detectada no horímetro'}.`,
        fc, eqId, 'horimetro',
      );
    }

    // ── ATENCAO: parada aberta > 30min ──
    if (eq.stopStartedAt && !eq.stopEndedAt) {
      const stopAge = now - new Date(eq.stopStartedAt).getTime();
      if (stopAge > STOP_ATTENTION_MS) {
        const mins = Math.round(stopAge / 60000);
        const stopDesc = eq.stopDescription || eq.stopReason || eq.stopCode || 'Parada';
        addAlert(
          'ATENCAO',
          'Parada aberta prolongada',
          `Frota ${fc} em parada "${stopDesc}" há ${mins} minutos.`,
          fc, eqId, 'parada-longa',
        );
      }
    }

    // ── ATENCAO: jornada pendente sem encerramento ──
    // Equipment with OPERANDO/PARADO status but last heartbeat older than 30min
    // suggests the operator left without closing the journey.
    if (hasActiveJourney && eq.lastHeartbeatAt) {
      const hbAge = now - new Date(eq.lastHeartbeatAt).getTime();
      // If heartbeat is very old (> 30min) and still showing active status
      if (hbAge > STOP_ATTENTION_MS && (eq.status === 'OPERANDO' || eq.status === 'PARADO')) {
        addAlert(
          'ATENCAO',
          'Jornada pendente sem encerramento',
          `Frota ${fc} com jornada ativa sem comunicação há ${Math.round(hbAge / 60000)} minutos.`,
          fc, eqId, 'jornada-pendente',
        );
      }
    }

    // ── INFORMATIVO: equipamento offline sem jornada ativa ──
    if (eq.status === 'OFFLINE' && !hasActiveJourney) {
      addAlert(
        'INFORMATIVO',
        'Equipamento offline',
        `Frota ${fc} está offline sem jornada ativa.`,
        fc, eqId, 'equipamento-offline',
      );
    }
  }

  // ── CRITICO: jornadas finalizadas com inconsistência (from events) ──
  // Check recent JOURNEY_END events for hourmeter issues
  const recentCutoff = now - 24 * 60 * 60 * 1000; // last 24h
  const journeyEndEvents = events.filter(e => {
    if (e.type !== 'JOURNEY_END') return false;
    const ts = new Date(e.timestamp || e.receivedAt).getTime();
    return ts > recentCutoff;
  });

  for (const evt of journeyEndEvents) {
    const payload = evt.payload as Record<string, unknown> | null;
    if (!payload) continue;
    const inconsistent = payload['hourmeterInconsistent'] === true;
    if (!inconsistent) continue;
    const fc = (payload['fleetCode'] as string) || '';
    const reason = (payload['hourmeterInconsistencyReason'] as string) || 'inconsistência no fechamento';
    if (!fc) continue;
    addAlert(
      'CRITICO',
      'Jornada finalizada com inconsistência',
      `Frota ${fc}: ${reason}.`,
      fc, evt.equipmentId, 'jornada-inconsistente',
    );
  }

  // Merge: keep persisted + add new
  const merged = [...persisted, ...newAlerts];

  // Auto-resolve: if condition no longer applies to a fleet, mark RESOLVIDO
  const currentFleetStatus = new Map<string, EquipmentLiveState>();
  for (const eq of fleet) currentFleetStatus.set(eq.fleetCode, eq);

  for (const alert of merged) {
    if (alert.status === 'RESOLVIDO') continue;
    const eq = currentFleetStatus.get(alert.fleetCode);
    if (!eq) continue;

    let resolved = false;

    if (alert.source === 'horimetro' && !eq.hourmeterInconsistent) {
      resolved = true;
    }
    if (alert.source === 'equipamento-offline' && eq.status !== 'OFFLINE') {
      resolved = true;
    }
    if (alert.source === 'parada-longa' && (eq.stopEndedAt || !eq.stopStartedAt)) {
      resolved = true;
    }

    if (resolved) {
      alert.status = 'RESOLVIDO';
      alert.resolvedAt = nowIso;
    }
  }

  saveAlerts(tenantId, merged);
  return merged;
}

// ── Actions ─────────────────────────────────────────────────────────────────

export function acknowledgeAlert(tenantId: string, alertId: string): AlertRecord | null {
  const alerts = loadAlerts(tenantId);
  const alert = alerts.find(a => a.id === alertId);
  if (!alert || alert.status === 'RESOLVIDO') return null;

  const prev = alert.status;
  alert.acknowledgedAt = new Date().toISOString();
  alert.status = 'RECONHECIDO';
  saveAlerts(tenantId, alerts);

  // Audit log
  const log = loadAuditLog(tenantId);
  log.push({
    alertId,
    action: 'ACKNOWLEDGE',
    performedAt: alert.acknowledgedAt,
    previousStatus: prev,
    newStatus: 'RECONHECIDO',
  });
  saveAuditLog(tenantId, log);

  return alert;
}

export function resolveAlert(tenantId: string, alertId: string): AlertRecord | null {
  const alerts = loadAlerts(tenantId);
  const alert = alerts.find(a => a.id === alertId);
  if (!alert || alert.status === 'RESOLVIDO') return null;

  const prev = alert.status;
  alert.resolvedAt = new Date().toISOString();
  alert.status = 'RESOLVIDO';
  saveAlerts(tenantId, alerts);

  const log = loadAuditLog(tenantId);
  log.push({
    alertId,
    action: 'RESOLVE',
    performedAt: alert.resolvedAt,
    previousStatus: prev,
    newStatus: 'RESOLVIDO',
  });
  saveAuditLog(tenantId, log);

  return alert;
}

export function resolveAllAlerts(tenantId: string): number {
  const alerts = loadAlerts(tenantId);
  const nowIso = new Date().toISOString();
  const log = loadAuditLog(tenantId);
  let count = 0;

  for (const alert of alerts) {
    if (alert.status === 'RESOLVIDO') continue;
    const prev = alert.status;
    alert.resolvedAt = nowIso;
    alert.status = 'RESOLVIDO';
    count++;
    log.push({
      alertId: alert.id,
      action: 'RESOLVE',
      performedAt: nowIso,
      previousStatus: prev,
      newStatus: 'RESOLVIDO',
    });
  }

  saveAlerts(tenantId, alerts);
  saveAuditLog(tenantId, log);
  return count;
}

export function markAlertsRead(tenantId: string, alertIds?: string[]): { read: number; alerts: AlertRecord[] } {
  const alerts = loadAlerts(tenantId);
  const nowIso = new Date().toISOString();
  const ids = alertIds && alertIds.length > 0 ? new Set(alertIds) : null;
  let count = 0;

  for (const alert of alerts) {
    if (alert.status === 'RESOLVIDO') continue;
    if (ids && !ids.has(alert.id)) continue;
    if (alert.readAt) continue;
    alert.readAt = nowIso;
    count++;
  }

  if (count > 0) saveAlerts(tenantId, alerts);
  return { read: count, alerts };
}

export function getUnreadAlertCount(tenantId: string): number {
  return loadAlerts(tenantId).filter((alert) => alert.status !== 'RESOLVIDO' && !alert.readAt).length;
}
