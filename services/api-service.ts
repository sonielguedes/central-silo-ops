/**
 * api-service.ts — Client-side CRUD services backed by /api/cadastro/*
 * Drop-in replacement for master.service.ts — same export names.
 * Return types use 'any' to avoid setState<SpecificType[]> mismatches.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function makeService(entity: string) {
  const base = '/api/cadastro/' + entity;
  return {
    async getAll(): Promise<any[]> {
      try {
        const res = await fetch(base, { cache: 'no-store' });
        return res.ok ? res.json() : [];
      } catch { return []; }
    },
    async getById(id: string): Promise<any> {
      try {
        const res = await fetch(base + '/' + id, { cache: 'no-store' });
        return res.ok ? res.json() : undefined;
      } catch { return undefined; }
    },
    async create(data: any): Promise<any> {
      const res = await fetch(base, {
        method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Create failed' }));
        throw new Error(err.error || 'Create failed');
      }
      return res.json();
    },
    async update(id: string, data: any): Promise<any> {
      try {
        const res = await fetch(base + '/' + id, {
          method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify(data),
        });
        return res.ok ? res.json() : undefined;
      } catch { return undefined; }
    },
    async archive(id: string): Promise<boolean> {
      try {
        const res = await fetch(base + '/' + id, { method: 'DELETE' });
        return res.ok;
      } catch { return false; }
    },
    async delete(id: string): Promise<boolean> { return this.archive(id); },
  };
}

// ── Primary cadastro entities (server-side persisted) ─────────────────────────
export const EquipmentService        = makeService('equipamentos');
export const OperatorService         = makeService('operadores');
export const FarmService             = makeService('fazendas');
export const FieldService            = makeService('talhoes');
export const StopReasonService       = makeService('paradas');
export const ImplementService        = makeService('implementos');
export const EquipmentTypeService    = makeService('tipos');
export const EquipmentModelService   = makeService('modelos');
export const EquipmentGroupService   = makeService('grupos');
export const EquipmentProfileService = makeService('perfis');
export const OperationalStateService = makeService('estados');
