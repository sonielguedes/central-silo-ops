import type { TotvsDispatchDataType, TotvsDispatchPayload, TotvsDispatchReference } from './totvs-dispatch-types';

function clean(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clean);
  if (!value || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined) continue;
    out[key] = clean(entry);
  }
  return out;
}

export function buildTotvsDispatchPayload(input: {
  schemaVersion: string;
  source: 'SILO_OPS';
  target: 'TOTVS';
  environment: 'HOMOLOGACAO';
  tenantId: string;
  dispatchId: string;
  generatedAt: string;
  dataType: TotvsDispatchDataType;
  reference: TotvsDispatchReference;
  mappedData: Record<string, unknown>;
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
}): TotvsDispatchPayload {
  return {
    ...input,
    reference: clean(input.reference) as TotvsDispatchReference,
    mappedData: clean(input.mappedData) as TotvsDispatchPayload['mappedData'],
    operationalData: clean(input.operationalData) as TotvsDispatchPayload['operationalData'],
    fuelSupplies: input.fuelSupplies ? (clean(input.fuelSupplies) as TotvsDispatchPayload['fuelSupplies']) : undefined,
    validation: input.validation ? (clean(input.validation) as TotvsDispatchPayload['validation']) : undefined,
  };
}
