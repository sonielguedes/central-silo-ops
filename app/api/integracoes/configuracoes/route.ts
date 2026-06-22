import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import {
  IntegrationConfigActor,
  IntegrationConfigInput,
} from '@/lib/integrations/integration-config-types';
import { IntegrationConfigStorage, IntegrationConfigError } from '@/lib/integrations/integration-config-storage';

export const dynamic = 'force-dynamic';

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...(extra ?? {}) }, { status });
}

function getActor(req: NextRequest): IntegrationConfigActor {
  const session = resolveSessionFromRequest(req);
  if (!session) {
    throw new IntegrationConfigError('Sessao nao identificada', 401, 'UNAUTHENTICATED');
  }
  return {
    userId: session.id,
    userName: session.name,
    userRole: session.role,
  };
}

function readBody(input: unknown): IntegrationConfigInput {
  const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new IntegrationConfigError('Payload invalido');
  }

  const body = input as Record<string, unknown>;
  return {
    system: str(body.system) as IntegrationConfigInput['system'],
    name: str(body.name) || '',
    description: str(body.description),
    environment: str(body.environment) as IntegrationConfigInput['environment'],
    baseUrl: str(body.baseUrl) || '',
    authType: str(body.authType) as IntegrationConfigInput['authType'],
    apiKey: str(body.apiKey),
    bearerToken: str(body.bearerToken),
    username: str(body.username),
    password: str(body.password),
    customHeaderName: str(body.customHeaderName),
    customHeaderValue: str(body.customHeaderValue),
    timeoutMs: Number(body.timeoutMs),
    retryCount: Number(body.retryCount),
    status: (str(body.status) || 'INACTIVE') as IntegrationConfigInput['status'],
  };
}

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;

  const rbac = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (rbac) return rbac;

  try {
    const items = IntegrationConfigStorage.listByTenant(tenant.tenantId);
    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('[integracoes/configuracoes] GET failed', error);
    return fail(500, 'Erro interno');
  }
}

export async function POST(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;

  const rbac = requirePermission(req, 'integracoes', 'criar', tenant.tenantId);
  if (rbac) return rbac;

  try {
    const body = readBody(await req.json());
    const item = IntegrationConfigStorage.create(tenant.tenantId, body, getActor(req));
    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error) {
    if (error instanceof IntegrationConfigError) {
      return fail(error.status, error.message, { code: error.code });
    }
    console.error('[integracoes/configuracoes] POST failed', error);
    return fail(500, 'Erro interno');
  }
}
