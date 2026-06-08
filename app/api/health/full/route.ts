import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const DATA_ROOT = process.env.SILO_STORAGE_DIR || process.env.SILO_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/app/data' : './data');
const VERSION = process.env.npm_package_version || '0.1.0-piloto';

function checkFile(filePath: string): { exists: boolean; readable: boolean; sizeBytes?: number } {
  try {
    if (!fs.existsSync(filePath)) return { exists: false, readable: false };
    const stat = fs.statSync(filePath);
    fs.accessSync(filePath, fs.constants.R_OK);
    return { exists: true, readable: true, sizeBytes: stat.size };
  } catch {
    return { exists: true, readable: false };
  }
}

function checkDir(dirPath: string): { exists: boolean; readable: boolean; writable: boolean } {
  try {
    if (!fs.existsSync(dirPath)) return { exists: false, readable: false, writable: false };
    fs.accessSync(dirPath, fs.constants.R_OK);
    const readable = true;
    let writable = false;
    try {
      fs.accessSync(dirPath, fs.constants.W_OK);
      writable = true;
    } catch { /* not writable */ }
    return { exists: true, readable, writable };
  } catch {
    return { exists: true, readable: false, writable: false };
  }
}

function getDiskInfo(): { freeGb?: number; totalGb?: number } | null {
  // Only available on some systems
  try {
    const stats = fs.statfsSync(DATA_ROOT);
    return {
      freeGb: Math.round((Number(stats.bavail) * Number(stats.bsize)) / 1073741824 * 100) / 100,
      totalGb: Math.round((Number(stats.blocks) * Number(stats.bsize)) / 1073741824 * 100) / 100,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const now = new Date().toISOString();
  const dataDir = checkDir(DATA_ROOT);

  // Find tenants
  let tenants: string[] = [];
  try {
    if (dataDir.exists && dataDir.readable) {
      tenants = fs.readdirSync(DATA_ROOT)
        .filter(f => fs.statSync(path.join(DATA_ROOT, f)).isDirectory())
        .filter(f => !f.startsWith('.'));
    }
  } catch { /* ignore */ }

  // Check key files for first tenant (or default)
  const tenantId = tenants[0] || 'silo-ops-001';
  const tenantDir = path.join(DATA_ROOT, tenantId);
  const mobileEvents = checkFile(path.join(tenantDir, 'mobile-events.json'));
  const liveState = checkFile(path.join(tenantDir, 'live-state.json'));
  const alerts = checkFile(path.join(tenantDir, 'alerts.json'));
  const auditLog = checkFile(path.join(tenantDir, 'audit-log.jsonl'));

  const disk = getDiskInfo();

  const allOk =
    dataDir.exists && dataDir.readable && dataDir.writable &&
    mobileEvents.readable !== false &&
    liveState.readable !== false;

  const status = allOk ? 'healthy' : 'degraded';

  const result = {
    status,
    version: VERSION,
    timestamp: now,
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'unknown',
    uptime: process.uptime(),
    checks: {
      dataDir,
      mobileEvents,
      liveState,
      alerts,
      auditLog,
    },
    tenants,
    disk,
    memory: {
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1048576 * 100) / 100,
      heapTotalMb: Math.round(process.memoryUsage().heapTotal / 1048576 * 100) / 100,
      rssMb: Math.round(process.memoryUsage().rss / 1048576 * 100) / 100,
    },
  };

  return NextResponse.json(result, {
    status: allOk ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
