import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';

export async function POST(req: NextRequest) {
  try {
    const companyToken = (req.headers.get('x-company-token') || undefined)?.trim();
    if (!companyToken) return NextResponse.json({ error: 'X-Company-Token is required' }, { status: 401 });

    const company = ServerStorage.getCompanyByToken(companyToken);
    if (!company || company.status === 'INATIVO') return NextResponse.json({ error: 'Token invalido' }, { status: 403 });

    const tenantId = company.tenantId;
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

    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
