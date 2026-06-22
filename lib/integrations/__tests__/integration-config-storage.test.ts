import fs from 'fs';
import os from 'os';
import path from 'path';

const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'silo-integrations-'));
process.env.SILO_STORAGE_DIR = TMP_ROOT;
process.env.SILO_AUTH_SECRET = 'test-secret';
process.env.NEXTAUTH_SECRET = 'test-secret';

let IntegrationConfigStorage: typeof import('../integration-config-storage').IntegrationConfigStorage;

beforeAll(async () => {
  ({ IntegrationConfigStorage } = await import('../integration-config-storage'));
});

beforeEach(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
  fs.mkdirSync(TMP_ROOT, { recursive: true });
});

describe('IntegrationConfigStorage', () => {
  it('creates, lists and masks secrets per tenant', () => {
    const created = IntegrationConfigStorage.create('tenant-a', {
      system: 'PIMS',
      name: 'PIMS Homologação',
      environment: 'HOMOLOGACAO',
      baseUrl: 'https://pims.example.com/api',
      authType: 'BEARER_TOKEN',
      bearerToken: 'super-secret-token',
      timeoutMs: 15000,
      retryCount: 3,
      status: 'INACTIVE',
    }, { userId: 'usr-1', userName: 'Robson', userRole: 'ADMIN_EMPRESA' });

    expect(created.tenantId).toBe('tenant-a');
    expect(created.hasBearerToken).toBe(true);
    expect(created.bearerTokenMasked).toContain('****');
    expect(created).not.toHaveProperty('bearerToken');

    const items = IntegrationConfigStorage.listByTenant('tenant-a');
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(created.id);
    expect(items[0].hasBearerToken).toBe(true);
    expect(items[0]).not.toHaveProperty('bearerToken');
    expect(items[0].tenantId).toBe('tenant-a');
  });

  it('updates without exposing secrets and keeps tenant isolation', () => {
    const created = IntegrationConfigStorage.create('tenant-a', {
      system: 'TOTVS',
      name: 'TOTVS Produção',
      environment: 'PRODUCAO',
      baseUrl: 'https://totvs.example.com/api',
      authType: 'API_KEY',
      apiKey: 'abc123',
      timeoutMs: 12000,
      retryCount: 2,
      status: 'ACTIVE',
    }, { userId: 'usr-1', userName: 'Robson', userRole: 'GESTOR' });

    const updated = IntegrationConfigStorage.update('tenant-a', created.id, {
      name: 'TOTVS Produção 2',
      status: 'INACTIVE',
    }, { userId: 'usr-2', userName: 'Ana', userRole: 'SUPORTE' });

    expect(updated.name).toBe('TOTVS Produção 2');
    expect(updated.status).toBe('INACTIVE');
    expect(updated.hasApiKey).toBe(true);
    expect(updated).not.toHaveProperty('apiKey');

    expect(() => IntegrationConfigStorage.update('tenant-b', created.id, { name: 'x' }, { userId: 'usr-2', userName: 'Ana', userRole: 'SUPORTE' }))
      .toThrow(/Configuracao nao encontrada/);
  });

  it('inactivates a config and records test status metadata', () => {
    const created = IntegrationConfigStorage.create('tenant-a', {
      system: 'EXPORTACAO',
      name: 'Exportações',
      environment: 'HOMOLOGACAO',
      baseUrl: 'https://exports.example.com/api',
      authType: 'NONE',
      timeoutMs: 8000,
      retryCount: 1,
      status: 'ACTIVE',
    }, { userId: 'usr-1', userName: 'Robson', userRole: 'ADMIN_EMPRESA' });

    const deactivated = IntegrationConfigStorage.deactivate('tenant-a', created.id, { userId: 'usr-3', userName: 'Maria', userRole: 'GESTOR' });
    expect(deactivated.status).toBe('INACTIVE');

    const tested = IntegrationConfigStorage.updateConnectionStatus('tenant-a', created.id, {
      status: 'SUCCESS',
      message: 'OK',
    }, { userId: 'usr-3', userName: 'Maria', userRole: 'GESTOR' });

    expect(tested.lastConnectionStatus).toBe('SUCCESS');
    expect(tested.lastConnectionMessage).toBe('OK');
    expect(tested.lastConnectionTestAt).toBeDefined();
  });
});
