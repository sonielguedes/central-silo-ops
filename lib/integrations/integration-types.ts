export type IntegrationSourceModule =
  | 'FICHA_OPERADOR'
  | 'ABASTECIMENTO'
  | 'OPERACAO'
  | 'PARADA'
  | 'MANUTENCAO';

export type IntegrationTargetSystem = 'PIMS' | 'TOTVS' | 'GENERIC_ERP';
export type IntegrationOperationType = 'CREATE' | 'UPDATE' | 'CANCEL' | 'REPROCESS';
export type IntegrationJobStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'EXPORTED'
  | 'ACKNOWLEDGED'
  | 'FAILED'
  | 'CANCELLED'
  | 'REPROCESS_REQUIRED';

export interface IntegrationExportJob {
  id: string;
  tenantId: string;
  sourceModule: IntegrationSourceModule;
  sourceType: string;
  sourceId: string;
  targetSystem: IntegrationTargetSystem;
  targetAdapter: string;
  operationType: IntegrationOperationType;
  payload: Record<string, unknown>;
  payloadHash: string;
  status: IntegrationJobStatus;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt: string | null;
  exportedAt: string | null;
  acknowledgedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  fileName?: string | null;
  externalId?: string | null;
  protocol?: string | null;
}

export interface IntegrationExportResult {
  success: boolean;
  externalId?: string;
  protocol?: string;
  fileName?: string;
  rawResponse?: unknown;
  errorMessage?: string;
}

export interface IntegrationAdapter {
  readonly targetSystem: IntegrationTargetSystem;
  readonly adapterName: string;
  buildPayload(input: unknown): Promise<unknown> | unknown;
  export(job: IntegrationExportJob): Promise<IntegrationExportResult>;
}
