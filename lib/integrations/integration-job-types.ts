export type IntegrationSystem = 'PIMS' | 'TOTVS' | 'EXPORTACAO' | 'API_EXTERNA';

export type IntegrationJobType =
  | 'EXPORT_FICHA_OPERADOR'
  | 'EXPORT_JOURNEY'
  | 'EXPORT_STOP_EVENTS'
  | 'EXPORT_FUELINGS'
  | 'SYNC_MASTER_DATA'
  | 'TEST_CONNECTION'
  | 'SEND_PIMS_HOMOLOGATION'
  | 'SEND_TOTVS_HOMOLOGATION'
  | 'MANUAL';

export type IntegrationJobStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCESS'
  | 'FAILED'
  | 'CANCELED'
  | 'RETRYING';

export type IntegrationJobSource = 'MANUAL' | 'SYSTEM' | 'API';

export type IntegrationLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

export interface IntegrationJob {
  id: string;
  tenantId: string;
  system: IntegrationSystem;
  configId?: string;
  type: IntegrationJobType;
  status: IntegrationJobStatus;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  canceledAt?: string;
  createdBy?: string;
  updatedBy?: string;
  source: IntegrationJobSource;
}

export interface IntegrationLog {
  id: string;
  tenantId: string;
  jobId?: string;
  configId?: string;
  system: IntegrationSystem;
  level: IntegrationLogLevel;
  event: string;
  message: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  createdBy?: string;
}
