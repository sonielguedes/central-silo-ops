import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { IntegrationExportJobStore } from '@/lib/integrations/export-job-store';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const perm = requirePermission(req, 'sincronizacao', 'editar', tenantId);
  if (perm) return perm;

  const { id } = params;
  const cancelled = IntegrationExportJobStore.cancelJob(tenantId, id);
  if (!cancelled) {
    return NextResponse.json({ error: 'Job nao pode ser cancelado neste estado' }, { status: 422 });
  }

  auditFromRequest(req, tenantId, {
    userId: 'system',
    action: 'INTEGRATION_JOB_CANCELLED',
    entity: 'integration-export-job',
    entityId: id,
    metadata: { status: cancelled.status },
  });

  return NextResponse.json({ ok: true, job: cancelled });
}
