import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { IntegrationExportStorage } from '@/lib/integrations/integration-export-storage';

export const dynamic = 'force-dynamic';

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...(extra ?? {}) }, { status });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const perm = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (perm) return perm;

  const item = IntegrationExportStorage.getById(tenant.tenantId, params.id);
  if (!item) return fail(404, 'Exportacao nao encontrada');
  return NextResponse.json({ success: true, item });
}

