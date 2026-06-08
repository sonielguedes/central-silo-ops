import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { requireMobileAuth } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';

export async function POST(req: NextRequest) {
  try {
    const auth = requireMobileAuth(req);
    if (!auth.ok) return auth.response;

    const { tenantId, companyToken } = auth;
    const body = await req.json();
    const { equipmentId, mobileToken, endTimestamp, offlineId } = body;

    const validation = ServerStorage.validateMobileEquipment(
      ServerStorage.getEquipmentById(equipmentId, tenantId),
      mobileToken,
      tenantId,
      companyToken
    );
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: validation.status });

    ServerStorage.updateEquipment(equipmentId, {
      activeShiftId: undefined,
      currentOperatorId: undefined,
      status: 'parada'
    }, tenantId);

    ServerStorage.updateLiveState(tenantId, equipmentId, validation.equipment.code, {
      status: 'FINALIZADO',
      currentOperator: undefined,
      updatedAt: new Date().toISOString()
    });

    ServerStorage.saveEvent({
      offlineId: offlineId || `end-${Date.now()}`,
      equipmentId,
      type: 'SHIFT_END',
      timestamp: endTimestamp || new Date().toISOString(),
      payload: { }
    }, tenantId);

    auditFromRequest(req, tenantId, { action: 'SHIFT_END', entity: 'shift', entityId: equipmentId });
    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
