import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { AuthStore } from '@/lib/auth/auth-store';
import { auditFromRequest } from '@/lib/audit/audit-log';
import { resolveSessionFromRequest } from '@/lib/auth/session';
import { requireCsrf } from '@/lib/auth/csrf';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // ── 1. CSRF guard (must be first — rejects unauthenticated mutations) ──────
  const csrf = requireCsrf(req);
  if (csrf) return csrf;

  // ── 2. Session guard ───────────────────────────────────────────────────────
  const session = resolveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: 'Sessao nao identificada. Faca login novamente.' }, { status: 401 });
  }

  // ── 3. Payload validation ─────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };

  const currentPassword = String(body.currentPassword || '');
  const newPassword     = String(body.newPassword     || '');
  const confirmPassword = String(body.confirmPassword  || '');

  if (!currentPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: 'Preencha a senha atual e a nova senha.' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'A nova senha deve ter no minimo 8 caracteres.' }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: 'A confirmacao da senha nao confere.' }, { status: 400 });
  }

  // ── 4. Verify user is active ───────────────────────────────────────────────
  const user = AuthStore.getUserById(session.id);
  if (!user || user.status !== 'ATIVO') {
    return NextResponse.json({ error: 'Usuario inativo ou inexistente.' }, { status: 401 });
  }

  // ── 5. Validate CURRENT password before touching anything ─────────────────
  // The old hash is read from disk here and compared. No write has occurred yet.
  // NEVER log currentPassword or newPassword.
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: 'Senha atual invalida.' }, { status: 403 });
  }

  // ── 6. Atomic password update ─────────────────────────────────────────────
  // AuthStore.updatePassword:
  //   a) hashes newPassword in memory
  //   b) writes to users.json atomically (tmp + renameSync)
  //   c) sets mustChangePassword=false ONLY after the write succeeds
  // If the write fails, the old hash is preserved on disk and we return 500.
  try {
    await AuthStore.updatePassword(user.id, newPassword, false);
  } catch (err) {
    // Log the error type/message but NEVER the password value.
    console.error(
      '[change-password] atomic write failed userId=' + user.id,
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      { error: 'Erro ao persistir nova senha. Tente novamente.' },
      { status: 500 },
    );
  }

  // ── 7. Revoke other sessions — current session stays valid ────────────────
  // Only runs after a confirmed successful write (step 6 above).
  const sessionRecord = AuthStore.getSessionRecord(req.cookies.get(AuthStore.cookieName)?.value);
  AuthStore.revokeSessionsForUser(user.id, sessionRecord?.sessionIdHash || null);

  // ── 8. Audit log — scope/role only, never passwords ───────────────────────
  auditFromRequest(req, session.activeTenantId || session.tenantId || session.defaultTenantId, {
    userId: user.id,
    action: 'PASSWORD_CHANGE',
    entity: 'auth',
    entityId: user.id,
    metadata: { scope: user.scope, role: user.role },
  });

  return NextResponse.json({ ok: true });
}
