import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { requireTenant } from '@/lib/auth/api-guard';
import { TrailPoint } from '@/lib/types';

export const dynamic = 'force-dynamic';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Distância haversine em km entre dois pontos. */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildSummary(points: TrailPoint[], journeyEnded?: boolean) {
  const valid = points.filter(
    p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
  );
  let distanceKm = 0;
  for (let i = 1; i < valid.length; i++) {
    distanceKm += haversineKm(
      valid[i - 1].latitude,
      valid[i - 1].longitude,
      valid[i].latitude,
      valid[i].longitude,
    );
  }
  return {
    totalPoints: valid.length,
    distanceKm: Math.round(distanceKm * 1000) / 1000,
    startedAt: valid[0]?.timestamp ?? null,
    endedAt: journeyEnded ? (valid[valid.length - 1]?.timestamp ?? null) : null,
  };
}

/** Converte para o formato compacto esperado pelo cliente. */
function toClientPoints(points: TrailPoint[]) {
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
      qualityStatus: p.qualityStatus ?? 'VALID',
      eventId:       p.eventId,
    }));
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const tenant = requireTenant(req);
    if (!tenant.ok) return tenant.response;
    const { tenantId } = tenant;

    const { searchParams } = new URL(req.url);
    // fleetCode e journeyId sempre String
    const fleetCode  = searchParams.get('fleetCode')?.trim()  || undefined;
    const journeyId  = searchParams.get('journeyId')?.trim()  || undefined;
    const date       = searchParams.get('date')?.trim()       || undefined; // YYYY-MM-DD

    // ── 1. Por journeyId direto ─────────────────────────────────────────────
    if (journeyId) {
      const points = ServerStorage.getTrail(tenantId, journeyId);
      const sorted = [...points].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      return NextResponse.json({
        success:   true,
        fleetCode: sorted[0]?.fleetCode ?? fleetCode ?? null,
        journeyId,
        points:    toClientPoints(sorted),
        summary:   buildSummary(sorted),
      });
    }

    // ── 2. Por fleetCode + date (histórico) ou jornada ativa ───────────────
    if (!fleetCode) {
      return NextResponse.json(
        { success: false, error: 'Informe fleetCode ou journeyId' },
        { status: 400 },
      );
    }

    // Se date fornecida, busca histórico em todos os arquivos de trail
    if (date) {
      const all = ServerStorage.getTrailsByFleetCode(tenantId, fleetCode, date);
      if (all.length === 0) {
        return NextResponse.json({
          success: true, fleetCode, journeyId: null, date,
          points: [], summary: { totalPoints: 0, distanceKm: 0, startedAt: null, endedAt: null },
        });
      }
      // Retorna o primeiro resultado (jornada mais antiga do dia)
      const { journeyId: jId, points } = all[0];
      const sorted = [...points].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      return NextResponse.json({
        success: true, fleetCode, journeyId: jId, date,
        points:  toClientPoints(sorted),
        summary: buildSummary(sorted),
        journeys: all.map(j => ({
          journeyId: j.journeyId,
          totalPoints: j.points.length,
          startedAt: j.points[0]?.timestamp ?? null,
        })),
      });
    }

    // Jornada ativa no live state
    const liveFleet = ServerStorage.getLiveFleet(tenantId);
    const machine = liveFleet.find(m => String(m.fleetCode) === String(fleetCode));

    if (!machine?.journeyId) {
      // Sem jornada ativa — tenta buscar trail histórico mais recente
      const all = ServerStorage.getTrailsByFleetCode(tenantId, fleetCode);
      if (all.length > 0) {
        const last = all[all.length - 1];
        const sorted = [...last.points].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        return NextResponse.json({
          success: true, fleetCode,
          journeyId: last.journeyId,
          points:    toClientPoints(sorted),
          summary:   buildSummary(sorted, true),
          note:      'Jornada finalizada — rastro histórico',
        });
      }
      return NextResponse.json({
        success: true, fleetCode, journeyId: null,
        points: [], summary: { totalPoints: 0, distanceKm: 0, startedAt: null, endedAt: null },
      });
    }

    const jId = machine.journeyId;
    const points = ServerStorage.getTrail(tenantId, jId);
    const sorted = [...points].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    return NextResponse.json({
      success:   true,
      fleetCode: String(fleetCode),
      journeyId: jId,
      points:    toClientPoints(sorted),
      summary:   buildSummary(sorted),
    });
  } catch (error) {
    console.error('[trail-api] error', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
