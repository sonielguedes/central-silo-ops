export type IntegrationSystem = 'PIMS' | 'TOTVS' | 'EXPORTACAO' | 'API_EXTERNA';
export type IntegrationEnvironment = 'HOMOLOGACAO' | 'PRODUCAO';
export type IntegrationAuthType = 'NONE' | 'API_KEY' | 'BEARER_TOKEN' | 'BASIC_AUTH' | 'CUSTOM_HEADER';
export type IntegrationConfigStatus = 'ACTIVE' | 'INACTIVE';
export type IntegrationConnectionStatus = 'SUCCESS' | 'FAILED' | 'NOT_TESTED';

export interface IntegrationConfig {
  id: string;
  tenantId: string;
  system: IntegrationSystem;
  name: string;
  description?: string;
  environment: IntegrationEnvironment;
  baseUrl: string;
  authType: IntegrationAuthType;
  apiKey?: string;
  bearerToken?: string;
  username?: string;
  password?: string;
  customHeaderName?: string;
  customHeaderValue?: string;
  mockMode?: boolean;
  timeoutMs: number;
  retryCount: number;
  status: IntegrationConfigStatus;
  lastConnectionTestAt?: string;
  lastConnectionStatus?: IntegrationConnectionStatus;
  lastConnectionMessage?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface IntegrationConfigPublic extends Omit<
  IntegrationConfig,
  'apiKey' | 'bearerToken' | 'password' | 'customHeaderValue'
> {
  hasApiKey: boolean;
  hasBearerToken: boolean;
  hasPassword: boolean;
  hasCustomHeaderValue: boolean;
  apiKeyMasked?: string;
  bearerTokenMasked?: string;
  passwordMasked?: string;
  customHeaderValueMasked?: string;
}

export interface IntegrationConfigInput {
  system: IntegrationSystem;
  name: string;
  description?: string;
  environment: IntegrationEnvironment;
  baseUrl: string;
  authType: IntegrationAuthType;
  apiKey?: string;
  bearerToken?: string;
  username?: string;
  password?: string;
  customHeaderName?: string;
  customHeaderValue?: string;
  mockMode?: boolean;
  timeoutMs: number;
  retryCount: number;
  status: IntegrationConfigStatus;
}

export interface IntegrationConfigActor {
  userId: string;
  userName: string;
  userRole: string;
}
