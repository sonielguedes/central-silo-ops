/**
 * tests/rbac-permissions.test.mjs
 *
 * Cenários:
 *  1. CONSULTA não pode criar equipamento (esperado 403)
 *  2. GESTOR_COA pode acessar dashboard e relatórios (esperado 200)
 *  3. Usuário sem sessão recebe 401/403 da API
 *  4. ADMIN_EMPRESA não consegue ver dados de outro tenant (esperado 403)
 *  5. SUPER_ADMIN_SILO sem activeTenantId não escreve dados operacionais (esperado 400/403)
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { test, before, after } from 'node:test';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server.js';

const require = createRequire(import.meta.url);

// ── Env setup ─────────────────────────────────────────────────────────────────
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-rbac-'));
process.env.SILO_STORAGE_DIR = tmpRoot;
process.env.SILO_DATA_DIR    = tmpRoot;

// ── Senhas de teste geradas em runtime — nunca fixas ──────────────────────────
const TEST_OWNER_PASSWORD      = `test-owner-${crypto.randomUUID()}!A1`;
const TEST_TENANT_PASSWORD     = `test-tenant-${crypto.randomUUID()}!A1`;
const TEST_CONSULTA_PASSWORD   = `test-consulta-${crypto.randomUUID()}!A1`;
const TEST_GESTOR_COA_PASSWORD = `test-gestorcoa-${crypto.randomUUID()}!A1`;
const TEST_ADMIN_A_PASSWORD    = `test-admina-${crypto.randomUUID()}!A1`;

process.env.SILO_AUTH_SECRET             = crypto.randomBytes(32).toString('hex');
process.env.SILO_PLATFORM_OWNER_PASSWORD = TEST_OWNER_PASSWORD;
process.env.SILO_DEMO_ADMIN_PASSWORD     = TEST_TENANT_PASSWORD;
process.env.NEXT_PUBLIC_SILO_TENANT_ID   = 'silo-ops-001';
process.env.SILO_TENANT_ID               = 'silo-ops-001';

const nextAppRoot = path.resolve('.next/server/app');

// ── Helpers ───────────────────────────────────────────────────────────────────
function findBundle(suffix) {
  const normalizedSuffix = suffix.split('/').join(path.sep);
  const results = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (path.relative(nextAppRoot, full) === normalizedSuffix) results.push(full);
    }
  };
  walk(nextAppRoot);
  assert.ok(results.length > 0, `bundle nao encontrado: ${suffix}`);
  return results[0];
}

function loadRoute(suffix) {
  const file = findBundle(suffix);
  const mod  = require(file);
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
  const raw = response.headers.get('set-cookie') ?? '';
  return raw.split(/, (?=[^;,=]+=[^;,]*)/g);
}

function cookieValue(response, name) {
  const frag = setCookieFragments(response).find((f) => f.startsWith(name + '='));
  assert.ok(frag, `cookie ${name} ausente`);
  return frag.split(';')[0].split('=').slice(1).join('=');
}

function cookieHeader(response) {
  const session = setCookieFragments(response).find((f) => f.startsWith('silo_session='))?.split(';')[0];
  const csrf    = setCookieFragments(response).find((f) => f.startsWith('silo_csrf='))?.split(';')[0];
  return [session, csrf].filter(Boolean).join('; ');
}

async function login(email, password) {
  const res = await loadRoute('api/auth/login/route.js').POST(
    jsonReq('/api/auth/login', { method: 'POST', body: { email, password } }),
  );
  assert.equal(res.status, 200, `login falhou para ${email}: status ${res.status}`);
  return { cookie: cookieHeader(res), csrf: cookieValue(res, 'silo_csrf') };
}

// ── Route loaders (lazy) ──────────────────────────────────────────────────────
const cadastroRoute = () => loadRoute('api/cadastro/[entity]/route.js');
const fichaRoute    = () => loadRoute('api/ficha-operador/route.js');
const relEffRoute   = () => loadRoute('api/relatorios/eficiencia-operacional/route.js');
const dashSummRoute = () => loadRoute('api/dashboard/summary/route.js');

// ── State ─────────────────────────────────────────────────────────────────────
const TENANT_A = 'empresa-alpha';
const TENANT_B = 'empresa-beta';

let ownerCookie;
let ownerCsrf;
let consultaAuth;
let gestorAuth;
let adminAAuth;

// ── Setup: cria todos os usuários necessários antes dos testes ────────────────
before(async () => {
  const auth = await login('sonieloficial@gmail.com', TEST_OWNER_PASSWORD);
  ownerCookie = auth.cookie;
  ownerCsrf   = auth.csrf;

  // Usuário CONSULTA
  const r1 = await cadastroRoute().POST(
    jsonReq('/api/cadastro/users', {
      method: 'POST',
      headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
      body: {
        name: 'Consulta User', email: 'consulta@example.test', username: 'consulta_user',
        password: TEST_CONSULTA_PASSWORD, accessGroupId: 'role-consulta',
        tenantId: TENANT_A, defaultTenantId: TENANT_A, scope: 'TENANT', status: 'ATIVO',
        mustChangePassword: false,
      },
    }),
    { params: { entity: 'users' } },
  );
  assert.ok(r1.status === 201 || r1.status === 200, `criar CONSULTA: ${r1.status}`);
  consultaAuth = await login('consulta@example.test', TEST_CONSULTA_PASSWORD);

  // Usuário GESTOR_COA
  const r2 = await cadastroRoute().POST(
    jsonReq('/api/cadastro/users', {
      method: 'POST',
      headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
      body: {
        name: 'Gestor COA', email: 'gestor.coa@example.test', username: 'gestor_coa_user',
        password: TEST_GESTOR_COA_PASSWORD, accessGroupId: 'role-gestor-coa',
        tenantId: TENANT_A, defaultTenantId: TENANT_A, scope: 'TENANT', status: 'ATIVO',
        mustChangePassword: false,
      },
    }),
    { params: { entity: 'users' } },
  );
  assert.ok(r2.status === 201 || r2.status === 200, `criar GESTOR_COA: ${r2.status}`);
  gestorAuth = await login('gestor.coa@example.test', TEST_GESTOR_COA_PASSWORD);

  // Usuário ADMIN_EMPRESA (tenant A)
  const r3 = await cadastroRoute().POST(
    jsonReq('/api/cadastro/users', {
      method: 'POST',
      headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
      body: {
        name: 'Admin A', email: 'admin.a@example.test', username: 'admin_a',
        password: TEST_ADMIN_A_PASSWORD, accessGroupId: 'role-admin-empresa',
        tenantId: TENANT_A, defaultTenantId: TENANT_A, scope: 'TENANT', status: 'ATIVO',
        mustChangePassword: false,
      },
    }),
    { params: { entity: 'users' } },
  );
  assert.ok(r3.status === 201 || r3.status === 200, `criar ADMIN_A: ${r3.status}`);
  adminAAuth = await login('admin.a@example.test', TEST_ADMIN_A_PASSWORD);
});

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ── Cenário 1: CONSULTA não pode criar equipamento ────────────────────────────
test('Cenario 1: CONSULTA nao pode criar equipamento — espera 403', async () => {
  const res = await cadastroRoute().POST(
    jsonReq('/api/cadastro/equipamentos', {
      method: 'POST',
      headers: {
        cookie:         consultaAuth.cookie,
        'x-csrf-token': consultaAuth.csrf,
        'x-tenant-id':  TENANT_A,
      },
      body: { nome: 'Trator Nao Autorizado', tipo: 'TRATOR' },
    }),
    { params: { entity: 'equipamentos' } },
  );
  assert.ok(
    res.status === 403 || res.status === 401,
    `CONSULTA criando equipamento: esperado 403, recebido ${res.status}`,
  );
});

// ── Cenário 2: GESTOR_COA acessa dashboard e relatórios ──────────────────────
test('Cenario 2: GESTOR_COA pode acessar dashboard e relatorios — espera 200', async () => {
  const headers = { cookie: gestorAuth.cookie, 'x-tenant-id': TENANT_A };

  const dashRes = await dashSummRoute().GET(
    jsonReq(`/api/dashboard/summary?tenantId=${TENANT_A}`, { headers }),
  );
  assert.ok(
    dashRes.status === 200 || dashRes.status === 206,
    `GESTOR_COA dashboard: esperado 200, recebido ${dashRes.status}`,
  );

  const relRes = await relEffRoute().GET(
    jsonReq(`/api/relatorios/eficiencia-operacional?tenantId=${TENANT_A}`, { headers }),
  );
  assert.ok(
    relRes.status === 200 || relRes.status === 206,
    `GESTOR_COA relatorio: esperado 200, recebido ${relRes.status}`,
  );
});

// ── Cenário 3: sem sessão recebe 401/403 ──────────────────────────────────────
test('Cenario 3: request sem sessao recebe 401 ou 403', async () => {
  const routes = [
    [dashSummRoute, 'GET', '/api/dashboard/summary'],
    [relEffRoute,   'GET', '/api/relatorios/eficiencia-operacional'],
    [fichaRoute,    'GET', '/api/ficha-operador?fleetCode=TRATOR-001'],
  ];
  for (const [loader, method, url] of routes) {
    const res = await loader()[method](
      jsonReq(url, { headers: { 'x-tenant-id': TENANT_A } }),
    );
    assert.ok(
      res.status === 401 || res.status === 403,
      `${url} sem sessao: esperado 401|403, recebido ${res.status}`,
    );
  }
});

// ── Cenário 4: ADMIN_EMPRESA não acessa tenant B ──────────────────────────────
test('Cenario 4: ADMIN_EMPRESA nao acessa dados de outro tenant — espera 403', async () => {
  const res = await dashSummRoute().GET(
    jsonReq('/api/dashboard/summary', {
      headers: { cookie: adminAAuth.cookie, 'x-tenant-id': TENANT_B },
    }),
  );
  assert.ok(
    res.status === 403 || res.status === 401,
    `ADMIN_EMPRESA acessando tenant B: esperado 403, recebido ${res.status}`,
  );
});

// ── Cenário 5a: SUPER_ADMIN_SILO sem activeTenantId não escreve ──────────────
test('Cenario 5a: SUPER_ADMIN_SILO sem activeTenantId nao escreve dados operacionais — espera 400 ou 403', async () => {
  const res = await cadastroRoute().POST(
    jsonReq('/api/cadastro/equipamentos', {
      method: 'POST',
      headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
      // sem x-tenant-id intencional: PLATFORM sem activeTenantId bloqueado em writes
      body: { nome: 'Equipamento Invalido', tipo: 'TRATOR' },
    }),
    { params: { entity: 'equipamentos' } },
  );
  assert.ok(
    res.status === 400 || res.status === 403,
    `SUPER_ADMIN_SILO sem tenant escrevendo: esperado 400|403, recebido ${res.status}`,
  );
});

// ── Cenário 5b: SUPER_ADMIN_SILO sem activeTenantId pode ler via defaultTenantId ──
test('Cenario 5b: SUPER_ADMIN_SILO sem activeTenantId pode ler dashboard usando defaultTenantId — espera 200', async () => {
  // O owner tem defaultTenantId = 'silo-demo' (seed). Sem activeTenantId,
  // GETs devem cair no defaultTenantId automaticamente — nunca 403.
  const res = await dashSummRoute().GET(
    jsonReq('/api/dashboard/summary', {
      headers: { cookie: ownerCookie },
      // sem x-tenant-id: a rota deve resolver via session.defaultTenantId
    }),
  );
  assert.ok(
    res.status === 200 || res.status === 206,
    `SUPER_ADMIN_SILO GET dashboard sem activeTenantId: esperado 200, recebido ${res.status}`,
  );
});
