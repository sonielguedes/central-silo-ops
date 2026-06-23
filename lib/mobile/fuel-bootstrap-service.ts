import fs from 'node:fs';
import path from 'node:path';

export const FUEL_BOOTSTRAP_SCHEMA_VERSION = 1 as const;

type AnyRecord = Record<string, unknown>;

export interface FuelBootstrapCompanyLike {
  tenantId: string;
  code: string;
  status?: string;
  mobileEnabled?: boolean;
}

export interface FuelBootstrapSourceOptions {
  tenantId: string;
  companyCode: string;
  syncedAt?: string;
}

export interface FuelBootstrapPayload {
  success: true;
  tenantId: string;
  companyCode: string;
  syncedAt: string;
  version: 1;
  fleets: FleetItem[];
  drivers: PersonItem[];
  operators: PersonItem[];
  attendants: PersonItem[];
  products: ProductItem[];
  pumps: PumpItem[];
  comboios: ComboioItem[];
  metadata: {
    source: 'SILO_OPS_CENTRAL';
    appModule: 'FUEL_CONTROL';
    appName: 'SILO FuelControl';
    schemaVersion: 1;
  };
}

export interface FleetItem {
  fleetCode: string;
  description: string;
  type: string;
  active: boolean;
  canReceiveFuel: boolean;
  lastKm: number | null;
  lastHourmeter: number | null;
  updatedAt: string;
}

export interface PersonItem {
  registration: string;
  name: string;
  active: boolean;
  role: 'MOTORISTA' | 'OPERADOR' | 'FRENTISTA';
  updatedAt: string;
}

export interface ProductItem {
  productCode: string;
  description: string;
  unit: 'L';
  active: boolean;
  updatedAt: string;
}

export interface PumpItem {
  pumpCode: string;
  description: string;
  registerNumber: string | null;
  productCode: string;
  currentReading: number | null;
  active: boolean;
  updatedAt: string;
}

export interface ComboioItem {
  fleetCode: string;
  description: string;
  tankCapacity: number | null;
  pumpCode: string | null;
  active: boolean;
  updatedAt: string;
}

type RequestErrorBody = {
  success: false;
  errorCode: string;
  message: string;
};

type RequestResult =
  | { status: 200; body: FuelBootstrapPayload }
  | { status: 400 | 401 | 403; body: RequestErrorBody };

type RequestContext = {
  headers: Headers;
  lookupCompanyByToken: (token: string) => FuelBootstrapCompanyLike | undefined;
  canUseCompany?: (company: FuelBootstrapCompanyLike) => { allowed: boolean; code?: string; message?: string };
  syncedAt?: string;
};

const REQUIRED_HEADERS = ['x-company-token', 'x-tenant-id', 'x-company-code', 'x-app-module', 'x-app-name'] as const;
const DEFAULT_PRODUCT: ProductItem = {
  productCode: 'DIESEL_S10',
  description: 'Diesel S-10',
  unit: 'L',
  active: true,
  updatedAt: new Date(0).toISOString(),
};

function storageRoot(): string {
  return (
    process.env.SILO_STORAGE_DIR ||
    process.env.SILO_DATA_DIR ||
    (process.env.NODE_ENV === 'production' ? '/app/data' : './data')
  );
}

function tenantDir(tenantId: string): string {
  return path.join(storageRoot(), tenantId);
}

function readJsonArray(filePath: string): AnyRecord[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? (parsed as AnyRecord[]) : [];
  } catch {
    return [];
  }
}

function readTenantFile(tenantId: string, fileName: string): AnyRecord[] {
  return readJsonArray(path.join(tenantDir(tenantId), fileName));
}

function toStringValue(value: unknown): string {
  return value == null ? '' : String(value).trim();
}

function toNullableString(value: unknown): string | null {
  const str = toStringValue(value);
  return str ? str : null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function isActiveRecord(item: AnyRecord): boolean {
  const entityStatus = toStringValue(item.entityStatus || 'ATIVO').toUpperCase();
  const status = toStringValue(item.status).toUpperCase();
  return entityStatus !== 'INATIVO' && entityStatus !== 'ARQUIVADO' && status !== 'INATIVO' && status !== 'ARQUIVADO' && !item.deletedAt;
}

function updatedAtOf(item: AnyRecord, fallback: string): string {
  return toStringValue(item.updatedAt || item.createdAt || fallback) || fallback;
}

function normalizeRole(role: unknown): PersonItem['role'] | null {
  const value = toStringValue(role).toUpperCase();
  if (!value) return null;
  if (value.includes('FRENT')) return 'FRENTISTA';
  if (value.includes('MOTOR') || value.includes('CONDUTOR') || value.includes('DRIVER')) return 'MOTORISTA';
  if (value.includes('OPERADOR') || value.includes('MÁQUINA') || value.includes('MAQUINA') || value.includes('OPERATOR')) return 'OPERADOR';
  return null;
}

function inferFleetType(item: AnyRecord): string {
  const direct = toStringValue(item.type || item.operationalType || item.category);
  if (direct) return direct;

  const code = toStringValue(item.code || item.fleetCode).toUpperCase();
  const name = toStringValue(item.name || item.description).toUpperCase();
  const probe = `${code} ${name}`;

  if (probe.includes('COMBOIO')) return 'COMBOIO';
  if (probe.includes('BOMBA')) return 'BOMBA';
  if (probe.includes('PIPA')) return 'CAMINHAO_PIPA';
  if (probe.includes('CAMINH') || probe.startsWith('CAM')) return 'COMBOIO';
  if (probe.includes('COLH')) return 'COLHEDORA';
  if (probe.includes('TRATOR') || probe.startsWith('TR-') || probe.startsWith('TR ')) return 'TRATOR';
  if (probe.includes('PULVER')) return 'PULVERIZADOR';
  return 'EQUIPAMENTO';
}

function isComboioCandidate(item: AnyRecord): boolean {
  const code = toStringValue(item.code || item.fleetCode).toUpperCase();
  const name = toStringValue(item.name || item.description).toUpperCase();
  const probe = `${code} ${name}`;
  return probe.includes('COMBOIO') || probe.includes('CAMINH') || code.startsWith('CAM');
}

function isPumpCandidate(item: AnyRecord): boolean {
  const code = toStringValue(item.code || item.pumpCode).toUpperCase();
  const name = toStringValue(item.name || item.description).toUpperCase();
  const probe = `${code} ${name}`;
  return probe.includes('BOMBA') || probe.includes('MEDIDOR');
}

function normalizeProductCode(raw: AnyRecord): string {
  const code = toStringValue(raw.productCode || raw.code || raw.sku || raw.id).toUpperCase();
  const description = toStringValue(raw.description || raw.name).toUpperCase();
  const probe = `${code} ${description}`;
  if (probe.includes('DIESEL') && !probe.includes('S500') && !probe.includes('S-500') && !probe.includes('S 500')) {
    return 'DIESEL_S10';
  }
  return code || 'DIESEL_S10';
}

function normalizeProductDescription(raw: AnyRecord, productCode: string): string {
  if (productCode === 'DIESEL_S10') return 'Diesel S-10';
  return toStringValue(raw.description || raw.name || productCode) || productCode;
}

function normalizeProducts(items: AnyRecord[], fallbackUpdatedAt: string): ProductItem[] {
  const mapped = items
    .filter(isActiveRecord)
    .map((item) => {
      const productCode = normalizeProductCode(item);
      const description = normalizeProductDescription(item, productCode);
      return {
        productCode,
        description,
        unit: 'L' as const,
        active: true,
        updatedAt: updatedAtOf(item, fallbackUpdatedAt),
      };
    });

  const byCode = new Map<string, ProductItem>();
  for (const item of mapped) {
    byCode.set(item.productCode, item);
  }
  if (!byCode.has('DIESEL_S10')) {
    byCode.set('DIESEL_S10', { ...DEFAULT_PRODUCT, updatedAt: fallbackUpdatedAt });
  } else {
    byCode.set('DIESEL_S10', { ...byCode.get('DIESEL_S10')!, productCode: 'DIESEL_S10', description: 'Diesel S-10', unit: 'L', active: true });
  }
  return [...byCode.values()].sort((a, b) => a.productCode.localeCompare(b.productCode));
}

function normalizeFleets(items: AnyRecord[], fallbackUpdatedAt: string): FleetItem[] {
  return items
    .filter(isActiveRecord)
    .map((item) => ({
      fleetCode: toStringValue(item.code || item.fleetCode || item.id),
      description: toStringValue(item.name || item.description || item.brand || item.code || item.fleetCode),
      type: inferFleetType(item),
      active: true,
      canReceiveFuel: item.mobileEnabled !== false && item.mobileEnabled !== 'false',
      lastKm: toNullableNumber(item.lastKm ?? item.km ?? item.odometer ?? item.mileage),
      lastHourmeter: toNullableNumber(item.lastHourmeter ?? item.hourmeter ?? item.hourmeterCurrent),
      updatedAt: updatedAtOf(item, fallbackUpdatedAt),
    }))
    .filter((item) => item.fleetCode.length > 0)
    .sort((a, b) => a.fleetCode.localeCompare(b.fleetCode));
}

function normalizePeople(items: AnyRecord[], fallbackUpdatedAt: string): PersonItem[] {
  const out: PersonItem[] = [];
  for (const item of items) {
    if (!isActiveRecord(item)) continue;
    const role = normalizeRole(item.role || item.cargo || item.position || item.jobTitle);
    if (!role) continue;
    const registration = toStringValue(item.registration || item.matricula || item.code || item.id);
    if (!registration) continue;
    out.push({
      registration,
      name: toStringValue(item.name || item.fullName || item.displayName || registration),
      active: true,
      role,
      updatedAt: updatedAtOf(item, fallbackUpdatedAt),
    });
  }
  return out.sort((a, b) => a.registration.localeCompare(b.registration));
}

function normalizeAttendants(items: AnyRecord[], fallbackUpdatedAt: string): PersonItem[] {
  const out: PersonItem[] = [];
  for (const item of items) {
    if (!isActiveRecord(item)) continue;
    const role = normalizeRole(item.role || item.cargo || item.position || item.jobTitle);
    const registration = toStringValue(item.registration || item.matricula || item.code || item.id);
    if (!registration || role !== 'FRENTISTA') continue;
    out.push({
      registration,
      name: toStringValue(item.name || item.fullName || item.displayName || registration),
      active: true,
      role: 'FRENTISTA',
      updatedAt: updatedAtOf(item, fallbackUpdatedAt),
    });
  }
  return out.sort((a, b) => a.registration.localeCompare(b.registration));
}

function normalizePumps(items: AnyRecord[], fallbackUpdatedAt: string): PumpItem[] {
  const out: PumpItem[] = [];
  for (const item of items) {
    if (!isActiveRecord(item) || !isPumpCandidate(item)) continue;
    const pumpCode = toStringValue(item.pumpCode || item.code || item.fleetCode || item.id);
    if (!pumpCode) continue;
    out.push({
      pumpCode,
      description: toStringValue(item.description || item.name || pumpCode),
      registerNumber: toNullableString(item.registerNumber || item.registration || item.plaque),
      productCode: toStringValue(item.productCode || item.fuelProductCode || 'DIESEL_S10') || 'DIESEL_S10',
      currentReading: toNullableNumber(item.currentReading || item.reading || item.meterReading),
      active: true,
      updatedAt: updatedAtOf(item, fallbackUpdatedAt),
    });
  }
  return out.sort((a, b) => a.pumpCode.localeCompare(b.pumpCode));
}

function normalizeComboios(items: AnyRecord[], fallbackUpdatedAt: string): ComboioItem[] {
  const out: ComboioItem[] = [];
  for (const item of items) {
    if (!isActiveRecord(item) || !isComboioCandidate(item)) continue;
    const fleetCode = toStringValue(item.code || item.fleetCode || item.id);
    if (!fleetCode) continue;
    out.push({
      fleetCode,
      description: toStringValue(item.name || item.description || fleetCode),
      tankCapacity: toNullableNumber(item.tankCapacity || item.capacity || item.tanqueCapacity || item.tanqueCapacidade),
      pumpCode: toNullableString(item.pumpCode || item.relatedPumpCode || item.bombaCode),
      active: true,
      updatedAt: updatedAtOf(item, fallbackUpdatedAt),
    });
  }
  return out.sort((a, b) => a.fleetCode.localeCompare(b.fleetCode));
}

export function buildFuelBootstrapPayload(opts: FuelBootstrapSourceOptions): FuelBootstrapPayload {
  const syncedAt = opts.syncedAt || new Date().toISOString();
  const fallbackUpdatedAt = syncedAt;

  const equipments = readTenantFile(opts.tenantId, 'cadastro-equipamentos.json');
  const operators = readTenantFile(opts.tenantId, 'cadastro-operadores.json');
  const frentistas = readTenantFile(opts.tenantId, 'cadastro-frentistas.json');
  const products = readTenantFile(opts.tenantId, 'cadastro-produtos.json');
  const pumps = readTenantFile(opts.tenantId, 'cadastro-bombas.json');
  const comboios = readTenantFile(opts.tenantId, 'cadastro-comboios.json');

  const fleets = normalizeFleets(equipments, fallbackUpdatedAt);
  const driverList = normalizePeople(operators, fallbackUpdatedAt).filter((item) => item.role === 'MOTORISTA');
  const operatorList = normalizePeople(operators, fallbackUpdatedAt).filter((item) => item.role === 'OPERADOR');
  const attendantList = [
    ...normalizeAttendants(operators, fallbackUpdatedAt),
    ...normalizeAttendants(frentistas, fallbackUpdatedAt),
  ]
    .filter((item, index, arr) => arr.findIndex((other) => other.registration === item.registration) === index)
    .sort((a, b) => a.registration.localeCompare(b.registration));

  const productList = normalizeProducts(products, fallbackUpdatedAt);
  const pumpList = normalizePumps(pumps, fallbackUpdatedAt);
  const comboioList = normalizeComboios(comboios, fallbackUpdatedAt);

  return {
    success: true,
    tenantId: opts.tenantId,
    companyCode: opts.companyCode,
    syncedAt,
    version: 1,
    fleets,
    drivers: driverList,
    operators: operatorList,
    attendants: attendantList,
    products: productList,
    pumps: pumpList,
    comboios: comboioList,
    metadata: {
      source: 'SILO_OPS_CENTRAL',
      appModule: 'FUEL_CONTROL',
      appName: 'SILO FuelControl',
      schemaVersion: FUEL_BOOTSTRAP_SCHEMA_VERSION,
    },
  };
}

function headerValue(headers: Headers, key: string): string | null {
  const value = headers.get(key);
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed : null;
}

function missingRequiredHeaders(headers: Headers): boolean {
  return REQUIRED_HEADERS.some((key) => !headerValue(headers, key));
}

function isValidAppContext(headers: Headers): boolean {
  return headerValue(headers, 'x-app-module') === 'FUEL_CONTROL' && headerValue(headers, 'x-app-name') === 'SILO FuelControl';
}

export function handleFuelBootstrapRequest(ctx: RequestContext): RequestResult {
  if (missingRequiredHeaders(ctx.headers)) {
    return {
      status: 400,
      body: {
        success: false,
        errorCode: 'MISSING_REQUIRED_HEADERS',
        message: 'Headers obrigatórios ausentes.',
      },
    };
  }

  if (!isValidAppContext(ctx.headers)) {
    return {
      status: 400,
      body: {
        success: false,
        errorCode: 'INVALID_APP_MODULE',
        message: 'Módulo mobile inválido.',
      },
    };
  }

  const companyToken = headerValue(ctx.headers, 'x-company-token')!;
  const tenantId = headerValue(ctx.headers, 'x-tenant-id')!;
  const companyCode = headerValue(ctx.headers, 'x-company-code')!;

  const company = ctx.lookupCompanyByToken(companyToken);
  if (!company) {
    return {
      status: 401,
      body: {
        success: false,
        errorCode: 'INVALID_COMPANY_TOKEN',
        message: 'Token da empresa inválido.',
      },
    };
  }

  if (ctx.canUseCompany) {
    const access = ctx.canUseCompany(company);
    if (!access.allowed) {
      return {
        status: 403,
        body: {
          success: false,
          errorCode: access.code || 'COMPANY_INACTIVE',
          message: access.message || 'Empresa sem acesso mobile.',
        },
      };
    }
  }

  if (tenantId !== company.tenantId) {
    return {
      status: 403,
      body: {
        success: false,
        errorCode: 'TENANT_MISMATCH',
        message: 'Tenant informado não pertence à empresa.',
      },
    };
  }

  if (companyCode !== company.code) {
    return {
      status: 403,
      body: {
        success: false,
        errorCode: 'COMPANY_CODE_MISMATCH',
        message: 'Código da empresa não corresponde ao token informado.',
      },
    };
  }

  return {
    status: 200,
    body: buildFuelBootstrapPayload({
      tenantId,
      companyCode,
      syncedAt: ctx.syncedAt,
    }),
  };
}
