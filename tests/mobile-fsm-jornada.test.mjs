/**
 * tests/mobile-fsm-jornada.test.mjs
 *
 * Cenários: FSM_TRANSITION com status/toState === JORNADA_FINALIZADA
 *
 * Garante:
 *   - status live-state → FINALIZADO
 *   - hourmeterStart, hourmeterCurrent, hourmeterEnd, endedAt definidos corretamente
 *   - journeyId / operador / operação / stop limpos do live-state
 *   - HEARTBEAT tardio no mesmo batch não reabre a jornada
 *   - toState (em vez de d.status) também é reconhecido
 *   - Idempotência: batch duplicado produz o mesmo estado
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
const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-fsm-jornada-'));
const nextAppRoot = path.resolve('.next/server/app');

// ── Senhas geradas em runtime — nunca fixas ───────────────────────────────────
const TEST_OWNER_PASSWORD  = `test-owner-${crypto.randomUUID()}!A1`;
const TEST_TENANT_PASSWORD = `tenant-fsm-${crypto.randomUUID()}!A1`;

process.env.SILO_STORAGE_DIR        = tmpRoot;
process.env.SILO_DATA_DIR           = tmpRoot;
process.env.SILO_AUTH_SECRET        = crypto.randomBytes(32).toString('hex');
process.env.SILO_PLATFORM_OWNER_PASSWORD = TEST_OWNER_PASSWORD;
process.env.NEXT_PUBLIC_SILO_TENANT_ID   = 'silo-ops-001';
process.env.SILO_TENANT_ID               = 'silo-ops-001';

// ── Loader helpers ────────────────────────────────────────────────────────────
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
  const session = fragments.find((f) => f.startsWith('silo_session='))?.split(';')[0] || null;
  const csrf    = fragments.find((f) => f.startsWith('silo_csrf='))?.split(';')[0] || null;
  return session ? (csrf ? session + '; ' + csrf : session) : null;
}

function cookieValue(response, name) {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'set-cookie ausente');
  const fragments = setCookie.split(/, (?=[^;,=]+=[^;,]*)/g);
  const frag = fragments.find((f) => f.startsWith(name + '='));
  assert.ok(frag, `cookie ${name} ausente`);
  return frag.split(';')[0].split('=').slice(1).join('=');
}

async function asJson(res) {
  return await res.json();
}

const loginRoute         = () => loadRoute('api/auth/login/route.js');
const adminRoute         = () => loadRoute('api/admin/companies/token/route.js');
const mobileEquipRoute   = () => loadRoute('api/mobile/equipment/route.js');
const batchRoute         = () => loadRoute('api/mobile/events/batch/route.js');
const statusRoute        = () => loadRoute('api/equipamentos/status/route.js');

// ── Shared state ──────────────────────────────────────────────────────────────
let ownerCookie;
let tenantCookie;   // TENANT-scoped ADMIN_EMPRESA cookie for silo-fsm-001 status checks
let companyToken;
let equipment;   // { mobileToken, ... }
let tenantId = 'silo-fsm-001';

before(async () => {
  // Login como SUPER_ADMIN_SILO
  const loginRes = await loginRoute().POST(jsonReq('/api/auth/login', {
    method: 'POST',
    body: { email: 'sonieloficial@gmail.com', password: TEST_OWNER_PASSWORD },
  }));
  assert.equal(loginRes.status, 200, 'login owner falhou');
  ownerCookie = cookieHeader(loginRes);
  const ownerCsrf = cookieValue(loginRes, 'silo_csrf');

  // Criar empresa de teste
  const companyRes = await adminRoute().POST(jsonReq('/api/admin/companies/token', {
    method: 'POST',
    headers: { cookie: ownerCookie, 'x-csrf-token': ownerCsrf },
    body: {
      regenerate: true,
      company: {
        id: tenantId,
        code: 'SFJ',
        tradingName: 'SILO FSM Jornada Test',
        corporateName: 'SILO FSM Test LTDA',
        cnpj: '00.000.000/0099-00',
        apiPort: 3099,
        mqttPort: 18899,
        plan: 'PILOTO',
        status: 'ATIVO',
      },
    },
  }));
  assert.equal(companyRes.status, 200, 'criacao empresa falhou');
  const companyBody = await asJson(companyRes);
  companyToken = companyBody.company.companyToken;
  assert.ok(companyToken, 'companyToken ausente');

  // Criar usuário TENANT-scoped para silo-fsm-001
  // requireTenant ignora x-tenant-id header para sessões PLATFORM scope —
  // precisamos de um cookie de sessão com scope=TENANT e tenantId=silo-fsm-001.
  {
    const bcryptjs = require('bcryptjs');
    const tenantPasswordHash = bcryptjs.hashSync(TEST_TENANT_PASSWORD, 12);
    const authDir = path.join(tmpRoot, 'auth');
    fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(
      path.join(authDir, 'users.json'),
      JSON.stringify([{
        id: 'usr-fsm-admin',
        tenantId,
        defaultTenantId: tenantId,
        scope: 'TENANT',
        role: 'ADMIN_EMPRESA',
        accessGroupId: 'role-admin-empresa',
        name: 'FSM Test Admin',
        username: 'fsm.admin',
        email: 'fsm.admin@example.test',
        status: 'ATIVO',
        mustChangePassword: false,
        passwordHash: tenantPasswordHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }]),
    );
    const tenantLoginRes = await loginRoute().POST(jsonReq('/api/auth/login', {
      method: 'POST',
      body: { email: 'fsm.admin@example.test', password: TEST_TENANT_PASSWORD },
    }));
    assert.equal(tenantLoginRes.status, 200, 'login tenant falhou');
    tenantCookie = cookieHeader(tenantLoginRes);
  }

  // Registrar equipamento mobile
  const equipRes = await mobileEquipRoute().POST(jsonReq('/api/mobile/equipment', {
    method: 'POST',
    headers: { 'x-company-token': companyToken },
    body: {
      equipmentId: 'eq-fsm-01',
      fleetCode: 'FSM-01',
      code: 'FSM-01',
      name: 'Trator FSM Test',
      status: 'ATIVO',
      typeId: 'MOBILE',
      brand: 'Test',
      mobileEnabled: true,
    },
  }));
  assert.equal(equipRes.status, 200, 'registro equipamento falhou');
  equipment = await asJson(equipRes);
  assert.ok(equipment.mobileToken, 'mobileToken ausente');

  // Iniciar jornada com operador e operação ativos
  const startBatch = await batchRoute().POST(jsonReq('/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'x-company-token': companyToken },
    body: {
      header: { machineId: 'eq-fsm-01', fleetCode: 'FSM-01', mobileToken: equipment.mobileToken },
      events: [
        {
          uuid: 'setup-start-1',
          type: 'JOURNEY_START',
          timestamp: new Date(Date.now() - 60_000).toISOString(),
          data: {
            journeyId: 'journey-fsm-001',
            fleetCode: 'FSM-01',
            operatorRegistration: 'OP-777',
            operatorName: 'Operador Teste',
            operationCode: 'OP-COLHEITA',
            operationName: 'Colheita',
            hourmeterStart: 1000,
            hourmeterSource: 'CAN',
          },
        },
        {
          uuid: 'setup-stop-1',
          type: 'STOP_REASON',
          timestamp: new Date(Date.now() - 45_000).toISOString(),
          data: {
            journeyId: 'journey-fsm-001',
            fleetCode: 'FSM-01',
            stopCode: 'PAR-01',
            stopDescription: 'Pausa para abastecimento',
            stopStartedAt: new Date(Date.now() - 45_000).toISOString(),
          },
        },
      ],
    },
  }));
  assert.equal(startBatch.status, 200, 'batch de setup falhou');

  // Confirmar que live-state tem jornada ativa
  const statusRes = await statusRoute().GET(
    jsonReq('/api/equipamentos/status', { headers: { cookie: tenantCookie } })
  );
  assert.equal(statusRes.status, 200, 'GET status falhou no setup');
  const fleet = await asJson(statusRes);
  const eq = fleet.find((x) => x.fleetCode === 'FSM-01');
  assert.ok(eq, 'equipamento FSM-01 nao encontrado no status');
  assert.equal(eq.journeyId, 'journey-fsm-001', 'journeyId nao setado no setup');
  assert.equal(eq.operatorRegistration, 'OP-777', 'operatorRegistration nao setado no setup');
  assert.equal(eq.stopCode, 'PAR-01', 'stopCode nao setado no setup');
});

after(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

// ── Cenário 1 ─────────────────────────────────────────────────────────────────
test('Cenario 1: FSM_TRANSITION JORNADA_FINALIZADA seta status=FINALIZADO e hourmeter', async () => {
  const endedAt = new Date().toISOString();

  const res = await batchRoute().POST(jsonReq('/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'x-company-token': companyToken },
    body: {
      header: { machineId: 'eq-fsm-01', fleetCode: 'FSM-01', mobileToken: equipment.mobileToken },
      events: [
        {
          uuid: `fsm-end-c1-${crypto.randomUUID()}`,
          type: 'FSM_TRANSITION',
          timestamp: endedAt,
          data: {
            status: 'JORNADA_FINALIZADA',
            fleetCode: 'FSM-01',
            hourmeterStart: 1000,
            hourmeterFinal: 1012.5,
            endedAt,
          },
        },
      ],
    },
  }));
  assert.equal(res.status, 200, `batch cenario 1 falhou: ${JSON.stringify(await res.json())}`);

  const statusRes = await statusRoute().GET(
    jsonReq('/api/equipamentos/status', { headers: { cookie: tenantCookie } })
  );
  const fleet = await asJson(statusRes);
  const eq = fleet.find((x) => x.fleetCode === 'FSM-01');
  assert.ok(eq, 'equipamento nao encontrado no status apos Cenario 1');

  assert.equal(eq.status, 'FINALIZADO', `status esperado FINALIZADO, recebido: ${eq.status}`);
  assert.equal(eq.hourmeterStart,   1000,   `hourmeterStart esperado 1000, recebido: ${eq.hourmeterStart}`);
  assert.equal(eq.hourmeterCurrent, 1012.5, `hourmeterCurrent esperado 1012.5, recebido: ${eq.hourmeterCurrent}`);
  assert.equal(eq.hourmeterEnd,     1012.5, `hourmeterEnd esperado 1012.5, recebido: ${eq.hourmeterEnd}`);
  assert.equal(eq.endedAt, endedAt, `endedAt incorreto`);
});

// ── Cenário 2 ─────────────────────────────────────────────────────────────────
test('Cenario 2: campos journeyId/operador/operacao/stop limpos apos JORNADA_FINALIZADA', async () => {
  // Reabrir jornada para ter campos ativos de novo
  await batchRoute().POST(jsonReq('/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'x-company-token': companyToken },
    body: {
      header: { machineId: 'eq-fsm-01', fleetCode: 'FSM-01', mobileToken: equipment.mobileToken },
      events: [
        {
          uuid: `restart-c2-${crypto.randomUUID()}`,
          type: 'JOURNEY_START',
          timestamp: new Date(Date.now() - 30_000).toISOString(),
          data: {
            journeyId: 'journey-fsm-002',
            fleetCode: 'FSM-01',
            operatorRegistration: 'OP-888',
            operatorName: 'Outro Operador',
            operationCode: 'OP-PLANTIO',
            operationName: 'Plantio',
            hourmeterStart: 1020,
            stopCode: 'PAR-02',
            stopStartedAt: new Date(Date.now() - 20_000).toISOString(),
          },
        },
      ],
    },
  }));

  const endedAt2 = new Date().toISOString();
  await batchRoute().POST(jsonReq('/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'x-company-token': companyToken },
    body: {
      header: { machineId: 'eq-fsm-01', fleetCode: 'FSM-01', mobileToken: equipment.mobileToken },
      events: [
        {
          uuid: `fsm-end-c2-${crypto.randomUUID()}`,
          type: 'FSM_TRANSITION',
          timestamp: endedAt2,
          data: {
            status: 'JORNADA_FINALIZADA',
            fleetCode: 'FSM-01',
            hourmeterStart: 1020,
            hourmeterFinal: 1030,
            endedAt: endedAt2,
          },
        },
      ],
    },
  }));

  const statusRes = await statusRoute().GET(
    jsonReq('/api/equipamentos/status', { headers: { cookie: tenantCookie } })
  );
  const fleet = await asJson(statusRes);
  const eq = fleet.find((x) => x.fleetCode === 'FSM-01');
  assert.ok(eq, 'equipamento nao encontrado no status apos Cenario 2');

  assert.equal(eq.status, 'FINALIZADO');

  // Campos de jornada/operador/operacao/stop devem estar ausentes
  assert.ok(!eq.journeyId,            `journeyId deveria ser nulo, recebido: ${eq.journeyId}`);
  assert.ok(!eq.operatorRegistration, `operatorRegistration deveria ser nulo, recebido: ${eq.operatorRegistration}`);
  assert.ok(!eq.operatorName,         `operatorName deveria ser nulo, recebido: ${eq.operatorName}`);
  assert.ok(!eq.operationCode,        `operationCode deveria ser nulo, recebido: ${eq.operationCode}`);
  assert.ok(!eq.operationName,        `operationName deveria ser nulo, recebido: ${eq.operationName}`);
  assert.ok(!eq.stopCode,             `stopCode deveria ser nulo, recebido: ${eq.stopCode}`);
  assert.ok(!eq.stopDescription,      `stopDescription deveria ser nulo, recebido: ${eq.stopDescription}`);
  assert.ok(!eq.stopStartedAt,        `stopStartedAt deveria ser nulo, recebido: ${eq.stopStartedAt}`);

  // Campos de identidade do equipamento preservados
  assert.equal(eq.fleetCode,    'FSM-01',     'fleetCode nao preservado');
  assert.equal(eq.equipmentId,  'eq-fsm-01',  'equipmentId nao preservado');
  assert.equal(eq.tenantId,     tenantId,     'tenantId nao preservado');
});

// ── Cenário 3 ─────────────────────────────────────────────────────────────────
test('Cenario 3: HEARTBEAT tardio no mesmo batch nao reabre jornada finalizada', async () => {
  // Reabrir jornada
  await batchRoute().POST(jsonReq('/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'x-company-token': companyToken },
    body: {
      header: { machineId: 'eq-fsm-01', fleetCode: 'FSM-01', mobileToken: equipment.mobileToken },
      events: [
        {
          uuid: `restart-c3-${crypto.randomUUID()}`,
          type: 'JOURNEY_START',
          timestamp: new Date(Date.now() - 60_000).toISOString(),
          data: {
            journeyId: 'journey-fsm-003',
            fleetCode: 'FSM-01',
            operatorRegistration: 'OP-999',
            hourmeterStart: 1100,
          },
        },
      ],
    },
  }));

  const fsmTs = new Date(Date.now() - 5_000).toISOString();
  // HEARTBEAT com timestamp POSTERIOR ao FSM_TRANSITION (simula sync tardio)
  const hbTs = new Date(Date.now() + 5_000).toISOString();

  const res = await batchRoute().POST(jsonReq('/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'x-company-token': companyToken },
    body: {
      header: { machineId: 'eq-fsm-01', fleetCode: 'FSM-01', mobileToken: equipment.mobileToken },
      events: [
        {
          uuid: `fsm-end-c3-${crypto.randomUUID()}`,
          type: 'FSM_TRANSITION',
          timestamp: fsmTs,
          data: {
            status: 'JORNADA_FINALIZADA',
            fleetCode: 'FSM-01',
            hourmeterStart: 1100,
            hourmeterFinal: 1115,
            endedAt: fsmTs,
          },
        },
        {
          uuid: `hb-late-c3-${crypto.randomUUID()}`,
          type: 'HEARTBEAT',
          timestamp: hbTs,
          data: {
            fleetCode: 'FSM-01',
            hourmeterCurrent: 1115,
          },
        },
      ],
    },
  }));
  assert.equal(res.status, 200, 'batch cenario 3 falhou');

  const statusRes = await statusRoute().GET(
    jsonReq('/api/equipamentos/status', { headers: { cookie: tenantCookie } })
  );
  const fleet = await asJson(statusRes);
  const eq = fleet.find((x) => x.fleetCode === 'FSM-01');
  assert.ok(eq, 'equipamento nao encontrado no status apos Cenario 3');
  assert.equal(eq.status, 'FINALIZADO',
    `HEARTBEAT tardio nao deveria sobrescrever FINALIZADO; recebido: ${eq.status}`);
});

// ── Cenário 4 ─────────────────────────────────────────────────────────────────
test('Cenario 4: toState === JORNADA_FINALIZADA (sem d.status) tambem finaliza', async () => {
  // Reabrir jornada
  await batchRoute().POST(jsonReq('/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'x-company-token': companyToken },
    body: {
      header: { machineId: 'eq-fsm-01', fleetCode: 'FSM-01', mobileToken: equipment.mobileToken },
      events: [
        {
          uuid: `restart-c4-${crypto.randomUUID()}`,
          type: 'JOURNEY_START',
          timestamp: new Date(Date.now() - 60_000).toISOString(),
          data: {
            journeyId: 'journey-fsm-004',
            fleetCode: 'FSM-01',
            operatorRegistration: 'OP-111',
            hourmeterStart: 2000,
          },
        },
      ],
    },
  }));

  const endedAt4 = new Date().toISOString();
  const res = await batchRoute().POST(jsonReq('/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'x-company-token': companyToken },
    body: {
      header: { machineId: 'eq-fsm-01', fleetCode: 'FSM-01', mobileToken: equipment.mobileToken },
      events: [
        {
          uuid: `fsm-end-c4-${crypto.randomUUID()}`,
          type: 'FSM_TRANSITION',
          timestamp: endedAt4,
          data: {
            // toState em vez de status
            toState: 'JORNADA_FINALIZADA',
            fleetCode: 'FSM-01',
            hourmeterStart: 2000,
            hourmeterFinal: 2008,
            endedAt: endedAt4,
          },
        },
      ],
    },
  }));
  assert.equal(res.status, 200, 'batch cenario 4 falhou');

  const statusRes = await statusRoute().GET(
    jsonReq('/api/equipamentos/status', { headers: { cookie: tenantCookie } })
  );
  const fleet = await asJson(statusRes);
  const eq = fleet.find((x) => x.fleetCode === 'FSM-01');
  assert.ok(eq, 'equipamento nao encontrado no status apos Cenario 4');
  assert.equal(eq.status, 'FINALIZADO',
    `toState JORNADA_FINALIZADA deveria resultar em FINALIZADO; recebido: ${eq.status}`);
  assert.equal(eq.hourmeterEnd, 2008, `hourmeterEnd incorreto: ${eq.hourmeterEnd}`);
  // journeyId deve estar limpo
  assert.ok(!eq.journeyId, `journeyId deveria ser nulo apos Cenario 4, recebido: ${eq.journeyId}`);
});

// ── Cenário 5 ─────────────────────────────────────────────────────────────────
test('Cenario 5: batch duplicado e idempotente (mesmo uuid)', async () => {
  // Reabrir jornada
  await batchRoute().POST(jsonReq('/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'x-company-token': companyToken },
    body: {
      header: { machineId: 'eq-fsm-01', fleetCode: 'FSM-01', mobileToken: equipment.mobileToken },
      events: [
        {
          uuid: `restart-c5-${crypto.randomUUID()}`,
          type: 'JOURNEY_START',
          timestamp: new Date(Date.now() - 60_000).toISOString(),
          data: {
            journeyId: 'journey-fsm-005',
            fleetCode: 'FSM-01',
            hourmeterStart: 3000,
          },
        },
      ],
    },
  }));

  const endedAt5 = new Date().toISOString();
  const FIXED_UUID = 'idempotent-uuid-fsm-c5';
  const batchPayload = {
    header: { machineId: 'eq-fsm-01', fleetCode: 'FSM-01', mobileToken: equipment.mobileToken },
    events: [
      {
        uuid: FIXED_UUID,
        type: 'FSM_TRANSITION',
        timestamp: endedAt5,
        data: {
          status: 'JORNADA_FINALIZADA',
          fleetCode: 'FSM-01',
          hourmeterStart: 3000,
          hourmeterFinal: 3020,
          endedAt: endedAt5,
        },
      },
    ],
  };

  // Enviar duas vezes
  const res1 = await batchRoute().POST(jsonReq('/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'x-company-token': companyToken },
    body: batchPayload,
  }));
  assert.equal(res1.status, 200, 'primeira envio do batch c5 falhou');

  const res2 = await batchRoute().POST(jsonReq('/api/mobile/events/batch', {
    method: 'POST',
    headers: { 'x-company-token': companyToken },
    body: batchPayload,
  }));
  assert.equal(res2.status, 200, 'segundo envio do batch c5 falhou');

  const statusRes = await statusRoute().GET(
    jsonReq('/api/equipamentos/status', { headers: { cookie: tenantCookie } })
  );
  const fleet = await asJson(statusRes);
  const eq = fleet.find((x) => x.fleetCode === 'FSM-01');
  assert.ok(eq, 'equipamento nao encontrado no status apos Cenario 5');
  assert.equal(eq.status,       'FINALIZADO', `status incorreto: ${eq.status}`);
  assert.equal(eq.hourmeterEnd, 3020,         `hourmeterEnd incorreto: ${eq.hourmeterEnd}`);
  assert.equal(eq.endedAt,      endedAt5,     `endedAt alterado na segunda envio`);
});
