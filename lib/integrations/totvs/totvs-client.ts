import { IntegrationConfigStorage } from '../integration-config-storage';
import type { TotvsDispatchPayload } from './totvs-dispatch-types';

function normalizeBaseUrl(value: string): boolean {
  return value.startsWith('mock://');
}

export async function sendTotvsDispatchPayload(input: {
  tenantId: string;
  configId: string;
  mockMode: boolean;
  payload: TotvsDispatchPayload;
}): Promise<{ status: number; ok: boolean; body: Record<string, unknown> }> {
  const config = IntegrationConfigStorage.getStoredById(input.tenantId, input.configId);
  if (!config) throw new Error('Configuracao TOTVS nao encontrada');

  if (input.mockMode || config.mockMode || normalizeBaseUrl(config.baseUrl)) {
    return {
      status: 200,
      ok: true,
      body: {
        protocol: `MOCK-TOTVS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0001`,
        message: 'Envio homologaÃ§Ã£o simulado com sucesso.',
        received: true,
        dispatchId: input.payload.dispatchId,
      },
    };
  }

  const headers = IntegrationConfigStorage.buildRequestInit(config).headers;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, config.timeoutMs));
  try {
    const response = await fetch(config.baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(input.payload),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    return {
      status: response.status,
      ok: response.ok,
      body: body && typeof body === 'object' ? body as Record<string, unknown> : { raw: body },
    };
  } finally {
    clearTimeout(timeout);
  }
}
