import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

const DATA_ROOT =
  process.env.SILO_STORAGE_DIR ||
  process.env.SILO_DATA_DIR ||
  (process.env.NODE_ENV === 'production' ? '/app/data' : './data');

const AUTH_DIR = path.join(DATA_ROOT, 'auth');
const USERS_FILE = path.join(AUTH_DIR, 'users.json');
const SESSIONS_FILE = path.join(AUTH_DIR, 'sessions.json');
const AUTH_COOKIE_NAME = 'silo_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export type AuthScope = 'PLATFORM' | 'TENANT';
export type AuthRole =
  | 'SUPER_ADMIN_SILO'
  | 'ADMIN_EMPRESA'
  | 'GESTOR'
  | 'SUPORTE'
  | 'GESTOR_COA'
  | 'COA'
  | 'SUPERVISOR_FRENTE'
  | 'OPERADOR_CENTRAL'
  | 'MANUTENCAO'
  | 'CLIENTE_RELATORIOS'
  | 'OPERADOR_APK'
  | 'SALA_OPERACIONAL'
  | 'CONSULTA'
  | 'AUDITOR';

export interface AuthUserRecord {
  id: string;
  tenantId: string | null;
  defaultTenantId: string;
  scope: AuthScope;
  role: AuthRole;
  accessGroupId: string;
  name: string;
  username: string;
  email: string;
  status: 'ATIVO' | 'INATIVO';
  mustChangePassword: boolean;
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  passwordLastChangedAt?: string;
  resetPasswordTokenHash?: string;
  resetPasswordExpiresAt?: string;
  resetPasswordUsedAt?: string;
}

export interface AuthSessionRecord {
  sessionIdHash: string;
  userId: string;
  scope: AuthScope;
  activeTenantId: string | null;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
}

export interface AuthSessionPayload {
  userId: string;
  name: string;
  email: string;
  role: AuthRole;
  scope: AuthScope;
  tenantId: string | null;
  activeTenantId: string | null;
  defaultTenantId: string;
  accessGroupId: string;
  expiresAt: string;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
}

export function roleFromAccessGroupId(accessGroupId: string): AuthRole {
  switch (accessGroupId) {
    case 'role-super-admin-silo':   return 'SUPER_ADMIN_SILO';
    case 'role-super-admin':        return 'SUPER_ADMIN_SILO';
    case 'role-admin-empresa':      return 'ADMIN_EMPRESA';
    case 'ag-suporte':              return 'SUPORTE';
    case 'role-suporte':            return 'SUPORTE';
    case 'role-gestor':             return 'GESTOR';
    case 'role-gestor-coa':         return 'GESTOR_COA';
    case 'role-coa':                return 'COA';
    case 'role-supervisor-frente':  return 'SUPERVISOR_FRENTE';
    case 'role-operador-central':   return 'OPERADOR_CENTRAL';
    case 'role-manutencao':         return 'MANUTENCAO';
    case 'role-cliente-relatorios': return 'CLIENTE_RELATORIOS';
    case 'role-operador-apk':       return 'OPERADOR_APK';
    case 'role-sala-operacional':   return 'SALA_OPERACIONAL';
    case 'ag-sala-operacional':     return 'SALA_OPERACIONAL';
    case 'role-auditor':            return 'AUDITOR';
    default:                        return 'CONSULTA';
  }
}

function ensureDir() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

/**
 * Writes JSON to `file` atomically using a write-then-rename pattern.
 *
 * 1. Serialize to JSON.
 * 2. Write to `<file>.tmp.<pid>.<ts>` — a new file, isolated from the target.
 * 3. Rename tmp → target (atomic on POSIX; best-effort on Windows).
 *
 * On any failure the tmp file is cleaned up and the original file is untouched,
 * so the old data survives partial writes, crashes, or disk-full errors.
 * NEVER logs the contents — callers must not pass sensitive values to error messages.
 */
function writeJsonAtomic(file: string, value: unknown): void {
  ensureDir();
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf-8');
    fs.renameSync(tmp, file); // POSIX: atomic swap; Windows: best-effort
  } catch (err) {
    try { fs.unlinkSync(tmp); } catch { /* ignore — cleanup only */ }
    throw err;
  }
}

function nowIso() {
  return new Date().toISOString();
}

function randomId(prefix: string) {
  return `${prefix}-${crypto.randomBytes(16).toString('hex')}`;
}

function getAuthSecret(): string {
  const secret = process.env.SILO_AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('SILO_AUTH_SECRET ausente. Configure a sessao segura antes de autenticar.');
  }
  return secret;
}

function signSessionId(sessionId: string): string {
  return crypto.createHmac('sha256', getAuthSecret()).update(sessionId).digest('hex');
}

function hashSessionId(sessionId: string): string {
  return signSessionId(sessionId);
}

function packCookie(sessionId: string): string {
  return `${sessionId}.${signSessionId(sessionId)}`;
}

function unpackCookie(cookieValue: string): string | null {
  const parts = cookieValue.split('.');
  if (parts.length === 1) return cookieValue.trim() || null;
  if (parts.length !== 2) return null;
  const [sessionId, signature] = parts;
  const expected = signSessionId(sessionId);
  const a = Buffer.from(signature, 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return sessionId;
}

function hashPassword(password: string): string {
  if (!password || !password.trim()) {
    throw new Error('Senha inicial ausente para seed/auth.');
  }
  return bcrypt.hashSync(password, 12);
}

function ensureSeedUsers(): AuthUserRecord[] {
  ensureDir();
  const current = readJson<AuthUserRecord[]>(USERS_FILE, []);

  const ownerPassword = process.env.SILO_PLATFORM_OWNER_PASSWORD;
  const demoPassword = process.env.SILO_DEMO_ADMIN_PASSWORD || ownerPassword;

  const seedBase: AuthUserRecord[] = [
    {
      id: 'usr-soniel-platform',
      tenantId: null,
      defaultTenantId: 'silo-demo',
      scope: 'PLATFORM',
      role: 'SUPER_ADMIN_SILO',
      accessGroupId: 'role-super-admin-silo',
      name: 'Soniel Guedes',
      username: 'sonieloficial',
      email: 'sonieloficial@gmail.com',
      status: 'ATIVO',
      mustChangePassword: true,
      passwordHash: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: undefined,
      passwordLastChangedAt: nowIso(),
    },
    {
      id: 'usr-demo-admin',
      tenantId: 'silo-demo',
      defaultTenantId: 'silo-demo',
      scope: 'TENANT',
      role: 'ADMIN_EMPRESA',
      accessGroupId: 'role-admin-empresa',
      name: 'SILO OPS Demo Admin',
      username: 'demo.admin',
      email: 'admin@siloops.com.br',
      status: 'ATIVO',
      mustChangePassword: true,
      passwordHash: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      lastLoginAt: undefined,
      passwordLastChangedAt: nowIso(),
    },
  ];

  const upsertSeedUser = (users: AuthUserRecord[], seed: AuthUserRecord, passwordSeed?: string) => {
    const index = users.findIndex(
      (user) =>
        user.id === seed.id ||
        user.email.toLowerCase() === seed.email.toLowerCase() ||
        user.username.toLowerCase() === seed.username.toLowerCase(),
    );
    const existing = index >= 0 ? users[index] : undefined;
    const passwordHash = existing?.passwordHash || (passwordSeed ? hashPassword(passwordSeed) : '');

    if (!existing && !passwordHash) {
      throw new Error(`Seed obrigatoria ausente para ${seed.email}`);
    }

    const next: AuthUserRecord = {
      ...seed,
      ...existing,
      id: existing?.id || seed.id,
      tenantId: existing?.tenantId ?? seed.tenantId,
      defaultTenantId: existing?.defaultTenantId || seed.defaultTenantId,
      scope: existing?.scope || seed.scope,
      role: existing?.role || seed.role,
      accessGroupId: existing?.accessGroupId || seed.accessGroupId,
      name: existing?.name || seed.name,
      username: existing?.username || seed.username,
      email: existing?.email || seed.email,
      status: existing?.status || seed.status,
      mustChangePassword: existing?.mustChangePassword ?? seed.mustChangePassword,
      passwordHash,
      createdAt: existing?.createdAt || seed.createdAt,
      updatedAt: existing?.updatedAt || seed.updatedAt,
      lastLoginAt: existing?.lastLoginAt || seed.lastLoginAt,
      passwordLastChangedAt: existing?.passwordLastChangedAt || seed.passwordLastChangedAt,
      resetPasswordTokenHash: existing?.resetPasswordTokenHash,
      resetPasswordExpiresAt: existing?.resetPasswordExpiresAt,
      resetPasswordUsedAt: existing?.resetPasswordUsedAt,
    };

    if (index >= 0) users[index] = next;
    else users.push(next);
  };

  const merged = [...current];
  upsertSeedUser(merged, seedBase[0], ownerPassword);
  upsertSeedUser(merged, seedBase[1], demoPassword || ownerPassword);

  const changed = JSON.stringify(merged) !== JSON.stringify(current);
  if (changed) writeJsonAtomic(USERS_FILE, merged);
  return merged;
}

function loadSessions(): AuthSessionRecord[] {
  ensureDir();
  const raw = readJson<Array<Partial<AuthSessionRecord> & { id?: string }>>(SESSIONS_FILE, []);
  const sessions = raw
    .map((session) => {
      const sessionIdHash = session.sessionIdHash || (session.id ? hashSessionId(session.id) : '');
      if (!sessionIdHash || !session.userId || !session.expiresAt || !session.createdAt || !session.updatedAt) {
        return null;
      }
      return {
        sessionIdHash,
        userId: session.userId,
        scope: session.scope || 'TENANT',
        activeTenantId: session.activeTenantId ?? null,
        expiresAt: session.expiresAt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        revokedAt: session.revokedAt,
      } as AuthSessionRecord;
    })
    .filter((session): session is AuthSessionRecord => Boolean(session));

  if (JSON.stringify(raw) !== JSON.stringify(sessions)) {
    saveSessions(sessions);
  }

  return sessions;
}

function saveSessions(sessions: AuthSessionRecord[]) {
  writeJsonAtomic(SESSIONS_FILE, sessions);
}

function saveUsers(users: AuthUserRecord[]) {
  writeJsonAtomic(USERS_FILE, users);
}

function cleanupExpiredSessions(sessions: AuthSessionRecord[]): AuthSessionRecord[] {
  const now = Date.now();
  const next = sessions.filter((session) => {
    if (session.revokedAt) return false;
    return new Date(session.expiresAt).getTime() > now;
  });
  if (next.length !== sessions.length) saveSessions(next);
  return next;
}

function sanitizeUser(user: AuthUserRecord) {
  const { passwordHash, resetPasswordTokenHash, resetPasswordExpiresAt, resetPasswordUsedAt, ...rest } = user;
  return rest;
}

export const AuthStore = {
  cookieName: AUTH_COOKIE_NAME,

  listUsers(): AuthUserRecord[] {
    return ensureSeedUsers();
  },

  getUserById(id: string): AuthUserRecord | undefined {
    return this.listUsers().find((user) => user.id === id);
  },

  findUserByIdentifier(identifier: string): AuthUserRecord | undefined {
    const normalized = identifier.trim().toLowerCase();
    return this.listUsers().find(
      (user) => user.email.toLowerCase() === normalized || user.username.toLowerCase() === normalized,
    );
  },

  async verifyPassword(user: AuthUserRecord, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  },

  async createSession(user: AuthUserRecord): Promise<{ cookie: string; payload: AuthSessionPayload }> {
    const sessionId = randomId('sess');
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const previousLoginAt = user.lastLoginAt || null;
    const sessions = loadSessions();
    sessions.push({
      sessionIdHash: hashSessionId(sessionId),
      userId: user.id,
      scope: user.scope,
      activeTenantId: user.scope === 'TENANT' ? user.tenantId : null,
      createdAt,
      updatedAt: createdAt,
      expiresAt,
    });
    saveSessions(sessions);
    this.markLogin(user.id, createdAt);

    return {
      cookie: packCookie(sessionId),
      payload: {
        userId: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        scope: user.scope,
        tenantId: user.tenantId,
        activeTenantId: user.scope === 'TENANT' ? user.tenantId : null,
        defaultTenantId: user.defaultTenantId,
        accessGroupId: user.accessGroupId,
        expiresAt,
        mustChangePassword: user.mustChangePassword,
        lastLoginAt: previousLoginAt,
      },
    };
  },

  resolveSession(cookieValue: string | undefined | null): AuthSessionPayload | null {
    if (!cookieValue) return null;
    const sessionId = unpackCookie(cookieValue);
    if (!sessionId) return null;
    const sessionIdHash = hashSessionId(sessionId);

    const sessions = cleanupExpiredSessions(loadSessions());
    const session = sessions.find((item) => item.sessionIdHash === sessionIdHash && !item.revokedAt);
    if (!session) return null;

    const user = this.getUserById(session.userId);
    if (!user || user.status !== 'ATIVO') return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null;

    return {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      scope: user.scope,
      tenantId: user.tenantId,
      activeTenantId: session.activeTenantId ?? (user.scope === 'TENANT' ? user.tenantId : null),
      defaultTenantId: user.defaultTenantId,
      accessGroupId: user.accessGroupId,
      expiresAt: session.expiresAt,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt || null,
    };
  },

  getSessionRecord(cookieValue: string | undefined | null): AuthSessionRecord | null {
    if (!cookieValue) return null;
    const sessionId = unpackCookie(cookieValue);
    if (!sessionId) return null;
    const sessionIdHash = hashSessionId(sessionId);
    const sessions = cleanupExpiredSessions(loadSessions());
    const session = sessions.find((item) => item.sessionIdHash === sessionIdHash && !item.revokedAt);
    return session || null;
  },

  revokeSession(cookieValue: string | undefined | null): void {
    if (!cookieValue) return;
    const sessionId = unpackCookie(cookieValue);
    if (!sessionId) return;
    const sessionIdHash = hashSessionId(sessionId);

    const sessions = loadSessions();
    const session = sessions.find((item) => item.sessionIdHash === sessionIdHash);
    if (!session || session.revokedAt) return;
    session.revokedAt = nowIso();
    session.updatedAt = nowIso();
    saveSessions(sessions);
  },

  revokeSessionsForUser(userId: string, exceptSessionIdHash?: string | null): void {
    const sessions = loadSessions();
    const now = nowIso();
    let changed = false;
    for (const session of sessions) {
      if (session.userId !== userId) continue;
      if (exceptSessionIdHash && session.sessionIdHash === exceptSessionIdHash) continue;
      if (session.revokedAt) continue;
      session.revokedAt = now;
      session.updatedAt = now;
      changed = true;
    }
    if (changed) saveSessions(sessions);
  },

  setActiveTenant(cookieValue: string | undefined | null, activeTenantId: string | null): AuthSessionPayload | null {
    if (!cookieValue) return null;
    const sessionId = unpackCookie(cookieValue);
    if (!sessionId) return null;
    const sessionIdHash = hashSessionId(sessionId);
    const sessions = loadSessions();
    const session = sessions.find((item) => item.sessionIdHash === sessionIdHash && !item.revokedAt);
    if (!session) return null;
    const user = this.getUserById(session.userId);
    if (!user || user.status !== 'ATIVO') return null;

    session.activeTenantId = activeTenantId;
    session.updatedAt = nowIso();
    saveSessions(sessions);

    return this.resolveSession(cookieValue);
  },

  async updatePassword(userId: string, password: string, mustChangePassword = false): Promise<AuthUserRecord> {
    const users = this.listUsers();
    const index = users.findIndex((user) => user.id === userId);
    if (index === -1) throw new Error('Usuario nao encontrado');

    // Step 1 — hash the new password in memory BEFORE touching the file.
    // If hashPassword throws (empty/invalid input), the file is untouched and
    // the old passwordHash is preserved on disk.
    const newHash = hashPassword(password);

    // Step 2 — build the updated record in memory.
    // mustChangePassword is NOT cleared until the atomic write succeeds below.
    const timestamp = nowIso();
    const updated: AuthUserRecord = {
      ...users[index],
      passwordHash: newHash,
      mustChangePassword,          // becomes false only after saveUsers() succeeds
      passwordLastChangedAt: timestamp,
      updatedAt: timestamp,
      lastLoginAt: users[index].lastLoginAt,
      resetPasswordTokenHash: undefined,
      resetPasswordExpiresAt: undefined,
      resetPasswordUsedAt: timestamp,
    };

    // Step 3 — write atomically: old file is preserved if writeJsonAtomic throws.
    users[index] = updated;
    saveUsers(users);   // writeJsonAtomic(USERS_FILE, users) under the hood
    return updated;
  },

  async upsertUser(input: Partial<AuthUserRecord> & Pick<AuthUserRecord, 'name' | 'email' | 'username' | 'accessGroupId' | 'status'>): Promise<AuthUserRecord> {
    const users = this.listUsers();
    const timestamp = nowIso();
    const existingIndex = users.findIndex(
      (user) => user.id === input.id || user.email.toLowerCase() === input.email.toLowerCase() || user.username.toLowerCase() === input.username.toLowerCase(),
    );
    const accessGroupId = input.accessGroupId;
    const role = (input.role || roleFromAccessGroupId(accessGroupId)) as AuthRole;
    const next: AuthUserRecord = {
      id: input.id || randomId('usr'),
      tenantId: input.tenantId === undefined ? null : input.tenantId,
      defaultTenantId: input.defaultTenantId || input.tenantId || 'silo-demo',
      scope: input.scope || (input.tenantId ? 'TENANT' : 'PLATFORM'),
      role,
      accessGroupId,
      name: input.name,
      username: input.username,
      email: input.email,
      status: input.status,
      mustChangePassword: input.mustChangePassword ?? false,
      passwordHash: input.passwordHash || users[existingIndex]?.passwordHash || '',
      createdAt: existingIndex >= 0 ? users[existingIndex].createdAt : timestamp,
      updatedAt: timestamp,
      passwordLastChangedAt: input.passwordLastChangedAt || users[existingIndex]?.passwordLastChangedAt,
      resetPasswordTokenHash: input.resetPasswordTokenHash,
      resetPasswordExpiresAt: input.resetPasswordExpiresAt,
      resetPasswordUsedAt: input.resetPasswordUsedAt,
    };

    if (existingIndex >= 0) users[existingIndex] = next;
    else users.push(next);
    saveUsers(users);
    return next;
  },

  archiveUser(userId: string): boolean {
    const users = this.listUsers();
    const index = users.findIndex((user) => user.id === userId);
    if (index === -1) return false;
    users[index] = {
      ...users[index],
      status: 'INATIVO',
      updatedAt: nowIso(),
    };
    saveUsers(users);
    return true;
  },

  /** Hard-delete a user by id and revoke all their sessions — used only for provisioning rollback. */
  removeUser(userId: string): boolean {
    // 1. Remove from users list
    const users = this.listUsers();
    const next = users.filter((u) => u.id !== userId);
    if (next.length === users.length) return false;
    saveUsers(next);

    // 2. Revoke all sessions for this user
    const sessions = loadSessions();
    const now = nowIso();
    let changed = false;
    for (const session of sessions) {
      if (session.userId !== userId) continue;
      if (session.revokedAt) continue;
      session.revokedAt = now;
      session.updatedAt = now;
      changed = true;
    }
    if (changed) saveSessions(sessions);

    return true;
  },

  toPublicUser(user: AuthUserRecord) {
    return sanitizeUser(user);
  },

  markLogin(userId: string, loginAt: string): void {
    const users = this.listUsers();
    const index = users.findIndex((user) => user.id === userId);
    if (index === -1) return;
    users[index] = {
      ...users[index],
      updatedAt: loginAt,
      lastLoginAt: loginAt,
    };
    saveUsers(users);
  },
};
