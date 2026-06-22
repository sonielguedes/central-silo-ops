import { NextRequest, NextResponse } from 'next/server';
import { POST as postFuelEventsBatch } from '@/app/api/mobile/fuel/events/batch/route';

export const dynamic = 'force-dynamic';

type FuelingBatchItem = {
  uuid?: string;
  eventId?: string;
  timestamp?: string;
  occurredAt?: string;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

function toFuelSupplyEvent(item: FuelingBatchItem) {
  const { uuid, eventId, timestamp, occurredAt, data, ...rest } = item;
  const payload = { ...(data ?? {}), ...rest };
  return {
    type: 'FUEL_SUPPLY',
    offlineId: uuid ?? eventId ?? payload.offlineId ?? `fuel-${Date.now()}`,
    occurredAt: occurredAt ?? timestamp ?? new Date().toISOString(),
    payload,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const fuelings = Array.isArray(body?.fuelings) ? body.fuelings as FuelingBatchItem[] : undefined;
  const events = Array.isArray(body?.events) ? body.events : undefined;

  const normalizedEvents = events ?? fuelings?.map(toFuelSupplyEvent);
  if (!normalizedEvents || normalizedEvents.length === 0) {
    return NextResponse.json({ success: false, error: 'fuelings/events obrigatorios' }, { status: 400 });
  }

  const forwardBody = {
    companyCode: body?.companyCode ?? body?.header?.companyCode,
    tenantId: body?.tenantId ?? body?.header?.tenantId,
    deviceId: body?.deviceId ?? body?.header?.deviceId ?? 'legacy-device',
    appModule: 'FUEL_CONTROL',
    sentAt: body?.sentAt ?? new Date().toISOString(),
    events: normalizedEvents.map((item: Record<string, unknown>) => ({
      type: item.type ?? 'FUEL_SUPPLY',
      offlineId: item.offlineId ?? item.uuid ?? item.eventId,
      occurredAt: item.occurredAt ?? item.timestamp ?? new Date().toISOString(),
      payload: item.payload ?? item.data ?? item,
    })),
  };

  const forwardReq = new NextRequest('http://localhost/api/mobile/fuel/events/batch', {
    method: 'POST',
    headers: req.headers,
    body: JSON.stringify(forwardBody),
  });

  return postFuelEventsBatch(forwardReq);
}
