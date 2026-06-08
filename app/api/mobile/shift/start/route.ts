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
    const { equipmentId, mobileToken, operatorId, startTimestamp, offlineId } = body;

    const validation = ServerStorage.validateMobileEquipment(
      ServerStorage.getEquipmentById(equipmentId, tenantId),
      mobileToken,
      tenantId,
      companyToken
    );
    if (!validation.ok) return NextResponse.json({ error: validation.error }, { status: validation.status });

    const shiftId = `shift-${Date.now()}`;
    ServerStorage.updateEquipment(equipmentId, {
      activeShiftId: shiftId,
      currentOperatorId: operatorId,
      status: 'trabalhando'
    }, tenantId);

    ServerStorage.updateLiveState(tenantId, equipmentId, validation.equipment.code, {
      status: 'OPERANDO',
      currentOperator: operatorId, // In a real app we might lookup the name
      updatedAt: new Date().toISOString()
    });

    ServerStorage.saveEvent({
      offlineId: offlineId || `start-${Date.now()}`,
      equipmentId,
      type: 'SHIFT_START',
      timestamp: startTimestamp || new Date().toISOString(),
      payload: { operatorId, shiftId }
    }, tenantId);

    auditFromRequest(req, tenantId, { action: 'SHIFT_START', entity: 'shift', entityId: shiftId, metadata: { equipmentId, operatorId } });
    return NextResponse.json({ status: 'OK', shiftId });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
