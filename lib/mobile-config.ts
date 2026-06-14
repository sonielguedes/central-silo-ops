import { Company } from '@/lib/types';

/**
 * Configuração de rede do app mobile (APK).
 *
 * DECISÃO DE PRODUTO: a API mobile usa HTTPS padrão (porta 443), SEM porta
 * customizada. A porta por empresa (apiPort) continua existindo para o roteamento
 * interno/web, mas NUNCA deve ir para o payload do QR Code nem para a resposta de
 * validação do APK — caso contrário o aparelho tenta conectar em algo como
 * `https://api.siloops.com.br:3004` e falha.
 *
 * O MQTT permanece separado, com host e porta próprios (mqttHost/mqttPort).
 */

const DEFAULT_MOBILE_API_HOST = 'api.siloops.com.br';

/**
 * URL base da API que o APK deve usar para a empresa informada.
 *
 * Ordem de resolução:
 *  1. Override global por env `SILO_MOBILE_API_BASE_URL`
 *     (ex.: `https://central.siloops.com.br`) — útil se a Central responder melhor
 *     por outro domínio, sem precisar alterar código.
 *  2. Host derivado do `apiBaseUrl` cadastrado na empresa, descartando a porta.
 *  3. Host padrão `api.siloops.com.br`.
 *
 * Sempre retorna `https://<host>` SEM porta (443 implícito) e sem barra final.
 */
export function getMobileApiBaseUrl(company: Pick<Company, 'apiBaseUrl'>): string {
  const override = process.env.SILO_MOBILE_API_BASE_URL?.trim();
  if (override) return override.replace(/\/+$/, '');

  let host = DEFAULT_MOBILE_API_HOST;
  if (company.apiBaseUrl) {
    try {
      const raw = company.apiBaseUrl.includes('://')
        ? company.apiBaseUrl
        : `https://${company.apiBaseUrl}`;
      const parsed = new URL(raw);
      if (parsed.hostname) host = parsed.hostname; // hostname já exclui a porta
    } catch {
      /* apiBaseUrl malformado — mantém o host padrão */
    }
  }
  return `https://${host}`;
}
