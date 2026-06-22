export type PimsMappingType =
  | 'OPERATION'
  | 'STOP_REASON'
  | 'COST_CENTER'
  | 'EQUIPMENT'
  | 'OPERATOR'
  | 'IMPLEMENT'
  | 'WORK_ORDER'
  | 'FICHA_FIELD';

export type PimsMappingStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING_REVIEW';

export interface PimsMapping {
  id: string;
  tenantId: string;
  type: PimsMappingType;
  siloCode: string;
  siloName?: string;
  pimsCode: string;
  pimsName?: string;
  description?: string;
  status: PimsMappingStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export type PimsValidationStatus = 'SUCCESS' | 'WARNING' | 'FAILED';

export type PimsValidationIssueType =
  | 'MISSING_OPERATION_MAPPING'
  | 'MISSING_STOP_REASON_MAPPING'
  | 'MISSING_COST_CENTER_MAPPING'
  | 'MISSING_EQUIPMENT_MAPPING'
  | 'MISSING_OPERATOR_MAPPING'
  | 'MISSING_IMPLEMENT_MAPPING'
  | 'INVALID_HOURMETER'
  | 'MISSING_REQUIRED_FIELD'
  | 'UNKNOWN_ERROR';

export type PimsValidationTargetDataType =
  | 'FICHA_OPERADOR'
  | 'JOURNEY'
  | 'STOP_EVENTS'
  | 'FULL_OPERATIONAL_PACKAGE';

export interface PimsValidationIssue {
  type: PimsValidationIssueType;
  message: string;
  field?: string;
  siloCode?: string;
  suggestedAction?: string;
}

export interface PimsValidationResult {
  id: string;
  tenantId: string;
  status: PimsValidationStatus;
  targetDataType: PimsValidationTargetDataType;
  referenceId?: string;
  journeyId?: string;
  fleetCode?: string;
  operatorRegistration?: string;
  issues: PimsValidationIssue[];
  checkedAt: string;
  checkedBy?: string;
}

export interface PimsValidationInput {
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
}
