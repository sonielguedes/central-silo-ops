import type { PimsValidationIssue, PimsValidationStatus, PimsValidationTargetDataType } from './pims-mapping-types';
import type { PimsDispatchPayload } from './pims-payload-builder';

export type PimsDispatchStatus = 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELED' | 'RETRYING';

export interface PimsDispatchInput {
  tenantId: string;
  configId?: string;
  jobId?: string;
  validationResultId?: string;
  targetDataType: PimsValidationTargetDataType;
  periodStart: string;
  periodEnd: string;
  referenceId?: string;
  filters?: {
    fleetCode?: string;
    operatorRegistration?: string;
    journeyId?: string;
  };
  mockMode: boolean;
  request: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  status: PimsDispatchStatus;
  createdBy?: string;
}

export interface PimsDispatch {
  id: string;
  tenantId: string;
  configId?: string;
  jobId?: string;
  validationResultId?: string;
  targetDataType: PimsValidationTargetDataType;
  periodStart: string;
  periodEnd: string;
  referenceId?: string;
  filters?: {
    fleetCode?: string;
    operatorRegistration?: string;
    journeyId?: string;
  };
  mockMode: boolean;
  request: Record<string, unknown>;
  requestPath: string;
  responsePath: string;
  attempts: number;
  maxAttempts: number;
  status: PimsDispatchStatus;
  responseStatusCode?: number;
  responseStatusText?: string;
  lastErrorCode?: string;
  lastErrorMessage?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  canceledAt?: string;
  createdBy?: string;
  updatedBy?: string;
  validationStatus?: PimsValidationStatus;
  validationIssues?: PimsValidationIssue[];
  payloadSummary?: {
    recordCount: number;
    fichaCount: number;
    journeyCount: number;
    stopCount: number;
    fuelingCount: number;
  };
}

export interface PimsDispatchSearch {
  status?: PimsDispatchStatus;
  q?: string;
  from?: string;
  to?: string;
}

export interface PimsDispatchServiceInput {
  tenantId: string;
  targetDataType: PimsValidationTargetDataType;
  periodStart?: string;
  periodEnd?: string;
  referenceId?: string;
  filters?: {
    fleetCode?: string;
    operatorRegistration?: string;
    journeyId?: string;
  };
  configId?: string;
  dispatchId?: string;
  jobId?: string;
  mockMode?: boolean;
  actor?: string;
}

export interface PimsDispatchServiceDeps {
  validate?: (input: {
    tenantId: string;
    targetDataType: PimsValidationTargetDataType;
    referenceId?: string;
    periodStart?: string;
    periodEnd?: string;
    filters?: {
      fleetCode?: string;
      operatorRegistration?: string;
      journeyId?: string;
    };
    checkedBy?: string;
  }) => Promise<{ status: PimsValidationStatus; issues: PimsValidationIssue[] } | { status: PimsValidationStatus; issues: PimsValidationIssue[] }>;
  loadOperationalRecords?: (tenantId: string, periodStart: string, periodEnd: string) => Promise<Array<Record<string, unknown>>>;
  send?: (input: {
    tenantId: string;
    configId: string;
    mockMode: boolean;
    payload: PimsDispatchPayload;
  }) => Promise<{ status: number; ok: boolean; body: Record<string, unknown> }>;
  now?: () => string;
}
