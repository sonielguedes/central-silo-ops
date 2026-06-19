import { ServerStorage, MobileEvent } from './server-storage';

export interface TimelineQuery {
  tenantId: string;
  fleetCode?: string;
  equipmentId?: string;
  operatorRegistration?: string;
  journeyId?: string;
  startDate?: string;
  endDate?: string;
  types?: string[];
}

export class MobileEventsStore {
  static getEvents(query: TimelineQuery): MobileEvent[] {
    const { tenantId, equipmentId, fleetCode, operatorRegistration, journeyId, startDate, endDate, types } = query;

    let all = ServerStorage.getEvents(tenantId);

    return all.filter(evt => {
      const p = evt.payload || {};

      // Filter by equipment
      if (equipmentId && evt.equipmentId !== equipmentId && p.equipmentId !== equipmentId) return false;
      if (fleetCode && p.fleetCode !== fleetCode && p.equipmentCode !== fleetCode) return false;

      // Filter by operator
      if (operatorRegistration && p.operatorRegistration !== operatorRegistration && p.registration !== operatorRegistration) return false;

      // Filter by journey
      if (journeyId && p.journeyId !== journeyId) return false;

      // Filter by type
      if (types && types.length > 0 && !types.includes(evt.type)) return false;

      // Filter by date
      const ts = evt.timestamp || evt.receivedAt;
      if (startDate && ts < startDate) return false;
      if (endDate && ts > endDate) return false;

      return true;
    });
  }
}
