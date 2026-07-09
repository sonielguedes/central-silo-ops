import fs from 'fs';
import path from 'path';

const resolveStorageDir = () => {
  const dir = process.env.SILO_STORAGE_DIR || process.env.SILO_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/app/data' : './data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const DATA_ROOT = resolveStorageDir();

export interface DeviceBinding {
  deviceId: string;
  deviceName?: string;
  fleetCode: string;
  equipmentId?: string;
  tenantId: string;
  linkedAt: string;
  linkedBy: string;
  status: 'ACTIVE' | 'INACTIVE';
  lastValidationAt: string;
}

export class DeviceBindingStorage {
  private static getFile(tenantId: string): string {
    const dir = path.join(DATA_ROOT, tenantId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'device-bindings.json');
  }

  static getAll(tenantId: string): DeviceBinding[] {
    const file = this.getFile(tenantId);
    if (!fs.existsSync(file)) return [];
    try {
      return JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch {
      return [];
    }
  }

  static getByDeviceId(tenantId: string, deviceId: string): DeviceBinding | undefined {
    return this.getAll(tenantId).find(b => b.deviceId === deviceId);
  }

  static upsert(tenantId: string, binding: DeviceBinding): void {
    const all = this.getAll(tenantId);
    const index = all.findIndex(b => b.deviceId === binding.deviceId);
    if (index >= 0) {
      all[index] = binding;
    } else {
      all.push(binding);
    }
    fs.writeFileSync(this.getFile(tenantId), JSON.stringify(all, null, 2));
  }

  static remove(tenantId: string, deviceId: string): void {
    const all = this.getAll(tenantId);
    const filtered = all.filter(b => b.deviceId !== deviceId);
    fs.writeFileSync(this.getFile(tenantId), JSON.stringify(filtered, null, 2));
  }
}
