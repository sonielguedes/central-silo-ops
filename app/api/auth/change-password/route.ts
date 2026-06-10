import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { AuthStore } from '@/lib/auth/auth-store';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { requireCsrf } from '@/lib/auth/csrf';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  const session = resolveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Sessao nao identificada. Faca login novamente.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };

  const currentPassword = String(body.currentPassword || '');
  const newPassword = String(body.newPassword || '');
  const confirmPassword = String(body.confirmPassword || '');

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'Preencha a senha atual e a nova senha.' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'A nova senha deve ter no minimo 8 caracteres.' }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'A confirmacao da senha nao confere.' }, { status: 400 });
  }

  const user = AuthStore.getUserById(session.id);
  if (!user || user.status !== 'ATIVO') {
    return NextResponse.json({ error: 'Usuario inativo ou inexistente.' }, { status: 401 });
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Senha atual invalida.' }, { status: 403 });
  }

  await AuthStore.updatePassword(user.id, newPassword, false);
  const sessionRecord = AuthStore.getSessionRecord(req.cookies.get(AuthStore.cookieName)?.value);
  AuthStore.revokeSessionsForUser(user.id, sessionRecord?.sessionIdHash || null);

  auditFromRequest(req, session.activeTenantId || session.tenantId || session.defaultTenantId, {
    userId: user.id,
    action: 'PASSWORD_CHANGE',
    entity: 'auth',
    entityId: user.id,
    metadata: { scope: user.scope, role: user.role },
  });

  return NextResponse.json({ ok: true });
}
