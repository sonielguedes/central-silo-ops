import fs from 'fs';
import path from 'path';
import { INITIAL_COMPANIES, INITIAL_EQUIPMENT } from './mock/master-data';
import { Company, Equipment } from './types';

const DEFAULT_TENANT_ID = process.env.SILO_TENANT_ID || 'silo-ops-001';
const TENANT_STATUS = process.env.SILO_TENANT_STATUS;
const DATA_ROOT = process.env.SILO_DATA_DIR || path.join(process.cwd(), 'data-storage');

export interface MobileEvent {
  offlineId: string;
  equipmentId: string;
  tenantId: string;
  type: string;
  timestamp: string;
  payload: any;
  receivedAt: string;
}

export class ServerStorage {
  private static getTenantDir(tenantId: string): string {
    const dataDir = path.join(DATA_ROOT, tenantId);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    return dataDir;
  }

  private static getEquipmentFile(tenantId: string): string {
    return path.join(this.getTenantDir(tenantId), 'equipment.json');
  }

  private static getEventsFile(tenantId: string): string {
    return path.join(this.getTenantDir(tenantId), 'events.json');
  }

  private static getCompaniesFile(): string {
    if (!fs.existsSync(DATA_ROOT)) {
      fs.mkdirSync(DATA_ROOT, { recursive: true });
    }
    return path.join(DATA_ROOT, 'companies.json');
  }

  private static loadCompanies(): Company[] {
    const companiesFile = this.getCompaniesFile();
    if (fs.existsSync(companiesFile)) {
      return JSON.parse(fs.readFileSync(companiesFile, 'utf-8'));
    }

    fs.writeFileSync(companiesFile, JSON.stringify(INITIAL_COMPANIES, null, 2));
    return INITIAL_COMPANIES;
  }

  private static getPortFromHost(host: string | null): number | undefined {
    if (!host) return undefined;

    const port = host.split(':').pop();
    const parsed = Number(port);
    return Number.isInteger(parsed) ? parsed : undefined;
  }

  static resolveTenantId(headers?: Headers): string {
    const tenantFromProxy = headers?.get('x-silo-tenant')?.trim();
    if (tenantFromProxy) return tenantFromProxy;

    const apiPort =
      this.getPortFromHost(headers?.get('x-forwarded-host') || null) ||
      this.getPortFromHost(headers?.get('host') || null);

    if (apiPort) {
      const company = this.loadCompanies().find(c => c.apiPort === apiPort);
      if (company) return company.id;
    }

    return DEFAULT_TENANT_ID;
  }

  private static loadEquipment(tenantId = DEFAULT_TENANT_ID): Equipment[] {
    const equipmentFile = this.getEquipmentFile(tenantId);

    if (fs.existsSync(equipmentFile)) {
      return JSON.parse(fs.readFileSync(equipmentFile, 'utf-8'));
    }

    const tenantEquipment = INITIAL_EQUIPMENT
      .filter(e => e.tenantId === tenantId)
      .map(e => ({ ...e, tenantId }));

    fs.writeFileSync(equipmentFile, JSON.stringify(tenantEquipment, null, 2));
    return tenantEquipment;
  }

  static getTenantId(headers?: Headers): string {
    return this.resolveTenantId(headers);
  }

  private static isTenantMobileActive(tenantId: string): boolean {
    if (tenantId === DEFAULT_TENANT_ID && TENANT_STATUS) return TENANT_STATUS === 'ATIVO';

    const company = this.loadCompanies().find(c => c.id === tenantId || c.tenantId === tenantId);
    return company?.status !== 'INATIVO';
  }

  static upsertCompany(input: Company): Company {
    const all = this.loadCompanies();
    const companiesFile = this.getCompaniesFile();
    const timestamp = new Date().toISOString();
    const index = all.findIndex(c => c.id === input.id || c.code.toLowerCase() === input.code.toLowerCase());
    const current = index >= 0 ? all[index] : undefined;
    const company: Company = {
      ...current,
      ...input,
      tenantId: input.tenantId || current?.tenantId || input.id,
      companyToken: input.companyToken || current?.companyToken,
      apiBaseUrl: input.apiPort ? `https://api.siloops.com.br:${input.apiPort}` : input.apiBaseUrl || current?.apiBaseUrl,
      mqttUrl: input.mqttPort ? `mqtt.siloops.com.br:${input.mqttPort}` : input.mqttUrl || current?.mqttUrl,
      updatedAt: timestamp,
    };

    if (index >= 0) {
      all[index] = company;
    } else {
      all.push(company);
    }

    fs.writeFileSync(companiesFile, JSON.stringify(all, null, 2));
    return company;
  }

  static validateCompanyToken(tenantId: string, companyToken: string | undefined): {
    ok: true;
    company: Company;
  } | {
    ok: false;
    status: 403;
    error: string;
  } {
    const company = this.loadCompanies().find(c => c.id === tenantId || c.tenantId === tenantId);
    if (!company?.companyToken || company.companyToken !== companyToken) {
      return { ok: false, status: 403, error: 'companyToken invalido' };
    }
    return { ok: true, company };
  }

  static validateMobileCompany(tenantId: string, companyToken: string | undefined): {
    ok: true;
    company: Company;
  } | {
    ok: false;
    status: 403;
    error: string;
  } {
    if (!this.isTenantMobileActive(tenantId)) {
      return { ok: false, status: 403, error: 'Instancia inativa para uso mobile' };
    }
    return this.validateCompanyToken(tenantId, companyToken);
  }

  static validateMobileEquipment(equipment: Equipment | undefined, mobileToken: string | undefined, tenantId = DEFAULT_TENANT_ID, companyToken?: string): {
    ok: true;
    equipment: Equipment;
  } | {
    ok: false;
    status: 403 | 404;
    error: string;
  } {
    const companyValidation = this.validateMobileCompany(tenantId, companyToken);
    if (!companyValidation.ok) return companyValidation;
    if (!equipment) return { ok: false, status: 404, error: 'Equipamento nao encontrado' };
    if (equipment.tenantId !== tenantId) return { ok: false, status: 404, error: 'Equipamento nao encontrado' };
    if (equipment.entityStatus !== 'ATIVO' || !['ATIVO', 'ativo'].includes(equipment.status)) {
      return { ok: false, status: 403, error: 'Frota inativa' };
    }
    if (!equipment.mobileEnabled) return { ok: false, status: 403, error: 'Mobile desabilitado para esta frota' };
    if (!equipment.mobileToken || equipment.mobileToken !== mobileToken) {
      return { ok: false, status: 403, error: 'mobileToken invalido' };
    }

    return { ok: true, equipment };
  }

  static validateMobileLookupEquipment(equipment: Equipment | undefined, tenantId = DEFAULT_TENANT_ID): {
    ok: true;
    equipment: Equipment;
  } | {
    ok: false;
    status: 403 | 404;
    error: string;
  } {
    if (!equipment) return { ok: false, status: 404, error: 'Equipamento nao encontrado' };
    if (equipment.tenantId !== tenantId) return { ok: false, status: 404, error: 'Equipamento nao encontrado' };
    if (equipment.entityStatus !== 'ATIVO' || !['ATIVO', 'ativo'].includes(equipment.status)) {
      return { ok: false, status: 403, error: 'Frota inativa' };
    }
    if (!equipment.mobileEnabled) return { ok: false, status: 403, error: 'Mobile desabilitado para esta frota' };

    return { ok: true, equipment };
  }

  static getEquipmentByFleetCode(fleetCode: string, tenantId = DEFAULT_TENANT_ID): Equipment | undefined {
    const all = this.loadEquipment(tenantId);
    return all.find(e => e.code === fleetCode && e.tenantId === tenantId);
  }

  static getEquipmentById(id: string, tenantId = DEFAULT_TENANT_ID): Equipment | undefined {
    const all = this.loadEquipment(tenantId);
    return all.find(e => e.id === id && e.tenantId === tenantId);
  }

  static upsertEquipment(input: Equipment, tenantId = DEFAULT_TENANT_ID): Equipment {
    const all = this.loadEquipment(tenantId);
    const equipmentFile = this.getEquipmentFile(tenantId);
    const timestamp = new Date().toISOString();
    const id = input.id || `eq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const index = all.findIndex(e => (e.id === id || e.code === input.code) && e.tenantId === tenantId);
    const current = index >= 0 ? all[index] : undefined;
    const mobileToken = input.mobileEnabled
      ? input.mobileToken || current?.mobileToken || Math.random().toString(36).substring(2, 15).toUpperCase()
      : input.mobileToken || current?.mobileToken;

    const equipment: Equipment = {
      ...current,
      ...input,
      id,
      tenantId,
      entityStatus: input.entityStatus || current?.entityStatus || 'ATIVO',
      createdAt: current?.createdAt || input.createdAt || timestamp,
      updatedAt: timestamp,
      createdBy: current?.createdBy || input.createdBy || 'SISTEMA',
      updatedBy: input.updatedBy || 'SISTEMA',
      version: (current?.version || input.version || 0) + 1,
      history: input.history || current?.history || [],
      lastSignal: input.lastSignal || current?.lastSignal || 'Agora',
      mobileToken,
    };

    if (index >= 0) {
      all[index] = equipment;
    } else {
      all.push(equipment);
    }

    fs.writeFileSync(equipmentFile, JSON.stringify(all, null, 2));
    return equipment;
  }

  static updateEquipment(id: string, updates: Partial<Equipment>, tenantId = DEFAULT_TENANT_ID) {
    const all = this.loadEquipment(tenantId);
    const index = all.findIndex(e => e.id === id && e.tenantId === tenantId);
    if (index !== -1) {
      all[index] = { ...all[index], ...updates, tenantId, updatedAt: new Date().toISOString() };
      fs.writeFileSync(this.getEquipmentFile(tenantId), JSON.stringify(all, null, 2));
    }
  }

  static saveEvent(event: Omit<MobileEvent, 'receivedAt' | 'tenantId'>, tenantId = DEFAULT_TENANT_ID): 'SYNCED' | 'DUPLICATE' {
    const eventsFile = this.getEventsFile(tenantId);
    let events: MobileEvent[] = [];
    if (fs.existsSync(eventsFile)) {
      events = JSON.parse(fs.readFileSync(eventsFile, 'utf-8'));
    }

    if (events.some(e => e.tenantId === tenantId && e.offlineId === event.offlineId)) {
      return 'DUPLICATE';
    }

    events.push({ ...event, tenantId, receivedAt: new Date().toISOString() });
    fs.writeFileSync(eventsFile, JSON.stringify(events, null, 2));
    return 'SYNCED';
  }
}
