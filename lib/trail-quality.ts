/**
 * SILO OPS Central — Trail Quality
 *
 * Classificação e filtragem de pontos GPS para o rastro visual.
 * NÃO apaga dados brutos — atua apenas para visualização e resumo da API.
 */

import { TrailPoint, TrailPointQualityStatus } from '@/lib/types';

// ── Constantes configuráveis ─────────────────────────────────────────────────

/** Precisão GPS acima deste valor em metros → LOW_ACCURACY */
export const GPS_LOW_ACCURACY_THRESHOLD_METERS = 20;

/** Velocidade calculada entre dois pontos acima deste valor → OUTLIER */
export const GPS_MAX_REASONABLE_SPEED_KMH = 80;

/** Distância mínima em metros entre pontos para não ser DUPLICATE */
export const GPS_MIN_DISTANCE_METERS = 0.5;

// ── Tipos internos ───────────────────────────────────────────────────────────

export interface TrailQualitySummary {
  totalPoints: number;
  rawPointsCount: number;
  visualPointsCount: number;
  filteredPointsCount: number;
  distanceKm: number;
  startedAt: string | null;
  endedAt: string | null;
  quality: {
    valid: number;
    lowAccuracy: number;
    duplicate: number;
    outlier: number;
    invalidCoordinate: number;
  };
}

export interface ClassifiedTrailPoint extends TrailPoint {
  qualityStatus: TrailPointQualityStatus;
}

// ── Funções utilitárias ──────────────────────────────────────────────────────

/** Distância haversine em km entre dois pontos. */
export function calculateDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
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

/**
 * Calcula a velocidade em km/h entre dois pontos.
 * Retorna null se timestamps inválidos ou intervalo zero.
 */
export function calculateSpeedBetweenPoints(
  p1: TrailPoint,
  p2: TrailPoint,
): number | null {
  const t1 = new Date(p1.timestamp).getTime();
  const t2 = new Date(p2.timestamp).getTime();
  if (isNaN(t1) || isNaN(t2)) return null;
  const dtSeconds = (t2 - t1) / 1000;
  if (dtSeconds <= 0) return null;
  const distKm = calculateDistanceKm(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
  return (distKm / dtSeconds) * 3600;
}

/**
 * Normaliza um ponto bruto: garante que campos numéricos são números
 * e que qualityStatus inicial é VALID se não definido.
 */
export function normalizeTrailPoint(raw: TrailPoint): ClassifiedTrailPoint {
  return {
    ...raw,
    latitude:  typeof raw.latitude  === 'number' ? raw.latitude  : parseFloat(String(raw.latitude)),
    longitude: typeof raw.longitude === 'number' ? raw.longitude : parseFloat(String(raw.longitude)),
    qualityStatus: raw.qualityStatus ?? 'VALID',
  };
}

/**
 * Classifica um ponto GPS com base nas regras de qualidade.
 * Recebe o ponto normalizado e o ponto anterior válido (para detecção de outlier/duplicate).
 */
export function classifyTrailPoint(
  point: ClassifiedTrailPoint,
  prevValid: ClassifiedTrailPoint | null,
  seenEventIds: Set<string>,
  seenSignatures: Set<string>,
): TrailPointQualityStatus {
  const { latitude: lat, longitude: lng, accuracy, eventId } = point;

  // 1. INVALID_COORDINATE
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return 'INVALID_COORDINATE';
  if (lat < -90 || lat > 90)                          return 'INVALID_COORDINATE';
  if (lng < -180 || lng > 180)                        return 'INVALID_COORDINATE';
  // 0,0 é coordenada nula — sem sentido operacional em âmbito agrícola BR
  if (lat === 0 && lng === 0)                         return 'INVALID_COORDINATE';

  // 2. DUPLICATE — por eventId
  if (eventId) {
    if (seenEventIds.has(eventId)) return 'DUPLICATE';
    seenEventIds.add(eventId);
  }

  // 3. DUPLICATE — por timestamp + coordenada (assinatura)
  const sig = `${point.timestamp}|${lat.toFixed(6)}|${lng.toFixed(6)}`;
  if (seenSignatures.has(sig)) return 'DUPLICATE';
  seenSignatures.add(sig);

  // 4. DUPLICATE — ponto praticamente igual ao anterior (< GPS_MIN_DISTANCE_METERS)
  if (prevValid) {
    const distM = calculateDistanceKm(prevValid.latitude, prevValid.longitude, lat, lng) * 1000;
    if (distM < GPS_MIN_DISTANCE_METERS) return 'DUPLICATE';
  }

  // 5. LOW_ACCURACY
  if (accuracy != null && accuracy > GPS_LOW_ACCURACY_THRESHOLD_METERS) return 'LOW_ACCURACY';

  // 6. OUTLIER — velocidade impossível entre pontos
  if (prevValid) {
    const speed = calculateSpeedBetweenPoints(prevValid, point);
    if (speed != null && speed > GPS_MAX_REASONABLE_SPEED_KMH) return 'OUTLIER';
  }

  return 'VALID';
}

/**
 * Classifica todos os pontos de uma jornada.
 * Mantém a ordem original (já devem estar ordenados por timestamp).
 */
export function classifyAllPoints(points: TrailPoint[]): ClassifiedTrailPoint[] {
  const seenEventIds   = new Set<string>();
  const seenSignatures = new Set<string>();
  let prevValid: ClassifiedTrailPoint | null = null;

  return points.map(raw => {
    const normalized = normalizeTrailPoint(raw);
    const status = classifyTrailPoint(normalized, prevValid, seenEventIds, seenSignatures);
    const classified: ClassifiedTrailPoint = { ...normalized, qualityStatus: status };
    if (status === 'VALID' || status === 'LOW_ACCURACY') {
      prevValid = classified;
    }
    return classified;
  });
}

/**
 * Filtra somente os pontos adequados para visualização no mapa.
 * Exclui: INVALID_COORDINATE, DUPLICATE, OUTLIER.
 * Mantém: VALID e LOW_ACCURACY (baixa precisão ainda útil para traçar o trajeto).
 */
export function filterVisualTrailPoints(classified: ClassifiedTrailPoint[]): ClassifiedTrailPoint[] {
  return classified.filter(
    p => p.qualityStatus === 'VALID' || p.qualityStatus === 'LOW_ACCURACY',
  );
}

/**
 * Calcula a distância total em km de uma sequência de pontos com coordenadas válidas.
 */
function totalDistanceKm(points: ClassifiedTrailPoint[]): number {
  let dist = 0;
  for (let i = 1; i < points.length; i++) {
    dist += calculateDistanceKm(
      points[i - 1].latitude, points[i - 1].longitude,
      points[i].latitude,     points[i].longitude,
    );
  }
  return Math.round(dist * 1000) / 1000;
}

/**
 * Constrói o resumo de qualidade completo da jornada.
 */
export function buildTrailQualitySummary(
  rawPoints: TrailPoint[],
  classified: ClassifiedTrailPoint[],
  visualPoints: ClassifiedTrailPoint[],
  journeyEnded = false,
): TrailQualitySummary {
  const counts = {
    valid:             0,
    lowAccuracy:       0,
    duplicate:         0,
    outlier:           0,
    invalidCoordinate: 0,
  };

  for (const p of classified) {
    switch (p.qualityStatus) {
      case 'VALID':              counts.valid++;             break;
      case 'LOW_ACCURACY':       counts.lowAccuracy++;       break;
      case 'DUPLICATE':          counts.duplicate++;         break;
      case 'OUTLIER':            counts.outlier++;           break;
      case 'INVALID_COORDINATE': counts.invalidCoordinate++; break;
    }
  }

  return {
    totalPoints:         classified.length,
    rawPointsCount:      rawPoints.length,
    visualPointsCount:   visualPoints.length,
    filteredPointsCount: classified.length - visualPoints.length,
    distanceKm:          totalDistanceKm(visualPoints),
    startedAt:           rawPoints[0]?.timestamp  ?? null,
    endedAt:             journeyEnded ? (rawPoints[rawPoints.length - 1]?.timestamp ?? null) : null,
    quality:             counts,
  };
}
