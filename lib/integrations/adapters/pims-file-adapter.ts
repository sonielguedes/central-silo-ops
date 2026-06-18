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

function writeFileAtomic(filePath: string, content: string): void {
  const tmp = filePath + '.tmp';
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, filePath);
}

function sanitizeName(value: string): string {
  return value.replace(/[^\w.-]+/g, '-');
}

export class PimsFileAdapter extends BaseIntegrationAdapter {
  readonly targetSystem = 'PIMS' as const;
  readonly adapterName = 'PIMS_FILE' as const;

  async export(job: IntegrationExportJob): Promise<IntegrationExportResult> {
    const fileName = sanitizeName(`pims-ficha-operador-${job.createdAt.slice(0, 10)}-frota-${job.payload.frota ?? 'unknown'}-job-${job.id}.json`);
    const dir = path.join(DATA_ROOT, job.tenantId, 'exports', 'pims');
    const filePath = path.join(dir, fileName);
    const content = JSON.stringify({
      jobId: job.id,
      tenantId: job.tenantId,
      sourceModule: job.sourceModule,
      sourceType: job.sourceType,
      sourceId: job.sourceId,
      targetSystem: job.targetSystem,
      operationType: job.operationType,
      payload: job.payload,
      generatedAt: new Date().toISOString(),
    }, null, 2);

    IntegrationExportJobStore.markProcessing(job.tenantId, job.id);
    writeFileAtomic(filePath, content);
    IntegrationExportJobStore.markExported(job.tenantId, job.id, { success: true, fileName });

    return {
      success: true,
      fileName,
      rawResponse: { filePath },
    };
  }
}
