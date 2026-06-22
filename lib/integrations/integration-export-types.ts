export type ExportTargetSystem = 'SILO' | 'PIMS' | 'TOTVS' | 'POWER_BI' | 'API_EXTERNA';

export type ExportDataType =
  | 'FICHA_OPERADOR'
  | 'JOURNEYS'
  | 'STOP_EVENTS'
  | 'HOURMETERS'
  | 'FUELINGS'
  | 'EQUIPMENTS'
  | 'OPERATORS'
  | 'OPERATIONS'
  | 'COST_CENTERS'
  | 'IMPLEMENTS'
  | 'FULL_OPERATIONAL_PACKAGE';

export type ExportFormat = 'JSON' | 'CSV' | 'ZIP';

export type ExportStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'CANCELED';

export interface IntegrationExportFilters {
  fleetCode?: string;
  operatorRegistration?: string;
  journeyId?: string;
  operationCode?: string;
  costCenterCode?: string;
}

export interface IntegrationExport {
  id: string;
  tenantId: string;
  targetSystem: ExportTargetSystem;
  dataType: ExportDataType;
  format: ExportFormat;
  title: string;
  description?: string;
  periodStart?: string;
  periodEnd?: string;
  filters?: IntegrationExportFilters;
  status: ExportStatus;
  filePath?: string;
  fileName?: string;
  fileSizeBytes?: number;
  recordCount?: number;
  jobId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  finishedAt?: string;
  createdBy?: string;
}

export interface OperationalPackage {
  schemaVersion: '1.0';
  source: 'SILO_OPS';
  tenantId: string;
  generatedAt: string;
  exportId: string;
  targetSystem: ExportTargetSystem;
  dataType: ExportDataType;
  period?: {
    start?: string;
    end?: string;
  };
  filters?: IntegrationExportFilters;
  records: OperationalExportRecord[];
}

export type OperationalExportRecord =
  | { recordType: 'FICHA_OPERADOR'; [key: string]: unknown }
  | { recordType: 'JOURNEY'; [key: string]: unknown }
  | { recordType: 'STOP_EVENT'; [key: string]: unknown }
  | { recordType: 'FUELING'; [key: string]: unknown }
  | { recordType: 'PACKAGE'; [key: string]: unknown };

