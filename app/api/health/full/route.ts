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
    let writable = false;
    try { fs.accessSync(dirPath, fs.constants.W_OK); writable = true; } catch { /* not writable */ }
    return { exists: true, readable: true, writable };
  } catch {
    return { exists: true, readable: false, writable: false };
  }
}

function getDiskInfo(): { freeGb?: number; totalGb?: number } | null {
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

interface TenantHealth {
  tenantId: string;
  code: string;
  status: string;
  dataDir: { exists: boolean; readable: boolean; writable: boolean };
  mobileEvents: { exists: boolean; readable: boolean; sizeBytes?: number };
  liveState: { exists: boolean; readable: boolean; sizeBytes?: number };
  alerts: { exists: boolean; readable: boolean; sizeBytes?: number };
  auditLog: { exists: boolean; readable: boolean; sizeBytes?: number };
}

function getTenantHealth(): TenantHealth[] {
  // Load companies to get tenant list (never expose tokens)
  try {
    const companiesFile = path.join(DATA_ROOT, 'companies.json');
    if (!fs.existsSync(companiesFile)) return [];
    const companies = JSON.parse(fs.readFileSync(companiesFile, 'utf-8')) as Array<{
      tenantId: string; code: string; status: string;
    }>;

    return companies.map(c => {
      const tenantDir = path.join(DATA_ROOT, c.tenantId);
      return {
        tenantId: c.tenantId,
        code: c.code,
        status: c.status || 'ATIVO',
        dataDir: checkDir(tenantDir),
        mobileEvents: checkFile(path.join(tenantDir, 'mobile-events.json')),
        liveState: checkFile(path.join(tenantDir, 'live-state.json')),
        alerts: checkFile(path.join(tenantDir, 'alerts.json')),
        auditLog: checkFile(path.join(tenantDir, 'audit-log.jsonl')),
      };
    });
  } catch {
    return [];
  }
}

export async function GET() {
  const now = new Date().toISOString();
  const dataDir = checkDir(DATA_ROOT);
  const disk = getDiskInfo();
  const tenants = getTenantHealth();

  const tenantsOk = tenants.length > 0 && tenants.every(t => t.dataDir.exists && t.dataDir.readable);
  const allOk = dataDir.exists && dataDir.readable && dataDir.writable && tenantsOk;
  const status = allOk ? 'healthy' : 'degraded';

  const result = {
    status,
    version: VERSION,
    timestamp: now,
    environment: process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'unknown',
    uptime: process.uptime(),
    dataDir,
    tenants,
    tenantCount: tenants.length,
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
