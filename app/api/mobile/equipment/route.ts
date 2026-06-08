import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { Equipment } from '@/lib/types';
import { requireMobileAuth, requireTenant, maskToken, blockWriteInDemo } from '@/lib/auth/api-guard';

export async function POST(req: NextRequest) {
  try {
    const demoBlock = blockWriteInDemo(req);
    if (demoBlock) return demoBlock;

    const companyToken = (req.headers.get('x-company-token') || undefined)?.trim();
    let tenantId: string;
    let companyId: string | undefined;

    if (companyToken) {
      const auth = requireMobileAuth(req);
      if (!auth.ok) return auth.response;
      tenantId = auth.tenantId;
      companyId = auth.company.id;
    } else {
      // Fallback for Central UI — still requires valid tenant
      const webTenant = requireTenant(req);
      if (!webTenant.ok) return webTenant.response;
      tenantId = webTenant.tenantId;
    }

    const body = await req.json() as Equipment & {
      equipmentId?: string;
      fleetCode?: string;
      name?: string;
      type?: string;
    };

    const equipment = {
      ...body,
      id: body.id || body.equipmentId,
      code: body.code || body.fleetCode,
      typeId: body.typeId || body.type || 'MOBILE',
      brand: body.brand || body.name || body.code || body.fleetCode || 'Equipamento',
      tenantId,
      entityStatus: body.entityStatus || 'ATIVO',
      mobileEnabled: Boolean(body.mobileEnabled),
    } as Equipment;

    if (!equipment.code) {
      return NextResponse.json({ error: 'fleetCode/code is required' }, { status: 400 });
    }

    if (!equipment.id) {
      return NextResponse.json({ error: 'equipmentId is required' }, { status: 400 });
    }

    const saved = ServerStorage.upsertEquipment(equipment, tenantId);
    console.info('[mobile/equipment] equipment synced', {
      companyId,
      companyTenantId: tenantId,
      equipmentId: saved.id,
      fleetCode: saved.code,
      mobileEnabled: saved.mobileEnabled,
      status: saved.status,
      receivedCompanyToken: maskToken(companyToken),
    });

    return NextResponse.json({
      equipmentId: saved.id,
      fleetCode: saved.code,
      tenantId: saved.tenantId,
      mobileEnabled: saved.mobileEnabled,
      mobileToken: saved.mobileToken,
      status: saved.status,
    });
  } catch (error) {
    console.error('[mobile/equipment] failed to persist equipment', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
