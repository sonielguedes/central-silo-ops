import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { IntegrationExportJobStore } from '@/lib/integrations/export-job-store';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const perm = requirePermission(req, 'sincronizacao', 'visualizar', tenantId);
  if (perm) return perm;

  const { id } = params;
  const job = IntegrationExportJobStore.getJobById(tenantId, id);
  if (!job) return NextResponse.json({ error: 'Job nao encontrado' }, { status: 404 });

  return NextResponse.json({ job });
}
