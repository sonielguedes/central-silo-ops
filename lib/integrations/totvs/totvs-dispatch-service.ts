import { buildDailySheetList } from '@/lib/daily-sheet-builder';
import { FuelJourneyStorage } from '@/lib/fuel-journey-storage';
import { FuelingStorage } from '@/lib/fueling-storage';
import { IntegrationConfigStorage } from '../integration-config-storage';
import { IntegrationJobStorage } from '../integration-job-storage';
import { IntegrationLogStorage } from '../integration-log-storage';
import { validateTotvsPreValidation } from './totvs-validation-engine';
import { TotvsDispatchStorage } from './totvs-dispatch-storage';
import { buildTotvsDispatchPayload } from './totvs-payload-builder';
import { sendTotvsDispatchPayload } from './totvs-client';
import type {
  TotvsDispatchServiceDeps,
  TotvsDispatchServiceInput,
} from './totvs-dispatch-types';
import type { TotvsValidationIssue, TotvsValidationTargetDataType } from './totvs-mapping-types';

const CRITICAL_ISSUES = new Set([
  'MISSING_COST_CENTER_MAPPING',
  'MISSING_WORK_ORDER_MAPPING',
  'MISSING_EQUIPMENT_MAPPING',
  'MISSING_OPERATOR_MAPPING',
  'MISSING_FUEL_TRUCK_MAPPING',
  'MISSING_PRODUCT_MAPPING',
  'MISSING_FUEL_PUMP_MAPPING',
  'INVALID_HOURMETER',
  'INVALID_ODOMETER',
  'INVALID_FUEL_VOLUME',
  'MISSING_REQUIRED_FIELD',
]);

function nowIso() {
  return new Date().toISOString();
}

function fail(error: string, message: string, extra?: Record<string, unknown>) {
  return { success: false as const, error, message, ...(extra ?? {}) };
}

function pickHomologConfig(tenantId: string, configId?: string) {
  const configs = IntegrationConfigStorage.listStoredByTenant(tenantId).filter((item) => item.system === 'TOTVS' && item.status === 'ACTIVE');
  if (configId) {
    const found = configs.find((item) => item.id === configId);
    if (!found) return { error: 'TOTVS_HOMOLOG_CONFIG_NOT_FOUND', message: 'Nenhuma configuração TOTVS Homologação ativa foi encontrada para este tenant.' };
    if (found.environment === 'PRODUCAO') return { error: 'TOTVS_PRODUCTION_BLOCKED', message: 'Configuração TOTVS Produção não pode ser usada nesta etapa.' };
    return { config: found };
  }
  const homolog = configs.find((item) => item.environment === 'HOMOLOGACAO');
  if (homolog) return { config: homolog };
  const prod = configs.find((item) => item.environment === 'PRODUCAO');
  if (prod) return { error: 'TOTVS_PRODUCTION_BLOCKED', message: 'Configuração TOTVS Produção não pode ser usada nesta etapa.' };
  return { error: 'TOTVS_HOMOLOG_CONFIG_NOT_FOUND', message: 'Nenhuma configuração TOTVS Homologação ativa foi encontrada para este tenant.' };
}

function isNoOperationalDataWarning(issues: TotvsValidationIssue[]): boolean {
  return issues.length === 1 && issues[0]?.message === 'Nenhum registro operacional encontrado para o filtro informado.';
}

function hasCriticalIssue(issues: TotvsValidationIssue[]): boolean {
  return issues.some((issue) => CRITICAL_ISSUES.has(issue.type));
}

async function defaultValidate(input: {
  tenantId: string;
  targetDataType: TotvsValidationTargetDataType;
  referenceId?: string;
  periodStart?: string;
  periodEnd?: string;
  filters?: {
    fleetCode?: string;
    operatorRegistration?: string;
    journeyId?: string;
  };
  checkedBy?: string;
}) {
  return validateTotvsPreValidation(input);
}

function toValidationTarget(dataType: TotvsDispatchServiceInput['dataType']): TotvsValidationTargetDataType {
  switch (dataType) {
    case 'JOURNEY':
    case 'FUEL_JOURNEY':
      return 'FUEL_JOURNEY';
    case 'FUELINGS':
      return 'FUELINGS';
    case 'STOP_EVENTS':
      return 'FUEL_JOURNEY';
    case 'FULL_OPERATIONAL_PACKAGE':
      return 'FICHA_OPERADOR';
    case 'FICHA_OPERADOR':
    default:
      return 'FICHA_OPERADOR';
  }
}

function readOperationalInputs(input: TotvsDispatchServiceInput, periodStart: string, periodEnd: string) {
  const fichas = buildDailySheetList({ tenantId: input.tenantId, date: periodStart, fleetCodeFilter: input.fleetCode ?? null });
  const journeys = FuelJourneyStorage.getAll(input.tenantId).filter((item) => {
    const day = item.occurredAt.slice(0, 10);
    return day >= periodStart && day <= periodEnd && (!input.journeyId || item.payload?.journeyId === input.journeyId);
  });
  const fuelings = FuelingStorage.getAll(input.tenantId, {
    from: `${periodStart}T00:00:00.000Z`,
    to: `${periodEnd}T23:59:59.999Z`,
    fleetCode: input.fleetCode,
    targetFleetCode: input.comboioFleetCode,
  }).filter((item) => !input.driverRegistration || item.operatorRegistration === input.driverRegistration);
  return { fichas, journeys, fuelings };
}

function buildMappedData(configId: string, input: TotvsDispatchServiceInput, evidence: ReturnType<typeof readOperationalInputs>) {
  const firstJourney = evidence.journeys[0];
  const firstFicha = evidence.fichas[0];
  const firstFueling = evidence.fuelings[0];
  return {
    fuelTruck: {
      siloCode: input.comboioFleetCode ?? input.fleetCode ?? firstJourney?.payload?.comboioFleetCode ?? '',
      totvsCode: input.comboioFleetCode ?? input.fleetCode ?? firstJourney?.payload?.comboioFleetCode ?? '',
    },
    driver: {
      siloCode: input.driverRegistration ?? input.operatorRegistration ?? firstFueling?.operatorRegistration ?? '',
      totvsCode: input.driverRegistration ?? input.operatorRegistration ?? firstFueling?.operatorRegistration ?? '',
    },
    costCenter: {
      siloCode: firstFicha?.costCenterName ?? firstJourney?.payload?.costCenterCode ?? '',
      totvsCode: firstFicha?.costCenterName ?? firstJourney?.payload?.costCenterCode ?? '',
    },
    workOrder: {
      siloCode: firstFicha?.workOrderNumber ?? firstJourney?.payload?.workOrderNumber ?? '',
      totvsCode: firstFicha?.workOrderNumber ? `OS${String(firstFicha.workOrderNumber).padStart(6, '0')}` : firstJourney?.payload?.workOrderNumber ?? '',
    },
    configId,
  };
}

function buildFuelSupplies(fuelings: Awaited<ReturnType<typeof FuelingStorage.getAll>>) {
  return fuelings.map((item) => ({
    fleetCode: item.fleetCode,
    equipmentTotvsCode: item.fleetCode,
    productCode: item.fuelType ?? '',
    productTotvsCode: item.fuelType ?? '',
    pumpCode: item.pumpCode ?? item.truckFleetCode ?? '',
    pumpTotvsCode: item.pumpCode ?? item.truckFleetCode ?? '',
    liters: item.dieselLiters,
    occurredAt: item.fueledAt,
  }));
}

async function executeSend(input: TotvsDispatchServiceInput, deps: TotvsDispatchServiceDeps = {}) {
  const periodStart = input.periodStart ?? new Date().toISOString().slice(0, 10);
  const periodEnd = input.periodEnd ?? periodStart;
  const validationTarget = toValidationTarget(input.dataType);
  const configPick = pickHomologConfig(input.tenantId, input.configId);
  if ('error' in configPick) {
    return fail(
      configPick.error ?? 'TOTVS_HOMOLOG_CONFIG_NOT_FOUND',
      configPick.message ?? 'Nenhuma configuração TOTVS Homologação ativa foi encontrada para este tenant.',
    );
  }
  const config = configPick.config;
  if (!config) return fail('TOTVS_HOMOLOG_CONFIG_NOT_FOUND', 'Nenhuma configuração TOTVS Homologação ativa foi encontrada para este tenant.');

  const dispatch = TotvsDispatchStorage.create({
    tenantId: input.tenantId,
    configId: config.id,
    dataType: input.dataType,
    referenceId: input.referenceId,
    journeyId: input.journeyId,
    fleetCode: input.fleetCode,
    comboioFleetCode: input.comboioFleetCode,
    operatorRegistration: input.operatorRegistration,
    driverRegistration: input.driverRegistration,
    status: 'PENDING',
    attempts: 0,
    maxAttempts: Math.min(10, Math.max(1, input.maxAttempts ?? 3)),
    createdBy: input.actor,
  });

  const job = IntegrationJobStorage.create({
    tenantId: input.tenantId,
    system: 'TOTVS',
    type: 'SEND_TOTVS_HOMOLOGATION',
    title: 'Envio TOTVS Homologação',
    description: 'Envio controlado para TOTVS em homologação com pré-validação obrigatória.',
    payload: { dispatchId: dispatch.id, configId: config.id, dataType: input.dataType },
    configId: config.id,
    maxAttempts: dispatch.maxAttempts,
    source: 'API',
    createdBy: input.actor,
  });

  TotvsDispatchStorage.update(input.tenantId, dispatch.id, { jobId: job.id, status: 'VALIDATING' });
  IntegrationLogStorage.create({
    tenantId: input.tenantId,
    jobId: job.id,
    configId: config.id,
    system: 'TOTVS',
    level: 'INFO',
    event: 'TOTVS_DISPATCH_CREATED',
    message: 'Dispatch TOTVS criado.',
    createdBy: input.actor,
    metadata: { dispatchId: dispatch.id, mockMode: Boolean(input.mockMode) },
  });
  IntegrationLogStorage.create({
    tenantId: input.tenantId,
    jobId: job.id,
    configId: config.id,
    system: 'TOTVS',
    level: 'INFO',
    event: 'TOTVS_DISPATCH_VALIDATION_STARTED',
    message: 'Pré-validação TOTVS iniciada.',
    createdBy: input.actor,
    metadata: { dispatchId: dispatch.id, dataType: input.dataType },
  });

  const validation = await (deps.validate ?? defaultValidate)({
    tenantId: input.tenantId,
    targetDataType: validationTarget,
    referenceId: input.referenceId,
    periodStart,
    periodEnd,
    filters: {
      fleetCode: input.fleetCode,
      operatorRegistration: input.operatorRegistration,
      journeyId: input.journeyId,
    },
    checkedBy: input.actor,
  });

  const validationResultId = validation.id || undefined;
  TotvsDispatchStorage.update(input.tenantId, dispatch.id, { validationResultId });

  if (validation.status !== 'SUCCESS' && isNoOperationalDataWarning(validation.issues)) {
    const error = 'NO_OPERATIONAL_DATA';
    const message = 'Nenhum registro operacional encontrado para envio.';
    const responseBody = { success: false, error, message, validation };
    TotvsDispatchStorage.writeRequestPayload(input.tenantId, dispatch.id, { validation, request: input });
    TotvsDispatchStorage.writeResponsePayload(input.tenantId, dispatch.id, responseBody);
    TotvsDispatchStorage.update(input.tenantId, dispatch.id, {
      status: 'BLOCKED',
      lastErrorCode: error,
      lastErrorMessage: message,
      finishedAt: nowIso(),
    });
    IntegrationJobStorage.setFailed(input.tenantId, job.id, error, message, input.actor);
    IntegrationLogStorage.create({
      tenantId: input.tenantId,
      jobId: job.id,
      configId: config.id,
      system: 'TOTVS',
      level: 'WARN',
      event: 'TOTVS_DISPATCH_VALIDATION_BLOCKED',
      message,
      createdBy: input.actor,
      metadata: { dispatchId: dispatch.id, issues: validation.issues.length },
    });
    IntegrationLogStorage.create({
      tenantId: input.tenantId,
      jobId: job.id,
      configId: config.id,
      system: 'TOTVS',
      level: 'WARN',
      event: 'TOTVS_DISPATCH_FAILED',
      message,
      createdBy: input.actor,
      metadata: { error },
    });
    return fail(error, message, { dispatchId: dispatch.id, jobId: job.id, validation });
  }

  if (validation.status !== 'SUCCESS' && hasCriticalIssue(validation.issues)) {
    const error = 'TOTVS_VALIDATION_BLOCKED';
    const message = 'Pré-validação TOTVS bloqueou o envio.';
    const responseBody = { success: false, error, message, validation };
    TotvsDispatchStorage.writeRequestPayload(input.tenantId, dispatch.id, { validation, request: input });
    TotvsDispatchStorage.writeResponsePayload(input.tenantId, dispatch.id, responseBody);
    TotvsDispatchStorage.update(input.tenantId, dispatch.id, {
      status: 'BLOCKED',
      lastErrorCode: error,
      lastErrorMessage: message,
      finishedAt: nowIso(),
    });
    IntegrationJobStorage.setFailed(input.tenantId, job.id, error, message, input.actor);
    IntegrationLogStorage.create({
      tenantId: input.tenantId,
      jobId: job.id,
      configId: config.id,
      system: 'TOTVS',
      level: 'WARN',
      event: 'TOTVS_DISPATCH_VALIDATION_BLOCKED',
      message,
      createdBy: input.actor,
      metadata: { dispatchId: dispatch.id, issues: validation.issues.length },
    });
    return fail(error, message, { dispatchId: dispatch.id, jobId: job.id, validation });
  }

  const evidence = readOperationalInputs(input, periodStart, periodEnd);
  const payload = buildTotvsDispatchPayload({
    schemaVersion: '1.0',
    source: 'SILO_OPS',
    target: 'TOTVS',
    environment: 'HOMOLOGACAO',
    tenantId: input.tenantId,
    dispatchId: dispatch.id,
    generatedAt: deps.now?.() ?? nowIso(),
    dataType: input.dataType,
    reference: {
      journeyId: input.journeyId,
      comboioFleetCode: input.comboioFleetCode,
      driverRegistration: input.driverRegistration,
      fleetCode: input.fleetCode,
      operatorRegistration: input.operatorRegistration,
    },
    mappedData: buildMappedData(config.id, input, evidence),
    operationalData: {
      periodStart,
      periodEnd,
      calculationMode: evidence.journeys[0]?.payload?.calculationMode ?? 'AUTOMATICO',
      status: evidence.fichas[0]?.status ?? 'PENDENTE',
      startedAt: evidence.journeys[0]?.occurredAt ?? null,
      finishedAt: evidence.journeys.at(-1)?.occurredAt ?? null,
      kmInicial: evidence.fichas[0]?.hourmeterStart ?? null,
      kmFinal: evidence.fichas[0]?.hourmeterEnd ?? null,
      distanciaPercorrida: evidence.fichas[0]?.totalHourmeter ?? null,
      tanqueInicial: null,
      totalCarregadoPosto: 0,
      totalAbastecidoMaquinas: evidence.fuelings.reduce((sum, item) => sum + Number(item.dieselLiters || 0), 0),
      saldoTeorico: null,
      saldoFinalAutomatico: null,
      tanqueFinal: null,
      diferenca: null,
    },
    fuelSupplies: buildFuelSupplies(evidence.fuelings),
    validation: { status: validation.status, issues: validation.issues as unknown as Record<string, unknown>[] },
    summary: {
      recordCount: evidence.fichas.length + evidence.journeys.length + evidence.fuelings.length,
      journeyCount: evidence.journeys.length,
      fuelingCount: evidence.fuelings.length,
    },
  });

  TotvsDispatchStorage.writeRequestPayload(input.tenantId, dispatch.id, payload);
  TotvsDispatchStorage.update(input.tenantId, dispatch.id, {
    status: 'SENDING',
    attempts: Math.max(1, dispatch.attempts + 1),
  });
  IntegrationLogStorage.create({
    tenantId: input.tenantId,
    jobId: job.id,
    configId: config.id,
    system: 'TOTVS',
    level: 'INFO',
    event: 'TOTVS_DISPATCH_PAYLOAD_BUILT',
    message: 'Payload TOTVS montado.',
    createdBy: input.actor,
    metadata: { dispatchId: dispatch.id, dataType: input.dataType, recordCount: payload.summary.recordCount },
  });
  IntegrationLogStorage.create({
    tenantId: input.tenantId,
    jobId: job.id,
    configId: config.id,
    system: 'TOTVS',
    level: 'INFO',
    event: 'TOTVS_DISPATCH_REQUEST_SAVED',
    message: 'request.json salvo.',
    createdBy: input.actor,
    metadata: { requestPath: TotvsDispatchStorage.getRequestPath(input.tenantId, dispatch.id) },
  });

  const response = await (deps.send ?? sendTotvsDispatchPayload)({
    tenantId: input.tenantId,
    configId: config.id,
    payload,
    mockMode: Boolean(input.mockMode),
  });

  TotvsDispatchStorage.writeResponsePayload(input.tenantId, dispatch.id, response);
  IntegrationLogStorage.create({
    tenantId: input.tenantId,
    jobId: job.id,
    configId: config.id,
    system: 'TOTVS',
    level: 'INFO',
    event: 'TOTVS_DISPATCH_SENT',
    message: 'Requisição TOTVS enviada.',
    createdBy: input.actor,
    metadata: { status: response.status },
  });
  IntegrationLogStorage.create({
    tenantId: input.tenantId,
    jobId: job.id,
    configId: config.id,
    system: 'TOTVS',
    level: 'INFO',
    event: 'TOTVS_DISPATCH_RESPONSE_SAVED',
    message: 'response.json salvo.',
    createdBy: input.actor,
    metadata: { responsePath: TotvsDispatchStorage.getResponsePath(input.tenantId, dispatch.id) },
  });

  if (!response.ok) {
    const message = 'TOTVS retornou erro no envio.';
    TotvsDispatchStorage.update(input.tenantId, dispatch.id, {
      status: 'FAILED',
      httpStatus: response.status,
      lastErrorCode: 'TOTVS_SEND_FAILED',
      lastErrorMessage: message,
      finishedAt: nowIso(),
    });
    IntegrationJobStorage.setFailed(input.tenantId, job.id, 'TOTVS_SEND_FAILED', message, input.actor);
    IntegrationLogStorage.create({
      tenantId: input.tenantId,
      jobId: job.id,
      configId: config.id,
      system: 'TOTVS',
      level: 'ERROR',
      event: 'TOTVS_DISPATCH_FAILED',
      message,
      createdBy: input.actor,
      metadata: { status: response.status },
    });
    return fail('TOTVS_SEND_FAILED', message, { dispatchId: dispatch.id, jobId: job.id, validation, response });
  }

  const protocol = typeof response.body.protocol === 'string' ? response.body.protocol : undefined;
  const message = typeof response.body.message === 'string' ? response.body.message : 'Envio TOTVS concluído com sucesso.';
  TotvsDispatchStorage.update(input.tenantId, dispatch.id, {
    status: 'SUCCESS',
    httpStatus: response.status,
    totvsProtocol: protocol,
    totvsMessage: message,
    sentAt: nowIso(),
    finishedAt: nowIso(),
    lastErrorCode: undefined,
    lastErrorMessage: undefined,
  });
  IntegrationJobStorage.setSuccess(input.tenantId, job.id, { dispatchId: dispatch.id, responseStatus: response.status, protocol }, input.actor);
  IntegrationLogStorage.create({
    tenantId: input.tenantId,
    jobId: job.id,
    configId: config.id,
    system: 'TOTVS',
    level: 'INFO',
    event: 'TOTVS_DISPATCH_SUCCESS',
    message: 'Envio TOTVS concluído com sucesso.',
    createdBy: input.actor,
    metadata: { dispatchId: dispatch.id, status: response.status, protocol },
  });

  const next = TotvsDispatchStorage.getById(input.tenantId, dispatch.id)!;
  return {
    success: true as const,
    dispatch: next,
    requestPath: next.requestPayloadPath!,
    responsePath: next.responsePayloadPath!,
    response: response.body,
    jobId: job.id,
  };
}

export const TotvsDispatchService = {
  send: executeSend,

  async retry(tenantId: string, dispatchId: string, actor?: string, deps: TotvsDispatchServiceDeps = {}) {
    const dispatch = TotvsDispatchStorage.getById(tenantId, dispatchId);
    if (!dispatch) return null;
    if (!['FAILED', 'CANCELED'].includes(dispatch.status)) return null;
    const jobId = dispatch.jobId;
    if (!jobId) return null;
    const jobRetry = IntegrationJobStorage.retry(tenantId, jobId, actor);
    if (!jobRetry) return null;
    TotvsDispatchStorage.update(tenantId, dispatchId, { status: 'RETRYING' });
    IntegrationLogStorage.create({
      tenantId,
      jobId,
      configId: dispatch.configId,
      system: 'TOTVS',
      level: 'INFO',
      event: 'TOTVS_DISPATCH_RETRY_REQUESTED',
      message: 'Retry solicitado para dispatch TOTVS.',
      createdBy: actor,
      metadata: { dispatchId },
    });
    return executeSend({
      tenantId,
      dataType: dispatch.dataType,
      referenceId: dispatch.referenceId,
      journeyId: dispatch.journeyId,
      fleetCode: dispatch.fleetCode,
      comboioFleetCode: dispatch.comboioFleetCode,
      operatorRegistration: dispatch.operatorRegistration,
      driverRegistration: dispatch.driverRegistration,
      configId: dispatch.configId,
      dispatchId: dispatch.id,
      jobId: dispatch.jobId,
      maxAttempts: dispatch.maxAttempts,
      actor,
    }, deps);
  },

  async cancel(tenantId: string, dispatchId: string, actor?: string) {
    const dispatch = TotvsDispatchStorage.getById(tenantId, dispatchId);
    if (!dispatch) return null;
    if (!['PENDING', 'BLOCKED', 'FAILED', 'RETRYING', 'VALIDATING'].includes(dispatch.status)) return null;
    const next = TotvsDispatchStorage.update(tenantId, dispatchId, {
      status: 'CANCELED',
      finishedAt: nowIso(),
      lastErrorCode: 'TOTVS_DISPATCH_CANCELED',
      lastErrorMessage: 'Dispatch TOTVS cancelado.',
    });
    if (dispatch.jobId) {
      IntegrationJobStorage.cancel(tenantId, dispatch.jobId, actor);
    }
    IntegrationLogStorage.create({
      tenantId,
      jobId: dispatch.jobId,
      configId: dispatch.configId,
      system: 'TOTVS',
      level: 'WARN',
      event: 'TOTVS_DISPATCH_CANCELED',
      message: 'Dispatch TOTVS cancelado.',
      createdBy: actor,
      metadata: { dispatchId },
    });
    return next;
  },

  list(tenantId: string, filters?: Parameters<typeof TotvsDispatchStorage.listByTenant>[1]) {
    return TotvsDispatchStorage.listByTenant(tenantId, filters);
  },

  getById(tenantId: string, id: string) {
    return TotvsDispatchStorage.getById(tenantId, id);
  },
};

export const sendTotvsDispatch = executeSend;
