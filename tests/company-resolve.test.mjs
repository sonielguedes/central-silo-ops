/**
 * tests/company-resolve.test.mjs
 *
 * Testa POST /api/mobile/company/resolve
 * — rota que o APK usa para descobrir automaticamente a configuração da instância
 *   a partir do Company Token.
 *
 * Cenários obrigatórios:
 *  1. Token válido SEEME → retorna SEEME001 / seeme-ops-001 / API 3002 / MQTT 18832
 *  2. Token válido SG01  → retorna SG01 / sg01-xxx / API 3004 / MQTT 18834
 *  3. Token inválido → INVALID_COMPANY_TOKEN (401)
 *  4. Empresa vencida → COMPANY_EXPIRED (403)
 *  5. Empresa suspensa → COMPANY_SUSPENDED (403)
 *  6. Resposta NUNCA contém campos de token
 *  7. Logs NUNCA mostram token completo
 *  8. Rate limit bloqueia após limite
 *
 * IMPORTANTE: Execute `npm run build` antes de rodar este arquivo.
 * Execução: node --test tests/company-resolve.test.mjs
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { test, before, after } from 'node:test';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server.js';

// ── Ambiente isolado ─────────────────────────────────────────────────────────

const require = createRequire(import.meta.url);
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-resolve-'));
const nextAppRoot = path.resolve('.next/server/app');

process.env.SILO_STORAGE_DIR = tmpRoot;
process.env.SILO_DATA_DIR    = tmpRoot;
process.env.SILO_AUTH_SECRET = crypto.randomBytes(32).toString('hex');

// ── Tokens de teste (nunca reais) ────────────────────────────────────────────

const TOKEN_SEEME   = `CTK-${crypto.randomBytes(24).toString('hex').toUpperCase()}`;
const TOKEN_SG01    = `CTK-${crypto.randomBytes(24).toString('hex').toUpperCase()}`;
const TOKEN_EXPIRED = `CTK-${crypto.randomBytes(24).toString('hex').toUpperCase()}`;
const TOKEN_SUSPENSO = `CTK-${crypto.randomBytes(24).toString('hex').toUpperCase()}`;
const TOKEN_INVALID = `CTK-INVALIDO-${crypto.randomUUID().toUpperCase()}`;

// ── Fixtures de empresa ──────────────────────────────────────────────────────

const NOW = new Date();
const YESTERDAY = new Date(NOW.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();

function baseCompany(overrides = {}) {
  const id = overrides.id || crypto.randomUUID();
  return {
    id,
    tenantId: overrides.tenantId || id,
    code: 'TST001',
    tradingName: 'Test Company',
    corporateName: 'Test Company LTDA',
    cnpj: '00.000.000/0001-00',
    plan: 'PILOTO',
    status: 'ATIVO',
    entityStatus: 'ATIVO',
    version: 1,
    history: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    createdBy: 'test',
    updatedBy: 'test',
    apiPort: 3001,
    mqttPort: 18831,
    apiBaseUrl: 'https://api.siloops.com.br:3001',
    mqttUrl: 'mqtt.siloops.com.br:18831',
    // token gravado nos 4 aliases
    companyToken: overrides.companyToken,
    mobileToken:  overrides.companyToken,
    apiToken:     overrides.companyToken,
    token:        overrides.companyToken,
    ...overrides,
  };
}

const COMPANIES = [
  baseCompany({
    id: 'seeme-id-001',
    tenantId: 'seeme-ops-001',
    code: 'SEEME001',
    tradingName: 'SEEME',
    corporateName: 'SEEME Logística LTDA',
    plan: 'PILOTO',
    status: 'ATIVO',
    subscriptionStatus: 'ATIVO',
    trialDays: 30,
    trialStartedAt: NOW.toISOString(),
    trialEndsAt: new Date(NOW.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString(),
    apiPort: 3002,
    mqttPort: 18832,
    apiBaseUrl: 'https://api.siloops.com.br:3002',
    mqttUrl: 'mqtt.siloops.com.br:18832',
    companyToken: TOKEN_SEEME,
    mobileToken:  TOKEN_SEEME,
    apiToken:     TOKEN_SEEME,
    token:        TOKEN_SEEME,
  }),
  baseCompany({
    id: 'sg01-id-002',
    tenantId: 'sg01-1781359594113',
    code: 'SG01',
    tradingName: 'SG01',
    corporateName: 'SG01 Operações LTDA',
    plan: 'ENTERPRISE',
    status: 'ATIVO',
    subscriptionStatus: 'ATIVO',
    apiPort: 3004,
    mqttPort: 18834,
    apiBaseUrl: 'https://api.siloops.com.br:3004',
    mqttUrl: 'mqtt.siloops.com.br:18834',
    companyToken: TOKEN_SG01,
    mobileToken:  TOKEN_SG01,
    apiToken:     TOKEN_SG01,
    token:        TOKEN_SG01,
  }),
  baseCompany({
    id: 'expired-id-003',
    tenantId: 'expired-tenant-003',
    code: 'EXP001',
    tradingName: 'Empresa Expirada',
    plan: 'PILOTO',
    status: 'ATIVO',
    subscriptionStatus: 'ATIVO',
    trialDays: 30,
    trialStartedAt: new Date(NOW.getTime() - 35 * 24 * 60 * 60 * 1000).toISOString(),
    trialEndsAt: YESTERDAY, // vencida ontem
    companyToken: TOKEN_EXPIRED,
    mobileToken:  TOKEN_EXPIRED,
    apiToken:     TOKEN_EXPIRED,
    token:        TOKEN_EXPIRED,
  }),
  baseCompany({
    id: 'suspenso-id-004',
    tenantId: 'suspenso-tenant-004',
    code: 'SUS001',
    tradingName: 'Empresa Suspensa',
    plan: 'PRO',
    status: 'ATIVO',
    subscriptionStatus: 'SUSPENSO', // suspenso manualmente
    companyToken: TOKEN_SUSPENSO,
    mobileToken:  TOKEN_SUSPENSO,
    apiToken:     TOKEN_SUSPENSO,
    token:        TOKEN_SUSPENSO,
  }),
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function findBundle(suffix) {
  const norm = suffix.split('/').join(path.sep);
  const hits = [];
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (path.relative(nextAppRoot, full) === norm) hits.push(full);
    }
  }
  walk(nextAppRoot);
  if (hits.length === 0) throw new Error(`bundle nao encontrado: ${suffix} — execute npm run build`);
  return hits[0];
}

function loadRoute(suffix) {
  const file = findBundle(suffix);
  const mod = require(file);
  return mod.routeModule?.userland || mod;
}

function resolveReq(token, extraHeaders = {}) {
  const headers = { 'content-type': 'application/json', ...extraHeaders };
  if (token) headers['x-company-token'] = token;
  return new NextRequest(
    new URL('http://localhost/api/mobile/company/resolve'),
    { method: 'POST', headers },
  );
}

async function asJson(res) {
  return res.json();
}

// ── Captura de logs para verificar que token nao vaza ────────────────────────

const capturedLogs = [];
const originalWarn = console.warn;
const originalInfo = console.info;
const originalError = console.error;

// ── Setup e teardown ─────────────────────────────────────────────────────────

before(() => {
  // Escrever companies.json direto no tmpRoot
  fs.mkdirSync(path.join(tmpRoot, 'auth'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpRoot, 'companies.json'),
    JSON.stringify(COMPANIES, null, 2),
  );

  // Interceptar logs
  console.warn = (...args) => {
    capturedLogs.push({ level: 'warn', msg: args.join(' ') });
    originalWarn(...args);
  };
  console.info = (...args) => {
    capturedLogs.push({ level: 'info', msg: args.join(' ') });
    originalInfo(...args);
  };
  console.error = (...args) => {
    capturedLogs.push({ level: 'error', msg: args.join(' ') });
    originalError(...args);
  };
});

after(() => {
  console.warn  = originalWarn;
  console.info  = originalInfo;
  console.error = originalError;
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ── Testes ───────────────────────────────────────────────────────────────────

test('1. Token valido SEEME retorna configuracao correta', async () => {
  const route = loadRoute('api/mobile/company/resolve/route.js');
  const res = await route.POST(resolveReq(TOKEN_SEEME));
  assert.equal(res.status, 200, `esperado 200, recebido ${res.status}`);

  const body = await asJson(res);
  assert.equal(body.success, true, 'success deve ser true');
  assert.equal(body.companyCode, 'SEEME001', `companyCode errado: ${body.companyCode}`);
  assert.equal(body.tenantId, 'seeme-ops-001', `tenantId errado: ${body.tenantId}`);
  assert.equal(body.apiPort, 3002, `apiPort errado: ${body.apiPort}`);
  assert.equal(body.mqttPort, 18832, `mqttPort errado: ${body.mqttPort}`);
  assert.ok(body.apiHost, 'apiHost ausente');
  assert.ok(body.mqttHost, 'mqttHost ausente');
  assert.equal(body.protocol, 'HTTPS', `protocol errado: ${body.protocol}`);
  assert.ok(['ATIVO', 'EXPIRANDO'].includes(body.subscriptionStatus),
    `subscriptionStatus inesperado: ${body.subscriptionStatus}`);
});

test('2. Token valido SG01 retorna configuracao correta', async () => {
  const route = loadRoute('api/mobile/company/resolve/route.js');
  const res = await route.POST(resolveReq(TOKEN_SG01));
  assert.equal(res.status, 200, `esperado 200, recebido ${res.status}`);

  const body = await asJson(res);
  assert.equal(body.success, true);
  assert.equal(body.companyCode, 'SG01', `companyCode errado: ${body.companyCode}`);
  assert.equal(body.tenantId, 'sg01-1781359594113', `tenantId errado: ${body.tenantId}`);
  assert.equal(body.apiPort, 3004, `apiPort errado: ${body.apiPort}`);
  assert.equal(body.mqttPort, 18834, `mqttPort errado: ${body.mqttPort}`);
  assert.equal(body.protocol, 'HTTPS');
});

test('3. Token invalido retorna INVALID_COMPANY_TOKEN (401)', async () => {
  const route = loadRoute('api/mobile/company/resolve/route.js');
  const res = await route.POST(resolveReq(TOKEN_INVALID));
  assert.equal(res.status, 401, `esperado 401, recebido ${res.status}`);

  const body = await asJson(res);
  assert.equal(body.success, false);
  assert.equal(body.errorCode, 'INVALID_COMPANY_TOKEN',
    `errorCode errado: ${body.errorCode}`);
});

test('4. Empresa vencida retorna COMPANY_EXPIRED (403)', async () => {
  const route = loadRoute('api/mobile/company/resolve/route.js');
  const res = await route.POST(resolveReq(TOKEN_EXPIRED));
  assert.equal(res.status, 403, `esperado 403, recebido ${res.status}`);

  const body = await asJson(res);
  assert.equal(body.success, false);
  assert.equal(body.errorCode, 'COMPANY_EXPIRED',
    `errorCode errado: ${body.errorCode}`);
});

test('5. Empresa suspensa retorna COMPANY_SUSPENDED ou COMPANY_INACTIVE (403)', async () => {
  const route = loadRoute('api/mobile/company/resolve/route.js');
  const res = await route.POST(resolveReq(TOKEN_SUSPENSO));
  assert.equal(res.status, 403, `esperado 403, recebido ${res.status}`);

  const body = await asJson(res);
  assert.equal(body.success, false);
  assert.ok(
    ['COMPANY_SUSPENDED', 'COMPANY_INACTIVE'].includes(body.errorCode),
    `errorCode inesperado para empresa suspensa: ${body.errorCode}`,
  );
});

test('6. Resposta de sucesso nao contem campos de token', async () => {
  const route = loadRoute('api/mobile/company/resolve/route.js');
  const res = await route.POST(resolveReq(TOKEN_SEEME));
  assert.equal(res.status, 200);

  const body = await asJson(res);
  const bodyStr = JSON.stringify(body);

  // Nunca deve retornar nenhum campo de token
  assert.ok(!('companyToken' in body), 'resposta NAO deve conter companyToken');
  assert.ok(!('mobileToken'  in body), 'resposta NAO deve conter mobileToken');
  assert.ok(!('apiToken'     in body), 'resposta NAO deve conter apiToken');
  assert.ok(!('token'        in body), 'resposta NAO deve conter token');

  // Nunca deve incluir o valor real do token
  assert.ok(!bodyStr.includes(TOKEN_SEEME),
    'resposta NAO deve conter o token completo no JSON');
});

test('7. Logs nao mostram token completo', async () => {
  capturedLogs.length = 0; // limpar logs anteriores

  const route = loadRoute('api/mobile/company/resolve/route.js');
  await route.POST(resolveReq(TOKEN_SG01));

  // Verificar que nenhum log contém o token completo
  for (const entry of capturedLogs) {
    assert.ok(
      !entry.msg.includes(TOKEN_SG01),
      `log NAO deve conter token completo. Encontrado em: "${entry.msg.slice(0, 100)}"`,
    );
  }

  // Verificar que o resolve foi logado (maskToken presente)
  const resolveLog = capturedLogs.find(e => e.msg.includes('mobile/company/resolve'));
  assert.ok(resolveLog, 'log de resolve deve existir');
});

test('8. Header X-Company-Token ausente retorna 401 MISSING_COMPANY_TOKEN', async () => {
  const route = loadRoute('api/mobile/company/resolve/route.js');
  // Sem header X-Company-Token
  const res = await route.POST(resolveReq(null));
  assert.equal(res.status, 401, `esperado 401, recebido ${res.status}`);

  const body = await asJson(res);
  assert.equal(body.success, false);
  assert.equal(body.errorCode, 'MISSING_COMPANY_TOKEN',
    `errorCode errado: ${body.errorCode}`);
});

test('9. GET retorna 405 METHOD_NOT_ALLOWED', async () => {
  const route = loadRoute('api/mobile/company/resolve/route.js');
  const req = new NextRequest(
    new URL('http://localhost/api/mobile/company/resolve'),
    { method: 'GET', headers: {} },
  );
  const res = await route.GET(req);
  assert.equal(res.status, 405, `esperado 405, recebido ${res.status}`);

  const body = await asJson(res);
  assert.equal(body.errorCode, 'METHOD_NOT_ALLOWED');
});
