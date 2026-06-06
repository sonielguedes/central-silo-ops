import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

export const dynamic = 'force-dynamic';

const maskToken = (token?: string) => {
  if (!token) return 'missing';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
};

export async function POST(req: NextRequest) {
  try {
    const companyToken = (req.headers.get('x-company-token') || undefined)?.trim();

    if (!companyToken) {
      return NextResponse.json({ error: 'X-Company-Token is required' }, { status: 401 });
    }

    const company = ServerStorage.getCompanyByToken(companyToken);

    if (!company || company.status === 'INATIVO') {
      return NextResponse.json({ error: 'Token invalido ou instancia inativa' }, { status: 403 });
    }

    const tenantId = company.tenantId;
    const body = await req.json();
    const { header, events } = body;

    if (!header || !header.machineId || !Array.isArray(events)) {
      return NextResponse.json({ error: 'Invalid batch format' }, { status: 400 });
    }

    // Strict tenant check as per requirements
    const bodyTenantId = header.tenantId || body.tenantId;
    if (bodyTenantId && bodyTenantId !== tenantId) {
      console.warn('[mobile/events/batch] tenant mismatch', {
        expected: tenantId,
        received: bodyTenantId,
        companyId: company.id
      });
      return NextResponse.json({ error: 'tenantId divergente do token' }, { status: 403 });
    }

    const mobileToken = header.mobileToken || events[0]?.data?.mobileToken;
    const equipment = ServerStorage.getEquipmentById(header.machineId, tenantId);
    const validation = ServerStorage.validateMobileEquipment(equipment, mobileToken, tenantId, companyToken);

    if (!validation.ok) {
      console.warn('[mobile/events/batch] validation failed', {
        companyId: company.id,
        companyTenantId: company.tenantId,
        receivedCompanyToken: maskToken(companyToken),
        error: validation.error
      });
      return NextResponse.json({ error: validation.error }, { status: validation.status });
    }

    const results = events.map((event: any) => {
      if (event.data?.mobileToken && event.data.mobileToken !== validation.equipment.mobileToken) {
        return { offlineId: event.uuid, status: 'REJECTED', reason: 'Token invalido' };
      }

      const status = ServerStorage.saveEvent({
        offlineId: event.uuid,
        equipmentId: validation.equipment.id,
        type: event.type,
        timestamp: new Date(event.timestamp).toISOString(),
        payload: event.data
      }, tenantId);

      return { offlineId: event.uuid, status };
    });

    // Update Live State based on batch events
    const lastLocation = [...events].reverse().find(e => e.type === 'LOCATION' || e.type === 'GPS');
    const lastStatus = [...events].reverse().find(e => ['WORK_STARTED', 'STOP_REASON', 'PARADA_DETECTADA', 'JOURNEY_END', 'HEARTBEAT'].includes(e.type));

    const liveUpdates: any = { lastHeartbeatAt: new Date().toISOString() };
    if (lastLocation) {
      liveUpdates.latitude = lastLocation.data.latitude;
      liveUpdates.longitude = lastLocation.data.longitude;
      liveUpdates.speed = lastLocation.data.speed;
      liveUpdates.accuracy = lastLocation.data.accuracy;
      liveUpdates.lastGpsAt = new Date(lastLocation.timestamp).toISOString();
    }
    if (lastStatus) {
      if (lastStatus.type === 'WORK_STARTED') liveUpdates.status = 'OPERANDO';
      else if (['STOP_REASON', 'PARADA_DETECTADA'].includes(lastStatus.type)) liveUpdates.status = 'PARADO';
      else if (lastStatus.type === 'JOURNEY_END') liveUpdates.status = 'FINALIZADO';
      else liveUpdates.status = 'ONLINE';

      if (lastStatus.data?.operationName) liveUpdates.currentOperation = lastStatus.data.operationName;
      if (lastStatus.data?.operatorName) liveUpdates.currentOperator = lastStatus.data.operatorName;
    }

    ServerStorage.updateLiveState(tenantId, validation.equipment.id, validation.equipment.code, liveUpdates);

    return NextResponse.json({ results, tenantId });
  } catch (error) {
    console.error('[mobile/events/batch] critical error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
