import fs from 'fs';
import os from 'os';
import path from 'path';

const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-totvs-dispatch-storage-'));
process.env.SILO_STORAGE_DIR = ROOT;

describe('TOTVS dispatch storage', () => {
  beforeEach(() => {
    fs.rmSync(ROOT, { recursive: true, force: true });
    fs.mkdirSync(ROOT, { recursive: true });
    jest.resetModules();
  });

  it('isola dispatches por tenant e salva request/response', async () => {
    const { TotvsDispatchStorage } = await import('../totvs-dispatch-storage');

    const item = TotvsDispatchStorage.create({
      tenantId: 'tenant-a',
      configId: 'cfg-1',
      dataType: 'FUEL_JOURNEY',
      referenceId: 'journey-1',
      journeyId: 'journey-1',
      fleetCode: '770',
      comboioFleetCode: '770',
      operatorRegistration: '01',
      driverRegistration: '00125',
      attempts: 0,
      maxAttempts: 3,
      status: 'PENDING',
      createdBy: 'Robson',
    });

    TotvsDispatchStorage.create({
      tenantId: 'tenant-b',
      configId: 'cfg-2',
      dataType: 'FUELINGS',
      attempts: 0,
      maxAttempts: 3,
      status: 'PENDING',
    });

    expect(TotvsDispatchStorage.listByTenant('tenant-a')).toHaveLength(1);
    expect(TotvsDispatchStorage.listByTenant('tenant-b')).toHaveLength(1);

    const requestPath = TotvsDispatchStorage.writeRequestPayload('tenant-a', item.id, { ok: true });
    const responsePath = TotvsDispatchStorage.writeResponsePayload('tenant-a', item.id, { received: true });
    expect(fs.existsSync(requestPath)).toBe(true);
    expect(fs.existsSync(responsePath)).toBe(true);
    expect(requestPath.includes('tenant-a')).toBe(true);
    expect(responsePath.includes('tenant-a')).toBe(true);
  });

  it('sanitiza o id do dispatch nos caminhos de payload', async () => {
    const { TotvsDispatchStorage } = await import('../totvs-dispatch-storage');
    const requestPath = TotvsDispatchStorage.getRequestPath('tenant-a', '../evil');
    expect(requestPath.includes('..')).toBe(false);
    expect(requestPath.includes('tenant-a')).toBe(true);
  });
});
