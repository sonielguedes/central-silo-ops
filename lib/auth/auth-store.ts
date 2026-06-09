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
  | 'COA'
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
}

export function roleFromAccessGroupId(accessGroupId: string): AuthRole {
  switch (accessGroupId) {
    case 'role-super-admin-silo':
      return 'SUPER_ADMIN_SILO';
    case 'role-admin-empresa':
      return 'ADMIN_EMPRESA';
    default:
      return 'CONSULTA';
  }
}

function ensureDir() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as T;
}

function writeJson(file: string, value: unknown) {
  ensureDir();
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
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
  if (changed) writeJson(USERS_FILE, merged);
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
  writeJson(SESSIONS_FILE, sessions);
}

function saveUsers(users: AuthUserRecord[]) {
  writeJson(USERS_FILE, users);
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
    };
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

    const timestamp = nowIso();
    users[index] = {
      ...users[index],
      passwordHash: hashPassword(password),
      mustChangePassword,
      passwordLastChangedAt: timestamp,
      updatedAt: timestamp,
      resetPasswordTokenHash: undefined,
      resetPasswordExpiresAt: undefined,
      resetPasswordUsedAt: timestamp,
    };
    saveUsers(users);
    return users[index];
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

  toPublicUser(user: AuthUserRecord) {
    return sanitizeUser(user);
  },
};
