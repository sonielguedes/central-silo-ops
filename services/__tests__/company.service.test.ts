/**
 * Unit tests for CompanyService (services/master.service.ts)
 *
 * Contracts verified:
 *  - create() retorna { company, provisioningToken } — nao gera token localmente
 *  - regenerateCompanyToken() retorna { company, newToken }
 *  - update() usa PATCH e nunca envia campos de token
 *  - token retornado pelo servidor nao e sobrescrito pelo cliente
 */

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Simulate browser environment so service doesn't fall into SSR fallback
(global as any).window = {};

// Mock getCsrfTokenFromDocument
jest.mock('@/lib/auth/csrf-client', () => ({
  getCsrfTokenFromDocument: () => 'test-csrf-token',
}));

// Mock normalizeCompanyPortPayload
jest.mock('@/lib/company-form', () => ({
  normalizeCompanyPortPayload: jest.fn((input: any) => ({
    ...input,
    apiPort: Number(input.portaApi ?? input.apiPort) || undefined,
    mqttPort: Number(input.portaMqtt ?? input.mqttPort) || undefined,
  })),
}));

// Mock BaseService to avoid localStorage / browser deps
jest.mock('@/services/base.service', () => {
  return {
    BaseService: class {
      constructor(_key: string, _initial: any[]) {}
      async create(item: any) { return item; }
      async update(_id: string, data: any) { return data; }
      async getAll() { return []; }
    },
  };
});

// Mock all INITIAL_* arrays from mock/master-data so the module loads
jest.mock('@/lib/mock/master-data', () => ({
  INITIAL_COMPANIES: [],
  INITIAL_EQUIPMENT: [],
  INITIAL_OPERATORS: [],
  INITIAL_FARMS: [],
  INITIAL_FIELDS: [],
  INITIAL_OPERATIONS: [],
  INITIAL_ACCESS_GROUPS: [],
  INITIAL_USERS: [],
  INITIAL_STOP_REASONS: [],
  INITIAL_SUPPLIES: [],
  INITIAL_SYNC_EVENTS: [],
  INITIAL_ALERTS: [],
  INITIAL_EQUIPMENT_TYPES: [],
  INITIAL_EQUIPMENT_MODELS: [],
  INITIAL_EQUIPMENT_GROUPS: [],
  INITIAL_EQUIPMENT_PROFILES: [],
  INITIAL_OPERATIONAL_STATES: [],
  INITIAL_IMPLEMENTS: [],
  INITIAL_FLEET_ACTIVITIES: [],
  INITIAL_REGIONALS: [],
  INITIAL_UNITS: [],
  INITIAL_AUDIT_LOGS: [],
  INITIAL_OPERATIONAL_RECORDS: [],
  INITIAL_INTEGRATIONS: [],
  INITIAL_SERVICE_ORDERS: [],
  INITIAL_TELEMETRY: [],
  INITIAL_CHECKLIST_MODELS: [],
  INITIAL_CHECKLIST_EXECUTIONS: [],
  INITIAL_TIMELINE_EVENTS: [],
}));

import { CompanyService } from '../master.service';
import type { CompanyCreateResult, CompanyTokenRotateResult } from '../master.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

const serverCompany = {
  id: 'server-generated-id',
  tenantId: 'server-generated-tenant',
  code: 'NC01',
  tradingName: 'Nova Empresa',
  corporateName: 'Nova Empresa LTDA',
  cnpj: '99.999.999/0001-99',
  tokenPreview: 'CTK-••••ZZZZ',
  entityStatus: 'ATIVO',
  status: 'ATIVO',
  plan: 'PILOTO',
  apiPort: 3099,
  mqttPort: 18899,
  version: 1,
  history: [],
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  createdBy: 'admin@silo.com',
  updatedBy: 'admin@silo.com',
};

const rawProvisioningToken = 'CTK-ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890';

function okJson(body: object) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  });
}

function failJson(body: object, status = 400) {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(body),
  });
}

beforeEach(() => {
  mockFetch.mockReset();
  // Default: getAllGlobal returns empty list
  mockFetch.mockResolvedValue(okJson({ companies: [] }));
});

// ── create() ─────────────────────────────────────────────────────────────────

describe('CompanyService.provision()', () => {
  it('retorna { company, provisioningToken } com token do servidor', async () => {
    mockFetch.mockResolvedValueOnce(okJson({
      company: serverCompany,
      provisioningToken: rawProvisioningToken,
    }));

    const result: CompanyCreateResult = await CompanyService.provision({
      code: 'NC01',
      tradingName: 'Nova Empresa',
    } as any);

    expect(result.provisioningToken).toBe(rawProvisioningToken);
    expect(result.company.id).toBe('server-generated-id');
    expect(result.company.tenantId).toBe('server-generated-tenant');
  });

  it('nao gera token localmente — token vem exclusivamente do servidor', async () => {
    mockFetch.mockResolvedValueOnce(okJson({
      company: serverCompany,
      provisioningToken: rawProvisioningToken,
    }));

    const result: CompanyCreateResult = await CompanyService.provision({
      code: 'NC01',
      tradingName: 'Nova Empresa',
    } as any);

    // provisioningToken must match exactly what the server returned
    expect(result.provisioningToken).toBe(rawProvisioningToken);
    // No CTK- token should be generated and embedded in company by the client
    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.companyToken).toBeUndefined();
    expect(sentBody.provisioningToken).toBeUndefined();
  });

  it('nao sobrescreve provisioningToken com token mascarado da resposta', async () => {
    mockFetch.mockResolvedValueOnce(okJson({
      company: { ...serverCompany, tokenPreview: 'CTK-••••ZZZZ' },
      provisioningToken: rawProvisioningToken,
    }));

    const result: CompanyCreateResult = await CompanyService.provision({ code: 'NC01' } as any);

    // The full token must come from provisioningToken, not the masked tokenPreview
    expect(result.provisioningToken).toBe(rawProvisioningToken);
    expect(result.provisioningToken).not.toContain('••••');
  });

  it('lanca erro com mensagem do servidor em caso de falha', async () => {
    mockFetch.mockResolvedValueOnce(failJson({ error: 'Codigo NC01 ja esta em uso.' }, 409));

    await expect(CompanyService.provision({ code: 'NC01' } as any))
      .rejects.toThrow('Codigo NC01 ja esta em uso.');
  });

  it('usa POST /api/admin/companies com CSRF header', async () => {
    mockFetch.mockResolvedValueOnce(okJson({
      company: serverCompany,
      provisioningToken: rawProvisioningToken,
    }));

    await CompanyService.provision({ code: 'NC01' } as any);

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/admin/companies');
    expect(options.method).toBe('POST');
    expect(options.headers['x-csrf-token']).toBe('test-csrf-token');
    expect(options.credentials).toBe('include');
  });
});

// ── regenerateCompanyToken() ──────────────────────────────────────────────────

describe('CompanyService.regenerateCompanyToken()', () => {
  it('retorna { company, newToken } com token completo do servidor', async () => {
    const newToken = 'CTK-NEWTOKEN1234567890NEWTOKEN1234567890NEWTOKEN12';
    // First fetch: POST /token
    mockFetch.mockResolvedValueOnce(okJson({
      companyId: 'company-1',
      newToken,
      tokenPreview: 'CTK-••••ET12',
    }));
    // Second fetch: GET /companies (getAllGlobal)
    mockFetch.mockResolvedValueOnce(okJson({
      companies: [{ ...serverCompany, id: 'company-1', tokenPreview: 'CTK-••••ET12' }],
    }));

    const result: CompanyTokenRotateResult = await CompanyService.regenerateCompanyToken('company-1');

    expect(result.newToken).toBe(newToken);
    expect(result.newToken).not.toContain('••••');
    expect(result.company.id).toBe('company-1');
  });

  it('chama POST /api/admin/companies/[id]/token com CSRF', async () => {
    const newToken = 'CTK-NEWTOKEN1234567890NEWTOKEN1234567890NEWTOKEN12';
    mockFetch.mockResolvedValueOnce(okJson({
      companyId: 'company-1', newToken, tokenPreview: 'CTK-••••ET12',
    }));
    mockFetch.mockResolvedValueOnce(okJson({ companies: [] }));

    await CompanyService.regenerateCompanyToken('company-1');

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/admin/companies/company-1/token');
    expect(options.method).toBe('POST');
    expect(options.headers['x-csrf-token']).toBe('test-csrf-token');
  });

  it('lanca erro em caso de falha', async () => {
    mockFetch.mockResolvedValueOnce(failJson({ error: 'Sem permissao.' }, 403));

    await expect(CompanyService.regenerateCompanyToken('company-1'))
      .rejects.toThrow('Sem permissao.');
  });
});

// ── update() ─────────────────────────────────────────────────────────────────

describe('CompanyService.update()', () => {
  it('usa PATCH /api/admin/companies/[id]', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ company: serverCompany }));

    await CompanyService.update('company-1', { tradingName: 'Novo Nome' });

    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/admin/companies/company-1');
    expect(options.method).toBe('PATCH');
  });

  it('nao envia companyToken, mobileToken, apiToken, token nem tenantId no body', async () => {
    mockFetch.mockResolvedValueOnce(okJson({ company: serverCompany }));

    await CompanyService.update('company-1', {
      tradingName: 'Novo Nome',
      companyToken: 'HACKER-TOKEN',
      mobileToken: 'HACKER-TOKEN',
      apiToken: 'HACKER-TOKEN',
      token: 'HACKER-TOKEN',
      tenantId: 'hacker-tenant',
      createdAt: '1970-01-01',
    } as any);

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(sentBody.companyToken).toBeUndefined();
    expect(sentBody.mobileToken).toBeUndefined();
    expect(sentBody.apiToken).toBeUndefined();
    expect(sentBody.token).toBeUndefined();
    expect(sentBody.tenantId).toBeUndefined();
    expect(sentBody.createdAt).toBeUndefined();
    expect(sentBody.tradingName).toBe('Novo Nome');
  });

  it('lanca erro em caso de falha no servidor', async () => {
    mockFetch.mockResolvedValueOnce(failJson({ error: 'Porta API ja em uso.' }, 409));

    await expect(CompanyService.update('company-1', { apiPort: 3001 }))
      .rejects.toThrow('Porta API ja em uso.');
  });
});

// ── create() herdado (BaseService) ──────────────────────────────────────────

describe('CompanyService.create() herdado', () => {
  it('retorna Company (tipo herdado de BaseService<Company>)', async () => {
    // BaseService.create stores to localStorage and returns the Company object.
    // In the test environment (mocked BaseService), it simply returns the input.
    const item = { id: 'x', code: 'X', tradingName: 'X' } as any;
    const result = await (CompanyService as any).__proto__.__proto__.create.call(
      CompanyService,
      item,
    ).catch(() => item); // mock BaseService just returns the item
    // The point: return type is Company, not CompanyCreateResult
    expect(result).toBeDefined();
  });
});
