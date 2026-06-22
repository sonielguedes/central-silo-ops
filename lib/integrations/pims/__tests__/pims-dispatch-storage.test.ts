import fs from 'fs';
import os from 'os';
import path from 'path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-pims-dispatch-'));
process.env.SILO_STORAGE_DIR = root;

describe('PIMS dispatch storage', () => {
  beforeEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    jest.resetModules();
  });

  it('persiste dispatch, request e response por tenant', async () => {
    const { PimsDispatchStorage } = await import('@/lib/integrations/pims/pims-dispatch-storage');

    const created = PimsDispatchStorage.create({
      tenantId: 'tenant-a',
      configId: 'cfg-1',
      targetDataType: 'FULL_OPERATIONAL_PACKAGE',
      periodStart: '2026-06-22',
      periodEnd: '2026-06-22',
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 3,
      mockMode: true,
      requestPath: '',
      responsePath: '',
      createdBy: 'user-1',
    });

    const requestFile = PimsDispatchStorage.writeRequestPayload('tenant-a', created.id, { foo: 'bar' });
    const responseFile = PimsDispatchStorage.writeResponsePayload('tenant-a', created.id, { ok: true });

    expect(requestFile).toContain('request.json');
    expect(responseFile).toContain('response.json');
    expect(PimsDispatchStorage.getById('tenant-a', created.id)?.mockMode).toBe(true);
    expect(JSON.parse(fs.readFileSync(requestFile, 'utf-8'))).toEqual({ foo: 'bar' });
    expect(JSON.parse(fs.readFileSync(responseFile, 'utf-8'))).toEqual({ ok: true });
    expect(PimsDispatchStorage.listByTenant('tenant-b')).toEqual([]);
  });

  it('não cruza leitura entre tenants', async () => {
    const { PimsDispatchStorage } = await import('@/lib/integrations/pims/pims-dispatch-storage');

    PimsDispatchStorage.create({
      tenantId: 'tenant-a',
      configId: 'cfg-1',
      targetDataType: 'FULL_OPERATIONAL_PACKAGE',
      periodStart: '2026-06-22',
      periodEnd: '2026-06-22',
      status: 'PENDING',
      attempts: 0,
      maxAttempts: 3,
      mockMode: false,
      requestPath: '',
      responsePath: '',
      createdBy: 'user-1',
    });

    expect(PimsDispatchStorage.listByTenant('tenant-a').length).toBe(1);
    expect(PimsDispatchStorage.listByTenant('tenant-b').length).toBe(0);
  });
});
