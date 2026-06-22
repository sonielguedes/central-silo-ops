import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { IntegrationExportStorage } from '@/lib/integrations/integration-export-storage';
import { IntegrationJobStorage } from '@/lib/integrations/integration-job-storage';
import { IntegrationLogStorage } from '@/lib/integrations/integration-log-storage';
import type { ExportTargetSystem } from '@/lib/integrations/integration-export-types';
import type { IntegrationSystem } from '@/lib/integrations/integration-job-types';

export const dynamic = 'force-dynamic';

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...(extra ?? {}) }, { status });
}

function actor(req: NextRequest): string | undefined {
  const session = resolveSessionFromRequest(req);
  return session?.name || session?.email || session?.id;
}

function toIntegrationSystem(targetSystem: ExportTargetSystem): IntegrationSystem {
  if (targetSystem === 'SILO' || targetSystem === 'POWER_BI') return 'EXPORTACAO';
  return targetSystem as IntegrationSystem;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const perm = requirePermission(req, 'integracoes', 'editar', tenant.tenantId);
  if (perm) return perm;

  const item = IntegrationExportStorage.getById(tenant.tenantId, params.id);
  if (!item) return fail(404, 'Exportacao nao encontrada');
  if (!['PENDING', 'PROCESSING'].includes(item.status)) return fail(422, 'Exportacao nao pode ser cancelada neste estado');

  const updated = IntegrationExportStorage.setStatus(tenant.tenantId, item.id, 'CANCELED', {
    finishedAt: new Date().toISOString(),
    errorMessage: 'Cancelada manualmente.',
  });
  if (item.jobId) {
    IntegrationJobStorage.cancel(tenant.tenantId, item.jobId, actor(req));
  }

  IntegrationLogStorage.create({
    tenantId: tenant.tenantId,
    system: toIntegrationSystem(item.targetSystem),
    level: 'WARN',
    event: 'EXPORT_CANCELED',
    message: 'Exportacao cancelada.',
    jobId: item.jobId,
    createdBy: actor(req),
    metadata: { exportId: item.id },
  });

  return NextResponse.json({ success: true, item: updated });
}
