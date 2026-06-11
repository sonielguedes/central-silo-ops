/**
 * tests/company-tenant-preserve.test.mjs
 * Garante que o tenantId de uma empresa cadastrada nunca e sobrescrito.
 *
 *  1. restart nao altera tenant (upsert sem tenantId preserva o existente)
 *  2. upsert com tenantId diferente NAO sobrescreve
 *  3. regeneracao de token mantem tenantId
 *  4. token aliases continuam iguais apos regeneracao
 *  5. tenant antigo nao reaparece apos upsert
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { describe, it, before, after } from 'node:test';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server.js';

const require = createRequire(import.meta.url);
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-tenant-'));
const nextAppRoot = path.resolve('.next/server/app');

const OWNER_PASSWORD = `owner-${crypto.randomUUID()}!A1`;
process.env.SILO_STORAGE_DIR   = tmpRoot;
process.env.SILO_DATA_DIR      = tmpRoot;
process.env.SILO_AUTH_SECRET   = crypto.randomBytes(32).toString('hex');
process.env.SILO_PLATFORM_OWNER_PASSWORD = OWNER_PASSWORD;

fs.mkdirSync(path.join(tmpRoot, 'auth'), { recursive: true });
fs.writeFileSync(path.join(tmpRoot, 'companies.json'), JSON.stringify([], null, 2));

// helpers
function findBundle(suffix) {
  const norm = suffix.split('/').join(path.sep);
  const hits = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (path.relative(nextAppRoot, full) === norm) hits.push(full);
    }
  };
  walk(nextAppRoot);
  assert.ok(hits.length > 0, `bundle nao encontrado: ${suffix}`);
  return hits[0];
}
function loadRoute(suffix) {
  const mod = require(findBundle(suffix));
  return mod.routeModule?.userland || mod;
}
function jsonReq(url, { method = 'POST', headers = {}, body } = {}) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  return new NextRequest(new URL('http://localhost' + url), init);
}
function parseCookies(res) {
  const raw = res.headers.get('set-cookie') || '';
  const frags = raw.split(/, (?=[^;,=]+=[^;,]*)/g);
  const get = (name) => {
    const f = frags.find(f => f.startsWith(`${name}=`));
    return f ? f.split(';')[0].split('=').slice(1).join('=') : null;
  };
  const sess = frags.find(f => f.startsWith('silo_session='))?.split(';')[0] || null;
  const csrf = frags.find(f => f.startsWith('silo_csrf='))?.split(';')[0] || null;
  return { cookieHeader: sess ? (csrf ? `${sess}; ${csrf}` : sess) : null, csrf: get('silo_csrf') };
}
function readCompanies() {
  return JSON.parse(fs.readFileSync(path.join(tmpRoot, 'companies.json'), 'utf-8'));
}

const CORRECT_TENANT = 'seeme-ops-001';
const WRONG_TENANT   = 'silo-ops-001';

const BASE = {
  id: CORRECT_TENANT,
  code: 'SEEME',
  tradingName: 'SEEME OPS',
  corporateName: 'SEEME OPS LTDA',
  cnpj: '00.000.000/0001-00',
  portaApi: '3001',
  portaMqtt: '18831',
  plan: 'ENTERPRISE',
  status: 'ATIVO',
  tenantId: CORRECT_TENANT,
};

let cookie, csrf;

before(async () => {
  const login = await loadRoute('api/auth/login/route.js').POST(
    jsonReq('/api/auth/login', { body: { email: 'sonieloficial@gmail.com', password: OWNER_PASSWORD } })
  );
  assert.equal(login.status, 200, 'login falhou');
  ({ cookieHeader: cookie, csrf } = parseCookies(login));
});

after(() => fs.rmSync(tmpRoot, { recursive: true, force: true }));

// helper: call token route
async function upsertToken(company, regenerate = false) {
  const res = await loadRoute('api/admin/companies/token/route.js').POST(
    jsonReq('/api/admin/companies/token', {
      headers: { cookie, 'x-csrf-token': csrf },
      body: { regenerate, company },
    })
  );
  assert.equal(res.status, 200, `token route status ${res.status}`);
  return (await res.json()).company;
}

describe('company-tenant-preserve', () => {
  // cenario 1 - upsert sem tenantId preserva o tenant existente
  it('cenario 1 - restart: upsert sem tenantId nao altera tenant existente', async () => {
    // Create company with correct tenant
    const co1 = await upsertToken(BASE, true);
    assert.equal(co1.tenantId, CORRECT_TENANT, `tenant apos criacao: ${co1.tenantId}`);

    // Simulate restart: call upsert again with tenantId omitted (as if old client had no field)
    const { tenantId: _dropped, ...baseWithoutTenant } = BASE;
    const co2 = await upsertToken({ ...baseWithoutTenant, companyToken: co1.companyToken }, false);
    assert.equal(co2.tenantId, CORRECT_TENANT,
      `tenant foi sobrescrito apos upsert sem tenantId: ${co2.tenantId}`);
  });

  // cenario 2 - upsert com tenantId errado NAO sobrescreve o existente
  it('cenario 2 - upsert com tenantId errado nao sobrescreve tenant existente', async () => {
    const co1 = await upsertToken(BASE, false);
    assert.equal(co1.tenantId, CORRECT_TENANT);

    // send wrong tenant
    const co2 = await upsertToken({ ...BASE, tenantId: WRONG_TENANT }, false);
    assert.equal(co2.tenantId, CORRECT_TENANT,
      `tenant foi sobrescrito para o errado: ${co2.tenantId}`);
  });

  // cenario 3 - regeneracao de token mantem tenantId
  it('cenario 3 - regeneracao de token preserva tenantId', async () => {
    const co1 = await upsertToken(BASE, true);
    assert.equal(co1.tenantId, CORRECT_TENANT);

    const co2 = await upsertToken({ ...BASE, companyToken: co1.companyToken }, true);
    assert.equal(co2.tenantId, CORRECT_TENANT,
      `tenantId mudou apos regeneracao: ${co2.tenantId}`);
    assert.notEqual(co2.companyToken, co1.companyToken, 'token nao foi regenerado');
  });

  // cenario 4 - token aliases iguais apos regeneracao
  it('cenario 4 - aliases de token continuam iguais apos regeneracao', async () => {
    const co = await upsertToken(BASE, true);
    const aliases = [co.companyToken, co.mobileToken, co.apiToken, co.token];
    const unique = new Set(aliases.filter(Boolean));
    assert.equal(unique.size, 1, `aliases divergentes: ${JSON.stringify(aliases)}`);
  });

  // cenario 5 - tenant antigo nao reaparece no companies.json
  it('cenario 5 - tenant antigo nao reaparece no companies.json apos upsert', async () => {
    await upsertToken(BASE, true);

    // Attempt to force wrong tenant via multiple upserts
    await upsertToken({ ...BASE, tenantId: WRONG_TENANT }, false);
    await upsertToken({ ...BASE, tenantId: WRONG_TENANT }, true);

    const companies = readCompanies();
    const seeme = companies.find(c => c.code === 'SEEME');
    assert.ok(seeme, 'empresa SEEME nao encontrada em companies.json');
    assert.equal(seeme.tenantId, CORRECT_TENANT,
      `tenant errado em companies.json: ${seeme.tenantId}`);
    assert.notEqual(seeme.tenantId, WRONG_TENANT,
      `tenant antigo reapareceu: ${seeme.tenantId}`);
  });
});
