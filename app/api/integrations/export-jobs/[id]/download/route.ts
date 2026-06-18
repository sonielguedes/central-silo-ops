import fs from 'fs';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { IntegrationExportJobStore } from '@/lib/integrations/export-job-store';

export const dynamic = 'force-dynamic';

function resolveStorageDir(): string {
  return process.env.SILO_STORAGE_DIR || process.env.SILO_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/app/data' : './data');
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const { tenantId } = tenant;

  const perm = requirePermission(req, 'sincronizacao', 'visualizar', tenantId);
  if (perm) return perm;

  const { id } = params;
  const job = IntegrationExportJobStore.getJobById(tenantId, id);
  if (!job?.fileName) return NextResponse.json({ error: 'Arquivo nao encontrado' }, { status: 404 });

  const baseDir = resolveStorageDir();
  const relDir = job.targetAdapter === 'TOTVS_PLACEHOLDER' ? ['exports', 'totvs'] : ['exports', 'pims'];
  const filePath = path.join(baseDir, tenantId, ...relDir, job.fileName);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Arquivo nao encontrado' }, { status: 404 });
  }

  const content = fs.readFileSync(filePath);
  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${job.fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
