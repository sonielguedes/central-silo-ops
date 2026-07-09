import { NextRequest } from 'next/server';

const TENANT_ID = 'silo-ops-001';
const COMPANY_TOKEN = 'CTK-POSITION-TEST';
const MOBILE_TOKEN = 'MTK-POSITION-TEST';
const MACHINE_ID = 'eq-2013';
const FLEET_CODE = '2013';
const BASE_TS = '2026-06-17T12:00:00.000Z';

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
  equipmentId: MACHINE_ID,
  fleetCode: FLEET_CODE,
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
    getEquipmentById: jest.fn((id: string) => (id === MACHINE_ID ? { id: MACHINE_ID, code: FLEET_CODE, tenantId: TENANT_ID } : undefined)),
    getEquipmentByFleetCode: jest.fn((code: string) => (code === FLEET_CODE ? { id: MACHINE_ID, code: FLEET_CODE, tenantId: TENANT_ID } : undefined)),
    validateMobileEquipment: jest.fn((equipment: { id: string; code: string; tenantId: string } | undefined) => (
      equipment ? { ok: true, equipment } : { ok: false, status: 404, error: 'Equipamento nao encontrado' }
    )),
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

function req(body: unknown) {
  return new NextRequest('http://localhost/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-company-token': COMPANY_TOKEN },
    body: JSON.stringify(body),
  });
}

function basePositionUpdate(extra: Record<string, unknown> = {}) {
  return {
    id: 'evt-1',
    eventId: 'evt-1',
    machineId: MACHINE_ID,
    fleetCode: FLEET_CODE,
    tenantId: TENANT_ID,
    type: 'POSITION_UPDATE',
    timestamp: BASE_TS,
    latitude: -17.55,
    longitude: -52.551,
    accuracy: 7.2,
    speedKmh: 13.4,
    bearing: 88,
    gpsSource: 'APK',
    mobileToken: MOBILE_TOKEN,
    ...extra,
  };
}

beforeEach(() => {
  saved = [];
  updateCalls = [];
  liveState[0] = {
    equipmentId: MACHINE_ID,
    fleetCode: FLEET_CODE,
    status: 'OPERANDO',
    updatedAt: '2026-06-17T10:00:00.000Z',
    lastHeartbeatAt: '2026-06-17T10:00:00.000Z',
  };
});

it('1. body.events[] com POSITION_UPDATE top-level atualiza GPS', async () => {
  const r = await POST(req({ deviceId: MACHINE_ID, events: [basePositionUpdate()] }));
  const json = await r.json();
  expect(r.status).toBe(200);
  expect(json.success).toBe(true);
  expect(json.received).toBe(1);
  expect(updateCalls.at(-1)?.updates).toEqual(expect.objectContaining({ latitude: -17.55, longitude: -52.551, lastGpsAt: BASE_TS }));
});

it('2. body.batch[] é aceito', async () => {
  const r = await POST(req({ deviceId: MACHINE_ID, batch: [basePositionUpdate({ eventId: 'evt-2', id: 'evt-2' })] }));
  const json = await r.json();
  expect(r.status).toBe(200);
  expect(json.received).toBe(1);
  expect(saved).toHaveLength(1);
});

it('3. body.data.events[] é aceito', async () => {
  const r = await POST(req({ deviceId: MACHINE_ID, data: { events: [basePositionUpdate({ eventId: 'evt-3', id: 'evt-3' })] } }));
  const json = await r.json();
  expect(r.status).toBe(200);
  expect(json.received).toBe(1);
  expect(saved).toHaveLength(1);
});

it('4. array direto é aceito', async () => {
  const r = await POST(req([basePositionUpdate({ eventId: 'evt-4', id: 'evt-4' })]));
  const json = await r.json();
  expect(r.status).toBe(200);
  expect(json.received).toBe(1);
  expect(saved).toHaveLength(1);
});

it('5. events + batch ao mesmo tempo combina e deduplica', async () => {
  const same = basePositionUpdate({ eventId: 'dup-1', id: 'dup-1' });
  const r = await POST(req({ deviceId: MACHINE_ID, events: [same], batch: [same] }));
  const json = await r.json();
  expect(r.status).toBe(200);
  expect(json.received).toBe(1);
  expect(saved).toHaveLength(1);
});

it('6. events vazio e batch preenchido funciona', async () => {
  const r = await POST(req({ deviceId: MACHINE_ID, events: [], batch: [basePositionUpdate({ eventId: 'evt-6', id: 'evt-6' })] }));
  const json = await r.json();
  expect(r.status).toBe(200);
  expect(json.received).toBe(1);
  expect(saved).toHaveLength(1);
});

it('7. type no topo é normalizado', async () => {
  const r = await POST(req({ deviceId: MACHINE_ID, events: [{ ...basePositionUpdate({ eventId: 'evt-7', id: 'evt-7' }), type: 'position_update' }] }));
  const json = await r.json();
  expect(r.status).toBe(200);
  expect(json.received).toBe(1);
});

it('8. eventType no topo é normalizado', async () => {
  const r = await POST(req({ deviceId: MACHINE_ID, events: [{ ...basePositionUpdate({ eventId: 'evt-8', id: 'evt-8', type: undefined }), eventType: 'POSITION_UPDATE' }] }));
  const json = await r.json();
  expect(r.status).toBe(200);
  expect(json.received).toBe(1);
});

it('9. type dentro de payload é aceito', async () => {
  const r = await POST(req({ deviceId: MACHINE_ID, events: [{ id: 'evt-9', eventId: 'evt-9', machineId: MACHINE_ID, fleetCode: FLEET_CODE, timestamp: BASE_TS, payload: { type: 'POSITION_UPDATE', latitude: -17.56, longitude: -52.552, mobileToken: MOBILE_TOKEN } }] }));
  const json = await r.json();
  expect(r.status).toBe(200);
  expect(json.received).toBe(1);
  expect(updateCalls.at(-1)?.updates).toEqual(expect.objectContaining({ latitude: -17.56, longitude: -52.552 }));
});

it('10. data no lugar de payload é aceito', async () => {
  const r = await POST(req({ deviceId: MACHINE_ID, events: [{ id: 'evt-10', eventId: 'evt-10', machineId: MACHINE_ID, fleetCode: FLEET_CODE, timestamp: BASE_TS, data: { type: 'POSITION_UPDATE', latitude: -17.57, longitude: -52.553, mobileToken: MOBILE_TOKEN } }] }));
  const json = await r.json();
  expect(r.status).toBe(200);
  expect(json.received).toBe(1);
  expect(updateCalls.at(-1)?.updates).toEqual(expect.objectContaining({ latitude: -17.57, longitude: -52.553 }));
});

it('11. evento sem type falha sem derrubar o lote', async () => {
  const r = await POST(req({ deviceId: MACHINE_ID, events: [
    { id: 'bad-1', eventId: 'bad-1', machineId: MACHINE_ID, fleetCode: FLEET_CODE, timestamp: BASE_TS, data: { mobileToken: MOBILE_TOKEN } },
    basePositionUpdate({ eventId: 'evt-11', id: 'evt-11' }),
  ] }));
  const json = await r.json();
  expect(r.status).toBe(200);
  expect(json.success).toBe(true);
  expect(json.received).toBe(2);
  expect(json.failed).toBe(1);
  expect(json.processed).toBe(1);
  expect(updateCalls).toHaveLength(1);
});

it('12. POSITION_UPDATE atualiza live-state com GPS completo', async () => {
  const r = await POST(req({ deviceId: MACHINE_ID, events: [basePositionUpdate({ eventId: 'evt-12', id: 'evt-12', gpsAccuracy: 6.1 })] }));
  const json = await r.json();
  expect(r.status).toBe(200);
  expect(json.success).toBe(true);
  expect(liveState[0]).toEqual(expect.objectContaining({
    latitude: -17.55,
    longitude: -52.551,
    lastGpsAt: BASE_TS,
    accuracy: 6.1,
    gpsAccuracy: 6.1,
    status: 'OPERANDO',
  }));
});

it('13. HEARTBEAT posterior preserva GPS e status OPERANDO', async () => {
  const r = await POST(req({ deviceId: MACHINE_ID, events: [
    basePositionUpdate({ eventId: 'evt-13a', id: 'evt-13a' }),
    { id: 'evt-13b', eventId: 'evt-13b', machineId: MACHINE_ID, fleetCode: FLEET_CODE, timestamp: '2026-06-17T12:01:00.000Z', type: 'HEARTBEAT', data: { mobileToken: MOBILE_TOKEN } },
  ] }));
  const json = await r.json();
  expect(r.status).toBe(200);
  expect(json.success).toBe(true);
  expect(liveState[0].latitude).toBe(-17.55);
  expect(liveState[0].longitude).toBe(-52.551);
  expect(liveState[0].lastGpsAt).toBe(BASE_TS);
  expect(liveState[0].status).toBe('OPERANDO');
});
