/**
 * Real filesystem integration test for POST /api/mobile/shift/start.
 *
 * Uses the REAL CadastroStorage + ServerStorage against a temp SILO_STORAGE_DIR,
 * writing actual data/{tenantId}/cadastro-equipamentos.json and
 * cadastro-operadores.json. Only requireMobileAuth (the X-Company-Token gate)
 * and audit logging are mocked.
 *
 * Acceptance: SG01 / equipamento 2026 / operador 01 via the new contract
 *   { equipmentCode: "2026", operatorRegistration: "01", hourmeterStart, startedAt }
 * must start the journey using only multi-tenant headers (no body mobileToken).
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { NextRequest } from 'next/server';

const TENANT = 'sg01-1781359594113';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-shift-start-'));

// Storage modules read SILO_STORAGE_DIR at import time -> set BEFORE requiring route.
process.env.SILO_STORAGE_DIR = TMP;
delete process.env.NEXT_PUBLIC_APP_ENV;

jest.mock('@/lib/audit/audit-log', () => ({ auditFromRequest: jest.fn() }));
jest.mock('@/lib/auth/api-guard', () => ({
  requireMobileAuth: jest.fn(() => ({ ok: true, tenantId: TENANT, companyToken: 'tok' })),
}));

function writeJson(rel: string, data: unknown) {
  const file = path.join(TMP, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

beforeAll(() => {
  // Real cadastro files exactly as described in the diagnosis.
  writeJson(`${TENANT}/cadastro-equipamentos.json`, [
    {
      code: '2026',
      id: 'pbzr0u9vl',
      tenantId: TENANT,
      status: 'ATIVO',
      entityStatus: 'ATIVO',
      mobileEnabled: true,
    },
  ]);
  writeJson(`${TENANT}/cadastro-operadores.json`, [
    {
      id: '34ueo7r30',
      registration: '01',
      name: 'Operador Um',
      status: 'ATIVO',
      entityStatus: 'ATIVO',
      tenantId: TENANT,
    },
  ]);
  // equipments.json intentionally empty (matches production state).
  writeJson(`${TENANT}/equipments.json`, []);
});

afterAll(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

function makeReq(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/mobile/shift/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-company-token': 'tok' },
    body: JSON.stringify(body),
  });
}

describe('integration: POST /api/mobile/shift/start (real fs, SG01/2026/01)', () => {
  test('inicia jornada com contrato novo, sem mobileToken no body', async () => {
    // require AFTER env is configured so storage roots point at TMP
    const { POST } = require('../route');

    const startedAt = '2026-06-14T10:00:00.000Z';
    const res = await POST(
      makeReq({ equipmentCode: '2026', operatorRegistration: '01', hourmeterStart: 0.15, startedAt }),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      success: true,
      status: 'OK',
      equipmentId: 'pbzr0u9vl',
      equipmentCode: '2026',
      operatorId: '34ueo7r30',
      operatorRegistration: '01',
      hourmeterStart: 0.15,
      startedAt,
    });

    // SHIFT_START event persisted to the real mobile-events.json file.
    const eventsFile = path.join(TMP, TENANT, 'mobile-events.json');
    expect(fs.existsSync(eventsFile)).toBe(true);
    const events = JSON.parse(fs.readFileSync(eventsFile, 'utf-8'));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('SHIFT_START');
    expect(events[0].payload).toMatchObject({
      equipmentId: 'pbzr0u9vl',
      equipmentCode: '2026',
      operatorId: '34ueo7r30',
      operatorRegistration: '01',
      hourmeterStart: 0.15,
      startedAt,
    });

    // live-state.json reflects OPERANDO + seeded hourmeter.
    const liveFile = path.join(TMP, TENANT, 'live-state.json');
    expect(fs.existsSync(liveFile)).toBe(true);
    const live = JSON.parse(fs.readFileSync(liveFile, 'utf-8'));
    expect(live[0].status).toBe('OPERANDO');
    expect(live[0].hourmeterStart).toBe(0.15);
  });
});
