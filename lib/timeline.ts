import { MobileEventsStore, TimelineQuery } from './mobile-events-store';
import { MobileEvent } from './server-storage';
import { TimelineEvent } from './types';
import type { TimelineEventType } from './types';

export class TimelineAggregator {
  static getTimeline(query: TimelineQuery): TimelineEvent[] {
    const mobileEvents = MobileEventsStore.getEvents(query);

    // Map MobileEvent (internal) to TimelineEvent (UI)
    const mapped = mobileEvents.map(evt => this.mapToTimelineEvent(evt));

    // Group or limit GPS/HEARTBEAT if needed (Rule: "não poluir demais")
    return this.processEvents(mapped);
  }

  private static mapToTimelineEvent(evt: MobileEvent): TimelineEvent {
    const p = evt.payload || {};
    const timestamp = evt.timestamp || evt.receivedAt;

    let title = evt.type;
    let description = '';
    let severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO';

    switch (evt.type) {
      case 'JOURNEY_START':
        title = 'Início de Jornada';
        description = `Equipamento ${p.fleetCode || ''} iniciou jornada. Horímetro: ${p.hourmeterStart || p.hourmeter || ''}`;
        break;
      case 'JOURNEY_END':
        title = 'Fim de Jornada';
        description = `Jornada finalizada. Horímetro Final: ${p.hourmeterEnd || p.hourmeter || ''}`;
        break;
      case 'GPS_POINT':
      case 'LOCATION':
      case 'GPS':
        title = 'GPS recebido';
        description = `Localização: ${p.latitude}, ${p.longitude} (Vel: ${p.speedKmh || 0} km/h)`;
        break;
      case 'HEARTBEAT':
        title = 'Heartbeat recebido';
        description = 'Conexão ativa com o APK';
        break;
      case 'STOP_DETECTED':
        title = 'Parada Detectada';
        description = 'Equipamento parou de se movimentar';
        severity = 'WARNING';
        break;
      case 'STOP_REASON':
      case 'PARADA':
        title = 'Parada Apontada';
        const reason = p.stopDescription || p.stopReason || p.description || p.reason || p.motivo || 'Sem motivo';
        const code = p.stopCode || p.code || '';
        description = code ? `${code} - ${reason}` : reason;
        severity = 'WARNING';
        break;
      case 'STOP_ENDED':
        title = 'Parada Encerrada';
        description = 'Retorno às atividades';
        break;
      case 'STATUS_CHANGED':
        title = 'Estado Alterado';
        description = `${p.fromState || ''} â†’ ${p.toState || p.status || ''}`;
        break;
      case 'CHECKLIST':
        title = 'Checklist Realizado';
        description = p.formName || 'Checklist de rotina';
        break;
      case 'FUELING':
        title = 'Abastecimento';
        description = `${p.dieselLiters || 0}L - Horímetro: ${p.hourmeter || ''}`;
        break;
      case 'SYNC_ERROR':
        title = 'Erro de Sincronismo';
        description = p.errorMessage || 'Falha ao enviar dados';
        severity = 'CRITICAL';
        break;
      case 'OPERATION_SELECTED':
      case 'OPERATION_CHANGED':
        title = 'Operação Atualizada';
        description = p.operationName || p.operationCode || 'Nova operação selecionada';
        break;
      default:
        // Keep original type as title if not mapped
        description = JSON.stringify(p);
    }

    const now = evt.receivedAt || evt.timestamp || new Date().toISOString();
    return {
      // BaseEntity fields
      id: evt.offlineId || Math.random().toString(36).substring(2, 11),
      tenantId: evt.tenantId || 'default',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      createdBy: 'system',
      updatedBy: 'system',
      entityStatus: 'ATIVO' as const,
      version: 1,
      history: [],
      // TimelineEvent fields
      title,
      description,
      type: evt.type as TimelineEventType,
      timestamp,
      severity,
      equipmentId: evt.equipmentId,
      operatorId: p.operatorId || p.operatorRegistration,
      metadata: p,
    };
  }

  private static processEvents(events: TimelineEvent[]): TimelineEvent[] {
    // Sort by timestamp DESC
    const sorted = [...events].sort((a, b) => {
      const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return tb - ta;
    });

    // Group GPS/HEARTBEAT: if multiple consecutive events of the same type
    // within 5 minutes, only keep the most recent one?
    // Or just limit them.
  
    return sorted;
  }
}
