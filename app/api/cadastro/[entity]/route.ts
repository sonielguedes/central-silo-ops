import { NextRequest, NextResponse } from 'next/server';
import { CadastroStorage, ALLOWED_ENTITIES } from '@/lib/cadastro-storage';
import { ServerStorage } from '@/lib/server-storage';
import { blockWriteInDemo } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';

export const dynamic = 'force-dynamic';

function badEntity(entity: string) {
  return NextResponse.json(
    { error: 'Entity not found: ' + entity + '. Allowed: ' + ALLOWED_ENTITIES.join(', ') },
    { status: 404 }
  );
}

export async function GET(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  const { entity } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) return badEntity(entity);

  const tenantId = ServerStorage.resolveTenantId(req.headers);
  const data = CadastroStorage.getAll(tenantId, entity);
  return NextResponse.json(data);
}

export async function POST(
  req: NextRequest,
  { params }: { params: { entity: string } }
) {
  const demoBlock = blockWriteInDemo(req);
  if (demoBlock) return demoBlock;

  const { entity } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) return badEntity(entity);

  const tenantId = ServerStorage.resolveTenantId(req.headers);
  try {
    const body = await req.json();
    const item = CadastroStorage.create(tenantId, entity, body);
    auditFromRequest(req, tenantId, { action: 'CREATE', entity, entityId: (item as Record<string, string>).id });
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('[storage-api] create error entity=' + entity, err);
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}
