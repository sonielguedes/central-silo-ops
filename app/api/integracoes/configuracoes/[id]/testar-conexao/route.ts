import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { IntegrationConfigActor } from '@/lib/integrations/integration-config-types';
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

async function executeTest(tenantId: string, configId: string) {
  const stored = IntegrationConfigStorage.getStoredById(tenantId, configId);
  if (!stored) throw new IntegrationConfigError('Configuracao nao encontrada', 404, 'NOT_FOUND');

  let url: URL;
  try {
    url = new URL(stored.baseUrl);
  } catch {
    throw new IntegrationConfigError('Endpoint base invalido');
  }

  const init = IntegrationConfigStorage.buildRequestInit(stored);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.min(stored.timeoutMs || 3000, 5000));

  try {
    const response = await fetch(url.toString(), {
      ...init,
      method: 'HEAD',
      signal: controller.signal,
      headers: init.headers,
    });

    if (response.ok || (response.status >= 300 && response.status < 400)) {
      return { status: 'SUCCESS' as const, message: `Conexao OK (${response.status})` };
    }

    if (response.status === 405 || response.status === 501) {
      const retry = await fetch(url.toString(), {
        ...init,
        method: 'GET',
        signal: controller.signal,
        headers: init.headers,
      });
      if (retry.ok || (retry.status >= 300 && retry.status < 400)) {
        return { status: 'SUCCESS' as const, message: `Conexao OK (${retry.status})` };
      }
      return { status: 'FAILED' as const, message: `Falha na resposta (${retry.status})` };
    }

    return { status: 'FAILED' as const, message: `Falha na resposta (${response.status})` };
  } catch (error) {
    return {
      status: 'FAILED' as const,
      message: error instanceof Error ? error.message : 'Falha ao testar conexao',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'editar', tenant.tenantId);
  if (rbac) return rbac;

  try {
    const result = await executeTest(tenant.tenantId, params.id);
    const item = IntegrationConfigStorage.updateConnectionStatus(
      tenant.tenantId,
      params.id,
      { status: result.status, message: result.message },
      getActor(req),
    );
    return NextResponse.json({ success: true, item });
  } catch (error) {
    if (error instanceof IntegrationConfigError) {
      return fail(error.status, error.message, { code: error.code });
    }
    console.error('[integracoes/configuracoes/[id]/testar-conexao] POST failed', error);
    return fail(500, 'Erro interno');
  }
}
