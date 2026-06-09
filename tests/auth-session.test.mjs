import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { test, before, after } from 'node:test';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server.js';

const require = createRequire(import.meta.url);
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-auth-session-'));
const nextAppRoot = path.resolve('.next/server/app');

process.env.SILO_STORAGE_DIR = tmpRoot;
process.env.SILO_DATA_DIR = tmpRoot;
process.env.SILO_AUTH_SECRET = 'test-auth-secret-2026';
process.env.SILO_PLATFORM_OWNER_PASSWORD = 'OwnerPass!2026';
process.env.SILO_DEMO_ADMIN_PASSWORD = 'TenantPass!2026';

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

function cookieHeader(response) {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'set-cookie ausente');
  return setCookie.split(';')[0];
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

async function loginOwner() {
  const res = await authLoginRoute().POST(jsonReq('/api/auth/login', {
    method: 'POST',
    body: { email: 'sonieloficial@gmail.com', password: 'OwnerPass!2026' },
  }));
  assert.equal(res.status, 200);
  return cookieHeader(res);
}

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('login inválido retorna erro genérico', async () => {
  const res = await authLoginRoute().POST(jsonReq('/api/auth/login', {
    method: 'POST',
    body: { email: 'nao-existe@siloops.com.br', password: 'qualquer-coisa' },
  }));
  assert.equal(res.status, 401);
  const body = await asJson(res);
  assert.equal(body.error, 'usuario ou senha invalidos');
});

test('logout invalida a sessao', async () => {
  ownerCookie = await loginOwner();
  const logout = await authLogoutRoute().POST(jsonReq('/api/auth/logout', {
    method: 'POST',
    headers: { cookie: ownerCookie },
  }));
  assert.equal(logout.status, 200);

  const me = await authMeRoute().GET(jsonReq('/api/auth/me', {
    headers: { cookie: ownerCookie },
  }));
  assert.equal(me.status, 401);
});

test('usuário inativo não loga', async () => {
  ownerCookie = await loginOwner();
  const createRes = await usersRoute().POST(jsonReq('/api/cadastro/users', {
    method: 'POST',
    headers: { cookie: ownerCookie },
    body: {
      name: 'Inativo',
      username: 'inativo.silo',
      email: 'inativo@siloops.com.br',
      accessGroupId: 'role-admin-empresa',
      scope: 'TENANT',
      tenantId: 'silo-demo',
      defaultTenantId: 'silo-demo',
      status: 'INATIVO',
      mustChangePassword: false,
      password: 'InactivePass!2026',
    },
  }), { params: { entity: 'users' } });
  assert.equal(createRes.status, 201);

  const loginRes = await authLoginRoute().POST(jsonReq('/api/auth/login', {
    method: 'POST',
    body: { email: 'inativo@siloops.com.br', password: 'InactivePass!2026' },
  }));
  assert.equal(loginRes.status, 401);
  const body = await asJson(loginRes);
  assert.equal(body.error, 'usuario ou senha invalidos');
});

test('SUPER_ADMIN_SILO sem activeTenantId não escreve operação', async () => {
  ownerCookie = await loginOwner();
  const res = await cadastrosRoute().POST(jsonReq('/api/cadastro/tipos', {
    method: 'POST',
    headers: { cookie: ownerCookie },
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
