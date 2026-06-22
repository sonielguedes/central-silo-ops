import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  IntegrationAuthType,
  IntegrationConfig,
  IntegrationConfigActor,
  IntegrationConfigInput,
  IntegrationConfigPublic,
  IntegrationConfigStatus,
  IntegrationEnvironment,
  IntegrationSystem,
  IntegrationConnectionStatus,
} from './integration-config-types';
import { decryptSecret, encryptSecret, hasSecretValue, maskSecret } from './mask-secret';

const DATA_ROOT =
  process.env.SILO_STORAGE_DIR ||
  process.env.SILO_DATA_DIR ||
  (process.env.NODE_ENV === 'production' ? '/app/data' : './data');

export class IntegrationConfigError extends Error {
  constructor(message: string, public status = 400, public code = 'INVALID_INTEGRATION_CONFIG') {
    super(message);
    this.name = 'IntegrationConfigError';
  }
}

type StoredIntegrationConfig = IntegrationConfig;

type UpdateInput = Partial<IntegrationConfigInput> & {
  lastConnectionTestAt?: string;
  lastConnectionStatus?: IntegrationConnectionStatus;
  lastConnectionMessage?: string;
};

const SYSTEMS = new Set<IntegrationSystem>(['PIMS', 'TOTVS', 'EXPORTACAO', 'API_EXTERNA']);
const ENVIRONMENTS = new Set<IntegrationEnvironment>(['HOMOLOGACAO', 'PRODUCAO']);
const AUTH_TYPES = new Set<IntegrationAuthType>(['NONE', 'API_KEY', 'BEARER_TOKEN', 'BASIC_AUTH', 'CUSTOM_HEADER']);
const STATUSES = new Set<IntegrationConfigStatus>(['ACTIVE', 'INACTIVE']);
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getTenantDir(tenantId: string): string {
  const dir = path.join(DATA_ROOT, tenantId);
  ensureDir(dir);
  return dir;
}

function getFile(tenantId: string): string {
  return path.join(getTenantDir(tenantId), 'integration-configs.json');
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

function writeJsonAtomic(file: string, value: unknown): void {
  ensureDir(path.dirname(file));
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf-8');
  fs.renameSync(tmp, file);
}

function nowIso(): string {
  return new Date().toISOString();
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mock:';
  } catch {
    return false;
  }
}

function assertSupported(value: string, set: Set<string>, label: string): void {
  if (!set.has(value as never)) {
    throw new IntegrationConfigError(`${label} invalido`);
  }
}

function normalizeUrl(value: string): string {
  return value.trim();
}

function normalizeSecretFields(record: StoredIntegrationConfig): StoredIntegrationConfig {
  return {
    ...record,
    apiKey: hasSecretValue(record.apiKey) ? record.apiKey : undefined,
    bearerToken: hasSecretValue(record.bearerToken) ? record.bearerToken : undefined,
    password: hasSecretValue(record.password) ? record.password : undefined,
    customHeaderValue: hasSecretValue(record.customHeaderValue) ? record.customHeaderValue : undefined,
  };
}

function toPublic(record: StoredIntegrationConfig): IntegrationConfigPublic {
  const safe = normalizeSecretFields(record);
  const apiKeyMasked = maskSecret(safe.apiKey);
  const bearerTokenMasked = maskSecret(safe.bearerToken);
  const passwordMasked = maskSecret(safe.password);
  const customHeaderValueMasked = maskSecret(safe.customHeaderValue);
  const { apiKey, bearerToken, password, customHeaderValue, ...rest } = safe;
  return {
    ...rest,
    hasApiKey: Boolean(apiKey),
    hasBearerToken: Boolean(bearerToken),
    hasPassword: Boolean(password),
    hasCustomHeaderValue: Boolean(customHeaderValue),
    ...(apiKeyMasked ? { apiKeyMasked } : {}),
    ...(bearerTokenMasked ? { bearerTokenMasked } : {}),
    ...(passwordMasked ? { passwordMasked } : {}),
    ...(customHeaderValueMasked ? { customHeaderValueMasked } : {}),
  };
}

function readAllStored(tenantId: string): StoredIntegrationConfig[] {
  const file = getFile(tenantId);
  const parsed = readJson<StoredIntegrationConfig[]>(file, []);
  return Array.isArray(parsed) ? parsed : [];
}

function writeAllStored(tenantId: string, records: StoredIntegrationConfig[]): void {
  writeJsonAtomic(getFile(tenantId), records);
}

function mergeSecrets(
  existing: StoredIntegrationConfig | undefined,
  input: {
    authType: IntegrationAuthType;
    apiKey?: string;
    bearerToken?: string;
    password?: string;
    customHeaderValue?: string;
    username?: string;
    customHeaderName?: string;
    mockMode?: boolean;
  },
): Pick<StoredIntegrationConfig, 'apiKey' | 'bearerToken' | 'password' | 'customHeaderName' | 'customHeaderValue'> {
  const authType = input.authType;
  if (authType === 'NONE') {
    return {};
  }

  const apiKey = input.apiKey !== undefined ? encryptSecret(input.apiKey) : existing?.apiKey;
  const bearerToken = input.bearerToken !== undefined ? encryptSecret(input.bearerToken) : existing?.bearerToken;
  const password = input.password !== undefined ? encryptSecret(input.password) : existing?.password;
  const customHeaderValue = input.customHeaderValue !== undefined ? encryptSecret(input.customHeaderValue) : existing?.customHeaderValue;

  if (authType === 'API_KEY' && !apiKey) {
    throw new IntegrationConfigError('apiKey obrigatoria para authType API_KEY');
  }
  if (authType === 'BEARER_TOKEN' && !bearerToken) {
    throw new IntegrationConfigError('bearerToken obrigatorio para authType BEARER_TOKEN');
  }
  if (authType === 'BASIC_AUTH' && ((!input.username && !existing?.username) || !password)) {
    throw new IntegrationConfigError('username e password obrigatorios para BASIC_AUTH');
  }
  if (authType === 'CUSTOM_HEADER' && ((!input.customHeaderName && !existing?.customHeaderName) || !customHeaderValue)) {
    throw new IntegrationConfigError('customHeaderName e customHeaderValue obrigatorios para CUSTOM_HEADER');
  }

  return {
    apiKey,
    bearerToken,
    password,
    customHeaderValue,
  };
}

function validateInput(input: IntegrationConfigInput): void {
  assertSupported(input.system, SYSTEMS, 'Sistema');
  assertSupported(input.environment, ENVIRONMENTS, 'Ambiente');
  assertSupported(input.authType, AUTH_TYPES, 'Autenticacao');
  assertSupported(input.status, STATUSES, 'Status');
  if (!input.name?.trim()) throw new IntegrationConfigError('Nome obrigatorio');
  if (!input.baseUrl?.trim()) throw new IntegrationConfigError('Endpoint obrigatorio');
  if (!isValidUrl(input.baseUrl)) throw new IntegrationConfigError('Endpoint deve ser uma URL valida');
  if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 1000) throw new IntegrationConfigError('timeoutMs minimo 1000');
  if (!Number.isInteger(input.retryCount) || input.retryCount < 0 || input.retryCount > 10) throw new IntegrationConfigError('retryCount deve ficar entre 0 e 10');
  if (input.authType === 'BASIC_AUTH' && (!input.username?.trim() || !input.password?.trim())) {
    throw new IntegrationConfigError('username e password obrigatorios para BASIC_AUTH');
  }
  if (input.authType === 'CUSTOM_HEADER' && (!input.customHeaderName?.trim() || !input.customHeaderValue?.trim())) {
    throw new IntegrationConfigError('customHeaderName e customHeaderValue obrigatorios para CUSTOM_HEADER');
  }
}

function assertTenant(record: StoredIntegrationConfig, tenantId: string): void {
  if (record.tenantId !== tenantId) {
    throw new IntegrationConfigError('Tenant divergente', 403, 'TENANT_MISMATCH');
  }
}

function updateMutableFields(existing: StoredIntegrationConfig, input: UpdateInput): StoredIntegrationConfig {
  const next: StoredIntegrationConfig = {
    ...existing,
    system: (input.system ?? existing.system) as IntegrationSystem,
    name: input.name !== undefined ? String(input.name).trim() : existing.name,
    description: input.description !== undefined ? String(input.description).trim() || undefined : existing.description,
    environment: (input.environment ?? existing.environment) as IntegrationEnvironment,
    baseUrl: input.baseUrl !== undefined ? normalizeUrl(String(input.baseUrl)) : existing.baseUrl,
    authType: (input.authType ?? existing.authType) as IntegrationAuthType,
    username: input.username !== undefined ? String(input.username).trim() || undefined : existing.username,
    customHeaderName: input.customHeaderName !== undefined ? String(input.customHeaderName).trim() || undefined : existing.customHeaderName,
    timeoutMs: input.timeoutMs !== undefined ? Number(input.timeoutMs) : existing.timeoutMs,
    retryCount: input.retryCount !== undefined ? Number(input.retryCount) : existing.retryCount,
    status: (input.status ?? existing.status) as IntegrationConfigStatus,
    updatedAt: nowIso(),
    lastConnectionTestAt: input.lastConnectionTestAt ?? existing.lastConnectionTestAt,
    lastConnectionStatus: input.lastConnectionStatus ?? existing.lastConnectionStatus,
    lastConnectionMessage: input.lastConnectionMessage ?? existing.lastConnectionMessage,
  };

  if (input.authType === 'NONE' || (!input.authType && existing.authType === 'NONE')) {
    next.apiKey = undefined;
    next.bearerToken = undefined;
    next.password = undefined;
    next.customHeaderValue = undefined;
  } else {
    const mergedSecrets = mergeSecrets(existing, {
      authType: next.authType,
      apiKey: input.apiKey,
      bearerToken: input.bearerToken,
      password: input.password,
      customHeaderValue: input.customHeaderValue,
      username: input.username,
      customHeaderName: input.customHeaderName,
    });
    next.apiKey = mergedSecrets.apiKey;
    next.bearerToken = mergedSecrets.bearerToken;
    next.password = mergedSecrets.password;
    next.customHeaderValue = mergedSecrets.customHeaderValue;
  }

  validateInput({
    system: next.system,
    name: next.name,
    description: next.description,
    environment: next.environment,
    baseUrl: next.baseUrl,
    authType: next.authType,
    apiKey: decryptSecret(next.apiKey) ?? undefined,
    bearerToken: decryptSecret(next.bearerToken) ?? undefined,
    username: next.username,
    password: decryptSecret(next.password) ?? undefined,
    customHeaderName: next.customHeaderName,
    customHeaderValue: decryptSecret(next.customHeaderValue) ?? undefined,
    mockMode: next.mockMode,
    timeoutMs: next.timeoutMs,
    retryCount: next.retryCount,
    status: next.status,
  });

  return next;
}

function resolveConnectionMessage(status: IntegrationConnectionStatus, detail: string): string {
  return `${status}: ${detail}`.trim();
}

export class IntegrationConfigStorage {
  static listStoredByTenant(tenantId: string): StoredIntegrationConfig[] {
    return readAllStored(tenantId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  static listByTenant(tenantId: string): IntegrationConfigPublic[] {
    return this.listStoredByTenant(tenantId).map(toPublic);
  }

  static getStoredById(tenantId: string, id: string): StoredIntegrationConfig | undefined {
    return this.listStoredByTenant(tenantId).find((item) => item.id === id);
  }

  static getById(tenantId: string, id: string): IntegrationConfigPublic | undefined {
    const found = this.getStoredById(tenantId, id);
    return found ? toPublic(found) : undefined;
  }

  static create(tenantId: string, input: IntegrationConfigInput, actor: IntegrationConfigActor): IntegrationConfigPublic {
    validateInput(input);
    const now = nowIso();
    const record: StoredIntegrationConfig = {
      id: randomUUID(),
      tenantId,
      system: input.system,
      name: input.name.trim(),
      description: input.description?.trim() || undefined,
      environment: input.environment,
      baseUrl: normalizeUrl(input.baseUrl),
      authType: input.authType,
      ...mergeSecrets(undefined, input),
      username: input.username?.trim() || undefined,
      customHeaderName: input.customHeaderName?.trim() || undefined,
      mockMode: input.mockMode ?? false,
      timeoutMs: input.timeoutMs,
      retryCount: input.retryCount,
      status: input.status,
      lastConnectionTestAt: undefined,
      lastConnectionStatus: 'NOT_TESTED',
      lastConnectionMessage: undefined,
      createdAt: now,
      updatedAt: now,
      createdBy: actor.userName || actor.userId,
      updatedBy: actor.userName || actor.userId,
    };

    const items = readAllStored(tenantId);
    items.push(record);
    writeAllStored(tenantId, items);
    return toPublic(record);
  }

  static update(tenantId: string, id: string, input: UpdateInput, actor: IntegrationConfigActor): IntegrationConfigPublic {
    const items = readAllStored(tenantId);
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) throw new IntegrationConfigError('Configuracao nao encontrada', 404, 'NOT_FOUND');

    const current = items[index];
    assertTenant(current, tenantId);

    const next = updateMutableFields(current, input);
    next.updatedBy = actor.userName || actor.userId;
    items[index] = next;
    writeAllStored(tenantId, items);
    return toPublic(next);
  }

  static deactivate(tenantId: string, id: string, actor: IntegrationConfigActor): IntegrationConfigPublic {
    return this.update(tenantId, id, { status: 'INACTIVE' }, actor);
  }

  static updateConnectionStatus(
    tenantId: string,
    id: string,
    input: { status: IntegrationConnectionStatus; message?: string },
    actor: IntegrationConfigActor,
  ): IntegrationConfigPublic {
    const items = readAllStored(tenantId);
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) throw new IntegrationConfigError('Configuracao nao encontrada', 404, 'NOT_FOUND');
    const current = items[index];
    assertTenant(current, tenantId);

    const next: StoredIntegrationConfig = {
      ...current,
      lastConnectionTestAt: nowIso(),
      lastConnectionStatus: input.status,
      lastConnectionMessage: input.message,
      updatedAt: nowIso(),
      updatedBy: actor.userName || actor.userId,
    };

    items[index] = next;
    writeAllStored(tenantId, items);
    return toPublic(next);
  }

  static testStoredConnection(
    tenantId: string,
    id: string,
    input: { status: IntegrationConnectionStatus; message: string },
    actor: IntegrationConfigActor,
  ): IntegrationConfigPublic {
    return this.updateConnectionStatus(tenantId, id, input, actor);
  }

  static buildRequestInit(record: StoredIntegrationConfig): RequestInit & { headers: Record<string, string> } {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const apiKey = decryptSecret(record.apiKey);
    const bearerToken = decryptSecret(record.bearerToken);
    const password = decryptSecret(record.password);
    const customHeaderValue = decryptSecret(record.customHeaderValue);

    switch (record.authType) {
      case 'API_KEY':
        if (apiKey) headers['X-API-Key'] = apiKey;
        break;
      case 'BEARER_TOKEN':
        if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;
        break;
      case 'BASIC_AUTH':
        if (record.username && password) {
          headers.Authorization = `Basic ${Buffer.from(`${record.username}:${password}`).toString('base64')}`;
        }
        break;
      case 'CUSTOM_HEADER':
        if (record.customHeaderName && customHeaderValue) {
          headers[record.customHeaderName] = customHeaderValue;
        }
        break;
      case 'NONE':
      default:
        break;
    }

    return { method: 'GET', headers };
  }

  static getResolvedConnectionHeaders(tenantId: string, id: string): Record<string, string> {
    const record = this.getStoredById(tenantId, id);
    if (!record) throw new IntegrationConfigError('Configuracao nao encontrada', 404, 'NOT_FOUND');
    return this.buildRequestInit(record).headers;
  }

  static resolveTestMessage(status: IntegrationConnectionStatus, url: string, detail: string): string {
    return resolveConnectionMessage(status, `${url} - ${detail}`);
  }
}
