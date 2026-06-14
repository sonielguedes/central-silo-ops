/**
 * POST /api/mobile/company/validate
 *
 * Rota usada pelo APK depois de ler o QR Code de configuração ("SILO_OPS_MOBILE_CONFIG").
 * O aplicativo envia o companyToken lido do QR e valida se ele é legítimo antes de
 * concluir a configuração. Em caso de sucesso devolve a configuração completa para
 * preencher/confirmar a tela do app (hosts, portas, IDs).
 *
 * REGRAS DE SEGURANÇA:
 * - Não exige sessão web (o APK ainda está em configuração).
 * - Aceita o token via header X-Company-Token (preferencial) ou no corpo JSON.
 * - Nunca gera token novo.
 * - Nunca devolve o token completo na resposta (apenas máscara).
 * - Nunca loga o token completo (sempre maskToken).
 * - Respeita o flag mobileEnabled da empresa (acesso mobile pode ser bloqueado
 *   sem destruir o token).
 * - Rate limit anti-brute-force dedicado.
 * - Registra auditoria MOBILE_TOKEN_VALIDATED / MOBILE_TOKEN_VALIDATION_FAILED
 *   (usuário=APK, data/hora automática, tenantId e ação).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { maskToken } from '@/lib/auth/api-guard';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { writeAudit } from '@/lib/audit/audit-log';
import { validateCompanyAccess } from '@/lib/subscription/subscription-validator';
import { migrateCompanySubscription } from '@/lib/subscription/subscription-migrator';
import { getMobileApiBaseUrl, getMobileApiHost, getMobileApiPort } from '@/lib/mobile-config';

// ── Rate limit dedicado — mesmo padrão restritivo do resolve ─────────────────

const VALIDATE_RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60_000,
  prefix: 'mobile-company-validate',
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function getUserAgent(req: NextRequest): string {
  return req.headers.get('user-agent')?.slice(0, 200) || 'unknown';
}

function extractMqttHost(mqttUrl?: string): string {
  if (!mqttUrl) return 'mqtt.siloops.com.br';
  const withProto = mqttUrl.includes('://') ? mqttUrl : 'mqtt://' + mqttUrl;
  try {
    return new URL(withProto).hostname;
  } catch {
    return 'mqtt.siloops.com.br';
  }
}

function extractProtocol(apiBaseUrl?: string): 'HTTPS' | 'HTTP' {
  if (!apiBaseUrl) return 'HTTPS';
  return apiBaseUrl.startsWith('https') ? 'HTTPS' : 'HTTP';
}

async function extractToken(req: NextRequest): Promise<string | undefined> {
  // 1. Header preferencial
  const headerToken = req.headers.get('x-company-token')?.trim();
  if (headerToken) return headerToken;

  // 2. Corpo JSON (companyToken | token)
  try {
    const body = (await req.json()) as { companyToken?: string; token?: string } | null;
    const bodyToken = (body?.companyToken || body?.token)?.trim();
    if (bodyToken) return bodyToken;
  } catch {
    /* corpo ausente ou inválido — ignora, cai no erro de token ausente */
  }
  return undefined;
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  // 1. Rate limit anti-brute-force (antes de qualquer lógica)
  const rl = checkRateLimit(req, VALIDATE_RATE_LIMIT);
  if (rl) return rl;

  // 2. Extrair token (header ou corpo)
  const companyToken = await extractToken(req);

  if (!companyToken) {
    console.warn('[mobile/company/validate] token ausente', { ip });
    return NextResponse.json(
      {
        success: false,
        valid: false,
        errorCode: 'MISSING_COMPANY_TOKEN',
        message: 'Token da empresa ausente. Leia novamente o QR Code de configuração.',
      },
      { status: 401 },
    );
  }

  // 3. Localizar empresa pelo token (nunca logar token completo)
  const rawCompany = ServerStorage.getCompanyByToken(companyToken);

  if (!rawCompany) {
    console.warn('[mobile/company/validate] token invalido', {
      token: maskToken(companyToken),
      ip,
    });
    writeAudit('platform', {
      userId: 'APK',
      action: 'MOBILE_TOKEN_VALIDATION_FAILED',
      entity: 'company',
      entityId: 'unknown',
      after: { errorCode: 'INVALID_COMPANY_TOKEN', tokenPreview: maskToken(companyToken) },
      ip,
      userAgent,
    });
    return NextResponse.json(
      {
        success: false,
        valid: false,
        errorCode: 'INVALID_COMPANY_TOKEN',
        message: 'Token inválido ou não reconhecido.',
      },
      { status: 401 },
    );
  }

  // 4. Migração lazy dos campos de assinatura
  const { company } = migrateCompanySubscription(rawCompany);

  // 5. Acesso mobile explicitamente desabilitado (token preservado)
  if (company.mobileEnabled === false) {
    console.warn('[mobile/company/validate] mobile desabilitado', {
      token: maskToken(companyToken),
      tenantId: company.tenantId,
      ip,
    });
    writeAudit(company.tenantId, {
      userId: 'APK',
      action: 'MOBILE_TOKEN_VALIDATION_FAILED',
      entity: 'company',
      entityId: company.id,
      after: { errorCode: 'MOBILE_DISABLED', tokenPreview: maskToken(companyToken) },
      ip,
      userAgent,
    });
    return NextResponse.json(
      {
        success: false,
        valid: false,
        errorCode: 'MOBILE_DISABLED',
        message: 'O acesso mobile desta empresa está desativado. Contate o administrador.',
      },
      { status: 403 },
    );
  }

  // 6. Validar status de assinatura / empresa ativa
  const access = validateCompanyAccess(company);
  if (!access.allowed) {
    const errorCode = access.code ?? 'COMPANY_INACTIVE';
    console.warn('[mobile/company/validate] acesso bloqueado', {
      token: maskToken(companyToken),
      tenantId: company.tenantId,
      errorCode,
      subscriptionStatus: access.status,
      ip,
    });
    writeAudit(company.tenantId, {
      userId: 'APK',
      action: 'MOBILE_TOKEN_VALIDATION_FAILED',
      entity: 'company',
      entityId: company.id,
      after: {
        errorCode,
        subscriptionStatus: access.status,
        tokenPreview: maskToken(companyToken),
      },
      ip,
      userAgent,
    });
    return NextResponse.json(
      {
        success: false,
        valid: false,
        errorCode,
        message: access.message,
      },
      { status: 403 },
    );
  }

  // 7. Token válido — montar configuração (sem nenhum campo de token completo)
  // apiBaseUrl é a fonte oficial; host/porta derivados dela (porta = 443, nunca a interna).
  const apiHost = getMobileApiHost(company);
  const mqttHost = extractMqttHost(company.mqttUrl);
  const protocol = extractProtocol(company.apiBaseUrl);

  console.info('[mobile/company/validate] token validado', {
    companyCode: company.code,
    tenantId: company.tenantId,
    apiPort: company.apiPort,
    mqttPort: company.mqttPort,
    subscriptionStatus: access.status,
    token: maskToken(companyToken),
    ip,
  });

  writeAudit(company.tenantId, {
    userId: 'APK',
    action: 'MOBILE_TOKEN_VALIDATED',
    entity: 'company',
    entityId: company.id,
    after: {
      companyCode: company.code,
      apiPort: company.apiPort,
      mqttPort: company.mqttPort,
      subscriptionStatus: access.status,
      tokenPreview: maskToken(companyToken),
    },
    ip,
    userAgent,
  });

  return NextResponse.json({
    success: true,
    valid: true,
    companyId: company.id,
    companyCode: company.code,
    companyName: company.tradingName || company.corporateName || company.code,
    tenantId: company.tenantId,
    status: company.status,
    plan: company.plan,
    subscriptionStatus: access.status,
    // O guard acima rejeita mobileEnabled === false; aqui o tipo é (true | undefined),
    // ou seja, mobile SEMPRE habilitado neste ponto (undefined = habilitado para
    // registros legados). Expomos true explicitamente para o APK.
    mobileEnabled: true,
    apiBaseUrl: getMobileApiBaseUrl(company),
    apiHost,
    apiPort: getMobileApiPort(company),
    mqttHost,
    mqttPort: company.mqttPort ?? null,
    protocol,
    tokenPreview: maskToken(companyToken),
  });
}

// GET conveniente — explica o uso correto
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      errorCode: 'METHOD_NOT_ALLOWED',
      message:
        'Use POST /api/mobile/company/validate com header X-Company-Token (ou { companyToken } no corpo).',
    },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
