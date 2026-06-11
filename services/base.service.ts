import { BaseEntity } from "@/lib/mock/master-data";
import { shouldSeedDemoData } from '@/lib/environment';

const DEFAULT_TENANT_ID =
  process.env.NEXT_PUBLIC_SILO_TENANT_ID ||
  process.env.SILO_TENANT_ID ||
  '';

export class BaseService<T extends BaseEntity> {
  protected data: T[];
  private initialData: T[];
  private storageKey: string;
  private static currentUser = 'Usuário Sistema';
  private static currentTenantId = DEFAULT_TENANT_ID;

  constructor(storageKey: string, initialData: T[]) {
    this.storageKey = `silo_ops_v2_${storageKey}`;
    this.initialData = initialData;
    this.data = shouldSeedDemoData() ? [...initialData] : [];
    this.load();
  }

  static setContext(user: string, tenantId: string) {
    BaseService.currentUser = user;
    BaseService.currentTenantId = tenantId;
  }

  private load() {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(this.storageKey);
    if (saved) {
      try {
        this.data = JSON.parse(saved);
      } catch {
        this.data = [];
      }
      return;
    }

    if (shouldSeedDemoData()) {
      this.data = [...this.initialData];
      this.save();
      return;
    }

    this.data = [];
  }

  private save() {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.storageKey, JSON.stringify(this.data));
  }

  // Tenant Isolation logic
  async getAll(includeArchived = false): Promise<T[]> {
    return new Promise((resolve) => {
      let filtered = this.data.filter(item => item.tenantId === BaseService.currentTenantId);

      if (!includeArchived) {
        filtered = filtered.filter(item => item.entityStatus !== 'ARQUIVADO' && !item.deletedAt);
      }

      setTimeout(() => resolve([...filtered]), 150);
    });
  }

  async getById(id: string): Promise<T | undefined> {
    const item = this.data.find((item) => item.id === id);
    if (item?.tenantId !== BaseService.currentTenantId) return undefined;
    return item;
  }

  async create(item: Omit<T, keyof BaseEntity>): Promise<T> {
    const timestamp = new Date().toISOString();
    const id = Math.random().toString(36).substring(2, 11);

    const audit: BaseEntity = {
      id,
      tenantId: BaseService.currentTenantId,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: BaseService.currentUser,
      updatedBy: BaseService.currentUser,
      entityStatus: 'ATIVO',
      version: 1,
      history: [{
        timestamp,
        user: BaseService.currentUser,
        action: 'CRIAÇÃO'
      }]
    };

    const newItem = { ...item, ...audit } as T;
    this.data.push(newItem);
    this.save();
    return newItem;
  }

  async update(id: string, updateData: Partial<T>): Promise<T | undefined> {
    const index = this.data.findIndex((i) => i.id === id);
    if (index === -1) throw new Error('Registro não encontrado');

    const current = this.data[index];
    if (current.tenantId !== BaseService.currentTenantId) throw new Error('Acesso negado');

    // Optimistic Locking
    if (updateData.version !== undefined && updateData.version !== current.version) {
      throw new Error('Conflito de versão: o registro foi atualizado por outro usuário.');
    }

    const timestamp = new Date().toISOString();
    const changes: Record<string, { old: any; new: any }> = {};

    Object.keys(updateData).forEach(key => {
      const k = key as keyof T;
      if (current[k] !== updateData[k] && !['id', 'history', 'version', 'createdAt', 'createdBy', 'tenantId'].includes(key)) {
        changes[key] = { old: current[k], new: updateData[k] };
      }
    });

    const updatedItem: T = {
      ...current,
      ...updateData,
      updatedAt: timestamp,
      updatedBy: BaseService.currentUser,
      version: (current.version || 1) + 1,
      history: [
        ...current.history,
        {
          timestamp,
          user: BaseService.currentUser,
          action: 'ATUALIZAÇÃO',
          changes
        }
      ]
    };

    this.data[index] = updatedItem;
    this.save();
    return updatedItem;
  }

  async archive(id: string): Promise<boolean> {
    const index = this.data.findIndex((i) => i.id === id);
    if (index === -1) return false;
    if (this.data[index].tenantId !== BaseService.currentTenantId) return false;

    const timestamp = new Date().toISOString();
    this.data[index] = {
      ...this.data[index],
      entityStatus: 'ARQUIVADO',
      deletedAt: timestamp,
      updatedAt: timestamp,
      updatedBy: BaseService.currentUser,
      version: (this.data[index].version || 1) + 1,
      history: [
        ...this.data[index].history,
        {
          timestamp,
          user: BaseService.currentUser,
          action: 'ARQUIVAMENTO/SOFT-DELETE'
        }
      ]
    };

    this.save();
    return true;
  }

  async delete(id: string): Promise<boolean> {
    return this.archive(id);
  }

  // Debug tool to switch tenant (simulating login)
  static setTenant(id: string) {
    BaseService.currentTenantId = id;
  }
}
