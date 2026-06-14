/**
 * POST /api/mobile/company/resolve
 *
 * Permite que o APK descubra automaticamente a configuração da instância
 * (portas, hosts, IDs) a partir do Company Token que já possui.
 *
 * REGRAS DE SEGURANÇA:
 * - Não exige sessão web (APK ainda está configurando acesso).
 * - Não gera token novo.
 * - Nunca retorna token completo na resposta.
 * - Nunca loga token completo (sempre maskToken).
 * - Rate limit anti-brute-force: 20 tentativas/minuto por IP.
 * - Registra auditoria MOBILE_COMPANY_RESOLVED / MOBILE_COMPANY_RESOLVE_FAILED.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { maskToken } from '@/lib/auth/api-guard';
import { checkRateLimit } from '@/lib/security/rate-limit';
import { writeAudit } from '@/lib/audit/audit-log';
import { validateCompanyAccess } from '@/lib/subscription/subscription-validator';
import { migrateCompanySubscription } from '@/lib/subscription/subscription-migrator';

// ── Rate limit dedicado — mais restritivo que rotas autenticadas ─────────────

const RESOLVE_RATE_LIMIT = {
  maxRequests: 20,
  windowMs: 60_000,
  prefix: 'mobile-company-resolve',
} as const;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  );
}

function extractApiHost(apiBaseUrl?: string): string {
  if (!apiBaseUrl) return 'api.siloops.com.br';
  try {
    return new URL(apiBaseUrl).hostname;
  } catch {
    return 'api.siloops.com.br';
  }
}

function extractMqttHost(mqttUrl?: string): string {
  if (!mqttUrl) return 'mqtt.siloops.com.br';
  // mqttUrl pode vir como "mqtt.siloops.com.br:18832" ou "mqtt://..."
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

// ── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);

  // 1. Rate limit anti-brute-force (antes de qualquer lógica)
  const rl = checkRateLimit(req, RESOLVE_RATE_LIMIT);
  if (rl) return rl;

  // 2. Extrair token do header (fonte principal)
  const companyToken = req.headers.get('x-company-token')?.trim();

  if (!companyToken) {
    console.warn('[mobile/company/resolve] missing X-Company-Token', { ip });
    return NextResponse.json(
      {
        success: false,
        errorCode: 'MISSING_COMPANY_TOKEN',
        message: 'Header X-Company-Token e obrigatorio.',
      },
      { status: 401 },
    );
  }

  // 3. Buscar empresa pelo token (nunca logar token completo)
  const rawCompany = ServerStorage.getCompanyByToken(companyToken);

  if (!rawCompany) {
    console.warn('[mobile/company/resolve] token nao encontrado', {
      token: maskToken(companyToken),
      ip,
    });
    // Audit de falha sem gravar token completo
    // Sem tenantId conhecido — gravar no tenant global 'platform'
    writeAudit('platform', {
      userId: 'APK',
      action: 'MOBILE_COMPANY_RESOLVE_FAILED',
      entity: 'company',
      entityId: 'unknown',
      after: { errorCode: 'INVALID_COMPANY_TOKEN', tokenPreview: maskToken(companyToken) },
      ip,
      userAgent: req.headers.get('user-agent')?.slice(0, 200) || 'unknown',
    });
    return NextResponse.json(
      {
        success: false,
        errorCode: 'INVALID_COMPANY_TOKEN',
        message: 'Token invalido ou empresa inativa.',
      },
      { status: 401 },
    );
  }

  // 4. Migração lazy de campos de assinatura
  const { company } = migrateCompanySubscription(rawCompany);

  // 5. Validar status de assinatura
  const access = validateCompanyAccess(company);
  if (!access.allowed) {
    const errorCode = access.code ?? 'COMPANY_INACTIVE';

    console.warn('[mobile/company/resolve] acesso bloqueado', {
      token: maskToken(companyToken),
      tenantId: company.tenantId,
      errorCode,
      subscriptionStatus: access.status,
      ip,
    });

    writeAudit(company.tenantId, {
      userId: 'APK',
      action: 'MOBILE_COMPANY_RESOLVE_FAILED',
      entity: 'company',
      entityId: company.id,
      after: {
        errorCode,
        subscriptionStatus: access.status,
        tokenPreview: maskToken(companyToken),
      },
      ip,
      userAgent: req.headers.get('user-agent')?.slice(0, 200) || 'unknown',
    });

    return NextResponse.json(
      {
        success: false,
        errorCode,
        message: access.message,
      },
      { status: 403 },
    );
  }

  // 6. Empresa ativa — montar resposta sem nenhum campo de token
  const apiHost = extractApiHost(company.apiBaseUrl);
  const mqttHost = extractMqttHost(company.mqttUrl);
  const protocol = extractProtocol(company.apiBaseUrl);

  console.info('[mobile/company/resolve] resolved', {
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
    action: 'MOBILE_COMPANY_RESOLVED',
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
    userAgent: req.headers.get('user-agent')?.slice(0, 200) || 'unknown',
  });

  // Garantia extra: nunca incluir campos de token na resposta
  return NextResponse.json({
    success: true,
    companyId: company.id,
    companyCode: company.code,
    tenantId: company.tenantId,
    name: company.tradingName || company.corporateName || company.code,
    status: company.status,
    plan: company.plan,
    subscriptionStatus: access.status,
    apiHost,
    apiPort: company.apiPort ?? null,
    mqttHost,
    mqttPort: company.mqttPort ?? null,
    protocol,
  });
}

// GET conveniente — redireciona para POST semanticamente correto
export async function GET(_req: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      errorCode: 'METHOD_NOT_ALLOWED',
      message: 'Use POST /api/mobile/company/resolve com header X-Company-Token.',
    },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
