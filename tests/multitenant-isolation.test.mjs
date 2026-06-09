import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { test, before, after } from 'node:test';
import { createRequire } from 'node:module';
import { NextRequest } from 'next/server.js';

const require = createRequire(import.meta.url);
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-tenant-audit-'));
const nextAppRoot = path.resolve('.next/server/app');

process.env.SILO_STORAGE_DIR = tmpRoot;
process.env.SILO_DATA_DIR = tmpRoot;
process.env.SILO_AUTH_SECRET = 'test-auth-secret-2026';
process.env.SILO_PLATFORM_OWNER_PASSWORD = 'OwnerPass!2026';
process.env.SILO_DEMO_ADMIN_PASSWORD = 'TenantPass!2026';
process.env.NEXT_PUBLIC_SILO_TENANT_ID = 'silo-ops-001';
process.env.SILO_TENANT_ID = 'silo-ops-001';

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
const adminRoute = () => loadRoute('api/admin/companies/token/route.js');
const usersRoute = () => loadRoute('api/cadastro/[entity]/route.js');
const mobileEquipmentRoute = () => loadRoute('api/mobile/equipment/route.js');
const statusRoute = () => loadRoute('api/equipamentos/status/route.js');
const trailRoute = () => loadRoute('api/equipamentos/trail/route.js');
const fichaRoute = () => loadRoute('api/ficha-operador/route.js');
const relEffRoute = () => loadRoute('api/relatorios/eficiencia-operacional/route.js');
const relTempoRoute = () => loadRoute('api/relatorios/tempo-operacional/route.js');
const batchRoute = () => loadRoute('api/mobile/events/batch/route.js');

let ownerCookie;
let tenantACookie;
let tenantBCookie;
let tenantAToken;
let tenantBToken;
let equipmentA;
let equipmentB;

async function login(identifier, password) {
  const res = await authLoginRoute().POST(jsonReq('/api/auth/login', {
    method: 'POST',
    body: { email: identifier, password },
  }));
  assert.equal(res.status, 200);
  const body = await asJson(res);
  return { cookie: cookieHeader(res), session: body.session, user: body.user };
}

before(async () => {
  const owner = await login('sonieloficial@gmail.com', 'OwnerPass!2026');
  ownerCookie = owner.cookie;
  assert.equal(owner.session.role, 'SUPER_ADMIN_SILO');
  assert.equal(owner.session.scope, 'PLATFORM');

  const demoRes = await adminRoute().POST(jsonReq('/api/admin/companies/token', {
    method: 'POST',
    headers: { cookie: ownerCookie },
    body: {
      company: {
        id: 'silo-demo',
        code: 'SD',
        tradingName: 'SILO OPS Demo',
        corporateName: 'SILO OPS Demo LTDA',
        cnpj: '00.000.000/0001-00',
        apiPort: 3001,
        mqttPort: 18831,
        plan: 'PILOTO',
        status: 'ATIVO',
      },
      regenerate: true,
    },
  }));
  assert.equal(demoRes.status, 200);
  const demoBody = await asJson(demoRes);
  tenantAToken = demoBody.company.companyToken;
  assert.ok(tenantAToken);

  const adminRes = await adminRoute().POST(jsonReq('/api/admin/companies/token', {
    method: 'POST',
    headers: { cookie: ownerCookie },
    body: {
      company: {
        id: 'tenant-b',
        code: 'TB',
        tradingName: 'Tenant B',
        corporateName: 'Tenant B LTDA',
        cnpj: '00.000.000/0002-00',
        apiPort: 3002,
        mqttPort: 18832,
        plan: 'PILOTO',
        status: 'ATIVO',
      },
      regenerate: true,
    },
  }));
  assert.equal(adminRes.status, 200);
  const adminBody = await asJson(adminRes);
  tenantBToken = adminBody.company.companyToken;
  assert.ok(tenantBToken);

  const createTenantUser = await usersRoute().POST(jsonReq('/api/cadastro/users', {
    method: 'POST',
    headers: { cookie: ownerCookie },
    body: {
      name: 'Tenant B Admin',
      username: 'tenantb.admin',
      email: 'tenantb.admin@siloops.com.br',
      accessGroupId: 'role-admin-empresa',
      scope: 'TENANT',
      tenantId: 'tenant-b',
      defaultTenantId: 'tenant-b',
      status: 'ATIVO',
      mustChangePassword: false,
      password: 'TenantBPass!2026',
    },
  }), { params: { entity: 'users' } });
  assert.equal(createTenantUser.status, 201);

  tenantACookie = (await login('admin@siloops.com.br', 'TenantPass!2026')).cookie;
  tenantBCookie = (await login('tenantb.admin@siloops.com.br', 'TenantBPass!2026')).cookie;

  const aRes = await mobileEquipmentRoute().POST(jsonReq('/api/mobile/equipment', {
    method: 'POST',
    headers: { 'x-company-token': tenantAToken },
    body: {
      equipmentId: 'eq-a',
      fleetCode: '1001',
      code: '1001',
      name: 'Tenant A Machine',
      status: 'ATIVO',
      typeId: 'MOBILE',
      brand: 'A',
      mobileEnabled: true,
    },
  }));
  assert.equal(aRes.status, 200);
  equipmentA = await asJson(aRes);

  const bRes = await mobileEquipmentRoute().POST(jsonReq('/api/mobile/equipment', {
    method: 'POST',
    headers: { 'x-company-token': tenantBToken },
    body: {
      equipmentId: 'eq-b',
      fleetCode: '2001',
      code: '2001',
      name: 'Tenant B Machine',
      status: 'ATIVO',
      typeId: 'MOBILE',
      brand: 'B',
      mobileEnabled: true,
    },
  }));
  assert.equal(bRes.status, 200);
  equipmentB = await asJson(bRes);

  await batchRoute().POST(jsonReq('/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'x-company-token': tenantAToken },
    body: {
      header: {
        machineId: 'eq-a',
        fleetCode: '1001',
        mobileToken: equipmentA.mobileToken,
      },
      events: [
        { uuid: 'a-1', type: 'JOURNEY_START', timestamp: new Date().toISOString(), data: { journeyId: 'journey-a', fleetCode: '1001', operatorRegistration: '1001' } },
        { uuid: 'a-2', type: 'JOURNEY_END', timestamp: new Date().toISOString(), data: { journeyId: 'journey-a', fleetCode: '1001', hourmeterStart: 10, hourmeterEnd: 12, totalHourmeter: 2 } },
      ],
    },
  }));

  await batchRoute().POST(jsonReq('/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'x-company-token': tenantBToken },
    body: {
      header: {
        machineId: 'eq-b',
        fleetCode: '2001',
        mobileToken: equipmentB.mobileToken,
      },
      events: [
        { uuid: 'b-1', type: 'JOURNEY_START', timestamp: new Date().toISOString(), data: { journeyId: 'journey-b', fleetCode: '2001', operatorRegistration: '2002' } },
        { uuid: 'b-2', type: 'JOURNEY_END', timestamp: new Date().toISOString(), data: { journeyId: 'journey-b', fleetCode: '2001', hourmeterStart: 20, hourmeterEnd: 23, totalHourmeter: 3 } },
      ],
    },
  }));
});

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

test('tenant A does not see tenant B equipment/status', async () => {
  const resA = await statusRoute().GET(jsonReq('/api/equipamentos/status', { headers: { cookie: tenantACookie } }));
  const fleetA = await asJson(resA);
  assert.ok(Array.isArray(fleetA));
  assert.ok(fleetA.some((x) => x.fleetCode === '1001'));
  assert.ok(!fleetA.some((x) => x.fleetCode === '2001'));

  const resB = await statusRoute().GET(jsonReq('/api/equipamentos/status', { headers: { cookie: tenantBCookie } }));
  const fleetB = await asJson(resB);
  assert.ok(Array.isArray(fleetB));
  assert.ok(fleetB.some((x) => x.fleetCode === '2001'));
  assert.ok(!fleetB.some((x) => x.fleetCode === '1001'));
});

test('tenant trail, ficha and reports stay isolated', async () => {
  const trailA = await trailRoute().GET(jsonReq('/api/equipamentos/trail?fleetCode=1001', { headers: { cookie: tenantACookie } }));
  const trailABody = await asJson(trailA);
  assert.equal(trailABody.fleetCode, '1001');
  assert.ok(Array.isArray(trailABody.points));

  const fichaA = await fichaRoute().GET(jsonReq('/api/ficha-operador?fleetCode=1001', { headers: { cookie: tenantACookie } }));
  assert.equal(fichaA.status, 200);
  const fichaABody = await asJson(fichaA);
  assert.equal(fichaABody.fleetCode, '1001');

  const fichaB = await fichaRoute().GET(jsonReq('/api/ficha-operador?fleetCode=2001', { headers: { cookie: tenantBCookie } }));
  assert.equal(fichaB.status, 200);
  const fichaBBody = await asJson(fichaB);
  assert.equal(fichaBBody.fleetCode, '2001');

  const relA = await relEffRoute().GET(jsonReq('/api/relatorios/eficiencia-operacional', { headers: { cookie: tenantACookie } }));
  assert.equal(relA.status, 200);
  const reportA = await asJson(relA);
  assert.ok(reportA.byFleet.some((x) => x.fleetCode === '1001'));
  assert.ok(!reportA.byFleet.some((x) => x.fleetCode === '2001'));

  const relB = await relTempoRoute().GET(jsonReq('/api/relatorios/tempo-operacional', { headers: { cookie: tenantBCookie } }));
  assert.equal(relB.status, 200);
  const reportB = await asJson(relB);
  assert.ok(reportB.byFleet.some((x) => x.fleetCode === '2001'));
  assert.ok(!reportB.byFleet.some((x) => x.fleetCode === '1001'));
});
