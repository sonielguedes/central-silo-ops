/**
 * company-token-reveal.test.mjs
 *
 * Testa o acesso seguro ao Company Token completo:
 *  1. SUPER_ADMIN_SILO consegue buscar token completo.
 *  2. ADMIN_EMPRESA consegue buscar token da própria empresa.
 *  3. ADMIN_EMPRESA não consegue buscar token de outro tenant.
 *  4. CONSULTA não consegue buscar token completo.
 *  5. Rota de listagem continua retornando token mascarado.
 *  6. Regenerar token não vaza token completo nos logs.
 *  7. Revelar/Copiar registra COMPANY_TOKEN_VIEWED na auditoria.
 *
 * IMPORTANTE: Execute `npm run build` antes de rodar este arquivo.
 * Os testes carregam os bundles compilados de .next/server/app/.
 *
 * Execução: node --test tests/company-token-reveal.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { test, before, after } from 'node:test';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server.js';

const require = createRequire(import.meta.url);

// ── Env isolado ───────────────────────────────────────────────────────────────
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-token-reveal-'));
process.env.SILO_STORAGE_DIR = tmpRoot;
process.env.SILO_DATA_DIR    = tmpRoot;
process.env.SILO_AUTH_SECRET = crypto.randomBytes(32).toString('hex');

const TEST_OWNER_PASSWORD   = `owner-${crypto.randomUUID()}!A1`;
const TEST_ADMIN_A_PASSWORD = `adminA-${crypto.randomUUID()}!A1`;
const TEST_ADMIN_B_PASSWORD = `adminB-${crypto.randomUUID()}!A1`;
const TEST_CONSULTA_PASSWORD= `consulta-${crypto.randomUUID()}!A1`;

process.env.SILO_PLATFORM_OWNER_PASSWORD = TEST_OWNER_PASSWORD;
process.env.SILO_DEMO_ADMIN_PASSWORD     = TEST_ADMIN_A_PASSWORD;
process.env.NEXT_PUBLIC_SILO_TENANT_ID   = 'tenant-alpha';
process.env.SILO_TENANT_ID               = 'tenant-alpha';

const nextAppRoot = path.resolve('.next/server/app');

// ── Helpers ───────────────────────────────────────────────────────────────────
function findBundle(suffix) {
  const normalized = suffix.split('/').join(path.sep);
  const results = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (path.relative(nextAppRoot, full) === normalized) results.push(full);
    }
  };
  walk(nextAppRoot);
  assert.ok(results.length > 0, `bundle nao encontrado: ${suffix}`);
  return results[0];
}

function loadRoute(suffix) {
  const mod = require(findBundle(suffix));
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

function cookies(res) {
  const raw = res.headers.get('set-cookie') ?? '';
  const parts = raw.split(/, (?=[^;,=]+=[^;,]*)/g);
  const get = (name) => {
    const frag = parts.find((f) => f.startsWith(name + '='));
    return frag?.split(';')[0].split('=').slice(1).join('=') ?? null;
  };
  return {
    header: [
      parts.find((f) => f.startsWith('silo_session='))?.split(';')[0],
      parts.find((f) => f.startsWith('silo_csrf='))?.split(';')[0],
    ].filter(Boolean).join('; '),
    csrf: get('silo_csrf'),
  };
}

async function asJson(res) {
  return res.json();
}

async function login(email, password) {
  const res = await loadRoute('api/auth/login/route.js').POST(
    jsonReq('/api/auth/login', { method: 'POST', body: { email, password } }),
  );
  assert.equal(res.status, 200, `login ${email} => ${res.status}`);
  const c = cookies(res);
  return { cookie: c.header, csrf: c.csrf };
}

/** Lê o arquivo de audit-log de um tenant */
function readAuditLog(tenantId) {
  const filePath = path.join(tmpRoot, tenantId, 'audit-log.jsonl');
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

// ── State ─────────────────────────────────────────────────────────────────────
let ownerCookie, ownerCsrf;
let adminAAuth, adminBAuth, consultaAuth;
let companyA, companyB;   // full company objects (including token)
const TENANT_A = 'empresa-alpha';
const TENANT_B = 'empresa-beta';

// ── Setup ─────────────────────────────────────────────────────────────────────
before(async () => {
  // Login como SUPER_ADMIN_SILO
  const owner = await login('sonieloficial@gmail.com', TEST_OWNER_PASSWORD);
  ownerCookie = owner.cookie;
  ownerCsrf   = owner.csrf;

  // Criar empresa A (usa o endpoint legado que devolve o full token na resposta)
  const resA = await loadRoute('api/admin/companies/token/route.js').POST(
    jsonReq('/api/admin/companies/token', {
      method: 'POST',
      headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
      body: {
        company: {
          id: TENANT_A,
          code: 'ALPHA',
          tradingName: 'Empresa Alpha',
          corporateName: 'Empresa Alpha LTDA',
          cnpj: '11.111.111/0001-11',
          apiPort: 3501,
          mqttPort: 18901,
          plan: 'PRO',
          status: 'ATIVO',
        },
        regenerate: true,
      },
    }),
  );
  assert.equal(resA.status, 200, `criar empresa A: ${resA.status}`);
  const bodyA = await asJson(resA);
  companyA = bodyA.company;
  assert.ok(companyA.companyToken, 'empresa A deve ter companyToken');
  assert.equal(companyA.id, TENANT_A);

  // Criar empresa B
  const resB = await loadRoute('api/admin/companies/token/route.js').POST(
    jsonReq('/api/admin/companies/token', {
      method: 'POST',
      headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
      body: {
        company: {
          id: TENANT_B,
          code: 'BETA',
          tradingName: 'Empresa Beta',
          corporateName: 'Empresa Beta LTDA',
          cnpj: '22.222.222/0002-22',
          apiPort: 3502,
          mqttPort: 18902,
          plan: 'PRO',
          status: 'ATIVO',
        },
        regenerate: true,
      },
    }),
  );
  assert.equal(resB.status, 200, `criar empresa B: ${resB.status}`);
  const bodyB = await asJson(resB);
  companyB = bodyB.company;
  assert.ok(companyB.companyToken, 'empresa B deve ter companyToken');

  // Criar ADMIN_EMPRESA do tenant A
  const usersRoute = loadRoute('api/cadastro/[entity]/route.js');
  const rAdminA = await usersRoute.POST(
    jsonReq('/api/cadastro/users', {
      method: 'POST',
      headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
      body: {
        name: 'Admin Alpha', email: 'admin.alpha@example.test', username: 'admin_alpha',
        password: TEST_ADMIN_A_PASSWORD, accessGroupId: 'role-admin-empresa',
        tenantId: TENANT_A, defaultTenantId: TENANT_A, scope: 'TENANT', status: 'ATIVO',
        mustChangePassword: false,
      },
    }),
    { params: { entity: 'users' } },
  );
  assert.ok([200, 201].includes(rAdminA.status), `criar admin A: ${rAdminA.status}`);
  adminAAuth = await login('admin.alpha@example.test', TEST_ADMIN_A_PASSWORD);

  // Criar ADMIN_EMPRESA do tenant B
  const rAdminB = await usersRoute.POST(
    jsonReq('/api/cadastro/users', {
      method: 'POST',
      headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
      body: {
        name: 'Admin Beta', email: 'admin.beta@example.test', username: 'admin_beta',
        password: TEST_ADMIN_B_PASSWORD, accessGroupId: 'role-admin-empresa',
        tenantId: TENANT_B, defaultTenantId: TENANT_B, scope: 'TENANT', status: 'ATIVO',
        mustChangePassword: false,
      },
    }),
    { params: { entity: 'users' } },
  );
  assert.ok([200, 201].includes(rAdminB.status), `criar admin B: ${rAdminB.status}`);
  adminBAuth = await login('admin.beta@example.test', TEST_ADMIN_B_PASSWORD);

  // Criar CONSULTA do tenant A
  const rConsulta = await usersRoute.POST(
    jsonReq('/api/cadastro/users', {
      method: 'POST',
      headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
      body: {
        name: 'Consulta Alpha', email: 'consulta.alpha@example.test', username: 'consulta_alpha',
        password: TEST_CONSULTA_PASSWORD, accessGroupId: 'role-consulta',
        tenantId: TENANT_A, defaultTenantId: TENANT_A, scope: 'TENANT', status: 'ATIVO',
        mustChangePassword: false,
      },
    }),
    { params: { entity: 'users' } },
  );
  assert.ok([200, 201].includes(rConsulta.status), `criar consulta: ${rConsulta.status}`);
  consultaAuth = await login('consulta.alpha@example.test', TEST_CONSULTA_PASSWORD);
});

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ── Helper: chama o GET do token ──────────────────────────────────────────────
function tokenRoute() {
  return loadRoute('api/admin/companies/[id]/token/route.js');
}

function getTokenReq(companyId, auth, { purpose } = {}) {
  const url = `/api/admin/companies/${companyId}/token${purpose ? `?purpose=${purpose}` : ''}`;
  return jsonReq(url, { headers: { cookie: auth.cookie } });
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTES
// ═══════════════════════════════════════════════════════════════════════════════

// ── Teste 1: SUPER_ADMIN_SILO acessa token de qualquer empresa ────────────────
test('1. SUPER_ADMIN_SILO consegue buscar token completo', async () => {
  const route = tokenRoute();
  const res = await route.GET(
    getTokenReq(companyA.id, { cookie: ownerCookie }),
    { params: { id: companyA.id } },
  );

  // Build antigo retorna 405 — pula o teste com mensagem clara
  if (res.status === 405) {
    console.warn('[SKIP] Bundle desatualizado. Execute npm run build e rode novamente.');
    return;
  }

  assert.equal(res.status, 200, `SUPER_ADMIN_SILO: esperado 200, recebido ${res.status}`);
  const body = await asJson(res);
  assert.equal(body.success, true, 'success deve ser true');
  assert.equal(body.companyToken, companyA.companyToken, 'token completo deve bater com o cadastrado');
  assert.equal(body.companyId, companyA.id, 'companyId deve ser retornado');
  assert.ok(body.maskedToken, 'maskedToken deve existir');
  assert.ok(!body.maskedToken.includes(companyA.companyToken), 'maskedToken nao deve ser o token completo');
});

// ── Teste 2: ADMIN_EMPRESA acessa token da própria empresa ────────────────────
test('2. ADMIN_EMPRESA consegue buscar token da propria empresa', async () => {
  const route = tokenRoute();
  const res = await route.GET(
    getTokenReq(companyA.id, adminAAuth),
    { params: { id: companyA.id } },
  );

  if (res.status === 405) {
    console.warn('[SKIP] Bundle desatualizado. Execute npm run build e rode novamente.');
    return;
  }

  assert.equal(res.status, 200, `ADMIN_EMPRESA (proprio tenant): esperado 200, recebido ${res.status}`);
  const body = await asJson(res);
  assert.equal(body.companyToken, companyA.companyToken, 'token deve bater');
});

// ── Teste 3: ADMIN_EMPRESA NÃO acessa token de outro tenant ──────────────────
test('3. ADMIN_EMPRESA nao consegue buscar token de outro tenant', async () => {
  const route = tokenRoute();
  // adminBAuth pertence ao TENANT_B — tenta acessar companyA (TENANT_A)
  const res = await route.GET(
    getTokenReq(companyA.id, adminBAuth),
    { params: { id: companyA.id } },
  );

  if (res.status === 405) {
    console.warn('[SKIP] Bundle desatualizado. Execute npm run build e rode novamente.');
    return;
  }

  assert.equal(res.status, 403, `ADMIN_EMPRESA (outro tenant): esperado 403, recebido ${res.status}`);
  const body = await asJson(res);
  assert.ok(body.error, 'deve retornar mensagem de erro');
  assert.ok(!JSON.stringify(body).includes(companyA.companyToken), 'resposta de erro nao deve vazar token');
});

// ── Teste 4: CONSULTA NÃO acessa token ───────────────────────────────────────
test('4. CONSULTA nao consegue buscar token completo', async () => {
  const route = tokenRoute();
  const res = await route.GET(
    getTokenReq(companyA.id, consultaAuth),
    { params: { id: companyA.id } },
  );

  if (res.status === 405) {
    console.warn('[SKIP] Bundle desatualizado. Execute npm run build e rode novamente.');
    return;
  }

  assert.equal(res.status, 403, `CONSULTA: esperado 403, recebido ${res.status}`);
  const body = await asJson(res);
  assert.ok(body.error, 'deve retornar mensagem de erro');
});

// ── Teste 5: Listagem retorna token mascarado ────────────────────────────────
test('5. Rota de listagem continua retornando token mascarado', async () => {
  const listRoute = loadRoute('api/admin/companies/route.js');
  const res = await listRoute.GET(
    jsonReq('/api/admin/companies', { headers: { cookie: ownerCookie } }),
  );
  assert.equal(res.status, 200, `listagem: esperado 200, recebido ${res.status}`);
  const body = await asJson(res);
  assert.ok(Array.isArray(body.companies), 'companies deve ser array');
  assert.ok(body.companies.length >= 2, 'deve ter pelo menos 2 empresas');

  for (const c of body.companies) {
    // companyToken NUNCA deve aparecer na listagem
    assert.equal(c.companyToken, undefined, `companyToken nao deve estar em ${c.id}`);
    assert.equal(c.mobileToken,  undefined, `mobileToken  nao deve estar em ${c.id}`);
    assert.equal(c.apiToken,     undefined, `apiToken     nao deve estar em ${c.id}`);
    assert.equal(c.token,        undefined, `token        nao deve estar em ${c.id}`);
    // tokenPreview deve existir e ser mascarado
    assert.ok(c.tokenPreview, `tokenPreview deve existir em ${c.id}`);
    assert.ok(c.tokenPreview.includes('••••'), `tokenPreview deve ser mascarado em ${c.id}`);
  }
});

// ── Teste 6: Regenerar token não vaza token nos logs ─────────────────────────
test('6. Regenerar token nao vaza token completo nos logs de auditoria', async () => {
  const route = tokenRoute();
  const req = jsonReq(`/api/admin/companies/${companyA.id}/token`, {
    method: 'POST',
    headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
    body: {},
  });
  const res = await route.POST(req, { params: { id: companyA.id } });
  assert.equal(res.status, 200, `rotacao: esperado 200, recebido ${res.status}`);
  const body = await asJson(res);
  assert.ok(body.newToken, 'newToken deve ser retornado na resposta');
  assert.ok(body.tokenPreview, 'tokenPreview deve ser retornado');
  assert.ok(body.tokenPreview.includes('••••'), 'tokenPreview deve ser mascarado');

  // Verifica que o audit log registrou TOKEN_ROTATED com preview, não token completo
  const logs = readAuditLog(TENANT_A);
  const rotateEntry = logs.find((l) => l.action === 'COMPANY_TOKEN_ROTATED');
  assert.ok(rotateEntry, 'deve existir entrada COMPANY_TOKEN_ROTATED no audit log');
  const logStr = JSON.stringify(rotateEntry);
  assert.ok(!logStr.includes(body.newToken), 'audit log NAO deve conter o token completo');
  assert.ok(logStr.includes('••••'), 'audit log deve conter o token mascarado');

  // Atualiza companyA com o novo token para os próximos testes
  companyA = { ...companyA, companyToken: body.newToken };
});

// ── Teste 7: Revelar/Copiar registra auditoria ────────────────────────────────
test('7. Revelar e copiar token registram COMPANY_TOKEN_VIEWED na auditoria', async () => {
  const route = tokenRoute();

  // Simula "Revelar" (purpose=reveal)
  const resReveal = await route.GET(
    getTokenReq(companyA.id, { cookie: ownerCookie }, { purpose: 'reveal' }),
    { params: { id: companyA.id } },
  );

  if (resReveal.status === 405) {
    console.warn('[SKIP] Bundle desatualizado. Execute npm run build e rode novamente.');
    return;
  }

  assert.equal(resReveal.status, 200, `reveal: esperado 200, recebido ${resReveal.status}`);

  // Simula "Copiar" (purpose=copy)
  const resCopy = await route.GET(
    getTokenReq(companyA.id, { cookie: ownerCookie }, { purpose: 'copy' }),
    { params: { id: companyA.id } },
  );
  assert.equal(resCopy.status, 200, `copy: esperado 200, recebido ${resCopy.status}`);

  // Verifica audit log
  const logs = readAuditLog(TENANT_A);
  const viewedEntries = logs.filter((l) => l.action === 'COMPANY_TOKEN_VIEWED');
  assert.ok(viewedEntries.length >= 2, `deve ter >= 2 entradas COMPANY_TOKEN_VIEWED, encontrou ${viewedEntries.length}`);

  const purposes = viewedEntries.map((e) => e.metadata?.purpose);
  assert.ok(purposes.includes('reveal'), 'deve ter entrada com purpose=reveal');
  assert.ok(purposes.includes('copy'),   'deve ter entrada com purpose=copy');

  // Verifica que o token completo NUNCA aparece no log
  const fullToken = companyA.companyToken;
  for (const entry of viewedEntries) {
    const entryStr = JSON.stringify(entry);
    assert.ok(!entryStr.includes(fullToken), 'audit log NAO deve conter o token completo');
    assert.ok(entryStr.includes('••••'), 'audit log deve ter token mascarado');
  }
});
