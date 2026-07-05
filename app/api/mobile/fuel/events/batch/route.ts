import { NextRequest, NextResponse } from 'next/server';
import { requireMobileAuth } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { checkRateLimit, RATE_LIMITS } from '@/lib/security/rate-limit';
import { FuelJourneyStorage, FuelJourneyEventType } from '@/lib/fuel-journey-storage';
import { FuelingStorage } from '@/lib/fueling-storage';
import { findActiveFuelJourneyByComboio } from '@/lib/fuel-journeys';

export const dynamic = 'force-dynamic';

type FuelBatchEventType = FuelJourneyEventType;

const ALLOWED_TYPES = new Set<FuelBatchEventType>([
  'JOURNEY_START',
  'POST_REFUEL',
  'FUEL_SUPPLY',
  'TANK_REFILL',
  'STOP_STARTED',
  'STOP_REASON_ADDED',
  'STOP_ENDED',
  'JOURNEY_END',
]);

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

function normalizeCommonJourneyPayload(payload: Record<string, unknown>) {
  return {
    journeyId: asString(payload.journeyId),
    journeyOfflineId: asString(payload.journeyOfflineId),
    comboio: asString(payload.comboio),
    comboioFleetCode: asString(payload.comboioFleetCode ?? payload.comboio),
    driverRegistration: asString(payload.driverRegistration),
    driverName: asString(payload.driverName),
    shift: asString(payload.shift),
    startedAt: asString(payload.startedAt),
    endedAt: asString(payload.endedAt),
    status: asString(payload.status),
    source: asString(payload.source) ?? 'APK',
  };
}

function normalizeJourneyPayload(type: FuelBatchEventType, payload: Record<string, unknown>) {
  switch (type) {
    case 'JOURNEY_START':
      return {
        ...normalizeCommonJourneyPayload(payload),
        kmStart: asFiniteNumber(payload.kmStart ?? payload.kmInicial),
        tankStartLiters: asFiniteNumber(payload.tankInitialLiters ?? payload.tankStartLiters ?? payload.tanqueInicial),
      };
    case 'POST_REFUEL':
      return {
        ...normalizeCommonJourneyPayload(payload),
        pumpCode: asString(payload.pumpCode),
        meterStart: asFiniteNumber(payload.meterStart),
        meterEnd: asFiniteNumber(payload.meterEnd),
        liters: asFiniteNumber(payload.liters),
        responsibleName: asString(payload.responsibleName),
      };
    case 'TANK_REFILL':
    case 'STOP_STARTED':
    case 'STOP_REASON_ADDED':
    case 'STOP_ENDED':
      return {
        ...normalizeCommonJourneyPayload(payload),
        reasonCode: asString(payload.reasonCode ?? payload.stopReasonCode),
        reasonDescription: asString(payload.reasonDescription ?? payload.stopReasonDescription),
        stopCode: asString(payload.stopCode),
        stopDescription: asString(payload.stopDescription),
        pumpCode: asString(payload.pumpCode),
        liters: asFiniteNumber(payload.liters),
        hourmeter: asFiniteNumber(payload.hourmeter),
        odometer: asFiniteNumber(payload.odometer),
      };
    case 'JOURNEY_END':
      return {
        ...normalizeCommonJourneyPayload(payload),
        kmStart: asFiniteNumber(payload.kmStart ?? payload.kmInitial ?? payload.kmInicial),
        kmFinal: asFiniteNumber(payload.kmFinal),
        distanciaPercorrida: asFiniteNumber(payload.distanciaPercorrida ?? payload.distanceKm),
        tankStartLiters: asFiniteNumber(payload.tankInitialLiters ?? payload.tankStartLiters ?? payload.tanqueInicial),
        tankInitialLiters: asFiniteNumber(payload.tankInitialLiters ?? payload.tankStartLiters ?? payload.tanqueInicial),
        totalLoadedLiters: asFiniteNumber(payload.totalLoadedLiters ?? payload.totalCarregadoPosto ?? payload.totalLoaded),
        totalSuppliedLiters: asFiniteNumber(payload.totalSuppliedLiters ?? payload.totalAbastecidoMaquinas ?? payload.totalSupplied),
        theoreticalFinalBalanceLiters: asFiniteNumber(payload.theoreticalFinalBalanceLiters ?? payload.saldoTeorico ?? payload.theoreticalBalance),
        realFinalBalanceLiters: asFiniteNumber(payload.realFinalBalanceLiters ?? payload.saldoFinalReal ?? payload.tankFinalLiters ?? payload.tanqueFinal),
        tankFinalLiters: asFiniteNumber(payload.tankFinalLiters ?? payload.tanqueFinal ?? payload.realFinalBalanceLiters ?? payload.saldoFinalReal),
        divergenceLiters: asFiniteNumber(payload.divergenceLiters ?? payload.diferenca ?? payload.difference),
        startedAt: asString(payload.startedAt),
        finishedAt: asString(payload.finishedAt ?? payload.endedAt),
      };
    case 'FUEL_SUPPLY':
      return {
        journeyId: asString(payload.journeyId),
        journeyOfflineId: asString(payload.journeyOfflineId),
        comboio: asString(payload.comboio),
        comboioFleetCode: asString(payload.comboioFleetCode ?? payload.comboio),
        fleetCode: asString(payload.fleetCode),
        fleetDescription: asString(payload.fleetDescription),
        operatorName: asString(payload.operatorName),
        attendantName: asString(payload.attendantName),
        attendantRegistration: asString(payload.attendantRegistration),
        pumpCode: asString(payload.pumpCode),
        productCode: asString(payload.productCode),
        productDescription: asString(payload.productDescription),
        fuelType: asString(payload.productCode ?? payload.productDescription ?? payload.fuelType),
        liters: asFiniteNumber(payload.liters),
        hourmeter: asFiniteNumber(payload.hourmeter),
        odometer: asFiniteNumber(payload.odometer),
        durationSeconds: asFiniteNumber(payload.durationSeconds),
        averageFlowLitersPerMinute: asFiniteNumber(payload.averageFlowLitersPerMinute),
      };
  }
}

function getJourneyIdFromPayload(payload: Record<string, unknown>): string | undefined {
  return asString(payload.journeyId) ?? asString(payload.journeyOfflineId);
}

function translateProductCode(code?: string | null): string | undefined {
  const normalized = asString(code)?.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) return undefined;
  if (normalized === 'DIESELS10') return 'Diesel S-10';
  if (normalized === 'DIESELS500') return 'Diesel S-500';
  if (normalized === 'DIESEL') return 'Diesel';
  if (normalized === 'GASOLINA') return 'Gasolina';
  if (normalized === 'ETANOL') return 'Etanol';
  return asString(code);
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
          console.info(`[FuelEventsBatch] type=FUEL_SUPPLY accepted=true`);
          console.info(`[FuelEventsBatch] offlineId=${offlineId}`);
          console.info(`[FuelEventsBatch] duplicate=true offlineId=${offlineId}`);
          continue;
        }

        const fleetCode = asString(payload.fleetCode);
        const liters = asFiniteNumber(payload.liters);
        const hourmeter = asFiniteNumber(payload.hourmeter);
        const odometer = asFiniteNumber(payload.odometer);

        const hasFleetCode = typeof fleetCode === 'string' && fleetCode.trim().length > 0;
        const hasLiters = typeof liters === 'number' && Number.isFinite(liters) && liters > 0;
        const hasHourmeter = typeof hourmeter === 'number' && Number.isFinite(hourmeter) && hourmeter >= 0;
        const hasOdometer = typeof odometer === 'number' && Number.isFinite(odometer) && odometer >= 0;

        if (!hasFleetCode || !hasLiters || (!hasHourmeter && !hasOdometer)) {
          return fail(400, 'Payload invalido', {
            errors: [{
              offlineId,
              error: 'FUEL_SUPPLY requer fleetCode, liters e hourmeter ou odometer validos'
            }]
          });
        }

        const saveResult = FuelingStorage.save({
          eventId: offlineId,
          tenantId: bodyTenantId,
          companyCode: bodyCompanyCode,
          equipmentId: fleetCode,
          fleetCode,
          targetFleetCode: fleetCode,
          truckFleetCode: asString(payload.comboioFleetCode ?? payload.comboio),
          comboioFleetCode: asString(payload.comboioFleetCode ?? payload.comboio),
          journeyOfflineId: asString(payload.journeyOfflineId),
          pumpCode: asString(payload.pumpCode),
          dieselLiters: liters,
          hourmeter: hasHourmeter ? hourmeter : null,
          fuelType: asString(payload.productDescription)
            ?? translateProductCode(asString(payload.fuelType))
            ?? translateProductCode(asString(payload.productCode))
            ?? asString(payload.fuelType)
            ?? asString(payload.productCode),
          productCode: asString(payload.productCode),
          productDescription:
            asString(payload.productDescription)
            ?? translateProductCode(asString(payload.fuelType))
            ?? translateProductCode(asString(payload.productCode))
            ?? asString(payload.productCode)
            ?? asString(payload.fuelType),
          fleetDescription: asString(payload.fleetDescription),
          driverName: asString(payload.driverName),
          driverRegistration: asString(payload.driverRegistration),
          operatorName: asString(payload.operatorName) ?? asString(payload.driverName),
          operatorRegistration: asString(payload.operatorRegistration) ?? asString(payload.driverRegistration),
          attendantName: asString(payload.attendantName),
          attendantRegistration: asString(payload.attendantRegistration),
          odometer: hasOdometer ? odometer : null,
          durationSeconds: asFiniteNumber(payload.durationSeconds),
          averageFlowLitersPerMinute: asFiniteNumber(payload.averageFlowLitersPerMinute),
          journeyId: asString(payload.journeyId),
          fueledAt: occurredAt,
          deviceId: bodyDeviceId,
          origin: 'APK',
          status: 'SYNCED',
        });

        if (saveResult === 'DUPLICATE') {
          duplicates += 1;
          console.info(`[FuelEventsBatch] type=FUEL_SUPPLY accepted=true`);
          console.info(`[FuelEventsBatch] offlineId=${offlineId}`);
          console.info(`[FuelEventsBatch] duplicate=true offlineId=${offlineId}`);
          continue;
        }

        synced += 1;
        console.info(`[FuelEventsBatch] type=FUEL_SUPPLY accepted=true`);
        console.info(`[FuelEventsBatch] offlineId=${offlineId}`);
        console.info(`[FuelEventsBatch] saved=true`);
        auditFromRequest(req, bodyTenantId, {
          action: 'FUEL_SUPPLY_RECEIVED',
          entity: 'fueling',
          entityId: offlineId,
          metadata: { fleetCode, liters, fuelType: asString(payload.fuelType), source: 'APK' },
        });
        continue;
      }

      const journeyId = getJourneyIdFromPayload(payload);
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
        console.info(`[FuelEventsBatch] duplicate=true offlineId=${offlineId}`);
        continue;
      }

      synced += 1;
      console.info(`[FuelEventsBatch] type=${type} accepted=true`);
      console.info(`[FuelEventsBatch] offlineId=${offlineId}`);
      console.info(`[FuelEventsBatch] saved=true`);
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
