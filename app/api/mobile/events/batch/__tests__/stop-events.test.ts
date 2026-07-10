import { NextRequest } from 'next/server';

const TENANT_ID = 'silo-ops-001';
const COMPANY_TOKEN = 'CTK-STOP-TEST';
const MOBILE_TOKEN = 'MTK-STOP-TEST';
const MACHINE_ID = 'eq-2013';
const FLEET_CODE = '2013';
const BASE_TS = '2026-06-17T12:00:00.000Z';

type LiveState = {
  equipmentId: string;
  fleetCode: string;
  status: string;
  updatedAt?: string;
  stopReasonCode?: string;
  stopCode?: string;
  stopDescription?: string;
  stopReason?: string;
  stopReasonCategory?: string;
  stopStartedAt?: string;
  lastStopReasonCode?: string;
  lastStopEndedAt?: string;
};

const liveState: LiveState[] = [{
  equipmentId: MACHINE_ID,
  fleetCode: FLEET_CODE,
  status: 'OPERANDO',
  updatedAt: '2026-06-17T10:00:00.000Z',
}];

let saved: Array<{ equipmentId: string; type: string; payload: Record<string, unknown> }> = [];
let updateCalls: Array<{ equipmentId: string; updates: Record<string, unknown>; deletedFields?: string[] }> = [];

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
    updateLiveState: jest.fn((_tenantId: string, equipmentId: string, _fleetCode: string, updates: Record<string, unknown>, deletedFields?: string[]) => {
      updateCalls.push({ equipmentId, updates, deletedFields });
      const idx = liveState.findIndex((item) => item.equipmentId === equipmentId);
      if (idx >= 0) {
        liveState[idx] = { ...liveState[idx], ...updates } as LiveState;
        if (deletedFields) {
          deletedFields.forEach(field => {
            delete (liveState[idx] as any)[field];
          });
        }
      }
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

beforeEach(() => {
  saved = [];
  updateCalls = [];
  liveState[0] = {
    equipmentId: MACHINE_ID,
    fleetCode: FLEET_CODE,
    status: 'OPERANDO',
    updatedAt: '2026-06-17T10:00:00.000Z',
  };
});

describe('Stop Events Lifecycle', () => {
  it('1. STOP_STARTED muda live-state para PARADO e salva motivos', async () => {
    const event = {
      type: 'STOP_STARTED',
      eventType: 'STOP_STARTED',
      journeyId: 'j-1',
      fleetCode: FLEET_CODE,
      equipmentId: MACHINE_ID,
      reasonCode: '1830',
      reasonName: 'Abastecimento',
      reasonCategory: 'FUEL',
      status: 'PARADO',
      occurredAt: BASE_TS,
      timestamp: BASE_TS,
      data: { mobileToken: MOBILE_TOKEN }
    };

    const r = await POST(req({ deviceId: MACHINE_ID, events: [event] }));
    const json = await r.json();

    expect(r.status).toBe(200);
    expect(json.success).toBe(true);
    expect(liveState[0].status).toBe('PARADO');
    expect(liveState[0].stopCode).toBe('1830');
    expect(liveState[0].stopReasonCode).toBe('1830');
    expect(liveState[0].stopDescription).toBe('Abastecimento');
    expect(liveState[0].stopStartedAt).toBe(new Date(BASE_TS).toISOString());
  });

  it('2. POSITION_UPDATE após STOP_STARTED mantém PARADO', async () => {
    const events = [
      {
        type: 'STOP_STARTED',
        reasonCode: '1830',
        reasonName: 'Abastecimento',
        timestamp: BASE_TS,
        data: { mobileToken: MOBILE_TOKEN }
      },
      {
        type: 'POSITION_UPDATE',
        latitude: -17.55,
        longitude: -52.55,
        timestamp: '2026-06-17T12:05:00.000Z',
        data: { mobileToken: MOBILE_TOKEN }
      }
    ];

    await POST(req({ deviceId: MACHINE_ID, events }));

    expect(liveState[0].status).toBe('PARADO');
    expect(liveState[0].stopCode).toBe('1830');
  });

  it('3. HEARTBEAT após STOP_STARTED mantém PARADO', async () => {
    const events = [
      {
        type: 'STOP_STARTED',
        reasonCode: '1830',
        reasonName: 'Abastecimento',
        timestamp: BASE_TS,
        data: { mobileToken: MOBILE_TOKEN }
      },
      {
        type: 'HEARTBEAT',
        timestamp: '2026-06-17T12:05:00.000Z',
        data: { mobileToken: MOBILE_TOKEN }
      }
    ];

    await POST(req({ deviceId: MACHINE_ID, events }));

    expect(liveState[0].status).toBe('PARADO');
  });

  it('4. STOP_REASON_CHANGED atualiza motivo mantendo status PARADO', async () => {
      // Setup state as PARADO
      liveState[0] = {
          ...liveState[0],
          status: 'PARADO',
          stopCode: '1830',
          stopReasonCode: '1830',
          stopDescription: 'Abastecimento'
      };

      const event = {
          type: 'STOP_REASON_CHANGED',
          reasonCode: '1840',
          reasonName: 'Troca de Turno',
          timestamp: '2026-06-17T12:15:00.000Z',
          data: { mobileToken: MOBILE_TOKEN }
      };

      await POST(req({ deviceId: MACHINE_ID, events: [event] }));

      expect(liveState[0].status).toBe('PARADO');
      expect(liveState[0].stopCode).toBe('1840');
      expect(liveState[0].stopDescription).toBe('Troca de Turno');
  });

  it('5. STOP_ENDED muda live-state para OPERANDO e limpa campos', async () => {
    // Setup state as PARADO
    liveState[0] = {
      ...liveState[0],
      status: 'PARADO',
      stopCode: '1830',
      stopReasonCode: '1830',
      stopStartedAt: BASE_TS
    };

    const event = {
      type: 'STOP_ENDED',
      eventType: 'STOP_ENDED',
      timestamp: '2026-06-17T12:10:00.000Z',
      data: { mobileToken: MOBILE_TOKEN }
    };

    await POST(req({ deviceId: MACHINE_ID, events: [event] }));

    expect(liveState[0].status).toBe('OPERANDO');
    expect(liveState[0].stopCode).toBeUndefined();
    expect(liveState[0].stopReasonCode).toBeUndefined();
    expect(liveState[0].lastStopReasonCode).toBe('1830');
    expect(liveState[0].lastStopEndedAt).toBe(new Date('2026-06-17T12:10:00.000Z').toISOString());
  });

  it('5. JOURNEY_END encerra activeJourney e activeStop', async () => {
      liveState[0] = {
          ...liveState[0],
          status: 'PARADO',
          stopCode: '1830'
      };

      const event = {
          type: 'JOURNEY_END',
          timestamp: '2026-06-17T12:20:00.000Z',
          data: { mobileToken: MOBILE_TOKEN }
      };

      await POST(req({ deviceId: MACHINE_ID, events: [event] }));

      expect(liveState[0].status).toBe('FINALIZADO');
  });
});
