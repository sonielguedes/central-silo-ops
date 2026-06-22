import { NextRequest, NextResponse } from 'next/server';
import { requireMobileAuth } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { FuelJourneyStorage, FuelJourneyEventType } from '@/lib/fuel-journey-storage';
import { FuelingStorage } from '@/lib/fueling-storage';
import { findActiveFuelJourneyByComboio } from '@/lib/fuel-journeys';

export const dynamic = 'force-dynamic';

type FuelBatchEventType = FuelJourneyEventType | 'FUEL_SUPPLY';

const ALLOWED_TYPES = new Set<FuelBatchEventType>(['JOURNEY_START', 'POST_REFUEL', 'FUEL_SUPPLY', 'JOURNEY_END']);

const asString = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
const asObject = (value: unknown): Record<string, unknown> | undefined => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
);
const asFiniteNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

type BatchEvent = {
  type?: unknown;
  offlineId?: unknown;
  occurredAt?: unknown;
  payload?: unknown;
};

type BatchBody = {
  companyCode?: unknown;
  tenantId?: unknown;
  deviceId?: unknown;
  appModule?: unknown;
  sentAt?: unknown;
  events?: unknown;
};

type ValidationError = { index?: number; offlineId?: string; error: string };

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...(extra ?? {}) }, { status });
}

function validateBaseHeaders(req: NextRequest) {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return fail(400, 'Content-Type deve ser application/json');
  }

  const appModule = asString(req.headers.get('x-app-module'));
  const appName = asString(req.headers.get('x-app-name'));
  if (appModule !== 'FUEL_CONTROL') {
    return fail(400, 'X-App-Module invalido');
  }
  if (appName !== 'SILO FuelControl') {
    return fail(400, 'X-App-Name invalido');
  }
  return null;
}

function validateEvent(item: BatchEvent, index: number): { ok: true; value: { type: FuelBatchEventType; offlineId: string; occurredAt: string; payload: Record<string, unknown> } } | { ok: false; error: ValidationError } {
  const type = asString(item.type);
  const offlineId = asString(item.offlineId);
  const occurredAt = asString(item.occurredAt);
  const payload = asObject(item.payload);

  if (!type || !ALLOWED_TYPES.has(type as FuelJourneyEventType)) {
    return { ok: false, error: { index, offlineId: offlineId ?? undefined, error: 'type invalido' } };
  }
  if (!offlineId) {
    return { ok: false, error: { index, error: 'offlineId obrigatorio' } };
  }
  if (!occurredAt) {
    return { ok: false, error: { index, offlineId, error: 'occurredAt obrigatorio' } };
  }
  if (!payload) {
    return { ok: false, error: { index, offlineId, error: 'payload obrigatorio' } };
  }

  return { ok: true, value: { type: type as FuelBatchEventType, offlineId, occurredAt, payload } };
}

function normalizeJourneyPayload(type: FuelBatchEventType, payload: Record<string, unknown>) {
  switch (type) {
    case 'JOURNEY_START':
      return {
        journeyId: asString(payload.journeyId),
        comboioFleetCode: asString(payload.comboioFleetCode),
        driverRegistration: asString(payload.driverRegistration),
        driverName: asString(payload.driverName),
        shift: asString(payload.shift),
        kmStart: asFiniteNumber(payload.kmStart ?? payload.kmInicial),
        tankStartLiters: asFiniteNumber(payload.tankStartLiters ?? payload.tanqueInicial),
        startedAt: asString(payload.startedAt),
      };
    case 'POST_REFUEL':
      return {
        journeyId: asString(payload.journeyId),
        comboioFleetCode: asString(payload.comboioFleetCode),
        pumpCode: asString(payload.pumpCode),
        meterStart: asFiniteNumber(payload.meterStart),
        meterEnd: asFiniteNumber(payload.meterEnd),
        liters: asFiniteNumber(payload.liters),
        responsibleName: asString(payload.responsibleName),
      };
    case 'JOURNEY_END':
      return {
        journeyId: asString(payload.journeyId),
        comboioFleetCode: asString(payload.comboioFleetCode),
        driverRegistration: asString(payload.driverRegistration),
        driverName: asString(payload.driverName),
        shift: asString(payload.shift),
        kmStart: asFiniteNumber(payload.kmStart ?? payload.kmInicial),
        kmFinal: asFiniteNumber(payload.kmFinal),
        distanciaPercorrida: asFiniteNumber(payload.distanciaPercorrida),
        tankStartLiters: asFiniteNumber(payload.tankStartLiters ?? payload.tanqueInicial),
        totalCarregadoPosto: asFiniteNumber(payload.totalCarregadoPosto ?? payload.totalLoaded),
        totalAbastecidoMaquinas: asFiniteNumber(payload.totalAbastecidoMaquinas ?? payload.totalSupplied),
        saldoTeorico: asFiniteNumber(payload.saldoTeorico ?? payload.theoreticalBalance),
        tankFinalLiters: asFiniteNumber(payload.tankFinalLiters ?? payload.tanqueFinal),
        diferenca: asFiniteNumber(payload.diferenca ?? payload.difference),
        startedAt: asString(payload.startedAt),
        finishedAt: asString(payload.finishedAt),
        status: asString(payload.status),
        source: asString(payload.source) ?? 'APK',
      };
    case 'FUEL_SUPPLY':
      return {
        journeyId: asString(payload.journeyId),
        fleetCode: asString(payload.fleetCode),
        fleetDescription: asString(payload.fleetDescription),
        operatorName: asString(payload.operatorName),
        pumpCode: asString(payload.pumpCode),
        fuelType: asString(payload.fuelType),
        liters: asFiniteNumber(payload.liters),
        hourmeter: asFiniteNumber(payload.hourmeter),
        odometer: asFiniteNumber(payload.odometer),
        durationSeconds: asFiniteNumber(payload.durationSeconds),
        averageFlowLitersPerMinute: asFiniteNumber(payload.averageFlowLitersPerMinute),
      };
  }
}

function getJourneyIdFromPayload(type: FuelBatchEventType, payload: Record<string, unknown>): string | undefined {
  if (type === 'FUEL_SUPPLY') return asString(payload.journeyId);
  return asString(payload.journeyId);
}

export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, RATE_LIMITS.mobileBatch);
    if (rl) return rl;

    const auth = requireMobileAuth(req);
    if (!auth.ok) return auth.response;

    const headerError = validateBaseHeaders(req);
    if (headerError) return headerError;

    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== 'object') {
      return fail(400, 'Payload invalido');
    }
    const body = rawBody as BatchBody;

    const bodyTenantId = asString(body.tenantId);
    const bodyCompanyCode = asString(body.companyCode);
    const bodyDeviceId = asString(body.deviceId);
    const bodyAppModule = asString(body.appModule);
    const sentAt = asString(body.sentAt);
    const headerTenantId = asString(req.headers.get('x-tenant-id'));
    const headerCompanyCode = asString(req.headers.get('x-company-code'));

    if (!bodyTenantId || !bodyCompanyCode || !bodyDeviceId || !bodyAppModule || !sentAt) {
      return fail(400, 'Payload invalido');
    }
    if (!Array.isArray(body.events) || body.events.length === 0) {
      return fail(400, 'Payload invalido');
    }
    if (bodyAppModule !== 'FUEL_CONTROL') {
      return fail(400, 'appModule invalido');
    }
    if (!headerTenantId || !headerCompanyCode) {
      return fail(403, 'Tenant/companyCode obrigatorios');
    }

    const company = auth.company;
    if (company.status === 'INATIVO' || company.mobileEnabled === false) {
      return fail(403, 'Empresa inativa ou mobile desabilitado');
    }
    if (company.tenantId !== auth.tenantId) {
      return fail(403, 'Tenant divergente do token');
    }
    if (company.tenantId !== bodyTenantId || headerTenantId !== bodyTenantId) {
      return fail(403, 'Tenant divergente');
    }
    if ((company.code && company.code !== bodyCompanyCode) || headerCompanyCode !== bodyCompanyCode) {
      return fail(403, 'CompanyCode divergente');
    }

    const errors: ValidationError[] = [];
    const normalizedEvents = (body.events as BatchEvent[]).map((event, index) => {
      const result = validateEvent(event, index);
      if (!result.ok) errors.push(result.error);
      return result;
    });

    if (errors.length > 0) {
      return fail(400, 'Payload invalido', { errors });
    }

    let synced = 0;
    let duplicates = 0;

    for (const item of normalizedEvents) {
      if (!item.ok) continue;
      const { type, offlineId, occurredAt, payload } = item.value;

      if (type === 'FUEL_SUPPLY') {
        if (FuelingStorage.isDuplicate(bodyTenantId, offlineId)) {
          duplicates += 1;
          continue;
        }

        const liters = asFiniteNumber(payload.liters);
        const hourmeter = asFiniteNumber(payload.hourmeter);
        const fleetCode = asString(payload.fleetCode);
        if (!fleetCode || liters == null || hourmeter == null || liters <= 0 || hourmeter <= 0) {
          return fail(400, 'Payload invalido', { errors: [{ offlineId, error: 'FUEL_SUPPLY requer fleetCode, liters e hourmeter validos' }] });
        }

        const saveResult = FuelingStorage.save({
          eventId: offlineId,
          tenantId: bodyTenantId,
          equipmentId: fleetCode,
          fleetCode,
          truckFleetCode: asString(payload.pumpCode ?? bodyDeviceId),
          pumpCode: asString(payload.pumpCode),
          dieselLiters: liters,
          hourmeter,
          fuelType: asString(payload.fuelType),
          fleetDescription: asString(payload.fleetDescription),
          operatorName: asString(payload.operatorName),
          odometer: asFiniteNumber(payload.odometer),
          durationSeconds: asFiniteNumber(payload.durationSeconds),
          averageFlowLitersPerMinute: asFiniteNumber(payload.averageFlowLitersPerMinute),
          journeyId: asString(payload.journeyId),
          fueledAt: occurredAt,
          deviceId: bodyDeviceId,
        });

        if (saveResult === 'DUPLICATE') {
          duplicates += 1;
          continue;
        }

        synced += 1;
        auditFromRequest(req, bodyTenantId, {
          action: 'FUEL_SUPPLY_RECEIVED',
          entity: 'fueling',
          entityId: offlineId,
          metadata: { fleetCode, liters, fuelType: asString(payload.fuelType), source: 'APK' },
        });
        continue;
      }

      const journeyId = getJourneyIdFromPayload(type, payload);
      if (FuelJourneyStorage.isDuplicate(bodyTenantId, offlineId)) {
        duplicates += 1;
        continue;
      }
      if (journeyId && FuelJourneyStorage.getAll(bodyTenantId).some((event) => event.type === type && asString(event.payload?.journeyId) === journeyId)) {
        duplicates += 1;
        continue;
      }

      if (type === 'JOURNEY_START') {
        const comboioFleetCode = asString(payload.comboioFleetCode);
        const activeJourney = findActiveFuelJourneyByComboio(bodyTenantId, bodyCompanyCode, comboioFleetCode);
        if (activeJourney) {
          if (journeyId && activeJourney.journeyId === journeyId) {
            duplicates += 1;
            continue;
          }

          duplicates += 1;
          auditFromRequest(req, bodyTenantId, {
            action: 'FUEL_JOURNEY_DUPLICATE_ACTIVE',
            entity: 'journey',
            entityId: journeyId ?? offlineId,
            metadata: {
              companyCode: bodyCompanyCode,
              comboioFleetCode,
              activeJourneyId: activeJourney.journeyId,
              activeComboio: activeJourney.comboioFleetCode,
              source: 'APK',
            },
          });
          continue;
        }
      }

      const saveResult = FuelJourneyStorage.save({
        eventId: offlineId,
        tenantId: bodyTenantId,
        companyCode: bodyCompanyCode,
        deviceId: bodyDeviceId,
        type,
        occurredAt,
        payload: {
          ...payload,
          ...normalizeJourneyPayload(type, payload),
          source: 'APK',
        },
      });

      if (saveResult === 'DUPLICATE') {
        duplicates += 1;
        continue;
      }

      synced += 1;
    }

    return NextResponse.json({
      success: true,
      received: normalizedEvents.length,
      synced,
      duplicates,
      errors: [],
    });
  } catch (error) {
    console.error('[mobile/fuel/events/batch] unhandled error', error);
    return fail(500, 'Erro interno');
  }
}
