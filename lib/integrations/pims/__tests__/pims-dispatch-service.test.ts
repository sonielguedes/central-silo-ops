import fs from 'fs';
import os from 'os';
import path from 'path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-pims-service-'));
process.env.SILO_STORAGE_DIR = root;
process.env.SILO_AUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_SECRET = 'test-secret';

describe('PIMS dispatch service', () => {
  beforeEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.mkdirSync(root, { recursive: true });
    jest.resetModules();
  });

  it('bloqueia configuracao de producao', async () => {
    const { IntegrationConfigStorage } = await import('@/lib/integrations/integration-config-storage');
    const { sendPimsDispatch } = await import('@/lib/integrations/pims/pims-dispatch-service');

    const config = IntegrationConfigStorage.create('tenant-a', {
      system: 'PIMS',
      name: 'PIMS Produção',
      environment: 'PRODUCAO',
      baseUrl: 'https://pims.example.com',
      authType: 'NONE',
      timeoutMs: 5000,
      retryCount: 0,
      status: 'ACTIVE',
    }, { userId: 'u-1', userName: 'User 1', userRole: 'ADMIN_EMPRESA' });

    const result = await sendPimsDispatch({
      tenantId: 'tenant-a',
      configId: config.id,
      periodStart: '2026-06-22',
      periodEnd: '2026-06-22',
      targetDataType: 'FULL_OPERATIONAL_PACKAGE',
      mockMode: true,
      actor: 'User 1',
    }, { validate: async () => ({ status: 'SUCCESS', issues: [] }) });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected failure');
    expect(result.error).toBe('PIMS_PRODUCTION_BLOCKED');
  });

  it('exige homologacao ativa quando nao ha configuracao homolog', async () => {
    const { IntegrationConfigStorage } = await import('@/lib/integrations/integration-config-storage');
    const { sendPimsDispatch } = await import('@/lib/integrations/pims/pims-dispatch-service');

    IntegrationConfigStorage.create('tenant-a', {
      system: 'PIMS',
      name: 'PIMS Produção',
      environment: 'PRODUCAO',
      baseUrl: 'https://pims.example.com',
      authType: 'NONE',
      timeoutMs: 5000,
      retryCount: 0,
      status: 'ACTIVE',
    }, { userId: 'u-1', userName: 'User 1', userRole: 'ADMIN_EMPRESA' });

    const result = await sendPimsDispatch({
      tenantId: 'tenant-a',
      periodStart: '2026-06-22',
      periodEnd: '2026-06-22',
      targetDataType: 'FULL_OPERATIONAL_PACKAGE',
      mockMode: true,
      actor: 'User 1',
    }, { validate: async () => ({ status: 'SUCCESS', issues: [] }) });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected failure');
    expect(result.error).toBe('PIMS_HOMOLOG_CONFIG_NOT_FOUND');
  });

  it('bloqueia envio quando a pre-validacao nao encontra dados operacionais', async () => {
    const { IntegrationConfigStorage } = await import('@/lib/integrations/integration-config-storage');
    const { sendPimsDispatch } = await import('@/lib/integrations/pims/pims-dispatch-service');

    IntegrationConfigStorage.create('tenant-a', {
      system: 'PIMS',
      name: 'PIMS Homologação',
      environment: 'HOMOLOGACAO',
      baseUrl: 'https://pims-hml.example.com',
      authType: 'NONE',
      timeoutMs: 5000,
      retryCount: 0,
      status: 'ACTIVE',
    }, { userId: 'u-1', userName: 'User 1', userRole: 'ADMIN_EMPRESA' });

    const result = await sendPimsDispatch({
      tenantId: 'tenant-a',
      periodStart: '2026-06-22',
      periodEnd: '2026-06-22',
      targetDataType: 'FULL_OPERATIONAL_PACKAGE',
      mockMode: true,
      actor: 'User 1',
    }, {
      validate: async () => ({
        status: 'WARNING',
        issues: [{ type: 'MISSING_REQUIRED_FIELD', message: 'Nenhum registro operacional encontrado para o filtro informado.' }],
      }),
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error('expected failure');
    expect(result.error).toBe('NO_OPERATIONAL_DATA');
  });

  it('salva request.json, response.json, job e logs no envio mockado', async () => {
    const { IntegrationConfigStorage } = await import('@/lib/integrations/integration-config-storage');
    const { IntegrationJobStorage } = await import('@/lib/integrations/integration-job-storage');
    const { IntegrationLogStorage } = await import('@/lib/integrations/integration-log-storage');
    const { sendPimsDispatch } = await import('@/lib/integrations/pims/pims-dispatch-service');

    const config = IntegrationConfigStorage.create('tenant-a', {
      system: 'PIMS',
      name: 'PIMS Homologação',
      environment: 'HOMOLOGACAO',
      baseUrl: 'https://pims-hml.example.com',
      authType: 'API_KEY',
      apiKey: 'sekret',
      timeoutMs: 5000,
      retryCount: 0,
      status: 'ACTIVE',
    }, { userId: 'u-1', userName: 'User 1', userRole: 'ADMIN_EMPRESA' });

    const result = await sendPimsDispatch({
      tenantId: 'tenant-a',
      periodStart: '2026-06-22',
      periodEnd: '2026-06-22',
      targetDataType: 'FULL_OPERATIONAL_PACKAGE',
      mockMode: true,
      actor: 'User 1',
      referenceId: 'ref-1',
    }, {
      validate: async () => ({ status: 'SUCCESS', issues: [] }),
      loadOperationalRecords: async () => ([{ fleetCode: '2026', liters: 12.5 }]),
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error('expected success');
    expect(result.dispatch.status).toBe('SUCCESS');
    expect(IntegrationJobStorage.listByTenant('tenant-a', { system: 'PIMS' }).length).toBe(1);
    expect(IntegrationLogStorage.listByTenant('tenant-a', { system: 'PIMS' }).length).toBeGreaterThan(0);
    expect(fs.readFileSync(result.requestPath, 'utf-8')).toContain('2026');
    expect(fs.readFileSync(result.requestPath, 'utf-8')).not.toContain('sekret');
    expect(JSON.parse(fs.readFileSync(result.responsePath, 'utf-8')).status).toBe(200);
    expect(result.dispatch.configId).toBe(config.id);
  });
});
