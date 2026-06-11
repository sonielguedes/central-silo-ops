/**
 * tests/company-token-sync.test.mjs
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
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-token-sync-'));
const nextAppRoot = path.resolve('.next/server/app');

const TEST_OWNER_PASSWORD = `test-owner-${crypto.randomUUID()}!A1`;
process.env.SILO_STORAGE_DIR   = tmpRoot;
process.env.SILO_DATA_DIR      = tmpRoot;
process.env.SILO_AUTH_SECRET   = crypto.randomBytes(32).toString('hex');
process.env.SILO_PLATFORM_OWNER_PASSWORD = TEST_OWNER_PASSWORD;

fs.mkdirSync(path.join(tmpRoot, 'auth'), { recursive: true });
fs.writeFileSync(path.join(tmpRoot, 'companies.json'), JSON.stringify([], null, 2));

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
  const file = findBundle(suffix);
  const mod = require(file);
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

function cookieHeader(res) {
  const raw = res.headers.get('set-cookie');
  assert.ok(raw, 'set-cookie ausente');
  const frags = raw.split(/, (?=[^;,=]+=[^;,]*)/g);
  const sess  = frags.find(f => f.startsWith('silo_session='))?.split(';')[0] || null;
  const csrf  = frags.find(f => f.startsWith('silo_csrf='))?.split(';')[0] || null;
  return sess ? (csrf ? `${sess}; ${csrf}` : sess) : null;
}

function cookieValue(res, name) {
  const raw   = res.headers.get('set-cookie');
  assert.ok(raw, 'set-cookie ausente');
  const frags = raw.split(/, (?=[^;,=]+=[^;,]*)/g);
  const frag  = frags.find(f => f.startsWith(`${name}=`));
  assert.ok(frag, `cookie ${name} ausente`);
  return frag.split(';')[0].split('=').slice(1).join('=');
}

async function asJson(res) { return res.json(); }

const authLoginRoute = () => loadRoute('api/auth/login/route.js');
const tokenRoute     = () => loadRoute('api/admin/companies/token/route.js');

const BASE = {
  id: 'testco-sync',
  code: 'TKSYNC',
  tradingName: 'Token Sync Co',
  corporateName: 'Token Sync LTDA',
  cnpj: '00.000.000/0099-00',
  portaApi: '8099',
  portaMqtt: '1899',
  plan: 'ENTERPRISE',
  status: 'ATIVO',
};

let cookie, csrf;

before(async () => {
  const login = await authLoginRoute().POST(jsonReq('/api/auth/login', {
    body: { email: 'sonieloficial@gmail.com', password: TEST_OWNER_PASSWORD },
  }));
  assert.equal(login.status, 200, 'login falhou');
  cookie = cookieHeader(login);
  csrf   = cookieValue(login, 'silo_csrf');
});

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('company-token-sync', () => {
  // cenario 1
  it('cenario 1 - POST grava o mesmo token nos 4 campos', async () => {
    const body = await asJson(
      await tokenRoute().POST(jsonReq('/api/admin/companies/token', {
        headers: { cookie, 'x-csrf-token': csrf },
        body: { regenerate: true, company: BASE },
      }))
    );
    const co = body.company;
    assert.ok(co, 'company ausente na resposta');
    assert.ok(co.companyToken, 'companyToken ausente');
    assert.equal(co.mobileToken, co.companyToken, 'mobileToken != companyToken');
    assert.equal(co.apiToken,    co.companyToken, 'apiToken != companyToken');
    assert.equal(co.token,       co.companyToken, 'token != companyToken');
  });

  // cenario 2
  it('cenario 2 - regeneracao atualiza todos os 4 campos', async () => {
    const b1 = await asJson(
      await tokenRoute().POST(jsonReq('/api/admin/companies/token', {
        headers: { cookie, 'x-csrf-token': csrf },
        body: { regenerate: true, company: BASE },
      }))
    );
    const co1 = b1.company;

    const b2 = await asJson(
      await tokenRoute().POST(jsonReq('/api/admin/companies/token', {
        headers: { cookie, 'x-csrf-token': csrf },
        body: { regenerate: true, company: { ...BASE, companyToken: co1.companyToken } },
      }))
    );
    const co2 = b2.company;

    assert.notEqual(co2.companyToken, co1.companyToken, 'token nao mudou apos regeneracao');
    assert.equal(co2.mobileToken, co2.companyToken, 'mobileToken != novo companyToken');
    assert.equal(co2.apiToken,    co2.companyToken, 'apiToken != novo companyToken');
    assert.equal(co2.token,       co2.companyToken, 'token != novo companyToken');
  });

  // cenario 3
  it('cenario 3 - updatedBy nao e nulo apos geracao de token', async () => {
    const body = await asJson(
      await tokenRoute().POST(jsonReq('/api/admin/companies/token', {
        headers: { cookie, 'x-csrf-token': csrf },
        body: { regenerate: true, company: BASE },
      }))
    );
    assert.ok(body.company.updatedBy, 'updatedBy ausente ou vazio');
  });

  // cenario 4
  it('cenario 4 - todos os 4 aliases tem o mesmo valor (paridade)', async () => {
    const body = await asJson(
      await tokenRoute().POST(jsonReq('/api/admin/companies/token', {
        headers: { cookie, 'x-csrf-token': csrf },
        body: { regenerate: false, company: BASE },
      }))
    );
    const co = body.company;
    const tokens = [co.companyToken, co.mobileToken, co.apiToken, co.token];
    const unique  = new Set(tokens.filter(Boolean));
    assert.equal(unique.size, 1, `campos divergentes: ${JSON.stringify(tokens)}`);
  });

  // cenario 5
  it('cenario 5 - empresas distintas mantem tokens independentes', async () => {
    const coA = { ...BASE, id: 'co-a-iso', code: 'COAISO', portaApi: '8101', portaMqtt: '1901' };
    const coB = { ...BASE, id: 'co-b-iso', code: 'COBISO', portaApi: '8102', portaMqtt: '1902' };

    const bA = await asJson(
      await tokenRoute().POST(jsonReq('/api/admin/companies/token', {
        headers: { cookie, 'x-csrf-token': csrf },
        body: { regenerate: true, company: coA },
      }))
    );
    const bB = await asJson(
      await tokenRoute().POST(jsonReq('/api/admin/companies/token', {
        headers: { cookie, 'x-csrf-token': csrf },
        body: { regenerate: true, company: coB },
      }))
    );

    const savedA = bA.company;
    const savedB = bB.company;

    assert.notEqual(savedA.companyToken, savedB.companyToken,
      'empresas distintas nao devem ter o mesmo token');
    assert.equal(savedA.tenantId, coA.id, 'tenantId empresa A incorreto');
    assert.equal(savedB.tenantId, coB.id, 'tenantId empresa B incorreto');
  });
});
