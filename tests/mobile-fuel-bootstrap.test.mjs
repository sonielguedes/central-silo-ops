import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test, before, after } from 'node:test';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-fuel-bootstrap-'));
const servicePath = path.resolve('lib/mobile/fuel-bootstrap-service.ts');
let service;

function loadService() {
  const source = fs.readFileSync(servicePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const file = path.join(tmp, 'fuel-bootstrap-service.cjs');
  fs.writeFileSync(file, compiled);
  delete require.cache[file];
  return require(file);
}

function companyLookup(token) {
  if (token === 'CTK-VALID') {
    return {
      tenantId: 'tenant-a',
      code: 'SG01',
      status: 'ATIVO',
      mobileEnabled: true,
    };
  }
  if (token === 'CTK-INACTIVE') {
    return {
      tenantId: 'tenant-a',
      code: 'SG01',
      status: 'INATIVO',
      mobileEnabled: false,
    };
  }
  return undefined;
}

function makeHeaders(overrides = {}) {
  return new Headers({
    'x-company-token': 'CTK-VALID',
    'x-tenant-id': 'tenant-a',
    'x-company-code': 'SG01',
    'x-app-module': 'FUEL_CONTROL',
    'x-app-name': 'SILO FuelControl',
    ...overrides,
  });
}

before(() => {
  process.env.SILO_STORAGE_DIR = tmp;
  fs.mkdirSync(path.join(tmp, 'tenant-a'), { recursive: true });

  fs.writeFileSync(path.join(tmp, 'tenant-a', 'cadastro-equipamentos.json'), JSON.stringify([
    {
      entityStatus: 'ATIVO',
      updatedAt: '2026-06-23T11:00:00.000-03:00',
      tenantId: 'tenant-a',
      id: 'eq-1',
      code: 'COL-101',
      name: 'Colheitadeira JD S680',
      brand: 'John Deere',
      status: 'trabalhando',
      hourmeter: 4890,
      mobileEnabled: true,
    },
    {
      entityStatus: 'ATIVO',
      updatedAt: '2026-06-23T11:00:00.000-03:00',
      tenantId: 'tenant-a',
      id: 'eq-2',
      code: 'CAM-401',
      name: 'Comboio Scania R450',
      brand: 'Scania',
      status: 'deslocando',
      hourmeter: 1240,
      mobileEnabled: true,
    },
  ], null, 2));

  fs.writeFileSync(path.join(tmp, 'tenant-a', 'cadastro-operadores.json'), JSON.stringify([
    {
      entityStatus: 'ATIVO',
      updatedAt: '2026-06-23T11:00:00.000-03:00',
      tenantId: 'tenant-a',
      id: 'op-1',
      registration: '1001',
      name: 'Ricardo Silva',
      role: 'Motorista',
      status: 'ATIVO',
    },
    {
      entityStatus: 'ATIVO',
      updatedAt: '2026-06-23T11:00:00.000-03:00',
      tenantId: 'tenant-a',
      id: 'op-2',
      registration: '1002',
      name: 'Marcos Souza',
      role: 'Operador Máquina',
      status: 'ATIVO',
    },
    {
      entityStatus: 'ATIVO',
      updatedAt: '2026-06-23T11:00:00.000-03:00',
      tenantId: 'tenant-a',
      id: 'op-3',
      registration: '1003',
      name: 'Joana Lima',
      role: 'Frentista',
      status: 'ATIVO',
    },
  ], null, 2));

  fs.writeFileSync(path.join(tmp, 'tenant-a', 'cadastro-produtos.json'), JSON.stringify([
    {
      entityStatus: 'ATIVO',
      updatedAt: '2026-06-23T11:00:00.000-03:00',
      tenantId: 'tenant-a',
      id: 'prod-1',
      code: 'diesel',
      name: 'Diesel',
      status: 'ATIVO',
    },
  ], null, 2));

  service = loadService();
});

after(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('1. sem headers obrigatorios retorna 400', () => {
  const res = service.handleFuelBootstrapRequest({
    headers: new Headers(),
    lookupCompanyByToken: companyLookup,
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.errorCode, 'MISSING_REQUIRED_HEADERS');
});

test('2. token invalido retorna 401', () => {
  const res = service.handleFuelBootstrapRequest({
    headers: makeHeaders({ 'x-company-token': 'CTK-INVALID' }),
    lookupCompanyByToken: companyLookup,
  });
  assert.equal(res.status, 401);
  assert.equal(res.body.errorCode, 'INVALID_COMPANY_TOKEN');
});

test('3. tenant divergente retorna 403', () => {
  const res = service.handleFuelBootstrapRequest({
    headers: makeHeaders({ 'x-tenant-id': 'tenant-b' }),
    lookupCompanyByToken: companyLookup,
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.errorCode, 'TENANT_MISMATCH');
});

test('4. companyCode divergente retorna 403', () => {
  const res = service.handleFuelBootstrapRequest({
    headers: makeHeaders({ 'x-company-code': 'XX99' }),
    lookupCompanyByToken: companyLookup,
  });
  assert.equal(res.status, 403);
  assert.equal(res.body.errorCode, 'COMPANY_CODE_MISMATCH');
});

test('5. appModule invalido retorna 400', () => {
  const res = service.handleFuelBootstrapRequest({
    headers: makeHeaders({ 'x-app-module': 'FUELING' }),
    lookupCompanyByToken: companyLookup,
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.errorCode, 'INVALID_APP_MODULE');
});

test('6. headers validos retornam 200', () => {
  const res = service.handleFuelBootstrapRequest({
    headers: makeHeaders(),
    lookupCompanyByToken: companyLookup,
    syncedAt: '2026-06-23T12:00:00-03:00',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
});

test('7. resposta contém arrays esperados', () => {
  const res = service.handleFuelBootstrapRequest({
    headers: makeHeaders(),
    lookupCompanyByToken: companyLookup,
    syncedAt: '2026-06-23T12:00:00-03:00',
  });
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(res.body.fleets));
  assert.ok(Array.isArray(res.body.drivers));
  assert.ok(Array.isArray(res.body.operators));
  assert.ok(Array.isArray(res.body.attendants));
  assert.ok(Array.isArray(res.body.products));
  assert.ok(Array.isArray(res.body.pumps));
  assert.ok(Array.isArray(res.body.comboios));
});

test('8. Diesel S-10 sai como DIESEL_S10', () => {
  const res = service.handleFuelBootstrapRequest({
    headers: makeHeaders(),
    lookupCompanyByToken: companyLookup,
    syncedAt: '2026-06-23T12:00:00-03:00',
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.products[0].productCode, 'DIESEL_S10');
  assert.equal(res.body.products[0].description, 'Diesel S-10');
});

test('9. token nao aparece no body', () => {
  const res = service.handleFuelBootstrapRequest({
    headers: makeHeaders(),
    lookupCompanyByToken: companyLookup,
    syncedAt: '2026-06-23T12:00:00-03:00',
  });
  const raw = JSON.stringify(res.body);
  assert.ok(!raw.includes('CTK-VALID'));
});

test('10. nao vaza dados de outro tenant', () => {
  fs.mkdirSync(path.join(tmp, 'tenant-b'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'tenant-b', 'cadastro-equipamentos.json'), JSON.stringify([
    {
      entityStatus: 'ATIVO',
      tenantId: 'tenant-b',
      id: 'eq-b',
      code: 'B-001',
      name: 'Outra Frota',
      status: 'ATIVO',
      hourmeter: 99,
      mobileEnabled: true,
    },
  ], null, 2));

  const res = service.buildFuelBootstrapPayload({
    tenantId: 'tenant-a',
    companyCode: 'SG01',
    syncedAt: '2026-06-23T12:00:00-03:00',
  });
  assert.ok(!res.fleets.some((item) => item.fleetCode === 'B-001'));
});

test('11. todos os codigos retornam como string', () => {
  const res = service.handleFuelBootstrapRequest({
    headers: makeHeaders(),
    lookupCompanyByToken: companyLookup,
    syncedAt: '2026-06-23T12:00:00-03:00',
  });
  assert.equal(typeof res.body.tenantId, 'string');
  assert.equal(typeof res.body.companyCode, 'string');
  assert.equal(typeof res.body.fleets[0].fleetCode, 'string');
  assert.equal(typeof res.body.products[0].productCode, 'string');
});

