import type { Company } from '@/lib/types';

export function normalizePort(value: unknown): number | undefined {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) return undefined;
  return parsed;
}

export function buildCompanyUrls(portaApi?: number, portaMqtt?: number) {
  return {
    apiBaseUrl: portaApi ? `https://api.siloops.com.br:${portaApi}` : undefined,
    mqttUrl: portaMqtt ? `mqtt.siloops.com.br:${portaMqtt}` : undefined,
  };
}

export function normalizeCompanyPortPayload<T extends object>(input: T) {
  const source = input as Record<string, unknown>;
  const portaApi = normalizePort(source.portaApi ?? source.apiPort);
  const portaMqtt = normalizePort(source.portaMqtt ?? source.mqttPort);
  const { apiBaseUrl, mqttUrl } = buildCompanyUrls(portaApi, portaMqtt);

  return {
    ...input,
    apiPort: portaApi,
    mqttPort: portaMqtt,
    apiBaseUrl,
    mqttUrl,
  };
}

export function companyFormToCompanyPayload<T extends object>(input: T): Partial<Company> {
  const normalized = normalizeCompanyPortPayload(input);
  const { portaApi, portaMqtt, ...rest } = input as Record<string, unknown>;
  return {
    ...rest,
    apiPort: normalized.apiPort,
    mqttPort: normalized.mqttPort,
    apiBaseUrl: normalized.apiBaseUrl,
    mqttUrl: normalized.mqttUrl,
  } as Partial<Company>;
}
