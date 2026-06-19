import { ServerStorage } from './server-storage';
import type { TrailPoint } from './types';

export class EquipmentTrailStore {
  static getTrail(tenantId: string, journeyId: string): TrailPoint[] {
    return ServerStorage.getTrail(tenantId, journeyId);
  }
}
