/**
 * POST /api/mobile/company/validate
 *
 * Valida a configuração da empresa antes de o APK salvar no dispositivo.
 * Chamada pelo botão "Testar Conexão" na tela de Configurações da Central.
 *
 * REGRAS DE SEGURANÇA:
 * - Não exige sessão web.
 * - Rota somente leitura — nunca grava, altera ou cria dados.
 * - Nunca retorna o token completo na resposta.
 * - Nunca loga o token completo (sempre maskToken).
 * - tenantId sempre resolvido pelo token — nunca confiado no body/header isoladamente.
 * - Rate limit anti-brute-force dedicado.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { maskToken } from '@/lib/auth/api-guard';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { writeAudit } from '@/lib/audit/audit-log';
import { validateCompanyAccess } from '@/lib/subscription/subscription-validator';
import { migrateCompanySubscription } from '@/lib/subscription/subscription-migrator';
import { getMobileApiBaseUrl } from '@/lib/mobile-config';

// ── Rate limit dedicado ───────────────────────────────────────────────────────

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

function getCentralUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CENTRAL_URL ||
    process.env.CENTRAL_URL ||
    'https://central.siloops.com.br'
  );
}

function getApiHost(apiBaseUrl: string): string {
  try {
    return new URL(apiBaseUrl).hostname;
  } catch {
    return 'api.siloops.com.br';
  }
}

function getApiPort(apiBaseUrl: string): number {
  try {
    const url = new URL(apiBaseUrl);
    if (url.port) return Number(url.port);
    return url.protocol === 'https:' ? 443 : 80;
  } catch {
    return 443;
  }
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const userAgent = getUserAgent(req);

  // 1. Rate limit anti-brute-force
  const rl = checkRateLimit(req, VALIDATE_RATE_LIMIT);
  if (rl) return rl;

  // 2. Ler body com segurança
  let body: Record<string, unknown> = {};
  try {
    const raw = await req.json();
    if (raw && typeof raw === 'object') body = raw as Record<string, unknown>;
  } catch {
    /* corpo ausente ou não-JSON — tratado abaixo */
  }

  // 3. Normalizar entradas — strings sempre, nunca converter para número
  const headerToken = req.headers.get('x-company-token')?.trim() || undefined;
  const headerTenantId = req.headers.get('x-tenant-id')?.trim() || undefined;
  const headerCode = req.headers.get('x-company-code')?.trim() || undefined;

  const bodyToken =
    (typeof body.companyToken === 'string' ? body.companyToken.trim() : undefined) ||
    (typeof body.token === 'string' ? body.token.trim() : undefined) ||
    undefined;
  const bodyTenantId =
    (typeof body.tenantId === 'string' ? body.tenantId.trim() : undefined) ||
    (typeof body.tenant === 'string' ? body.tenant.trim() : undefined) ||
    undefined;
  const bodyCode =
    (typeof body.companyCode === 'string' ? body.companyCode.trim() : undefined) ||
    (typeof body.code === 'string' ? body.code.trim() : undefined) ||
    undefined;

  // 4. Token: header tem prioridade; se ambos presentes e divergem → 403
  let companyToken: string | undefined;
  if (headerToken && bodyToken) {
    if (headerToken !== bodyToken) {
      console.warn('[mobile/company/validate] token divergente header/body', { ip });
      return NextResponse.json(
        {
          success: false,
          valid: false,
          errorCode: 'TOKEN_MISMATCH',
          error: 'Token divergente entre header e corpo da requisição.',
          message: 'Token divergente entre header e corpo da requisição.',
        },
        { status: 403 },
      );
    }
    companyToken = headerToken;
  } else {
    companyToken = headerToken || bodyToken;
  }

  const tenantIdInput = headerTenantId || bodyTenantId;
  const companyCodeInput = headerCode || bodyCode;

  // 5. Validar campos obrigatórios
  if (!companyToken) {
    console.warn('[mobile/company/validate] token ausente', { ip });
    return NextResponse.json(
      {
        success: false,
        valid: false,
        errorCode: 'MISSING_COMPANY_TOKEN',
        error: 'Token da empresa ausente.',
        message: 'Token da empresa ausente. Leia novamente o QR Code de configuração.',
      },
      { status: 401 },
    );
  }

  // 6. Buscar empresa pelo token
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
        error: 'Token da empresa inválido.',
        message: 'Token inválido ou não reconhecido.',
      },
      { status: 401 },
    );
  }

  // 7. Migração lazy de campos de assinatura
  const { company } = migrateCompanySubscription(rawCompany);

  // 8. Validar companyCode — se informado, deve bater com o da empresa encontrada
  if (companyCodeInput && companyCodeInput !== company.code) {
    console.warn('[mobile/company/validate] companyCode divergente', {
      informed: companyCodeInput,
      actual: company.code,
      token: maskToken(companyToken),
      ip,
    });
    writeAudit(company.tenantId, {
      userId: 'APK',
      action: 'MOBILE_TOKEN_VALIDATION_FAILED',
      entity: 'company',
      entityId: company.id,
      after: {
        errorCode: 'COMPANY_CODE_MISMATCH',
        informedCode: companyCodeInput,
        tokenPreview: maskToken(companyToken),
      },
      ip,
      userAgent,
    });
    return NextResponse.json(
      {
        success: false,
        valid: false,
        errorCode: 'COMPANY_CODE_MISMATCH',
        error: 'Empresa não encontrada.',
        message: 'Código da empresa não corresponde ao token informado.',
      },
      { status: 404 },
    );
  }

  // 9. Validar tenantId — se informado, deve bater com o tenant da empresa/token
  if (tenantIdInput && tenantIdInput !== company.tenantId) {
    console.warn('[mobile/company/validate] tenantId divergente', {
      informed: tenantIdInput,
      actual: company.tenantId,
      token: maskToken(companyToken),
      ip,
    });
    writeAudit(company.tenantId, {
      userId: 'APK',
      action: 'MOBILE_TOKEN_VALIDATION_FAILED',
      entity: 'company',
      entityId: company.id,
      after: {
        errorCode: 'TENANT_MISMATCH',
        informedTenantId: tenantIdInput,
        tokenPreview: maskToken(companyToken),
      },
      ip,
      userAgent,
    });
    return NextResponse.json(
      {
        success: false,
        valid: false,
        errorCode: 'TENANT_MISMATCH',
        error: 'Tenant informado não pertence à empresa.',
        message: 'Tenant informado não pertence à empresa vinculada ao token.',
      },
      { status: 403 },
    );
  }

  // 10. Mobile explicitamente desabilitado
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
        error: 'Empresa inativa ou não habilitada para mobile.',
        message: 'O acesso mobile desta empresa está desativado. Contate o administrador.',
      },
      { status: 403 },
    );
  }

  // 11. Validar status de assinatura / empresa ativa
  const access = validateCompanyAccess(company);
  if (!access.allowed) {
    const errorCode = access.code ?? 'COMPANY_INACTIVE';
    console.warn('[mobile/company/validate] acesso bloqueado', {
      token: maskToken(companyToken),
      tenantId: company.tenantId,
      errorCode,
      ip,
    });
    writeAudit(company.tenantId, {
      userId: 'APK',
      action: 'MOBILE_TOKEN_VALIDATION_FAILED',
      entity: 'company',
      entityId: company.id,
      after: { errorCode, tokenPreview: maskToken(companyToken) },
      ip,
      userAgent,
    });
    return NextResponse.json(
      {
        success: false,
        valid: false,
        errorCode: 'MOBILE_DISABLED',
        error: 'Empresa inativa ou não habilitada para mobile.',
        message: 'O acesso mobile desta empresa está desativado. Contate o administrador.',
      },
      { status: 403 },
    );
  }

  // 12. Tudo válido — montar resposta (sem token completo)
  const apiBaseUrl = getMobileApiBaseUrl(company);
  const mqttHost = extractMqttHost(company.mqttUrl);
  const protocol = extractProtocol(company.apiBaseUrl);

  const apiHost = getApiHost(apiBaseUrl);
  const apiPort = getApiPort(apiBaseUrl);
  const companyName = company.tradingName || company.corporateName || String(company.code);

  console.info('[mobile/company/validate] validado com sucesso', {
    companyCode: company.code,
    tenantId: company.tenantId,
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
      subscriptionStatus: access.status,
      tokenPreview: maskToken(companyToken),
    },
    ip,
    userAgent,
  });

  return NextResponse.json({
    // Formato legado — compatível com o APK atual
    success: true,
    valid: true,
    companyId: company.id,
    companyCode: String(company.code),
    companyName,
    tenantId: String(company.tenantId),
    status: company.status,
    plan: company.plan,
    subscriptionStatus: access.status,
    mobileEnabled: true,
    apiBaseUrl,
    apiHost,
    apiPort,
    mqttHost,
    mqttPort: company.mqttPort ?? null,
    protocol,
    tokenPreview: maskToken(companyToken),

    // Formato novo — evolução segura para próximas versões do APK
    company: {
      id: company.id,
      code: String(company.code),
      name: companyName,
      tenantId: String(company.tenantId),
      status: company.status,
      plan: company.plan,
      subscriptionStatus: access.status,
      mobileEnabled: true,
    },
    api: {
      baseUrl: apiBaseUrl,
      host: apiHost,
      port: apiPort,
      centralUrl: getCentralUrl(),
      mqttHost,
      mqttPort: company.mqttPort ?? null,
      protocol,
    },
    serverTime: new Date().toISOString(),
  });
}

// GET — informa uso correto
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      valid: false,
      errorCode: 'METHOD_NOT_ALLOWED',
      error: 'Método não permitido.',
      message:
        'Use POST /api/mobile/company/validate com header X-Company-Token ou { companyToken } no corpo.',
    },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
