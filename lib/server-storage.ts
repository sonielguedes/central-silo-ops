import fs from 'fs';
import path from 'path';
import { INITIAL_COMPANIES, INITIAL_EQUIPMENT } from './mock/master-data';
import { Company, Equipment, EquipmentLiveState, TrailPoint } from './types';
import { shouldSeedDemoData } from './environment';

const DEFAULT_TENANT_ID = process.env.SILO_TENANT_ID || 'silo-ops-001';
const TENANT_STATUS = process.env.SILO_TENANT_STATUS;

const resolveStorageDir = () => {
  const dir = process.env.SILO_STORAGE_DIR || process.env.SILO_DATA_DIR || (process.env.NODE_ENV === 'production' ? '/app/data' : './data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const DATA_ROOT = resolveStorageDir();
let storageLogDone = false;

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
    return path.join(this.getTenantDir(tenantId), 'equipments.json');
  }

  private static getEventsFile(tenantId: string): string {
    return path.join(this.getTenantDir(tenantId), 'mobile-events.json');
  }

  private static getLiveStateFile(tenantId: string): string {
    return path.join(this.getTenantDir(tenantId), 'live-state.json');
  }

  private static sanitizeLiveStateItem(item: EquipmentLiveState): EquipmentLiveState {
    const sanitized: EquipmentLiveState = { ...item };

    // 1. Numeric hourmeter fields: must be finite > 0
    const numericHourmeterKeys: Array<keyof EquipmentLiveState> = [
      'hourmeter',
      'hourmeterInitial',
      'hourmeterStart',
      'hourmeterCurrent',
      'hourmeterFinal',
      'hourmeterEnd',
    ];
    numericHourmeterKeys.forEach((key) => {
      const value = sanitized[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        delete sanitized[key];
      }
    });

    // 2. totalHourmeter: finite >= 0
    if (typeof sanitized.totalHourmeter !== 'number' || !Number.isFinite(sanitized.totalHourmeter) || sanitized.totalHourmeter < 0) {
      delete sanitized.totalHourmeter;
    }

    // 3. hourmeterSource: must be a non-empty string — cleans up null/empty residuals
    if (!sanitized.hourmeterSource || typeof sanitized.hourmeterSource !== 'string' || !sanitized.hourmeterSource.trim()) {
      delete sanitized.hourmeterSource;
    }

    // 4. hourmeterCurrent must not regress below hourmeterStart
    if (
      sanitized.hourmeterCurrent !== undefined &&
      sanitized.hourmeterStart !== undefined &&
      sanitized.hourmeterCurrent < sanitized.hourmeterStart
    ) {
      delete sanitized.hourmeterCurrent;
    }

    // 5. Re-evaluate inconsistency from scratch.
    //    Always clear first so stale flags from previous journeys never bleed through.
    //    Only mark inconsistent when an actual violation is detected now.
    delete sanitized.hourmeterInconsistent;
    delete sanitized.hourmeterInconsistencyReason;

    if (sanitized.hourmeterEnd !== undefined && sanitized.hourmeterStart === undefined) {
      // End present but no valid start
      sanitized.hourmeterInconsistent = true;
      sanitized.hourmeterInconsistencyReason = 'hourmeterEnd sem hourmeterStart valido';
    } else if (
      sanitized.hourmeterEnd !== undefined &&
      sanitized.hourmeterStart !== undefined &&
      sanitized.hourmeterEnd < sanitized.hourmeterStart
    ) {
      // End < Start: remove the invalid end value
      delete sanitized.hourmeterEnd;
      sanitized.hourmeterInconsistent = true;
      sanitized.hourmeterInconsistencyReason = 'hourmeterEnd menor que hourmeterStart';
    } else if (
      typeof sanitized.totalHourmeter === 'number' &&
      sanitized.totalHourmeter < 0
    ) {
      sanitized.hourmeterInconsistent = true;
      sanitized.hourmeterInconsistencyReason = 'totalHourmeter negativo';
    }
    // No violation → hourmeterInconsistent remains absent (clean state)

    return sanitized;
  }

  private static loadLiveState(tenantId: string): EquipmentLiveState[] {
    const file = this.getLiveStateFile(tenantId);
    if (fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as EquipmentLiveState[];
      const sanitized = raw.map(item => this.sanitizeLiveStateItem(item));
      if (JSON.stringify(raw) !== JSON.stringify(sanitized)) {
        fs.writeFileSync(file, JSON.stringify(sanitized, null, 2));
        console.info(`[live-state] sanitized tenantId=${tenantId} count=${sanitized.length}`);
      }
      return sanitized;
    }
    return [];
  }

  static updateLiveState(tenantId: string, equipmentId: string, fleetCode: string, updates: Partial<EquipmentLiveState>): EquipmentLiveState {
    const all = this.loadLiveState(tenantId);
    const now = new Date().toISOString();
    const index = all.findIndex(s => s.equipmentId === equipmentId);
    const current = index >= 0 ? all[index] : undefined;
    const hourmeterKeys = new Set(['hourmeter', 'hourmeterInitial', 'hourmeterStart', 'hourmeterCurrent', 'hourmeterFinal', 'hourmeterEnd', 'totalHourmeter']);
    const cleanUpdates = Object.fromEntries(
      Object.entries(updates).filter(([key, value]) => {
        if (value === undefined || value === null || value === '') return false;
        if (!hourmeterKeys.has(key)) return true;
        if (typeof value !== 'number' || !Number.isFinite(value)) return false;
        if (key === 'totalHourmeter') return value >= 0;
        if (value <= 0) return false;
        if (key === 'hourmeterCurrent' && current?.hourmeterStart && value < current.hourmeterStart) return false;
        if (key === 'hourmeterEnd' && current?.hourmeterStart && value < current.hourmeterStart) return false;
        return true;
      })
    ) as Partial<EquipmentLiveState>;

    // When a new journey starts (hourmeterStart is being updated), clear stale end-of-journey
    // fields from the existing record. Without this, a residual hourmeterEnd from a previous
    // journey would be carried forward and re-trigger the end<start inconsistency check
    // against the new hourmeterStart.
    const isNewJourneyStart = cleanUpdates.hourmeterStart !== undefined;

    // FINALIZADO is terminal. Never let an OFFLINE update overwrite it in the same
    // merge/sanitize (e.g. a stale heartbeat timeout arriving after JOURNEY_END).
    // A genuinely new journey (JOURNEY_START carries hourmeterStart) is still allowed.
    if (index >= 0 && current?.status === 'FINALIZADO' && cleanUpdates.status === 'OFFLINE' && !isNewJourneyStart) {
      delete cleanUpdates.status;
    }

    let state: EquipmentLiveState;
    if (index >= 0) {
      let base: Record<string, unknown> = { ...all[index] };
      if (isNewJourneyStart) {
        delete base.hourmeterEnd;
        delete base.hourmeterFinal;
        delete base.hourmeterInconsistent;
        delete base.hourmeterInconsistencyReason;
        delete base.totalHourmeter;
      }
      state = this.sanitizeLiveStateItem({ ...base, ...cleanUpdates, updatedAt: now } as EquipmentLiveState);
      all[index] = state;
    } else {
      state = this.sanitizeLiveStateItem({
        equipmentId,
        fleetCode,
        tenantId,
        status: 'ONLINE',
        updatedAt: now,
        ...cleanUpdates
      } as EquipmentLiveState);
      all.push(state);
    }

    // On journey end, close any stop still open. Uses the MERGED state (current + updates),
    // so a stop opened in a previous batch is closed even if this batch only sent JOURNEY_END.
    {
      const merged = state as unknown as Record<string, unknown>;
      const hasStop = Boolean(merged.stopCode || merged.stopDescription || merged.stopReason);
      if (merged.status === 'FINALIZADO' && hasStop && !merged.stopEndedAt) {
        merged.stopEndedAt = (merged.endedAt as string) || now;
        all[index >= 0 ? index : all.length - 1] = state;
        console.info(`[live-state] auto-closed open stop on JOURNEY_END fleetCode=${fleetCode} stopEndedAt=${merged.stopEndedAt}`);
      }
    }

    fs.writeFileSync(this.getLiveStateFile(tenantId), JSON.stringify(all, null, 2));
    console.info(`[live-state] updated fleetCode=${fleetCode} status=${state.status}`);
    const operationalUpdated = [
      'operatorRegistration',
      'operatorName',
      'currentOperator',
      'operationCode',
      'operationName',
      'currentOperation',
      'implementCode',
      'hourmeterCurrent',
      'stopCode',
      'stopDescription',
      'stopReason'
    ].some(key => Object.prototype.hasOwnProperty.call(cleanUpdates, key));
    if (operationalUpdated) {
      console.info(`[live-state] operational fields updated fleetCode=${fleetCode}`);
    }
    const hourmeterUpdated = Array.from(hourmeterKeys).some(key => Object.prototype.hasOwnProperty.call(cleanUpdates, key));
    if (hourmeterUpdated) {
      console.info(`[live-state] hourmeter updated fleetCode=${fleetCode}`);
    }
    return state;
  }

  static getLiveFleet(tenantId: string): EquipmentLiveState[] {
    const all = this.loadLiveState(tenantId);
    const now = Date.now();
    const OFFLINE_TIMEOUT_MS = 120 * 1000;

    const fleet = all.map(s => {
      const hb = s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).getTime() : 0;
      const gps = s.lastGpsAt ? new Date(s.lastGpsAt).getTime() : 0;
      const lastSignal = Math.max(hb, gps);

      // FINALIZADO is terminal — a finished journey must never be downgraded to OFFLINE
      // by the signal-timeout rule (offline-synced JOURNEY_END carries old timestamps).
      if (s.status !== 'OFFLINE' && s.status !== 'FINALIZADO' && lastSignal > 0 && (now - lastSignal) > OFFLINE_TIMEOUT_MS) {
        return { ...s, status: 'OFFLINE' as const };
      }
      return s;
    });

    const statusWeight = { 'OPERANDO': 0, 'ONLINE': 1, 'PARADO': 2, 'FINALIZADO': 3, 'OFFLINE': 4 };
    return fleet.sort((a, b) => (statusWeight[a.status] || 99) - (statusWeight[b.status] || 99));
  }


  private static getCompaniesFile(): string {
    if (!storageLogDone) {
      console.info(`[ServerStorage] using storage dir: ${DATA_ROOT}`);
      storageLogDone = true;
    }
    return path.join(DATA_ROOT, 'companies.json');
  }

  private static loadCompanies(): Company[] {
    const companiesFile = this.getCompaniesFile();
    if (fs.existsSync(companiesFile)) {
      return JSON.parse(fs.readFileSync(companiesFile, 'utf-8'));
    }

    const seed = shouldSeedDemoData() ? INITIAL_COMPANIES : [];
    fs.writeFileSync(companiesFile, JSON.stringify(seed, null, 2));
    console.info(`[ServerStorage] companies action=${seed.length ? 'seed' : 'init-empty'} count=${seed.length}`);
    return seed;
  }

  private static getPortFromHost(host: string | null): number | undefined {
    if (!host) return undefined;

    const port = host.split(':').pop();
    const parsed = Number(port);
    return Number.isInteger(parsed) ? parsed : undefined;
  }

  static resolveApiPort(headers?: Headers): number | undefined {
    const forwardedPort = Number(headers?.get('x-forwarded-port'));
    if (Number.isInteger(forwardedPort) && forwardedPort > 0) return forwardedPort;

    return (
      this.getPortFromHost(headers?.get('x-forwarded-host') || null) ||
      this.getPortFromHost(headers?.get('host') || null)
    );
  }

  static resolveTenantId(headers?: Headers): string {
    const tenantFromProxy = headers?.get('x-silo-tenant')?.trim();
    if (tenantFromProxy) return tenantFromProxy;

    const apiPort = this.resolveApiPort(headers);

    if (apiPort) {
      const company = this.loadCompanies().find(c => Number(c.apiPort) === apiPort);
      if (company && company.tenantId) return company.tenantId;
    }

    return DEFAULT_TENANT_ID;
  }

  private static loadEquipment(tenantId = DEFAULT_TENANT_ID): Equipment[] {
    const equipmentFile = this.getEquipmentFile(tenantId);

    if (fs.existsSync(equipmentFile)) {
      return JSON.parse(fs.readFileSync(equipmentFile, 'utf-8'));
    }

    const tenantEquipment = shouldSeedDemoData()
      ? INITIAL_EQUIPMENT
        .filter(e => e.tenantId === tenantId)
        .map(e => ({ ...e, tenantId }))
      : [];

    fs.writeFileSync(equipmentFile, JSON.stringify(tenantEquipment, null, 2));
    console.info(`[ServerStorage] equipment action=${tenantEquipment.length ? 'seed' : 'init-empty'} tenantId=${tenantId} count=${tenantEquipment.length}`);
    return tenantEquipment;
  }

  static getTenantId(headers?: Headers): string {
    return this.resolveTenantId(headers);
  }

  static getCompanyByTenantId(tenantId: string): Company | undefined {
    return this.loadCompanies().find(c => c.tenantId === tenantId);
  }

  static getCompanyByApiPort(apiPort: number): Company | undefined {
    return this.loadCompanies().find(c => Number(c.apiPort) === apiPort);
  }

  static getCompanyByToken(token: string): Company | undefined {
    if (!token) return undefined;
    return this.loadCompanies().find(c => c.companyToken === token);
  }

  static validateMobileCompanyRecord(company: Company | undefined, companyToken: string | undefined): {
    ok: true;
    company: Company;
  } | {
    ok: false;
    status: 403;
    error: string;
  } {
    if (!company || company.status === 'INATIVO') {
      return { ok: false, status: 403, error: 'Instancia inativa para uso mobile' };
    }
    if (!company.companyToken || company.companyToken !== companyToken) {
      return { ok: false, status: 403, error: 'companyToken invalido' };
    }
    return { ok: true, company };
  }

  static getCompanies(): Company[] {
    return this.loadCompanies();
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
    const index = all.findIndex(c =>
      c.id === input.id ||
      c.tenantId === input.tenantId ||
      c.code.toLowerCase() === input.code.toLowerCase()
    );
    const current = index >= 0 ? all[index] : undefined;
    const apiPort = Number(input.apiPort || current?.apiPort || 0);
    const mqttPort = Number(input.mqttPort || current?.mqttPort || 0);
    const company: Company = {
      ...current,
      ...input,
      tenantId: input.tenantId || current?.tenantId || input.id,
      companyToken: input.companyToken || current?.companyToken,
      apiPort,
      mqttPort,
      apiBaseUrl: apiPort ? `https://api.siloops.com.br:${apiPort}` : input.apiBaseUrl || current?.apiBaseUrl,
      mqttUrl: mqttPort ? `mqtt.siloops.com.br:${mqttPort}` : input.mqttUrl || current?.mqttUrl,
      status: input.status || current?.status || 'ATIVO',
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
    const company = this.loadCompanies().find(c => c.tenantId === tenantId);
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

  // ── Trail ────────────────────────────────────────────────────────────────────
  private static getTrailDir(tenantId: string): string {
    const dir = path.join(this.getTenantDir(tenantId), 'trails');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
  }

  private static getTrailFile(tenantId: string, journeyId: string): string {
    const safe = journeyId.replace(/[^\w]/g, '_').replace(/-/g,'_');
    return path.join(this.getTrailDir(tenantId), safe + '.json');
  }

  static saveTrailPoint(tenantId: string, point: TrailPoint): boolean {
    // Reject invalid coordinates
    if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return false;
    if (point.latitude === 0 && point.longitude === 0) return false;
    // Reject absent timestamp or journeyId — they are the deduplication/routing keys
    if (!point.timestamp) return false;
    if (!point.journeyId || !point.journeyId.trim()) return false;

    const file = this.getTrailFile(tenantId, point.journeyId);
    let pts: TrailPoint[] = [];
    if (fs.existsSync(file)) {
      try {
        pts = JSON.parse(fs.readFileSync(file, 'utf-8'));
        if (!Array.isArray(pts)) pts = [];
      } catch {
        console.warn('[trail] saveTrailPoint: corrupted trail file, resetting', file);
        pts = [];
      }
    }

    // Deduplicate by journeyId (implicit via file) + timestamp + lat + lng
    const isDup = pts.some((p: TrailPoint) =>
      p.timestamp === point.timestamp &&
      p.latitude  === point.latitude  &&
      p.longitude === point.longitude
    );
    if (isDup) return false;

    pts.push(point);
    pts.sort((a: TrailPoint, b: TrailPoint) => a.timestamp.localeCompare(b.timestamp));
    fs.writeFileSync(file, JSON.stringify(pts, null, 2));
    console.info('[trail] saved point fleetCode=' + point.fleetCode + ' journeyId=' + point.journeyId + ' total=' + pts.length);
    return true;
  }

  static getTrail(tenantId: string, journeyId: string): TrailPoint[] {
    const file = this.getTrailFile(tenantId, journeyId);
    if (!fs.existsSync(file)) return [];
    try {
      const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      console.warn('[trail] getTrail: corrupted trail file, returning []', file);
      return [];
    }
  }

  static getEvents(tenantId: string, equipmentId?: string): MobileEvent[] {
    const eventsFile = this.getEventsFile(tenantId);
    if (!fs.existsSync(eventsFile)) return [];
    let all: MobileEvent[] = [];
    try {
      const raw = fs.readFileSync(eventsFile, 'utf-8');
      const parsed = JSON.parse(raw);
      all = Array.isArray(parsed) ? parsed : [];
    } catch {
      console.warn('[server-storage] getEvents: failed to parse', eventsFile);
      return [];
    }
    let result = all;
    if (equipmentId) {
      result = all.filter(e => {
        if (e.equipmentId === equipmentId) return true;
        const p = e.payload as Record<string, unknown> | null | undefined;
        if (!p) return false;
        return p['equipmentId'] === equipmentId || p['machineId'] === equipmentId;
      });
    }
    return result.sort((a, b) => {
      const ta = a.timestamp ?? a.receivedAt ?? '';
      const tb = b.timestamp ?? b.receivedAt ?? '';
      return ta < tb ? -1 : ta > tb ? 1 : 0;
    });
  }

  static saveEvent(event: Omit<MobileEvent, 'receivedAt' | 'tenantId'>, tenantId = DEFAULT_TENANT_ID): 'SYNCED' | 'DUPLICATE' {
    const eventsFile = this.getEventsFile(tenantId);
    let events: MobileEvent[] = [];
    if (fs.existsSync(eventsFile)) {
      try {
        events = JSON.parse(fs.readFileSync(eventsFile, 'utf-8'));
        if (!Array.isArray(events)) events = [];
      } catch { events = []; }
    }
    if (event.offlineId && events.some((e: MobileEvent) => e.tenantId === tenantId && e.offlineId === event.offlineId)) {
      return 'DUPLICATE';
    }
    events.push({ ...event, tenantId, receivedAt: new Date().toISOString() });
    fs.writeFileSync(eventsFile, JSON.stringify(events, null, 2));
    return 'SYNCED';
  }
}
