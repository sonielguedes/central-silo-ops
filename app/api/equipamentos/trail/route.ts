import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { requireTenant } from '@/lib/auth/api-guard';
import { TrailPoint } from '@/lib/types';
import {
  classifyAllPoints,
  filterVisualTrailPoints,
  buildTrailQualitySummary,
  ClassifiedTrailPoint,
} from '@/lib/trail-quality';

export const dynamic = 'force-dynamic';

// ── Formato compacto para o cliente ──────────────────────────────────────────

function toClientPoints(points: ClassifiedTrailPoint[]) {
  return points
    .filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
    .map(p => ({
      lat:           p.latitude,
      lng:           p.longitude,
      speedKmh:      p.speedKmh ?? (p.speed != null ? Math.round(p.speed * 3.6 * 10) / 10 : undefined),
      accuracy:      p.accuracy,
      rpm:           p.rpm,
      hourmeter:     p.hourmeterCurrent,
      timestamp:     p.timestamp,
      qualityStatus: p.qualityStatus,
      eventId:       p.eventId,
    }));
}

// ── Pipeline de qualidade ────────────────────────────────────────────────────

interface TrailQualityResult {
  raw:     TrailPoint[];
  classified: ClassifiedTrailPoint[];
  visual:  ClassifiedTrailPoint[];
}

function applyQualityPipeline(raw: TrailPoint[]): TrailQualityResult {
  const sorted     = [...raw].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const classified = classifyAllPoints(sorted);
  const visual     = filterVisualTrailPoints(classified);
  return { raw: sorted, classified, visual };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;
    const { tenantId } = tenant;

    const { searchParams } = new URL(req.url);
    // fleetCode e journeyId sempre String
    const fleetCode = searchParams.get('fleetCode')?.trim() || undefined;
    const journeyId = searchParams.get('journeyId')?.trim() || undefined;
    const date      = searchParams.get('date')?.trim()      || undefined; // YYYY-MM-DD
    const quality   = searchParams.get('quality')           || 'visual';  // visual | raw
    const debug     = searchParams.get('debug') === 'true';

    const showRaw   = quality === 'raw';

    // ── 1. Por journeyId direto ─────────────────────────────────────────────
    if (journeyId) {
      const raw = ServerStorage.getTrail(tenantId, journeyId);
      const { raw: sorted, classified, visual } = applyQualityPipeline(raw);
      const displayPoints = showRaw ? classified : visual;
      const summary = buildTrailQualitySummary(sorted, classified, visual);

      return NextResponse.json({
        success:   true,
        fleetCode: sorted[0]?.fleetCode ?? fleetCode ?? null,
        journeyId,
        points:    toClientPoints(displayPoints),
        summary,
        ...(debug ? { debug: { classifiedPoints: toClientPoints(classified) } } : {}),
      });
    }

    // ── 2. Por fleetCode (obrigatório a partir daqui) ───────────────────────
    if (!fleetCode) {
      return NextResponse.json(
        { success: false, error: 'Informe fleetCode ou journeyId' },
        { status: 400 },
      );
    }

    // ── 3. Por fleetCode + date (histórico) ─────────────────────────────────
    if (date) {
      const all = ServerStorage.getTrailsByFleetCode(tenantId, fleetCode, date);
      if (all.length === 0) {
        return NextResponse.json({
          success: true, fleetCode, journeyId: null, date,
          points: [],
          summary: {
            totalPoints: 0, rawPointsCount: 0, visualPointsCount: 0, filteredPointsCount: 0,
            distanceKm: 0, startedAt: null, endedAt: null,
            quality: { valid: 0, lowAccuracy: 0, duplicate: 0, outlier: 0, invalidCoordinate: 0 },
          },
        });
      }

      const { journeyId: jId, points: rawPts } = all[0];
      const { raw: sorted, classified, visual } = applyQualityPipeline(rawPts);
      const displayPoints = showRaw ? classified : visual;
      const summary = buildTrailQualitySummary(sorted, classified, visual);

      return NextResponse.json({
        success: true, fleetCode, journeyId: jId, date,
        points:  toClientPoints(displayPoints),
        summary,
        journeys: all.map(j => ({
          journeyId:   j.journeyId,
          totalPoints: j.points.length,
          startedAt:   j.points[0]?.timestamp ?? null,
        })),
        ...(debug ? { debug: { classifiedPoints: toClientPoints(classified) } } : {}),
      });
    }

    // ── 4. Jornada ativa no live state ──────────────────────────────────────
    const liveFleet = ServerStorage.getLiveFleet(tenantId);
    const machine   = liveFleet.find(m => String(m.fleetCode) === String(fleetCode));

    if (!machine?.journeyId) {
      // Sem jornada ativa — tenta buscar trail histórico mais recente
      const all = ServerStorage.getTrailsByFleetCode(tenantId, fleetCode);
      if (all.length > 0) {
        const last = all[all.length - 1];
        const { raw: sorted, classified, visual } = applyQualityPipeline(last.points);
        const displayPoints = showRaw ? classified : visual;
        const summary = buildTrailQualitySummary(sorted, classified, visual, true);

        return NextResponse.json({
          success: true, fleetCode,
          journeyId: last.journeyId,
          points:    toClientPoints(displayPoints),
          summary,
          note:      'Jornada finalizada — rastro histórico',
          ...(debug ? { debug: { classifiedPoints: toClientPoints(classified) } } : {}),
        });
      }
      return NextResponse.json({
        success: true, fleetCode, journeyId: null,
        points: [],
        summary: {
          totalPoints: 0, rawPointsCount: 0, visualPointsCount: 0, filteredPointsCount: 0,
          distanceKm: 0, startedAt: null, endedAt: null,
          quality: { valid: 0, lowAccuracy: 0, duplicate: 0, outlier: 0, invalidCoordinate: 0 },
        },
      });
    }

    // ── 5. Jornada ativa com trail ───────────────────────────────────────────
    const jId    = machine.journeyId;
    const rawPts = ServerStorage.getTrail(tenantId, jId);
    const { raw: sorted, classified, visual } = applyQualityPipeline(rawPts);
    const displayPoints = showRaw ? classified : visual;
    const summary = buildTrailQualitySummary(sorted, classified, visual);

    return NextResponse.json({
      success:   true,
      fleetCode: String(fleetCode),
      journeyId: jId,
      points:    toClientPoints(displayPoints),
      summary,
      ...(debug ? { debug: { classifiedPoints: toClientPoints(classified) } } : {}),
    });

  } catch (error) {
    console.error('[trail-api] error', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
