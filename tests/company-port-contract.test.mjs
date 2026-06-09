import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { test, before, after } from 'node:test';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server.js';

const require = createRequire(import.meta.url);
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-company-port-'));
const nextAppRoot = path.resolve('.next/server/app');

process.env.SILO_STORAGE_DIR = tmpRoot;
process.env.SILO_DATA_DIR = tmpRoot;
process.env.SILO_AUTH_SECRET = 'test-auth-secret-2026';
process.env.SILO_PLATFORM_OWNER_PASSWORD = 'OwnerPass!2026';

fs.mkdirSync(path.join(tmpRoot, 'auth'), { recursive: true });
fs.writeFileSync(path.join(tmpRoot, 'companies.json'), JSON.stringify([], null, 2));

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
  const fragments = setCookie.split(/, (?=[^;,=]+=[^;,]*)/g);
  const sessionCookie = fragments.find((item) => item.startsWith('silo_session='))?.split(';')[0] || null;
  const csrfCookie = fragments.find((item) => item.startsWith('silo_csrf='))?.split(';')[0] || null;
  return sessionCookie ? (csrfCookie ? sessionCookie + '; ' + csrfCookie : sessionCookie) : null;
}

function cookieValue(response, name) {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'set-cookie ausente');
  const fragments = setCookie.split(/, (?=[^;,=]+=[^;,]*)/g);
  const fragment = fragments.find((item) => item.startsWith(name + '='));
  assert.ok(fragment, `cookie ${name} ausente`);
  return fragment.split(';')[0].split('=').slice(1).join('=');
}

async function asJson(response) {
  return await response.json();
}

const authLoginRoute = () => loadRoute('api/auth/login/route.js');
const adminRoute = () => loadRoute('api/admin/companies/token/route.js');

let ownerCookie;
let ownerCsrf;

before(async () => {
  const login = await authLoginRoute().POST(jsonReq('/api/auth/login', {
    method: 'POST',
    body: { email: 'sonieloficial@gmail.com', password: 'OwnerPass!2026' },
  }));
  assert.equal(login.status, 200);
  ownerCookie = cookieHeader(login);
  ownerCsrf = cookieValue(login, 'silo_csrf');
});

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('SEEME instance accepts portaApi/portaMqtt and persists normalized ports', async () => {
  const res = await adminRoute().POST(jsonReq('/api/admin/companies/token', {
    method: 'POST',
    headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
    body: {
      regenerate: true,
      company: {
        id: 'seeme',
        code: 'SEEME',
        tradingName: 'SEEME',
        corporateName: 'SEEME LTDA',
        cnpj: '00.000.000/0003-00',
        portaApi: '3001',
        portaMqtt: '18831',
        plan: 'PILOTO',
        status: 'ATIVO',
      },
    },
  }), { params: { entity: 'companies' } });

  assert.equal(res.status, 200);
  const body = await asJson(res);
  assert.equal(body.company.apiPort, 3001);
  assert.equal(body.company.mqttPort, 18831);
  assert.equal(body.company.apiBaseUrl, 'https://api.siloops.com.br:3001');
  assert.equal(body.company.mqttUrl, 'mqtt.siloops.com.br:18831');
});
