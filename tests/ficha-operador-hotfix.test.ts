import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';

const tenantId = 'tenant-hotfix-ficha';
const date = '2026-06-17';

let tmpRoot = '';
let daily: typeof import('../lib/daily-sheet-builder');
let exportLib: typeof import('../lib/ficha-export');

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

beforeAll(async () => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-ficha-hotfix-'));
  process.env.SILO_STORAGE_DIR = tmpRoot;
  process.env.SILO_DATA_DIR = tmpRoot;
  jest.resetModules();

  daily = await import('../lib/daily-sheet-builder');
  exportLib = await import('../lib/ficha-export');

  const now = '2026-06-17T12:00:00.000Z';
  writeJson(path.join(tmpRoot, tenantId, 'live-state.json'), [
    {
      tenantId,
      equipmentId: 'eq-2026',
      fleetCode: '2026',
      status: 'FINALIZADO',
      updatedAt: now,
      endedAt: now,
      operatorRegistration: '00125',
      operatorName: 'RAIMUNDO NONATO',
      currentOperator: 'RAIMUNDO NONATO',
      operationCode: 'OP-PLANTIO',
      operationName: 'PLANTIO',
      currentOperation: 'PLANTIO',
      implementCode: 'SULCADOR',
      implementName: 'SULCADOR',
      workOrder: '100',
      costCenter: 'PLANTIO',
      costCenterCode: 'PLANTIO',
      costCenterName: 'PLANTIO',
      hourmeterStart: 0.5,
      hourmeterCurrent: 0.7,
      hourmeterEnd: 1.6,
      hourmeterFinal: 1.6,
      lastGpsAt: now,
      lastHeartbeatAt: now,
    },
  ]);

  writeJson(path.join(tmpRoot, tenantId, 'mobile-events.json'), [
    {
      offlineId: 'evt-start',
      equipmentId: 'eq-2026',
      tenantId,
      type: 'JOURNEY_START',
      timestamp: '2026-06-17T12:00:00.000Z',
      receivedAt: '2026-06-17T12:00:01.000Z',
      payload: {
        journeyId: 'journey-2026',
        operatorRegistration: '00125',
        operatorName: 'RAIMUNDO NONATO',
        operationCode: 'OP-PLANTIO',
        operationName: 'PLANTIO',
        workOrderNumber: '100',
        costCenterName: 'PLANTIO',
        hourmeterStart: '0,5',
      },
    },
    {
      offlineId: 'evt-end',
      equipmentId: 'eq-2026',
      tenantId,
      type: 'JOURNEY_END',
      timestamp: '2026-06-17T12:30:00.000Z',
      receivedAt: '2026-06-17T12:30:01.000Z',
      payload: {
        journeyId: 'journey-2026',
        operatorRegistration: '00125',
        operatorName: 'RAIMUNDO NONATO',
        operationCode: 'OP-PLANTIO',
        operationName: 'PLANTIO',
        workOrderNumber: '100',
        costCenterName: 'PLANTIO',
        hourmeterEnd: '1,6',
      },
    },
  ]);

  writeJson(path.join(tmpRoot, tenantId, 'trails', 'journey_2026.json'), [
    { journeyId: 'journey-2026', timestamp: '2026-06-17T12:05:00.000Z', latitude: -12.55, longitude: -55.72 },
    { journeyId: 'journey-2026', timestamp: '2026-06-17T12:10:00.000Z', latitude: -12.551, longitude: -55.721 },
  ]);

  writeJson(path.join(tmpRoot, tenantId, 'cadastro-ordens-servico.json'), [
    {
      id: 'os-100',
      tenantId,
      entityStatus: 'ATIVO',
      code: '100',
      description: 'OS teste hotfix',
      type: 'PREVENTIVA',
      priority: 'MEDIA',
      status: 'ABERTA',
      equipmentId: 'eq-2026',
      costCenterId: 'cc-8080',
      operationId: 'op-plantio-1',
      openedAt: now,
    },
  ]);

  writeJson(path.join(tmpRoot, tenantId, 'cadastro-centros-custo.json'), [
    {
      id: 'cc-8080',
      tenantId,
      entityStatus: 'ATIVO',
      code: '8080',
      name: 'Centro 8080',
      description: 'Centro de custo correto',
      status: 'ATIVO',
    },
  ]);
});

afterAll(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('ficha operador hotfix', () => {
  test('toNumber e calculateTotalHours aceitam vírgula e preservam 1,1', () => {
    expect(daily.toNumber('0,5')).toBe(0.5);
    expect(daily.toNumber('1.6')).toBe(1.6);
    expect(daily.calculateTotalHours('0,5', '1,6')).toBe(1.1);
    expect(daily.calculateTotalHours('1,6', '0,5')).toBeNull();
  });

  test('buildDailySheet resolve total hours e centro de custo sem cair em operação', () => {
    const result = daily.buildDailySheet({ tenantId, fleetCode: '2026', date });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);

    const ficha = result.ficha;
    expect(ficha.hourmeterStart).toBe(0.5);
    expect(ficha.hourmeterEnd).toBe(1.6);
    expect(ficha.totalHourmeter).toBe(1.1);
    expect(ficha.operationName).toBe('PLANTIO');
    expect(ficha.costCenterName).toBe('8080');

    const row = exportLib.buildFichaExportRow(ficha, null);
    const cells = row.split(';');
    expect(cells[12]).toBe('PLANTIO');
    expect(cells[13]).toBe('8080');
    expect(cells[22]).toBe('1,1');
  });
});
