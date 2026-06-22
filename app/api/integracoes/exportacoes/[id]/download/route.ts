import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { IntegrationExportStorage } from '@/lib/integrations/integration-export-storage';
import { existsFile, readBuffer, resolveSafeExportPath } from '@/lib/integrations/integration-export-files';
import { IntegrationLogStorage } from '@/lib/integrations/integration-log-storage';
import type { ExportTargetSystem } from '@/lib/integrations/integration-export-types';
import type { IntegrationSystem } from '@/lib/integrations/integration-job-types';

export const dynamic = 'force-dynamic';

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...(extra ?? {}) }, { status });
}

function toIntegrationSystem(targetSystem: ExportTargetSystem): IntegrationSystem {
  if (targetSystem === 'SILO' || targetSystem === 'POWER_BI') return 'EXPORTACAO';
  return targetSystem as IntegrationSystem;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const perm = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (perm) return perm;

  const item = IntegrationExportStorage.getById(tenant.tenantId, params.id);
  if (!item) return fail(404, 'Exportacao nao encontrada');
  if (item.status !== 'SUCCESS' || !item.fileName || !item.filePath) return fail(422, 'Exportacao sem arquivo disponivel');

  let filePath: string;
  try {
    filePath = resolveSafeExportPath(tenant.tenantId, item.id, item.fileName);
  } catch {
    return fail(400, 'Caminho de arquivo invalido');
  }
  if (!existsFile(filePath)) return fail(404, 'Arquivo nao encontrado');

  IntegrationLogStorage.create({
    tenantId: tenant.tenantId,
    system: toIntegrationSystem(item.targetSystem),
    level: 'INFO',
    event: 'EXPORT_DOWNLOAD_REQUESTED',
    message: 'Download solicitado.',
    jobId: item.jobId,
    createdBy: undefined,
    metadata: { exportId: item.id, fileName: item.fileName },
  });

  const contentType = item.format === 'CSV' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8';
  return new NextResponse(readBuffer(filePath).toString('utf-8'), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${item.fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
