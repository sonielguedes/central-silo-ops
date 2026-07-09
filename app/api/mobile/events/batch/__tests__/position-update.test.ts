import { NextRequest } from 'next/server';

const TENANT_ID = 'silo-ops-001';
const COMPANY_TOKEN = 'CTK-POSITION-TEST';
const MOBILE_TOKEN = 'MTK-POSITION-TEST';

type LiveState = {
  equipmentId: string;
  fleetCode: string;
  status: string;
  updatedAt?: string;
  lastHeartbeatAt?: string;
  lastGpsAt?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  gpsAccuracy?: number;
  speedKmh?: number;
  bearing?: number;
  gpsSource?: string;
  source?: string;
};

const liveState: LiveState[] = [{
  equipmentId: 'eq-2013',
  fleetCode: '2013',
  status: 'OPERANDO',
  updatedAt: '2026-06-17T10:00:00.000Z',
  lastHeartbeatAt: '2026-06-17T10:00:00.000Z',
}];

let saved: Array<{ equipmentId: string; type: string; payload: Record<string, unknown> }> = [];
let updateCalls: Array<{ equipmentId: string; updates: Record<string, unknown> }> = [];

jest.mock('@/lib/auth/api-guard', () => ({
  requireMobileAuth: jest.fn(() => ({
    ok: true, tenantId: TENANT_ID, companyToken: COMPANY_TOKEN, company: { id: 'co-1', tenantId: TENANT_ID },
  })),
}));

jest.mock('@/lib/security/rate-limit', () => ({
  checkRateLimit: jest.fn(() => null),
  RATE_LIMITS: { mobileBatch: {} },
}));

jest.mock('@/lib/cadastro-storage', () => ({ CadastroStorage: { getAll: jest.fn(() => []) } }));
jest.mock('@/lib/device-binding-storage', () => ({ DeviceBindingStorage: { getByDeviceId: jest.fn(() => undefined) } }));

jest.mock('@/lib/server-storage', () => ({
  ServerStorage: {
    getLiveFleet: jest.fn(() => liveState),
    getEquipmentById: jest.fn(() => ({ id: 'eq-2013', code: '2013', tenantId: TENANT_ID })),
    validateMobileEquipment: jest.fn(() => ({ ok: true, equipment: { id: 'eq-2013', code: '2013', tenantId: TENANT_ID } })),
    getEquipmentByFleetCode: jest.fn(() => undefined),
    saveEvent: jest.fn((event: { offlineId: string; equipmentId: string; type: string; payload: Record<string, unknown> }) => {
      saved.push({ equipmentId: event.equipmentId, type: event.type, payload: event.payload });
      return 'SYNCED';
    }),
    updateLiveState: jest.fn((_tenantId: string, equipmentId: string, _fleetCode: string, updates: Record<string, unknown>) => {
      updateCalls.push({ equipmentId, updates });
      const idx = liveState.findIndex((item) => item.equipmentId === equipmentId);
      if (idx >= 0) liveState[idx] = { ...liveState[idx], ...updates } as LiveState;
    }),
  },
}));

import { POST } from '@/app/api/mobile/events/batch/route';

function req(events: Array<{ uuid: string; type: string; timestamp: string; data?: Record<string, unknown>; payload?: Record<string, unknown> }>) {
  return new NextRequest('http://localhost/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-company-token': COMPANY_TOKEN },
    body: JSON.stringify({ header: { machineId: 'eq-2013', mobileToken: MOBILE_TOKEN }, events }),
  });
}

beforeEach(() => {
  saved = [];
  updateCalls = [];
  liveState[0] = {
    equipmentId: 'eq-2013',
    fleetCode: '2013',
    status: 'OPERANDO',
    updatedAt: '2026-06-17T10:00:00.000Z',
    lastHeartbeatAt: '2026-06-17T10:00:00.000Z',
  };
});

it('1. POSITION_UPDATE top-level atualiza latitude/longitude/lastGpsAt', async () => {
  const r = await POST(req([{
    uuid: 'p1',
    type: 'POSITION_UPDATE',
    timestamp: '2026-06-17T12:00:00.000Z',
    data: { mobileToken: MOBILE_TOKEN, latitude: -17.55, longitude: -52.551, accuracy: 7.2, speedKmh: 13.4, bearing: 88, gpsSource: 'APK' },
  }]));
  expect(r.status).toBe(200);
  expect(updateCalls.at(-1)?.updates).toEqual(expect.objectContaining({ latitude: -17.55, longitude: -52.551, lastGpsAt: '2026-06-17T12:00:00.000Z', accuracy: 7.2, speedKmh: 13.4, bearing: 88, gpsSource: 'APK' }));
});

it('2. POSITION_UPDATE com payload atualiza latitude/longitude/lastGpsAt', async () => {
  const r = await POST(req([{
    uuid: 'p2',
    type: 'POSITION_UPDATE',
    timestamp: '2026-06-17T12:05:00.000Z',
    data: { mobileToken: MOBILE_TOKEN, payload: { lat: -17.56, lng: -52.552, accuracy: 5.1, source: 'GPS' } },
  }]));
  expect(r.status).toBe(200);
  expect(updateCalls.at(-1)?.updates).toEqual(expect.objectContaining({ latitude: -17.56, longitude: -52.552, lastGpsAt: '2026-06-17T12:05:00.000Z', accuracy: 5.1, gpsSource: 'GPS' }));
});

it('3. HEARTBEAT posterior preserva GPS', async () => {
  liveState[0] = { ...liveState[0], latitude: -17.55, longitude: -52.551, lastGpsAt: '2026-06-17T12:00:00.000Z' };
  await POST(req([
    { uuid: 'p3', type: 'HEARTBEAT', timestamp: '2026-06-17T12:06:00.000Z', data: { mobileToken: MOBILE_TOKEN } },
  ]));
  expect(liveState[0].latitude).toBe(-17.55);
  expect(liveState[0].longitude).toBe(-52.551);
  expect(liveState[0].lastGpsAt).toBe('2026-06-17T12:00:00.000Z');
});

it('4. Coordenada 0,0 não atualiza GPS', async () => {
  await POST(req([{
    uuid: 'p4',
    type: 'POSITION_UPDATE',
    timestamp: '2026-06-17T12:07:00.000Z',
    data: { mobileToken: MOBILE_TOKEN, latitude: 0, longitude: 0 },
  }]));
  expect(liveState[0].latitude).toBeUndefined();
  expect(liveState[0].longitude).toBeUndefined();
  expect(liveState[0].lastGpsAt).toBeUndefined();
});

it('5. Status OPERANDO é preservado', async () => {
  liveState[0] = { ...liveState[0], latitude: -17.55, longitude: -52.551, lastGpsAt: '2026-06-17T12:00:00.000Z', status: 'OPERANDO' };
  await POST(req([
    { uuid: 'p5', type: 'HEARTBEAT', timestamp: '2026-06-17T12:08:00.000Z', data: { mobileToken: MOBILE_TOKEN } },
  ]));
  expect(liveState[0].status).toBe('OPERANDO');
});
