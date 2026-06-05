import fs from 'fs';
import path from 'path';
import { INITIAL_COMPANIES, INITIAL_EQUIPMENT } from './mock/master-data';
import { Equipment } from './types';

const TENANT_ID = process.env.SILO_TENANT_ID || 'silo-ops-001';
const TENANT_STATUS = process.env.SILO_TENANT_STATUS;
const DATA_ROOT = process.env.SILO_DATA_DIR || path.join(process.cwd(), 'data-storage');
const DATA_DIR = path.join(DATA_ROOT, TENANT_ID);
const EQUIPMENT_FILE = path.join(DATA_DIR, 'equipment.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface MobileEvent {
  offlineId: string;
  equipmentId: string;
  tenantId: string;
  type: string;
  timestamp: string;
  payload: any;
  receivedAt: string;
}

export class ServerStorage {
  private static loadEquipment(): Equipment[] {
    if (fs.existsSync(EQUIPMENT_FILE)) {
      return JSON.parse(fs.readFileSync(EQUIPMENT_FILE, 'utf-8'));
    }

    const tenantEquipment = INITIAL_EQUIPMENT
      .filter(e => e.tenantId === TENANT_ID)
      .map(e => ({ ...e, tenantId: TENANT_ID }));

    fs.writeFileSync(EQUIPMENT_FILE, JSON.stringify(tenantEquipment, null, 2));
    return tenantEquipment;
  }

  static getTenantId(): string {
    return TENANT_ID;
  }

  private static isTenantMobileActive(): boolean {
    if (TENANT_STATUS) return TENANT_STATUS === 'ATIVO';

    const company = INITIAL_COMPANIES.find(c => c.id === TENANT_ID || c.tenantId === TENANT_ID);
    return company?.status !== 'INATIVO';
  }

  static validateMobileEquipment(equipment: Equipment | undefined, mobileToken: string | undefined): {
    ok: true;
    equipment: Equipment;
  } | {
    ok: false;
    status: 403 | 404;
    error: string;
  } {
    if (!this.isTenantMobileActive()) return { ok: false, status: 403, error: 'Instância inativa para uso mobile' };
    if (!equipment) return { ok: false, status: 404, error: 'Equipamento não encontrado' };
    if (equipment.tenantId !== TENANT_ID) return { ok: false, status: 404, error: 'Equipamento não encontrado' };
    if (equipment.entityStatus !== 'ATIVO' || !['ATIVO', 'ativo'].includes(equipment.status)) {
      return { ok: false, status: 403, error: 'Frota inativa' };
    }
    if (!equipment.mobileEnabled) return { ok: false, status: 403, error: 'Mobile desabilitado para esta frota' };
    if (!equipment.mobileToken || equipment.mobileToken !== mobileToken) {
      return { ok: false, status: 403, error: 'mobileToken inválido' };
    }

    return { ok: true, equipment };
  }

  static getEquipmentByFleetCode(fleetCode: string): Equipment | undefined {
    const all = this.loadEquipment();
    return all.find(e => e.code === fleetCode && e.tenantId === TENANT_ID);
  }

  static getEquipmentById(id: string): Equipment | undefined {
    const all = this.loadEquipment();
    return all.find(e => e.id === id && e.tenantId === TENANT_ID);
  }

  static upsertEquipment(input: Equipment): Equipment {
    const all = this.loadEquipment();
    const timestamp = new Date().toISOString();
    const id = input.id || `eq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const index = all.findIndex(e => (e.id === id || e.code === input.code) && e.tenantId === TENANT_ID);
    const current = index >= 0 ? all[index] : undefined;
    const mobileToken = input.mobileEnabled
      ? input.mobileToken || current?.mobileToken || Math.random().toString(36).substring(2, 15).toUpperCase()
      : input.mobileToken || current?.mobileToken;

    const equipment: Equipment = {
      ...current,
      ...input,
      id,
      tenantId: TENANT_ID,
      entityStatus: input.entityStatus || current?.entityStatus || 'ATIVO',
      createdAt: current?.createdAt || input.createdAt || timestamp,
      updatedAt: timestamp,
      createdBy: current?.createdBy || input.createdBy || 'SISTEMA',
      updatedBy: input.updatedBy || 'SISTEMA',
      version: (current?.version || input.version || 0) + 1,
      history: input.history || current?.history || [],
      lastSignal: input.lastSignal || current?.lastSignal || 'Agora',
      mobileToken,
    };

    if (index >= 0) {
      all[index] = equipment;
    } else {
      all.push(equipment);
    }

    fs.writeFileSync(EQUIPMENT_FILE, JSON.stringify(all, null, 2));
    return equipment;
  }

  static updateEquipment(id: string, updates: Partial<Equipment>) {
    const all = this.loadEquipment();
    const index = all.findIndex(e => e.id === id && e.tenantId === TENANT_ID);
    if (index !== -1) {
      all[index] = { ...all[index], ...updates, updatedAt: new Date().toISOString() };
      fs.writeFileSync(EQUIPMENT_FILE, JSON.stringify(all, null, 2));
    }
  }

  static saveEvent(event: Omit<MobileEvent, 'receivedAt' | 'tenantId'>): 'SYNCED' | 'DUPLICATE' {
    let events: MobileEvent[] = [];
    if (fs.existsSync(EVENTS_FILE)) {
      events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
    }

    // Check for duplicate by offlineId
    if (events.some(e => e.tenantId === TENANT_ID && e.offlineId === event.offlineId)) {
      return 'DUPLICATE';
    }

    events.push({ ...event, tenantId: TENANT_ID, receivedAt: new Date().toISOString() });
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
    return 'SYNCED';
  }
}
