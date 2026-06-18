import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { IntegrationExportJobStore } from '@/lib/integrations/export-job-store';
import { buildFichaIntegrationJobInput } from '@/lib/integrations/ficha-integration';
import { resolveIntegrationAdapter } from '@/lib/integrations/adapter-registry';
import type { IntegrationJobStatus } from '@/lib/integrations/integration-types';

export const dynamic = 'force-dynamic';

function sessionUser(req: NextRequest): string {
  const header = req.headers.get('x-user-name')?.trim();
  if (header) return header;
  return 'system';
}

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const perm = requirePermission(req, 'sincronizacao', 'visualizar', tenantId);
  if (perm) return perm;

  const sp = req.nextUrl.searchParams;
  const jobs = IntegrationExportJobStore.listJobs(tenantId, {
    targetSystem: sp.get('targetSystem')?.trim() || undefined,
    sourceModule: sp.get('sourceModule')?.trim() || undefined,
    status: (sp.get('status')?.trim() || undefined) as IntegrationJobStatus | undefined,
    sourceId: sp.get('sourceId')?.trim() || undefined,
    from: sp.get('from')?.trim() || undefined,
    to: sp.get('to')?.trim() || undefined,
  });

  return NextResponse.json({
    items: jobs,
    total: jobs.length,
  });
}

export async function POST(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const perm = requirePermission(req, 'sincronizacao', 'editar', tenantId);
  if (perm) return perm;

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const targetSystem = String(body.targetSystem ?? 'PIMS').toUpperCase() as 'PIMS' | 'TOTVS' | 'GENERIC_ERP';
  const targetAdapter = String(body.targetAdapter ?? (targetSystem === 'TOTVS' ? 'TOTVS_PLACEHOLDER' : 'PIMS_FILE'));
  const createdBy = String(body.createdBy ?? sessionUser(req));

  const target = String(body.target ?? 'FICHA_OPERADOR');
  const fleetCode = String(body.fleetCode ?? '');
  const date = String(body.date ?? '');
  if (!fleetCode || !date) {
    return NextResponse.json({ error: 'fleetCode e date sao obrigatorios' }, { status: 400 });
  }

  const built = buildFichaIntegrationJobInput({
    tenantId,
    fleetCode,
    date,
    targetSystem: targetSystem === 'TOTVS' ? 'TOTVS' : 'PIMS',
    targetAdapter,
  });
  if (!built.ok || !built.payload || !built.sourceId || !built.sourceModule) {
    return NextResponse.json(
      {
        ok: false,
        error: built.error ?? 'Nao foi possivel gerar payload de integracao',
        blockingReasons: built.blockingReasons ?? [],
      },
      { status: built.status ?? 422 },
    );
  }

  const job = IntegrationExportJobStore.createJob({
    tenantId,
    sourceModule: built.sourceModule,
    sourceType: built.sourceType ?? target,
    sourceId: built.sourceId,
    targetSystem: built.targetSystem ?? 'PIMS',
    targetAdapter: built.targetAdapter ?? 'PIMS_FILE',
    operationType: built.operationType ?? 'CREATE',
    payload: built.payload,
    createdBy,
    payloadHash: built.payloadHash,
  });

  const duplicate = job.status !== 'PENDING' || job.attemptCount > 0;
  const adapter = resolveIntegrationAdapter(job.targetSystem, job.targetAdapter);
  let exportedJob = job;
  if (job.status === 'PENDING' && job.attemptCount === 0) {
    try {
      await adapter.export(job);
      exportedJob = IntegrationExportJobStore.getJobById(tenantId, job.id) ?? job;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao processar job';
      exportedJob = IntegrationExportJobStore.markFailed(tenantId, job.id, message) ?? job;
    }
  }

  auditFromRequest(req, tenantId, {
    userId: createdBy,
    action: duplicate ? 'INTEGRATION_JOB_DUPLICATED' : 'INTEGRATION_JOB_CREATED',
    entity: 'integration-export-job',
    entityId: exportedJob.id,
    metadata: {
      targetSystem: exportedJob.targetSystem,
      targetAdapter: exportedJob.targetAdapter,
      sourceModule: exportedJob.sourceModule,
      sourceId: exportedJob.sourceId,
      status: exportedJob.status,
    },
  });

  return NextResponse.json({
    ok: true,
    duplicated: duplicate,
    job: exportedJob,
  }, { status: duplicate ? 200 : 201 });
}
