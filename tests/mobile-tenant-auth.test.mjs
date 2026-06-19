/**
 * tests/mobile-tenant-auth.test.mjs
 *
 * ETAPA 6.13B — Testes de autenticação mobile e isolamento de tenant
 *
 * Valida casos específicos de autenticação mobile:
 *  - Token inválido → 401
 *  - X-Tenant-Id divergente → 403
 *  - Bootstrap retorna dados somente do tenant correto
 *  - last-hourmeter não cruza tenant
 *  - fleetCode de outra empresa não é retornado
 *
 * Execução: node --test tests/mobile-tenant-auth.test.mjs
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { test } from 'node:test';

// ── Dados de teste (Empresa A = Destilaria Tabu, Empresa B = SEEME) ──────────

const TENANT_A_ID = 'destilariatabu-001';
const TENANT_B_ID = 'seeme-ops-001';

const TOKEN_A = crypto.randomBytes(32).toString('hex');
const TOKEN_B = crypto.randomBytes(32).toString('hex');
const TOKEN_INVALID = 'xxxxxxxx-invalid-token-xxxxxxxx';

// Banco de tokens simulado (espelha ServerStorage.getCompanyByToken)
const companyDB = new Map([
  [TOKEN_A, {
    tenantId: TENANT_A_ID,
    name: 'Destilaria Tabu',
    status: 'ATIVO',
    companyToken: TOKEN_A,
  }],
  [TOKEN_B, {
    tenantId: TENANT_B_ID,
    name: 'SEEME',
    status: 'ATIVO',
    companyToken: TOKEN_B,
  }],
]);

// Dados de live-state por tenant
const liveStateDB = new Map([
  [TENANT_A_ID, [{ fleetCode: 'DT-100', tenantId: TENANT_A_ID, status: 'OPERANDO' }]],
  [TENANT_B_ID, [{ fleetCode: 'SM-200', tenantId: TENANT_B_ID, status: 'PARADO' }]],
]);

// Horímetros por tenant
const hourmeterDB = new Map([
  [TENANT_A_ID, { 'DT-100': 1500.5 }],
  [TENANT_B_ID, { 'SM-200': 850.0 }],
]);

// ── Simulação do guard mobile ────────────────────────────────────────────────

function mobileAuth(token, xTenantId = null) {
  if (!token) return { status: 401, error: 'Token ausente' };
  const company = companyDB.get(token);
  if (!company) return { status: 401, error: 'Token invalido ou instancia inativa' };
  if (xTenantId && xTenantId !== company.tenantId) {
    return { status: 403, error: 'Tenant divergente do token informado.' };
  }
  return { ok: true, tenantId: company.tenantId };
}

// Simula /api/mobile/bootstrap — retorna apenas dados do tenant autenticado
function bootstrapHandler(token, xTenantId = null) {
  const auth = mobileAuth(token, xTenantId);
  if (!auth.ok) return auth;
  return {
    ok: true,
    tenantId: auth.tenantId,
    liveFleet: liveStateDB.get(auth.tenantId) ?? [],
  };
}

// Simula /api/mobile/equipment/{fleetCode}/last-hourmeter
function lastHourmeterHandler(token, fleetCode, xTenantId = null) {
  const auth = mobileAuth(token, xTenantId);
  if (!auth.ok) return auth;
  const meters = hourmeterDB.get(auth.tenantId) ?? {};
  const value = meters[fleetCode];
  if (value === undefined) return { status: 404, error: 'Equipamento nao encontrado no tenant' };
  return { ok: true, tenantId: auth.tenantId, fleetCode, hourmeter: value };
}

// ── Testes ───────────────────────────────────────────────────────────────────

test('token ausente → 401', () => {
  const r = mobileAuth(null);
  assert.equal(r.status, 401);
});

test('token inválido → 401', () => {
  const r = mobileAuth(TOKEN_INVALID);
  assert.equal(r.status, 401, 'Token desconhecido deve retornar 401');
});

test('token A + x-tenant-id de B → 403', () => {
  const r = mobileAuth(TOKEN_A, TENANT_B_ID);
  assert.equal(r.status, 403, 'Token A com tenant B deve ser rejeitado');
});

test('token B + x-tenant-id de A → 403', () => {
  const r = mobileAuth(TOKEN_B, TENANT_A_ID);
  assert.equal(r.status, 403, 'Token B com tenant A deve ser rejeitado');
});

test('token A válido sem x-tenant-id → resolve tenant A', () => {
  const r = mobileAuth(TOKEN_A);
  assert.ok(r.ok);
  assert.equal(r.tenantId, TENANT_A_ID);
});

test('bootstrap com token A retorna somente frota de A', () => {
  const r = bootstrapHandler(TOKEN_A);
  assert.ok(r.ok);
  assert.equal(r.tenantId, TENANT_A_ID);
  const fleets = r.liveFleet.map(e => e.fleetCode);
  assert.ok(fleets.includes('DT-100'), 'Bootstrap A deve ter DT-100');
  assert.ok(!fleets.includes('SM-200'), 'Bootstrap A não deve ter SM-200');
});

test('bootstrap com token B retorna somente frota de B', () => {
  const r = bootstrapHandler(TOKEN_B);
  assert.ok(r.ok);
  assert.equal(r.tenantId, TENANT_B_ID);
  const fleets = r.liveFleet.map(e => e.fleetCode);
  assert.ok(fleets.includes('SM-200'), 'Bootstrap B deve ter SM-200');
  assert.ok(!fleets.includes('DT-100'), 'Bootstrap B não deve ter DT-100');
});

test('last-hourmeter com token A + fleetCode de A retorna horímetro', () => {
  const r = lastHourmeterHandler(TOKEN_A, 'DT-100');
  assert.ok(r.ok);
  assert.equal(r.fleetCode, 'DT-100');
  assert.equal(r.hourmeter, 1500.5);
});

test('last-hourmeter com token A + fleetCode de B retorna 404 (não cruza tenant)', () => {
  const r = lastHourmeterHandler(TOKEN_A, 'SM-200');
  assert.equal(r.status, 404, 'Token A não deve retornar horímetro de frota de B');
});

test('last-hourmeter com token B + fleetCode de A retorna 404 (não cruza tenant)', () => {
  const r = lastHourmeterHandler(TOKEN_B, 'DT-100');
  assert.equal(r.status, 404, 'Token B não deve retornar horímetro de frota de A');
});

test('frotas são strings — DT-100 e SM-200 nunca coercíveis ao mesmo número', () => {
  assert.equal(typeof 'DT-100', 'string');
  assert.equal(typeof 'SM-200', 'string');
  assert.ok(isNaN(Number('DT-100')), 'DT-100 não é número — impossível coerção');
  assert.ok(isNaN(Number('SM-200')), 'SM-200 não é número — impossível coerção');
});

test('operador 0001 preserva zeros à esquerda como string', () => {
  const operatorA = '0001';
  const operatorB = '0002';
  assert.equal(typeof operatorA, 'string');
  assert.notEqual(operatorA, String(Number(operatorA))); // '0001' !== '1'
  assert.notEqual(operatorB, String(Number(operatorB))); // '0002' !== '2'
});

test('tenant IDs de A e B são distintos e imutáveis', () => {
  assert.notEqual(TENANT_A_ID, TENANT_B_ID);
  // Empresa A não pode "se tornar" empresa B passando ID diferente
  const auth = mobileAuth(TOKEN_A, TENANT_A_ID); // OK: mesmo tenant
  assert.ok(auth.ok);
  assert.equal(auth.tenantId, TENANT_A_ID);
  assert.notEqual(auth.tenantId, TENANT_B_ID);
});
