import { NextRequest, NextResponse } from 'next/server';
import { CadastroStorage, ALLOWED_ENTITIES } from '@/lib/cadastro-storage';
import { ServerStorage } from '@/lib/server-storage';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { entity: string; id: string } }
) {
  const { entity, id } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }
  const tenantId = ServerStorage.resolveTenantId(req.headers);
  const item = CadastroStorage.getById(tenantId, entity, id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { entity: string; id: string } }
) {
  const { entity, id } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }
  const tenantId = ServerStorage.resolveTenantId(req.headers);
  try {
    const body = await req.json();
    const updated = CadastroStorage.update(tenantId, entity, id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[storage-api] update error entity=' + entity + ' id=' + id, err);
    return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { entity: string; id: string } }
) {
  const { entity, id } = params;
  if (!ALLOWED_ENTITIES.includes(entity)) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }
  const tenantId = ServerStorage.resolveTenantId(req.headers);
  const ok = CadastroStorage.archive(tenantId, entity, id);
  if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ success: true });
}
