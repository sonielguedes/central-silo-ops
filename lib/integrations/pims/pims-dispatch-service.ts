import { IntegrationConfigStorage } from '../integration-config-storage';
import { IntegrationJobStorage } from '../integration-job-storage';
import { IntegrationLogStorage } from '../integration-log-storage';
import { validatePimsOperationalData } from './pims-validation-engine';
import { buildPimsDispatchPayload, loadPimsDispatchRecords } from './pims-payload-builder';
import { PimsDispatchStorage } from './pims-dispatch-storage';
import { sendPimsDispatchPayload } from './pims-client';
import type { PimsDispatch, PimsDispatchServiceDeps, PimsDispatchServiceInput } from './pims-dispatch-types';

function nowIso() {
  return new Date().toISOString();
}

function fail(error: string, message: string, extra?: Record<string, unknown>) {
  return { success: false as const, error, message, ...(extra ?? {}) };
}

function pickHomologConfig(tenantId: string, configId?: string) {
  const configs = IntegrationConfigStorage.listStoredByTenant(tenantId).filter((item) => item.system === 'PIMS' && item.status === 'ACTIVE');
  if (configId) {
    const found = configs.find((item) => item.id === configId);
    if (!found) return { error: 'PIMS_CONFIG_NOT_FOUND', message: 'Configuracao PIMS nao encontrada.' };
    if (found.environment === 'PRODUCAO') return { error: 'PIMS_PRODUCTION_BLOCKED', message: 'Envio para PIMS Produção está bloqueado nesta etapa. Use uma configuração de Homologação.' };
    return { config: found };
  }
  const homolog = configs.find((item) => item.environment === 'HOMOLOGACAO');
  if (!homolog) return { error: 'PIMS_HOMOLOG_CONFIG_NOT_FOUND', message: 'Nenhuma configuração PIMS Homologação ativa foi encontrada para este tenant.' };
  return { config: homolog };
}

function isNoOperationalDataWarning(issues: Array<{ message: string }>): boolean {
  return issues.length === 1 && issues[0]?.message === 'Nenhum registro operacional encontrado para o filtro informado.';
}

async function defaultValidate(input: Parameters<NonNullable<PimsDispatchServiceDeps['validate']>>[0]) {
  return validatePimsOperationalData(input);
}

export async function sendPimsDispatch(input: PimsDispatchServiceInput, deps: PimsDispatchServiceDeps = {}): Promise<
  | { success: true; dispatch: PimsDispatch; requestPath: string; responsePath: string; response: Record<string, unknown>; jobId: string }
  | ReturnType<typeof fail>
> {
  const periodStart = input.periodStart ?? new Date().toISOString().slice(0, 10);
  const periodEnd = input.periodEnd ?? periodStart;
  const requestEnvelope = {
    tenantId: input.tenantId,
    periodStart,
    periodEnd,
    targetDataType: input.targetDataType,
    referenceId: input.referenceId,
    filters: input.filters,
    mockMode: Boolean(input.mockMode),
  };

  const existingDispatch = input.dispatchId ? PimsDispatchStorage.getById(input.tenantId, input.dispatchId) : undefined;
  const dispatch = existingDispatch ?? PimsDispatchStorage.create({
    tenantId: input.tenantId,
    configId: input.configId,
    targetDataType: input.targetDataType,
    periodStart,
    periodEnd,
    referenceId: input.referenceId,
    filters: input.filters,
    mockMode: Boolean(input.mockMode),
    request: requestEnvelope,
    attempts: 0,
    maxAttempts: 3,
    status: 'PENDING',
    createdBy: input.actor,
  });

  const job = input.jobId
    ? IntegrationJobStorage.getById(input.tenantId, input.jobId) ?? IntegrationJobStorage.create({
        tenantId: input.tenantId,
        system: 'PIMS',
        type: 'SEND_PIMS_HOMOLOGATION',
        title: 'Envio PIMS em homologação',
        description: 'Envio real para PIMS homologação com pré-validação obrigatória.',
        payload: { dispatchId: dispatch.id, requestedConfigId: input.configId },
        configId: input.configId,
        maxAttempts: 3,
        source: 'API',
        createdBy: input.actor,
      })
    : IntegrationJobStorage.create({
        tenantId: input.tenantId,
        system: 'PIMS',
        type: 'SEND_PIMS_HOMOLOGATION',
        title: 'Envio PIMS em homologação',
        description: 'Envio real para PIMS homologação com pré-validação obrigatória.',
        payload: { dispatchId: dispatch.id, requestedConfigId: input.configId },
        configId: input.configId,
        maxAttempts: 3,
        source: 'API',
        createdBy: input.actor,
  });

  if (!job) throw new Error('Job PIMS nao criado');
  const jobId: string = job!.id;

  IntegrationLogStorage.create({
    tenantId: input.tenantId,
    system: 'PIMS',
    level: 'INFO',
    event: 'PIMS_DISPATCH_CREATED',
    message: 'Dispatch PIMS criado.',
    createdBy: input.actor,
    metadata: { configId: input.configId, mockMode: Boolean(input.mockMode) },
  });

  const configPick = pickHomologConfig(input.tenantId, input.configId);
  if ('error' in configPick) {
    const errorCode: string = configPick.error ?? 'PIMS_HOMOLOG_CONFIG_NOT_FOUND';
    const errorMessage: string = configPick.message ?? 'Nenhuma configuração PIMS Homologação ativa foi encontrada para este tenant.';
    const response = { success: false, error: errorCode, message: errorMessage };
    PimsDispatchStorage.writeRequestPayload(input.tenantId, dispatch.id, dispatch.request ?? requestEnvelope);
    PimsDispatchStorage.writeResponsePayload(input.tenantId, dispatch.id, response);
    PimsDispatchStorage.update(input.tenantId, dispatch.id, {
      jobId,
      configId: input.configId ?? dispatch.configId,
      status: 'FAILED',
      lastErrorCode: errorCode,
      lastErrorMessage: errorMessage,
      finishedAt: nowIso(),
    });
    IntegrationJobStorage.setFailed(input.tenantId, jobId, errorCode, errorMessage, input.actor);
    IntegrationLogStorage.create({
      tenantId: input.tenantId,
      jobId,
      configId: input.configId,
      system: 'PIMS',
      level: 'ERROR',
      event: 'PIMS_DISPATCH_FAILED',
      message: errorMessage,
      createdBy: input.actor,
      metadata: { dispatchId: dispatch.id, error: errorCode },
    });
    return fail(errorCode, errorMessage, { dispatchId: dispatch.id, jobId });
  }

  const config = configPick.config;
  if (!config) return fail('PIMS_HOMOLOG_CONFIG_NOT_FOUND', 'Nenhuma configuração PIMS Homologação ativa foi encontrada para este tenant.');
  if (dispatch.configId !== config.id) {
    PimsDispatchStorage.update(input.tenantId, dispatch.id, { configId: config.id, request: requestEnvelope });
    IntegrationJobStorage.update(input.tenantId, jobId, {
      configId: config.id,
      payload: { dispatchId: dispatch.id, configId: config.id },
      maxAttempts: Math.max(1, config.retryCount + 1),
    });
  } else if (existingDispatch) {
    PimsDispatchStorage.update(input.tenantId, dispatch.id, { request: requestEnvelope });
  }

  PimsDispatchStorage.update(input.tenantId, dispatch.id, { jobId });
  IntegrationLogStorage.create({
    tenantId: input.tenantId,
    jobId,
    configId: config.id,
    system: 'PIMS',
    level: 'INFO',
    event: 'PIMS_DISPATCH_VALIDATION_STARTED',
    message: 'Pré-validação PIMS iniciada.',
    createdBy: input.actor,
    metadata: { dispatchId: dispatch.id, targetDataType: input.targetDataType },
  });

  const validation = await (deps.validate ?? defaultValidate)({
    tenantId: input.tenantId,
    targetDataType: input.targetDataType,
    referenceId: input.referenceId,
    periodStart,
    periodEnd,
    filters: input.filters,
    checkedBy: input.actor,
  });

  PimsDispatchStorage.update(input.tenantId, dispatch.id, {
    validationStatus: validation.status,
    validationIssues: validation.issues,
  });

  if (validation.status !== 'SUCCESS') {
    const noData = validation.status === 'WARNING' && isNoOperationalDataWarning(validation.issues);
    const error = noData ? 'NO_OPERATIONAL_DATA' : 'PIMS_VALIDATION_BLOCKED';
    const message = noData
      ? 'Nenhum registro operacional encontrado para envio.'
      : 'Pré-validação PIMS bloqueou o envio.';
    PimsDispatchStorage.update(input.tenantId, dispatch.id, {
      status: 'FAILED',
      lastErrorCode: error,
      lastErrorMessage: message,
      finishedAt: nowIso(),
    });
    IntegrationJobStorage.setFailed(input.tenantId, jobId, error, message, input.actor);
    const response = { success: false, error, message, validation };
    PimsDispatchStorage.writeResponsePayload(input.tenantId, dispatch.id, response);
    IntegrationLogStorage.create({
      tenantId: input.tenantId,
      jobId,
      configId: config.id,
      system: 'PIMS',
      level: 'WARN',
      event: 'PIMS_DISPATCH_VALIDATION_BLOCKED',
      message,
      createdBy: input.actor,
      metadata: { dispatchId: dispatch.id, issues: validation.issues.length },
    });
    return fail(error, message, { validation });
  }

  const records = await (deps.loadOperationalRecords ?? loadPimsDispatchRecords)(input.tenantId, periodStart, periodEnd);
  const payload = buildPimsDispatchPayload({
    tenantId: input.tenantId,
    dispatchId: dispatch.id,
    configId: config.id,
    generatedAt: deps.now?.() ?? nowIso(),
    periodStart,
    periodEnd,
    targetDataType: input.targetDataType,
    referenceId: input.referenceId,
    mockMode: Boolean(input.mockMode),
    validation: { status: validation.status, issues: validation.issues },
    records,
  });

  PimsDispatchStorage.writeRequestPayload(input.tenantId, dispatch.id, payload);
  PimsDispatchStorage.update(input.tenantId, dispatch.id, {
    request: payload as unknown as Record<string, unknown>,
    payloadSummary: payload.summary,
    status: 'RUNNING',
    startedAt: nowIso(),
  });
  IntegrationLogStorage.create({
    tenantId: input.tenantId,
    jobId,
    configId: config.id,
    system: 'PIMS',
    level: 'INFO',
    event: 'PIMS_DISPATCH_PAYLOAD_BUILT',
    message: 'Payload PIMS montado.',
    createdBy: input.actor,
    metadata: payload.summary as unknown as Record<string, unknown>,
  });
  IntegrationLogStorage.create({
    tenantId: input.tenantId,
    jobId,
    configId: config.id,
    system: 'PIMS',
    level: 'INFO',
    event: 'PIMS_DISPATCH_REQUEST_SAVED',
    message: 'request.json salvo.',
    createdBy: input.actor,
    metadata: { requestPath: PimsDispatchStorage.getRequestPath(input.tenantId, dispatch.id) },
  });

  const response = await (deps.send ?? sendPimsDispatchPayload)({
    tenantId: input.tenantId,
    configId: config.id,
    mockMode: Boolean(input.mockMode),
    payload,
  });

  PimsDispatchStorage.writeResponsePayload(input.tenantId, dispatch.id, response);
  IntegrationLogStorage.create({
    tenantId: input.tenantId,
    jobId,
    configId: config.id,
    system: 'PIMS',
    level: 'INFO',
    event: 'PIMS_DISPATCH_SENT',
    message: 'Requisição PIMS enviada.',
    createdBy: input.actor,
    metadata: { status: response.status, mockMode: Boolean(input.mockMode) },
  });
  IntegrationLogStorage.create({
    tenantId: input.tenantId,
    jobId,
    configId: config.id,
    system: 'PIMS',
    level: 'INFO',
    event: 'PIMS_DISPATCH_RESPONSE_SAVED',
    message: 'response.json salvo.',
    createdBy: input.actor,
    metadata: { responsePath: PimsDispatchStorage.getResponsePath(input.tenantId, dispatch.id) },
  });

  if (!response.ok) {
    const message = 'PIMS retornou erro no envio.';
    PimsDispatchStorage.update(input.tenantId, dispatch.id, {
      status: 'FAILED',
      responseStatusCode: response.status,
      lastErrorCode: 'PIMS_SEND_FAILED',
      lastErrorMessage: message,
      finishedAt: nowIso(),
    });
    IntegrationJobStorage.setFailed(input.tenantId, jobId, 'PIMS_SEND_FAILED', message, input.actor);
    IntegrationLogStorage.create({
      tenantId: input.tenantId,
      jobId,
      configId: config.id,
      system: 'PIMS',
      level: 'ERROR',
      event: 'PIMS_DISPATCH_FAILED',
      message,
      createdBy: input.actor,
      metadata: { status: response.status },
    });
    return fail('PIMS_SEND_FAILED', message, { response, validation });
  }

  PimsDispatchStorage.update(input.tenantId, dispatch.id, {
    status: 'SUCCESS',
    responseStatusCode: response.status,
    finishedAt: nowIso(),
    lastErrorCode: undefined,
    lastErrorMessage: undefined,
  });
    IntegrationJobStorage.setSuccess(input.tenantId, jobId, { dispatchId: dispatch.id, responseStatus: response.status }, input.actor);
  IntegrationLogStorage.create({
    tenantId: input.tenantId,
    jobId,
    configId: config.id,
    system: 'PIMS',
    level: 'INFO',
    event: 'PIMS_DISPATCH_SUCCESS',
    message: 'Envio PIMS concluído com sucesso.',
    createdBy: input.actor,
    metadata: { dispatchId: dispatch.id, status: response.status },
  });

  const next = PimsDispatchStorage.getById(input.tenantId, dispatch.id)!;
  return { success: true, dispatch: next, requestPath: next.requestPath, responsePath: next.responsePath, response: response.body, jobId };
}

export async function retryPimsDispatch(tenantId: string, dispatchId: string, actor?: string, deps: PimsDispatchServiceDeps = {}) {
  const dispatch = PimsDispatchStorage.getById(tenantId, dispatchId);
  if (!dispatch) return null;
  const jobId = dispatch.jobId;
  if (!jobId) return null;
  const jobRetry = IntegrationJobStorage.retry(tenantId, jobId, actor);
  if (!jobRetry) return null;
  PimsDispatchStorage.update(tenantId, dispatchId, { status: 'RETRYING' });
  IntegrationLogStorage.create({
    tenantId,
    jobId,
    configId: dispatch.configId,
    system: 'PIMS',
    level: 'INFO',
    event: 'PIMS_DISPATCH_RETRY_REQUESTED',
    message: 'Retry solicitado para dispatch PIMS.',
    createdBy: actor,
    metadata: { dispatchId },
  });
  return sendPimsDispatch({
    tenantId,
    targetDataType: dispatch.targetDataType,
    periodStart: dispatch.periodStart,
    periodEnd: dispatch.periodEnd,
    referenceId: dispatch.referenceId,
    filters: dispatch.filters,
    configId: dispatch.configId,
    dispatchId: dispatch.id,
    jobId: dispatch.jobId,
    mockMode: dispatch.mockMode,
    actor,
  }, deps);
}

export async function cancelPimsDispatch(tenantId: string, dispatchId: string, actor?: string) {
  const dispatch = PimsDispatchStorage.getById(tenantId, dispatchId);
  if (!dispatch) return null;
  if (!['PENDING', 'RUNNING', 'RETRYING', 'FAILED'].includes(dispatch.status)) return null;
  PimsDispatchStorage.update(tenantId, dispatchId, {
    status: 'CANCELED',
    canceledAt: nowIso(),
    finishedAt: nowIso(),
    updatedBy: actor,
  });
  if (dispatch.jobId) {
    IntegrationJobStorage.cancel(tenantId, dispatch.jobId, actor);
  }
  IntegrationLogStorage.create({
    tenantId,
    jobId: dispatch.jobId,
    configId: dispatch.configId,
    system: 'PIMS',
    level: 'WARN',
    event: 'PIMS_DISPATCH_CANCELED',
    message: 'Dispatch PIMS cancelado.',
    createdBy: actor,
    metadata: { dispatchId },
  });
  return PimsDispatchStorage.getById(tenantId, dispatchId);
}

export function listPimsDispatches(tenantId: string, filters?: { status?: string; q?: string; from?: string; to?: string }) {
  return PimsDispatchStorage.listByTenant(tenantId, filters as never);
}
