import type { IntegrationAdapter, IntegrationExportJob, IntegrationExportResult } from '@/lib/integrations/integration-types';

export abstract class BaseIntegrationAdapter implements IntegrationAdapter {
  abstract readonly targetSystem: IntegrationAdapter['targetSystem'];
  abstract readonly adapterName: string;

  buildPayload(input: unknown): Promise<unknown> | unknown {
    return input;
  }

  abstract export(job: IntegrationExportJob): Promise<IntegrationExportResult>;
}
