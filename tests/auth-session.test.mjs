import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { test, after } from 'node:test';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server.js';

const require = createRequire(import.meta.url);
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-auth-session-'));
const nextAppRoot = path.resolve('.next/server/app');

// ── Senhas de teste geradas em runtime — nunca fixas ─────────────────────────
const TEST_OWNER_PASSWORD    = `test-owner-${crypto.randomUUID()}!A1`;
const TEST_TENANT_PASSWORD   = `test-tenant-${crypto.randomUUID()}!A1`;
const TEST_INACTIVE_PASSWORD = `test-inactive-${crypto.randomUUID()}!A1`;
const TEST_CSRF_PASSWORD     = `test-csrf-${crypto.randomUUID()}!A1`;
const TEST_AUDIT_PASSWORD    = `test-audit-${crypto.randomUUID()}!A1`;
const TEST_AUTH_SECRET       = crypto.randomBytes(32).toString('hex');

process.env.SILO_STORAGE_DIR = tmpRoot;
process.env.SILO_DATA_DIR = tmpRoot;
process.env.SILO_AUTH_SECRET = TEST_AUTH_SECRET;
process.env.SILO_PLATFORM_OWNER_PASSWORD = TEST_OWNER_PASSWORD;
process.env.SILO_DEMO_ADMIN_PASSWORD = TEST_TENANT_PASSWORD;

function findBundle(suffix) {
  const matches = [];
  const normalizedSuffix = suffix.split('/').join(path.sep);
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (path.relative(nextAppRoot, full) === normalizedSuffix) matches.push(full);
    }
  };
  walk(nextAppRoot);
  assert.ok(matches.length > 0, `bundle nao encontrado: ${suffix}`);
  return matches[0];
}

function loadRoute(suffix) {
  const file = findBundle(suffix);
  const mod = require(file);
  return mod.routeModule?.userland || mod;
}

function jsonReq(url, { method = 'GET', headers = {}, body } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  return new NextRequest(new URL('http://localhost' + url), init);
}

function setCookieFragments(response) {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'set-cookie ausente');
  return setCookie.split(/, (?=[^;,=]+=[^;,]*)/g);
}

function cookieHeader(response) {
  const sessionCookie = setCookieFragments(response).find((item) => item.startsWith('silo_session='))?.split(';')[0] || null;
  const csrfCookie = setCookieFragments(response).find((item) => item.startsWith('silo_csrf='))?.split(';')[0] || null;
  if (!sessionCookie) return null;
  return csrfCookie ? sessionCookie + '; ' + csrfCookie : sessionCookie;
}

function cookieFragment(response, name) {
  const fragment = setCookieFragments(response).find((item) => item.startsWith(name + '='));
  assert.ok(fragment, `cookie ${name} ausente`);
  return fragment;
}

function cookieValue(response, name) {
  return cookieFragment(response, name).split(';')[0].split('=').slice(1).join('=');
}

function cookieHasFlag(response, name, flag) {
  return cookieFragment(response, name).toLowerCase().includes(flag.toLowerCase());
}

function readJsonFile(file) {
  return JSON.parse(fs.readFileSync(file, 'utf-8'));
}

function writeJsonFile(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
}

function sessionHashFromCookie(cookie) {
  const value = cookie?.split(';')[0].split('=')[1] || '';
  const sessionId = value.split('.')[0];
  return crypto.createHmac('sha256', TEST_AUTH_SECRET).update(sessionId).digest('hex');
}

async function asJson(response) {
  return await response.json();
}

const authLoginRoute = () => loadRoute('api/auth/login/route.js');
const authLogoutRoute = () => loadRoute('api/auth/logout/route.js');
const authMeRoute = () => loadRoute('api/auth/me/route.js');
const usersRoute = () => loadRoute('api/cadastro/[entity]/route.js');
const cadastrosRoute = () => loadRoute('api/cadastro/[entity]/route.js');

let ownerCookie;
let ownerCsrf;

async function loginOwner() {
  const res = await authLoginRoute().POST(jsonReq('/api/auth/login', {
    method: 'POST',
    body: { email: 'sonieloficial@gmail.com', password: TEST_OWNER_PASSWORD },
  }));
  assert.equal(res.status, 200);
  ownerCsrf = cookieValue(res, 'silo_csrf');
  return cookieHeader(res);
}

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('login invalido retorna erro generico', async () => {
  const res = await authLoginRoute().POST(jsonReq('/api/auth/login', {
    method: 'POST',
    body: { email: 'nao-existe@example.test', password: 'qualquer-coisa' },
  }));
  assert.equal(res.status, 401);
  const body = await asJson(res);
  assert.equal(body.error, 'usuario ou senha invalidos');
});

test('cookies de sessao e csrf recebem flags esperadas', async () => {
  const res = await authLoginRoute().POST(jsonReq('/api/auth/login', {
    method: 'POST',
    body: { email: 'sonieloficial@gmail.com', password: TEST_OWNER_PASSWORD },
  }));
  assert.equal(res.status, 200);
  assert.ok(cookieHasFlag(res, 'silo_session', 'httponly'));
  assert.ok(cookieHasFlag(res, 'silo_session', 'samesite=lax'));
  assert.ok(!cookieHasFlag(res, 'silo_csrf', 'httponly'));
  assert.ok(cookieHasFlag(res, 'silo_csrf', 'samesite=lax'));
});

test('cookies ficam secure em producao', async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    const res = await authLoginRoute().POST(jsonReq('/api/auth/login', {
      method: 'POST',
      body: { email: 'sonieloficial@gmail.com', password: TEST_OWNER_PASSWORD },
    }));
    assert.equal(res.status, 200);
    assert.ok(cookieHasFlag(res, 'silo_session', 'secure'));
    assert.ok(cookieHasFlag(res, 'silo_csrf', 'secure'));
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
  }
});

test('logout invalida a sessao', async () => {
  ownerCookie = await loginOwner();
  const sessionsBefore = readJsonFile(path.join(tmpRoot, 'auth', 'sessions.json'));
  const targetHash = sessionHashFromCookie(ownerCookie);
  const logout = await authLogoutRoute().POST(jsonReq('/api/auth/logout', {
    method: 'POST',
    headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
  }));
  assert.equal(logout.status, 200);
  const logoutBody = await asJson(logout);
  assert.equal(logoutBody.success, true);
  assert.equal(logoutBody.message, 'Sessao encerrada com sucesso.');
  const sessionsAfter = readJsonFile(path.join(tmpRoot, 'auth', 'sessions.json'));
  assert.equal(sessionsAfter.length, sessionsBefore.length);
  const revoked = sessionsAfter.find((session) => session.sessionIdHash === targetHash);
  assert.ok(revoked?.revokedAt, 'sessao nao foi revogada');

  const me = await authMeRoute().GET(jsonReq('/api/auth/me', {
    headers: { cookie: ownerCookie },
  }));
  assert.equal(me.status, 401);
  const meBody = await asJson(me);
  assert.equal(meBody.authenticated, false);
  assert.equal(meBody.user, null);
});

test('usuario inativo nao loga', async () => {
  ownerCookie = await loginOwner();
  const createRes = await usersRoute().POST(jsonReq('/api/cadastro/users', {
    method: 'POST',
    headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
    body: {
      name: 'Inativo',
      username: 'inativo.silo',
      email: 'inativo@example.test',
      accessGroupId: 'role-admin-empresa',
      scope: 'TENANT',
      tenantId: 'silo-demo',
      defaultTenantId: 'silo-demo',
      status: 'INATIVO',
      mustChangePassword: false,
      password: TEST_INACTIVE_PASSWORD,
    },
  }), { params: { entity: 'users' } });
  assert.equal(createRes.status, 201);

  const loginRes = await authLoginRoute().POST(jsonReq('/api/auth/login', {
    method: 'POST',
    body: { email: 'inativo@example.test', password: TEST_INACTIVE_PASSWORD },
  }));
  assert.equal(loginRes.status, 401);
  const body = await asJson(loginRes);
  assert.equal(body.error, 'usuario ou senha invalidos');
});

test('SUPER_ADMIN_SILO sem activeTenantId nao escreve operacao', async () => {
  ownerCookie = await loginOwner();
  const res = await cadastrosRoute().POST(jsonReq('/api/cadastro/tipos', {
    method: 'POST',
    headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
    body: {
      code: 'TIPO-LOCK',
      name: 'Tipo Bloqueado',
      category: 'Apoio',
      iconType: 'CAMINHAO',
      primaryMetric: 'HORIMETRO',
      telemetryEnabledDefault: true,
      canEnabledDefault: true,
      mobileEnabledDefault: true,
      mapEnabled: true,
      operationalGroup: 'APOIO',
      active: true,
    },
  }), { params: { entity: 'tipos' } });
  assert.equal(res.status, 403);
});

test('header editavel nao bypassa sessao em producao', async () => {
  const prevNodeEnv = process.env.NODE_ENV;
  const prevAllow = process.env.SILO_ALLOW_HEADER_SESSION;
  process.env.NODE_ENV = 'production';
  process.env.SILO_ALLOW_HEADER_SESSION = 'true';
  try {
    const res = await usersRoute().GET(jsonReq('/api/cadastro/users', {
      headers: {
        'x-silo-user-id': 'usr-soniel-platform',
        'x-silo-user-name': 'Platform Owner',
        'x-silo-user-email': 'owner@example.test',
        'x-silo-user-role': 'SUPER_ADMIN_SILO',
        'X-Silo-Tenant': 'silo-demo',
      },
    }), { params: { entity: 'users' } });
    assert.equal(res.status, 401);
  } finally {
    process.env.NODE_ENV = prevNodeEnv;
    process.env.SILO_ALLOW_HEADER_SESSION = prevAllow;
  }
});

test('write route exige CSRF basico', async () => {
  ownerCookie = await loginOwner();
  const payload = {
    name: 'CSRF Test',
    username: 'csrf.test',
    email: 'csrf.test@example.test',
    accessGroupId: 'role-admin-empresa',
    scope: 'TENANT',
    tenantId: 'silo-demo',
    defaultTenantId: 'silo-demo',
    status: 'ATIVO',
    mustChangePassword: false,
    password: TEST_CSRF_PASSWORD,
  };

  const blocked = await usersRoute().POST(jsonReq('/api/cadastro/users', {
    method: 'POST',
    headers: { cookie: ownerCookie },
    body: payload,
  }), { params: { entity: 'users' } });
  assert.equal(blocked.status, 403);

  const allowed = await usersRoute().POST(jsonReq('/api/cadastro/users', {
    method: 'POST',
    headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
    body: payload,
  }), { params: { entity: 'users' } });
  assert.equal(allowed.status, 201);
});

test('sessao expirada e bloqueada', async () => {
  ownerCookie = await loginOwner();
  const sessionsFile = path.join(tmpRoot, 'auth', 'sessions.json');
  const sessions = readJsonFile(sessionsFile);
  const targetHash = sessionHashFromCookie(ownerCookie);
  const target = sessions.find((session) => session.sessionIdHash === targetHash);
  assert.ok(target, 'sessao alvo nao encontrada');
  target.expiresAt = new Date(Date.now() - 60_000).toISOString();
  writeJsonFile(sessionsFile, sessions);

  const me = await authMeRoute().GET(jsonReq('/api/auth/me', {
    headers: { cookie: ownerCookie },
  }));
  assert.equal(me.status, 401);
});

test('logs nao vazam cookie, senha ou hash', async () => {
  ownerCookie = await loginOwner();
  const body = {
    name: 'Audit Safe',
    username: 'audit.safe',
    email: 'audit.safe@example.test',
    accessGroupId: 'role-admin-empresa',
    scope: 'TENANT',
    tenantId: 'silo-demo',
    defaultTenantId: 'silo-demo',
    status: 'ATIVO',
    mustChangePassword: false,
    password: TEST_AUDIT_PASSWORD,
  };
  const created = await usersRoute().POST(jsonReq('/api/cadastro/users', {
    method: 'POST',
    headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
    body,
  }), { params: { entity: 'users' } });
  assert.equal(created.status, 201);

  const auditPath = path.join(tmpRoot, 'silo-demo', 'audit-log.jsonl');
  assert.ok(fs.existsSync(auditPath), 'audit log ausente');
  const auditContent = fs.readFileSync(auditPath, 'utf-8');
  assert.ok(!auditContent.includes(ownerCookie), 'cookie vazou no audit log');
  assert.ok(!auditContent.includes(ownerCsrf), 'csrf vazou no audit log');
  assert.ok(!auditContent.includes(TEST_AUDIT_PASSWORD), 'senha vazou no audit log');
  assert.ok(!auditContent.includes('passwordHash'), 'hash vazou no audit log');
});
