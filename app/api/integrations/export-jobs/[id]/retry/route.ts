import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { IntegrationExportJobStore } from '@/lib/integrations/export-job-store';
import { canRetryIntegrationJob } from '@/lib/integrations/ficha-integration';
import { resolveIntegrationAdapter } from '@/lib/integrations/adapter-registry';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const perm = requirePermission(req, 'sincronizacao', 'editar', tenantId);
  if (perm) return perm;

  const { id } = params;
  const job = IntegrationExportJobStore.getJobById(tenantId, id);
  if (!job) return NextResponse.json({ error: 'Job nao encontrado' }, { status: 404 });
  if (!canRetryIntegrationJob(job.status)) {
    return NextResponse.json({ error: 'Job nao pode ser reprocessado neste estado' }, { status: 422 });
  }

  const reset = IntegrationExportJobStore.retryJob(tenantId, id);
  if (!reset) return NextResponse.json({ error: 'Falha ao preparar retry' }, { status: 500 });

  const adapter = resolveIntegrationAdapter(reset.targetSystem, reset.targetAdapter);
  let updated = reset;
  try {
    await adapter.export(reset);
    updated = IntegrationExportJobStore.getJobById(tenantId, id) ?? reset;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao reprocessar job';
    updated = IntegrationExportJobStore.markFailed(tenantId, id, message) ?? reset;
  }

  auditFromRequest(req, tenantId, {
    userId: 'system',
    action: 'INTEGRATION_JOB_RETRY',
    entity: 'integration-export-job',
    entityId: id,
    metadata: { status: updated.status },
  });

  return NextResponse.json({ ok: true, job: updated });
}
