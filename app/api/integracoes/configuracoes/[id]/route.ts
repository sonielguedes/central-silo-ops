import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { IntegrationConfigActor, IntegrationConfigInput } from '@/lib/integrations/integration-config-types';
import { IntegrationConfigError, IntegrationConfigStorage } from '@/lib/integrations/integration-config-storage';

export const dynamic = 'force-dynamic';

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...(extra ?? {}) }, { status });
}

function getActor(req: NextRequest): IntegrationConfigActor {
  const session = resolveSessionFromRequest(req);
  if (!session) {
    throw new IntegrationConfigError('Sessao nao identificada', 401, 'UNAUTHENTICATED');
  }
  return { userId: session.id, userName: session.name, userRole: session.role };
}

function readBody(input: unknown): Partial<IntegrationConfigInput> {
  const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new IntegrationConfigError('Payload invalido');
  }
  const body = input as Record<string, unknown>;
  return {
    system: str(body.system) as IntegrationConfigInput['system'] | undefined,
    name: str(body.name),
    description: str(body.description),
    environment: str(body.environment) as IntegrationConfigInput['environment'] | undefined,
    baseUrl: str(body.baseUrl),
    authType: str(body.authType) as IntegrationConfigInput['authType'] | undefined,
    apiKey: str(body.apiKey),
    bearerToken: str(body.bearerToken),
    username: str(body.username),
    password: str(body.password),
    customHeaderName: str(body.customHeaderName),
    customHeaderValue: str(body.customHeaderValue),
    timeoutMs: body.timeoutMs !== undefined ? Number(body.timeoutMs) : undefined,
    retryCount: body.retryCount !== undefined ? Number(body.retryCount) : undefined,
    status: str(body.status) as IntegrationConfigInput['status'] | undefined,
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (rbac) return rbac;

  const item = IntegrationConfigStorage.getById(tenant.tenantId, params.id);
  if (!item) return fail(404, 'Configuracao nao encontrada');
  return NextResponse.json({ success: true, item });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'editar', tenant.tenantId);
  if (rbac) return rbac;

  try {
    const body = readBody(await req.json());
    const item = IntegrationConfigStorage.update(tenant.tenantId, params.id, body, getActor(req));
    return NextResponse.json({ success: true, item });
  } catch (error) {
    if (error instanceof IntegrationConfigError) {
      return fail(error.status, error.message, { code: error.code });
    }
    console.error('[integracoes/configuracoes/[id]] PUT failed', error);
    return fail(500, 'Erro interno');
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'editar', tenant.tenantId);
  if (rbac) return rbac;

  try {
    const item = IntegrationConfigStorage.deactivate(tenant.tenantId, params.id, getActor(req));
    return NextResponse.json({ success: true, item });
  } catch (error) {
    if (error instanceof IntegrationConfigError) {
      return fail(error.status, error.message, { code: error.code });
    }
    console.error('[integracoes/configuracoes/[id]] DELETE failed', error);
    return fail(500, 'Erro interno');
  }
}
