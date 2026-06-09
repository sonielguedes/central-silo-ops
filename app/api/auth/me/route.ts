import { NextRequest, NextResponse } from 'next/server';
import { AuthStore } from '@/lib/auth/auth-store';

export async function GET(req: NextRequest) {
  const session = AuthStore.resolveSession(req.cookies.get(AuthStore.cookieName)?.value);
  if (!session) {
    return NextResponse.json({ error: 'Sessao invalida' }, { status: 401 });
  }
  return NextResponse.json({ session });
}
