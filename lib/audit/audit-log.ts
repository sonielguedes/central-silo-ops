/**
 * audit-log.ts — Global audit log for SILO OPS Central.
 * Persists to data/{tenantId}/audit-log.jsonl (append-only).
 */

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';

const DATA_ROOT = process.env.SILO_STORAGE_DIR || process.env.SILO_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/app/data' : './data');

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuditEntry {
  timestamp: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip: string;
  userAgent: string;
  metadata?: Record<string, unknown>;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getAuditFile(tenantId: string): string {
  const dir = path.join(DATA_ROOT, tenantId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'audit-log.jsonl');
}

function extractIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function extractUserAgent(req: NextRequest): string {
  return req.headers.get('user-agent')?.slice(0, 200) || 'unknown';
}

/** Truncate deep objects to keep audit lines manageable */
function summarize(obj: unknown): Record<string, unknown> | null {
  if (!obj || typeof obj !== 'object') return null;
  const entries = Object.entries(obj as Record<string, unknown>).slice(0, 20);
  const result: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    if (typeof value === 'string' && value.length > 200) {
      result[key] = value.slice(0, 200) + '...';
    } else if (Array.isArray(value)) {
      result[key] = '[' + value.length + ' items]';
    } else if (typeof value === 'object' && value !== null) {
      result[key] = '{...}';
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ── Public API ──────────────────────────────────────────────────────────────

export function writeAudit(
  tenantId: string,
  entry: Omit<AuditEntry, 'timestamp'>,
): void {
  try {
    const line: AuditEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
      before: entry.before ? summarize(entry.before) : null,
      after: entry.after ? summarize(entry.after) : null,
    };
    const file = getAuditFile(tenantId);
    fs.appendFileSync(file, JSON.stringify(line) + '\n');
  } catch (err) {
    console.error('[audit-log] write failed', err);
  }
}

/** Convenience: extract request context and write audit */
export function auditFromRequest(
  req: NextRequest,
  tenantId: string,
  params: {
    userId?: string;
    action: string;
    entity: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    metadata?: Record<string, unknown>;
  },
): void {
  writeAudit(tenantId, {
    userId: params.userId || 'system',
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    before: params.before as Record<string, unknown> | null,
    after: params.after as Record<string, unknown> | null,
    ip: extractIp(req),
    userAgent: extractUserAgent(req),
    metadata: params.metadata,
  });
}

/** Read recent audit entries (for admin/debug) */
export function readAuditLog(tenantId: string, limit = 100): AuditEntry[] {
  const file = getAuditFile(tenantId);
  if (!fs.existsSync(file)) return [];
  try {
    const content = fs.readFileSync(file, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const entries: AuditEntry[] = [];
    for (const line of lines.slice(-limit)) {
      try { entries.push(JSON.parse(line)); } catch { /* skip malformed */ }
    }
    return entries;
  } catch { return []; }
}
