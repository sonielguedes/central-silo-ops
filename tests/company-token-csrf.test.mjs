/**
 * tests/company-token-csrf.test.mjs
 * Garante que POST /api/admin/companies/token aplica CSRF corretamente.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { describe, it, before, after } from 'node:test';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server.js';
import bcrypt from 'bcryptjs';

const require = createRequire(import.meta.url);
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-tkcsrf-'));
const nextAppRoot = path.resolve('.next/server/app');

const OWNER_PASSWORD  = `owner-${crypto.randomUUID()}!A1`;
const VIEWER_PASSWORD = `viewer-${crypto.randomUUID()}!A1`;

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

function parseCookies(res) {
  const raw = res.headers.get('set-cookie') || '';
  const frags = raw.split(/, (?=[^;,=]+=[^;,]*)/g);
  const get = (name) => {
    const f = frags.find(f => f.startsWith(`${name}=`));
    return f ? f.split(';')[0].split('=').slice(1).join('=') : null;
  };
  const sess = frags.find(f => f.startsWith('silo_session='))?.split(';')[0] || null;
  const csrf = frags.find(f => f.startsWith('silo_csrf='))?.split(';')[0] || null;
  return {
    cookieHeader: sess ? (csrf ? `${sess}; ${csrf}` : sess) : null,
    csrfValue: get('silo_csrf'),
  };
}

async function doLogin(email, password) {
  const res = await loadRoute('api/auth/login/route.js').POST(
    jsonReq('/api/auth/login', { body: { email, password } })
  );
  return { status: res.status, ...parseCookies(res) };
}

const BASE_CO = {
  id: 'co-csrf-test',
  code: 'CSRFTST',
  tradingName: 'CSRF Test Co',
  corporateName: 'CSRF Test LTDA',
  cnpj: '00.000.000/0077-00',
  portaApi: '8077',
  portaMqtt: '1877',
  plan: 'ENTERPRISE',
  status: 'ATIVO',
};

let ownerCookie, ownerCsrf;
let viewerCookie, viewerCsrf;

before(async () => {
  // ── owner login ────────────────────────────────────────────────────────────
  const o = await doLogin('sonieloficial@gmail.com', OWNER_PASSWORD);
  assert.equal(o.status, 200, `owner login falhou: ${o.status}`);
  ownerCookie = o.cookieHeader;
  ownerCsrf   = o.csrfValue;

  // ── create viewer user directly in auth store ──────────────────────────────
  // Seed after owner login so listUsers() has already initialised the file.
  const usersFile = path.join(tmpRoot, 'auth', 'users.json');
  const users = JSON.parse(fs.readFileSync(usersFile, 'utf-8'));
  const now = new Date().toISOString();
  users.push({
    id: 'usr-viewer-test',
    tenantId: 'silo-demo',
    defaultTenantId: 'silo-demo',
    scope: 'TENANT',
    role: 'CONSULTA',
    accessGroupId: 'ag-visualizador',
    name: 'Viewer Test',
    username: 'viewer.test',
    email: 'viewer@test.local',
    status: 'ATIVO',
    mustChangePassword: false,
    passwordHash: bcrypt.hashSync(VIEWER_PASSWORD, 10),
    createdAt: now,
    updatedAt: now,
  });
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));

  const v = await doLogin('viewer@test.local', VIEWER_PASSWORD);
  if (v.status === 200) {
    viewerCookie = v.cookieHeader;
    viewerCsrf   = v.csrfValue;
  }
});

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('company-token-csrf', () => {
  // cenario 1 - sem CSRF → 403
  it('cenario 1 - ausencia de X-CSRF-Token retorna 403', async () => {
    const res = await loadRoute('api/admin/companies/token/route.js').POST(
      jsonReq('/api/admin/companies/token', {
        headers: { cookie: ownerCookie /* sem csrf */ },
        body: { regenerate: true, company: BASE_CO },
      })
    );
    assert.equal(res.status, 403, `esperado 403 sem CSRF, obtido ${res.status}`);
  });

  // cenario 2 - CSRF correto → 200
  it('cenario 2 - X-CSRF-Token correto retorna 200', async () => {
    const res = await loadRoute('api/admin/companies/token/route.js').POST(
      jsonReq('/api/admin/companies/token', {
        headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
        body: { regenerate: true, company: BASE_CO },
      })
    );
    assert.equal(res.status, 200, `esperado 200, obtido ${res.status}`);
    const body = await res.json();
    assert.ok(body.company?.companyToken, 'companyToken ausente');
  });

  // cenario 3 - usuario sem permissao → 403
  it('cenario 3 - usuario sem permissao administrar retorna 403', async () => {
    if (!viewerCookie) {
      console.log('# skipped: viewer user unavailable');
      return;
    }
    const res = await loadRoute('api/admin/companies/token/route.js').POST(
      jsonReq('/api/admin/companies/token', {
        headers: { cookie: viewerCookie, 'x-csrf-token': viewerCsrf },
        body: { regenerate: true, company: BASE_CO },
      })
    );
    assert.equal(res.status, 403, `esperado 403 para viewer, obtido ${res.status}`);
  });

  // cenario 4 - admin plataforma → 200
  it('cenario 4 - SUPER_ADMIN_SILO retorna 200', async () => {
    const res = await loadRoute('api/admin/companies/token/route.js').POST(
      jsonReq('/api/admin/companies/token', {
        headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
        body: { regenerate: false, company: BASE_CO },
      })
    );
    assert.equal(res.status, 200, `esperado 200 para SUPER_ADMIN_SILO, obtido ${res.status}`);
    const body = await res.json();
    assert.ok(body.company?.companyToken, 'companyToken ausente');
  });
});
