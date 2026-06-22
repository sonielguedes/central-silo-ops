export type TotvsMappingType =
  | 'COST_CENTER'
  | 'WORK_ORDER'
  | 'EQUIPMENT'
  | 'FUEL_TRUCK'
  | 'PRODUCT'
  | 'FUEL_PUMP'
  | 'OPERATOR'
  | 'IMPLEMENT';

export type TotvsMappingStatus = 'ACTIVE' | 'INACTIVE' | 'PENDING_REVIEW';

export interface TotvsMapping {
  id: string;
  tenantId: string;
  type: TotvsMappingType;
  siloCode: string;
  siloName?: string;
  totvsCode: string;
  totvsName?: string;
  description?: string;
  status: TotvsMappingStatus;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export type TotvsValidationStatus = 'SUCCESS' | 'WARNING' | 'FAILED';

export type TotvsValidationIssueType =
  | 'MISSING_COST_CENTER_MAPPING'
  | 'MISSING_WORK_ORDER_MAPPING'
  | 'MISSING_EQUIPMENT_MAPPING'
  | 'MISSING_FUEL_TRUCK_MAPPING'
  | 'MISSING_PRODUCT_MAPPING'
  | 'MISSING_FUEL_PUMP_MAPPING'
  | 'MISSING_OPERATOR_MAPPING'
  | 'MISSING_IMPLEMENT_MAPPING'
  | 'MISSING_REQUIRED_FIELD'
  | 'UNKNOWN_ERROR';

export type TotvsValidationTargetDataType =
  | 'FICHA_OPERADOR'
  | 'FUEL_JOURNEY'
  | 'FUELINGS';

export interface TotvsValidationIssue {
  type: TotvsValidationIssueType;
  message: string;
  field?: string;
  siloCode?: string;
  suggestedAction?: string;
}

export interface TotvsValidationResult {
  id: string;
  tenantId: string;
  status: TotvsValidationStatus;
  targetDataType: TotvsValidationTargetDataType;
  periodStart: string;
  periodEnd: string;
  referenceId?: string;
  journeyId?: string;
  fleetCode?: string;
  operatorRegistration?: string;
  sourceCount: number;
  sources: Array<'FICHA_OPERADOR' | 'FUEL_JOURNEY' | 'FUELINGS'>;
  issues: TotvsValidationIssue[];
  checkedAt: string;
  checkedBy?: string;
}

export interface TotvsValidationInput {
  tenantId: string;
  targetDataType: TotvsValidationTargetDataType;
  periodStart?: string;
  periodEnd?: string;
  referenceId?: string;
  filters?: {
    fleetCode?: string;
    operatorRegistration?: string;
    journeyId?: string;
  };
  checkedBy?: string;
}
