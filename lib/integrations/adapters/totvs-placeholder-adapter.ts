import fs from 'fs';
import path from 'path';
import { BaseIntegrationAdapter } from '@/lib/integrations/adapters/base-adapter';
import { IntegrationExportJobStore } from '@/lib/integrations/export-job-store';
import type { IntegrationExportJob, IntegrationExportResult } from '@/lib/integrations/integration-types';

function resolveStorageDir(): string {
  const dir =
    process.env.SILO_STORAGE_DIR ||
    process.env.SILO_DATA_DIR ||
    (process.env.NODE_ENV === 'production' ? '/app/data' : './data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const DATA_ROOT = resolveStorageDir();

export class TotvsPlaceholderAdapter extends BaseIntegrationAdapter {
  readonly targetSystem = 'TOTVS' as const;
  readonly adapterName = 'TOTVS_PLACEHOLDER' as const;

  async export(job: IntegrationExportJob): Promise<IntegrationExportResult> {
    const dir = path.join(DATA_ROOT, job.tenantId, 'exports', 'totvs');
    fs.mkdirSync(dir, { recursive: true });
    const fileName = `totvs-placeholder-${job.createdAt.slice(0, 10)}-${job.id}.json`;
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, JSON.stringify({ jobId: job.id, payload: job.payload, generatedAt: new Date().toISOString() }, null, 2), 'utf-8');
    IntegrationExportJobStore.markExported(job.tenantId, job.id, { success: true, fileName });
    return {
      success: true,
      fileName,
      rawResponse: { filePath },
    };
  }
}
