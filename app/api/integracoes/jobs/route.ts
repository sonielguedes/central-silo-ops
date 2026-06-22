import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/auth/api-guard';
import { requirePermission } from '@/lib/auth/rbac-server';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { IntegrationJobStorage } from '@/lib/integrations/integration-job-storage';
import type { IntegrationJobSource, IntegrationJobStatus, IntegrationJobType, IntegrationSystem } from '@/lib/integrations/integration-job-types';

export const dynamic = 'force-dynamic';

const JOB_STATUSES = new Set<IntegrationJobStatus>(['PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELED', 'RETRYING']);

function fail(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ success: false, error, ...(extra ?? {}) }, { status });
}

function getActor(req: NextRequest): string | undefined {
  const session = resolveSessionFromRequest(req);
  return session?.name || session?.email || session?.id;
}

function readBody(input: unknown): {
  system?: IntegrationSystem;
  type?: IntegrationJobType;
  title?: string;
  description?: string;
  maxAttempts?: number;
  source?: IntegrationJobSource;
  configId?: string;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
} {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Payload invalido');
  const body = input as Record<string, unknown>;
  return {
    system: typeof body.system === 'string' ? (body.system.trim().toUpperCase() as IntegrationSystem) : undefined,
    type: typeof body.type === 'string' ? (body.type.trim().toUpperCase() as IntegrationJobType) : undefined,
    title: typeof body.title === 'string' ? body.title.trim() : undefined,
    description: typeof body.description === 'string' ? body.description.trim() || undefined : undefined,
    maxAttempts: body.maxAttempts !== undefined ? Number(body.maxAttempts) : undefined,
    source: typeof body.source === 'string' ? (body.source.trim().toUpperCase() as IntegrationJobSource) : undefined,
    configId: typeof body.configId === 'string' ? body.configId.trim() || undefined : undefined,
    payload: body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload) ? (body.payload as Record<string, unknown>) : undefined,
    result: body.result && typeof body.result === 'object' && !Array.isArray(body.result) ? (body.result as Record<string, unknown>) : undefined,
  };
}

export async function GET(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'visualizar', tenant.tenantId);
  if (rbac) return rbac;

  const sp = req.nextUrl.searchParams;
  const status = sp.get('status')?.trim().toUpperCase();
  const items = IntegrationJobStorage.listByTenant(tenant.tenantId, {
    system: (sp.get('system')?.trim().toUpperCase() || undefined) as IntegrationSystem | undefined,
    status: status && JOB_STATUSES.has(status as IntegrationJobStatus) ? (status as IntegrationJobStatus) : undefined,
    type: (sp.get('type')?.trim().toUpperCase() || undefined) as IntegrationJobType | undefined,
    from: sp.get('from')?.trim() || undefined,
    to: sp.get('to')?.trim() || undefined,
    q: sp.get('q')?.trim() || undefined,
  });

  return NextResponse.json({ success: true, items, total: items.length });
}

export async function POST(req: NextRequest) {
  const tenant = requireTenant(req);
  if (!tenant.ok) return tenant.response;
  const rbac = requirePermission(req, 'integracoes', 'criar', tenant.tenantId);
  if (rbac) return rbac;

  try {
    const body = readBody(await req.json());
    if (!body.system) return fail(400, 'system obrigatorio');
    if (!body.type) return fail(400, 'type obrigatorio');
    if (!body.title) return fail(400, 'title obrigatorio');
    const maxAttempts = body.maxAttempts ?? 3;
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) return fail(400, 'maxAttempts deve ficar entre 1 e 10');

    const item = IntegrationJobStorage.create({
      tenantId: tenant.tenantId,
      system: body.system,
      type: body.type,
      title: body.title,
      description: body.description,
      maxAttempts,
      source: body.source ?? 'MANUAL',
      configId: body.configId,
      payload: body.payload,
      result: body.result,
      createdBy: getActor(req),
    });

    return NextResponse.json({ success: true, item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return fail(400, message);
  }
}
