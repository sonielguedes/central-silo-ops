import { ServerStorage } from '../server-storage';
import { FichaStore } from '../ficha-store';
import { CadastroStorage } from '../cadastro-storage';

export interface LastHourmeterResponse {
  success: boolean;
  fleetCode: string;
  lastHourmeter: number | null;
  source: string | null;
  journeyId?: string | null;
  measuredAt?: string | null;
  message?: string;
}

export class HourmeterResolver {
  static async getLastValidHourmeter(tenantId: string, fleetCode: string): Promise<LastHourmeterResponse> {
    // 1. Check Ficha Operador (Validated/Exported)
    // We look for the most recent validated ficha for this fleet.
    const overlays = FichaStore.list(tenantId).filter(o => o.fleetCode === fleetCode && (o.validated || o.exported));
    if (overlays.length > 0) {
      // Sort by date DESC
      const sorted = overlays.sort((a, b) => b.date.localeCompare(a.date));
      const latest = sorted[0];
      const hourmeter = (latest.correctedFields.hourmeterEnd as number) || (latest.correctedFields.hourmeterFinal as number);
      if (hourmeter && hourmeter > 0) {
        return {
          success: true,
          fleetCode,
          lastHourmeter: hourmeter,
          source: 'FICHA_OPERADOR',
          measuredAt: latest.updatedAt,
        };
      }
    }

    // 2. Check Live State (includes finalized journeys and current activity)
    const liveState = ServerStorage.getLiveFleet(tenantId);
    const equipmentState = liveState.find(s => s.fleetCode === fleetCode);

    if (equipmentState) {
      // Priority in LiveState: hourmeterEnd (Finalizado) > hourmeterCurrent > hourmeter
      const hourmeter = equipmentState.hourmeterEnd || equipmentState.hourmeterCurrent || equipmentState.hourmeter;

      if (hourmeter && hourmeter > 0) {
        return {
          success: true,
          fleetCode,
          lastHourmeter: hourmeter,
          source: equipmentState.status === 'FINALIZADO' ? 'JORNADA_ANTERIOR' : 'LIVE_STATE',
          journeyId: equipmentState.journeyId,
          measuredAt: equipmentState.updatedAt,
        };
      }
    }

    // 3. Check Mobile Events
    const events = ServerStorage.getEvents(tenantId).filter(e => {
        const p = e.payload || {};
        return (p.fleetCode === fleetCode || p.equipmentCode === fleetCode);
    });

    if (events.length > 0) {
        // Sort by timestamp DESC
        const sortedEvents = events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        for (const evt of sortedEvents) {
            const p = evt.payload || {};
            const hm = p.hourmeterEnd || p.hourmeterCurrent || p.hourmeter;
            if (typeof hm === 'number' && hm > 0) {
                return {
                    success: true,
                    fleetCode,
                    lastHourmeter: hm,
                    source: 'MOBILE_EVENT',
                    measuredAt: evt.timestamp,
                };
            }
        }
    }

    // 4. Check Equipment Cadastro
    const equipments = CadastroStorage.getAll(tenantId, 'equipamentos') as any[];
    const equipment = equipments.find(e => e.code === fleetCode);
    if (equipment && equipment.hourmeter && equipment.hourmeter > 0) {
      return {
        success: true,
        fleetCode,
        lastHourmeter: equipment.hourmeter,
        source: 'CADASTRO',
        measuredAt: equipment.updatedAt,
      };
    }

    return {
      success: true,
      fleetCode,
      lastHourmeter: null,
      source: null,
      message: 'Nenhum horÃ­metro anterior encontrado.',
    };
  }
}

