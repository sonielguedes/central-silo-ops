/**
 * rate-limit.ts — Simple in-memory rate limiter for SILO OPS Central.
 * Sliding window per IP. Resets on process restart (acceptable for single-instance).
 */

import { NextRequest, NextResponse } from 'next/server';

// ── Types ───────────────────────────────────────────────────────────────────

interface WindowEntry {
  timestamps: number[];
}

// ── Config ──────────────────────────────────────────────────────────────────

const DEFAULT_WINDOW_MS = 60 * 1000;   // 1 minute
const DEFAULT_MAX_REQUESTS = 60;       // 60 req/min
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // cleanup every 5 min

// ── Store ───────────────────────────────────────────────────────────────────

const store = new Map<string, WindowEntry>();

// Periodic cleanup to prevent memory leak
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const cutoff = Date.now() - DEFAULT_WINDOW_MS * 2;
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter(t => t > cutoff);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Don't block process exit
  if (cleanupTimer && typeof cleanupTimer === 'object' && 'unref' in cleanupTimer) {
    cleanupTimer.unref();
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

export interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  /** Key prefix to separate rate limit pools */
  prefix?: string;
}

/**
 * Check rate limit for a request.
 * Returns null if allowed, or a 429 NextResponse if rate-limited.
 */
export function checkRateLimit(
  req: NextRequest,
  options: RateLimitOptions = {},
): NextResponse | null {
  ensureCleanup();

  const windowMs = options.windowMs || DEFAULT_WINDOW_MS;
  const maxRequests = options.maxRequests || DEFAULT_MAX_REQUESTS;
  const prefix = options.prefix || req.nextUrl.pathname;

  const ip = getClientIp(req);
  const key = prefix + '::' + ip;
  const now = Date.now();
  const windowStart = now - windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove old timestamps outside window
  entry.timestamps = entry.timestamps.filter(t => t > windowStart);

  if (entry.timestamps.length >= maxRequests) {
    const retryAfterSec = Math.ceil((entry.timestamps[0] + windowMs - now) / 1000);
    console.warn('[rate-limit] exceeded', {
      key,
      count: entry.timestamps.length,
      maxRequests,
      ip,
    });
    return NextResponse.json(
      { error: 'Rate limit exceeded. Retry after ' + retryAfterSec + 's' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Limit': String(maxRequests),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  entry.timestamps.push(now);

  return null;
}

/** Pre-configured rate limiters for specific routes */
export const RATE_LIMITS = {
  mobileBatch: { maxRequests: 120, windowMs: 60000, prefix: 'mobile-batch' },
  mobileHeartbeat: { maxRequests: 120, windowMs: 60000, prefix: 'mobile-hb' },
  adminToken: { maxRequests: 10, windowMs: 60000, prefix: 'admin-token' },
  login: { maxRequests: 10, windowMs: 60000, prefix: 'login' },
} as const;
