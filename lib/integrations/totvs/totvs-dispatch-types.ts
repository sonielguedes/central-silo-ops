export type TotvsDispatchStatus =
  | 'PENDING'
  | 'VALIDATING'
  | 'BLOCKED'
  | 'SENDING'
  | 'SUCCESS'
  | 'FAILED'
  | 'RETRYING'
  | 'CANCELED';

export type TotvsDispatchDataType =
  | 'FICHA_OPERADOR'
  | 'JOURNEY'
  | 'FUEL_JOURNEY'
  | 'FUELINGS'
  | 'STOP_EVENTS'
  | 'FULL_OPERATIONAL_PACKAGE';

export interface TotvsDispatchReference {
  journeyId?: string;
  fleetCode?: string;
  comboioFleetCode?: string;
  operatorRegistration?: string;
  driverRegistration?: string;
}

export interface TotvsDispatchMappedCode {
  siloCode?: string;
  totvsCode?: string;
}

export interface TotvsDispatchPayload {
  schemaVersion: string;
  source: 'SILO_OPS';
  target: 'TOTVS';
  environment: 'HOMOLOGACAO';
  tenantId: string;
  dispatchId: string;
  generatedAt: string;
  dataType: TotvsDispatchDataType;
  reference: TotvsDispatchReference;
  mappedData: Record<string, TotvsDispatchMappedCode | Record<string, TotvsDispatchMappedCode>>;
  operationalData: Record<string, unknown>;
  fuelSupplies?: Array<Record<string, unknown>>;
  validation?: {
    status: 'SUCCESS' | 'WARNING' | 'FAILED';
    issues: Array<Record<string, unknown>>;
  };
  summary: {
    recordCount: number;
    journeyCount: number;
    fuelingCount: number;
  };
}

export interface TotvsDispatch {
  id: string;
  tenantId: string;
  configId: string;
  environment: 'HOMOLOGACAO';
  dataType: TotvsDispatchDataType;
  referenceId?: string;
  journeyId?: string;
  fleetCode?: string;
  comboioFleetCode?: string;
  operatorRegistration?: string;
  driverRegistration?: string;
  status: TotvsDispatchStatus;
  validationResultId?: string;
  exportId?: string;
  jobId?: string;
  requestPayloadPath?: string;
  responsePayloadPath?: string;
  httpStatus?: number;
  totvsProtocol?: string;
  totvsMessage?: string;
  attempts: number;
  maxAttempts: number;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  finishedAt?: string;
  createdBy?: string;
}

export interface TotvsDispatchSearch {
  status?: TotvsDispatchStatus;
  dataType?: TotvsDispatchDataType;
  fleetCode?: string;
  comboioFleetCode?: string;
  operatorRegistration?: string;
  driverRegistration?: string;
  from?: string;
  to?: string;
  q?: string;
}

export interface TotvsDispatchServiceInput {
  tenantId: string;
  dataType: TotvsDispatchDataType;
  referenceId?: string;
  journeyId?: string;
  fleetCode?: string;
  comboioFleetCode?: string;
  operatorRegistration?: string;
  driverRegistration?: string;
  periodStart?: string;
  periodEnd?: string;
  configId?: string;
  dispatchId?: string;
  jobId?: string;
  maxAttempts?: number;
  mockMode?: boolean;
  actor?: string;
}

export interface TotvsDispatchServiceDeps {
  validate?: (input: {
    tenantId: string;
    targetDataType: import('./totvs-mapping-types').TotvsValidationTargetDataType;
    referenceId?: string;
    periodStart?: string;
    periodEnd?: string;
    filters?: {
      fleetCode?: string;
      operatorRegistration?: string;
      journeyId?: string;
    };
    checkedBy?: string;
  }) => Promise<import('./totvs-mapping-types').TotvsValidationResult> | import('./totvs-mapping-types').TotvsValidationResult;
  send?: (input: {
    tenantId: string;
    configId: string;
    payload: TotvsDispatchPayload;
    mockMode: boolean;
  }) => Promise<{ status: number; ok: boolean; body: Record<string, unknown> }>;
  now?: () => string;
}
