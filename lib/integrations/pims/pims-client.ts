import { IntegrationConfigStorage } from '../integration-config-storage';
import type { PimsDispatchPayload } from './pims-payload-builder';

export async function sendPimsDispatchPayload(input: {
  tenantId: string;
  configId: string;
  mockMode: boolean;
  payload: PimsDispatchPayload;
}): Promise<{ status: number; ok: boolean; body: Record<string, unknown> }> {
  const config = IntegrationConfigStorage.getStoredById(input.tenantId, input.configId);
  if (!config) throw new Error('Configuracao PIMS nao encontrada');

  if (input.mockMode || config.baseUrl.startsWith('mock://')) {
    return {
      status: 200,
      ok: true,
      body: {
        success: true,
        mocked: true,
        endpoint: config.baseUrl,
        dispatchId: input.payload.dispatchId,
        recordCount: input.payload.summary.recordCount,
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

