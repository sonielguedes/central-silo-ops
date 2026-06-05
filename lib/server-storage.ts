import fs from 'fs';
import path from 'path';
import { INITIAL_EQUIPMENT } from './mock/master-data';
import { Equipment } from './types';

const DATA_DIR = path.join(process.cwd(), 'data-storage');
const EQUIPMENT_FILE = path.join(DATA_DIR, 'equipment.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface MobileEvent {
  offlineId: string;
  equipmentId: string;
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
    // If file doesn't exist, use initial mock data
    return INITIAL_EQUIPMENT;
  }

  static getEquipmentByFleetCode(fleetCode: string): Equipment | undefined {
    const all = this.loadEquipment();
    return all.find(e => e.code === fleetCode && e.entityStatus === 'ATIVO');
  }

  static getEquipmentById(id: string): Equipment | undefined {
    const all = this.loadEquipment();
    return all.find(e => e.id === id);
  }

  static updateEquipment(id: string, updates: Partial<Equipment>) {
    const all = this.loadEquipment();
    const index = all.findIndex(e => e.id === id);
    if (index !== -1) {
      all[index] = { ...all[index], ...updates, updatedAt: new Date().toISOString() };
      fs.writeFileSync(EQUIPMENT_FILE, JSON.stringify(all, null, 2));
    }
  }

  static saveEvent(event: Omit<MobileEvent, 'receivedAt'>): 'SYNCED' | 'DUPLICATE' {
    let events: MobileEvent[] = [];
    if (fs.existsSync(EVENTS_FILE)) {
      events = JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf-8'));
    }

    // Check for duplicate by offlineId
    if (events.some(e => e.offlineId === event.offlineId)) {
      return 'DUPLICATE';
    }

    events.push({ ...event, receivedAt: new Date().toISOString() });
    fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2));
    return 'SYNCED';
  }
}
