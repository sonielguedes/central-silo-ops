import { NextRequest, NextResponse } from 'next/server';
import { ServerStorage } from '@/lib/server-storage';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { requireMobileAuth } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';

export const dynamic = 'force-dynamic';

// -- Status normalisation ------------------------------------------------------
// Cadastro records carry two status concepts:
//   * entityStatus -- lifecycle: 'ATIVO' | 'INATIVO' | 'ARQUIVADO'
//   * status       -- operational: 'trabalhando' | 'parada' | 'ATIVO' | 'ativo' ...
// A machine that is 'trabalhando' is actively in use and must NOT be treated as
// inactive. We only block when the lifecycle status (entityStatus), or an
// explicit operational INATIVO, indicates the equipment is disabled.

const INACTIVE_STATUSES = new Set(['INATIVO', 'inativo', 'ARQUIVADO', 'arquivado']);

const norm = (value: unknown): string => String(value ?? '').trim().toLowerCase();

function isEquipmentInactive(item: Record<string, unknown>): boolean {
  // Lifecycle: anything other than ATIVO (or empty/ATIVO default) is inactive.
  const entityStatus = String(item.entityStatus ?? 'ATIVO');
  if (INACTIVE_STATUSES.has(entityStatus)) return true;
  // Operational status: only an explicit INATIVO blocks. Operational states like
  // 'trabalhando' / 'parada' / 'ativo' are NOT lifecycle-inactive.
  const status = String(item.status ?? 'ATIVO');
  if (INACTIVE_STATUSES.has(status)) return true;
  return false;
}

function normalizeMobileEnabled(item: Record<string, unknown>): boolean {
  // Accept both mobileEnabled (Equipment interface) and mobile (form alias).
  // Only an EXPLICIT false disables -- absent/undefined defaults to enabled so
  // the new multi-tenant contract (X-Company-Token only) is not blocked by a
  // missing flag. (mobileEnabled === false is the documented disable signal.)
  if (item.mobileEnabled === false || item.mobile === false) return false;
  if (item.mobileEnabled === 'false' || item.mobile === 'false') return false;
  return true;
}

// -- Operator helpers ----------------------------------------------------------

function isOperatorInactive(item: Record<string, unknown>): boolean {
  const entityStatus = String(item.entityStatus ?? 'ATIVO');
  if (INACTIVE_STATUSES.has(entityStatus)) return true;
  const status = String(item.status ?? 'ATIVO');
  if (INACTIVE_STATUSES.has(status)) return true;
  return false;
}

const asValidHourmeter = (value: unknown): number | undefined => {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
};

interface ShiftStartBody {
  // Equipment identifiers (any of these may be supplied by the APK)
  equipmentId?: string;
  equipmentCode?: string;
  fleetCode?: string;
  // Operator identifiers
  operatorId?: string;
  operatorRegistration?: string;
  registration?: string;
  matricula?: string;
  // Journey / misc
  // mobileToken is accepted for backward-compat but IGNORED: authentication is
  // performed exclusively by requireMobileAuth (X-Company-Token). The route must
  // never require an equipment-level mobileToken in the body.
  mobileToken?: string;
  hourmeterStart?: number;
  startedAt?: string;
  startTimestamp?: string;
  offlineId?: string;
}

export async function POST(req: NextRequest) {
  try {
    const auth = requireMobileAuth(req);
    if (!auth.ok) return auth.response;

    // tenantId comes EXCLUSIVELY from the validated X-Company-Token. No
    // client-supplied tenantId is ever trusted, so every lookup below is
    // confined to the authenticated tenant.
    const { tenantId } = auth;
    const body = (await req.json()) as ShiftStartBody;

    const equipmentId = body.equipmentId;
    const equipmentCode = body.equipmentCode;
    const fleetCode = body.fleetCode;
    const hourmeterStart = asValidHourmeter(body.hourmeterStart);
    // New contract uses `startedAt`; legacy used `startTimestamp`.
    const startedAt = body.startedAt || body.startTimestamp || new Date().toISOString();
    const offlineId = body.offlineId || `start-${Date.now()}`;

    // Operator identifier: operatorId (direct) is preferred, then the canonical
    // registration fields. matricula is an alias for registration.
    const operatorKey =
      body.operatorId ?? body.operatorRegistration ?? body.registration ?? body.matricula;

    // -- 1. Resolve equipment --------------------------------------------------
    // PRIMARY: cadastro-equipamentos.json (managed by Central UI).
    // CadastroStorage.getAll already scopes to tenantId and filters out
    // ARQUIVADO / soft-deleted records.
    // Resolution priority: equipmentId -> equipmentCode -> fleetCode, but a
    // single combined match also tolerates the APK sending only a code.
    const idCandidates = [equipmentId, equipmentCode, fleetCode]
      .map(norm)
      .filter((v) => v !== '');

    if (idCandidates.length === 0) {
      return NextResponse.json({ error: 'Equipamento nao encontrado' }, { status: 404 });
    }

    const cadastroItems = CadastroStorage.getAll(
      tenantId,
      'equipamentos',
    ) as Array<Record<string, unknown>>;

    const cadastroMatch = cadastroItems.find((item) => {
      const candidates = [item.id, item.code, item.fleetCode, item.equipmentCode].map(norm);
      return candidates.some((c) => c !== '' && idCandidates.includes(c));
    });

    // Resolved equipment shape used downstream (id + code), regardless of source.
    let equipment: { id: string; code: string } | undefined;

    if (cadastroMatch) {
      // Tenant double-check (CadastroStorage already scopes, but be explicit).
      const storedTenant = cadastroMatch.tenantId ? String(cadastroMatch.tenantId) : tenantId;
      if (storedTenant !== tenantId) {
        return NextResponse.json({ error: 'Equipamento nao encontrado' }, { status: 404 });
      }
      // Lifecycle / operational inactive.
      if (isEquipmentInactive(cadastroMatch)) {
        console.info('[mobile/shift/start] equipamento inativo', { tenantId, idCandidates });
        return NextResponse.json({ error: 'Equipamento inativo' }, { status: 403 });
      }
      // Mobile disabled (only an explicit mobileEnabled === false blocks).
      if (!normalizeMobileEnabled(cadastroMatch)) {
        console.info('[mobile/shift/start] equipamento desabilitado para mobile', { tenantId, idCandidates });
        return NextResponse.json(
          { error: 'Equipamento desabilitado para mobile' },
          { status: 403 },
        );
      }
      // NOTE: no equipment-level mobileToken check. Authentication is already
      // guaranteed by requireMobileAuth (X-Company-Token).
      equipment = {
        id: String(cadastroMatch.id ?? ''),
        code: String(cadastroMatch.code ?? ''),
      };
    } else {
      // FALLBACK: legacy equipments.json (read-only, no migration).
      const legacy =
        (equipmentId ? ServerStorage.getEquipmentById(equipmentId, tenantId) : undefined) ??
        (equipmentCode ? ServerStorage.getEquipmentByFleetCode(equipmentCode, tenantId) : undefined) ??
        (fleetCode ? ServerStorage.getEquipmentByFleetCode(fleetCode, tenantId) : undefined);

      if (!legacy || legacy.tenantId !== tenantId) {
        return NextResponse.json({ error: 'Equipamento nao encontrado' }, { status: 404 });
      }
      // Lifecycle inactive (entityStatus) or explicit operational INATIVO.
      if (legacy.entityStatus !== 'ATIVO' || INACTIVE_STATUSES.has(String(legacy.status))) {
        return NextResponse.json({ error: 'Equipamento inativo' }, { status: 403 });
      }
      if (legacy.mobileEnabled === false) {
        return NextResponse.json(
          { error: 'Equipamento desabilitado para mobile' },
          { status: 403 },
        );
      }
      // NOTE: no equipment-level mobileToken check (see above).
      equipment = { id: legacy.id, code: legacy.code };
    }

    // -- 2. Resolve operator ---------------------------------------------------
    // Always scoped to the authenticated tenant via CadastroStorage.
    if (!operatorKey || !String(operatorKey).trim()) {
      return NextResponse.json({ error: 'Operador nao encontrado' }, { status: 404 });
    }
    const operatorKeyNorm = norm(operatorKey);

    const operatorItems = CadastroStorage.getAll(
      tenantId,
      'operadores',
    ) as Array<Record<string, unknown>>;

    const operatorMatch = operatorItems.find((item) => {
      // Tenant scoping already applied by getAll; double-check defensively.
      const sameTenant = !item.tenantId || String(item.tenantId) === tenantId;
      if (!sameTenant) return false;
      const candidates = [item.id, item.registration, item.matricula, item.code].map(norm);
      return candidates.some((c) => c !== '' && c === operatorKeyNorm);
    });

    if (!operatorMatch) {
      return NextResponse.json({ error: 'Operador nao encontrado' }, { status: 404 });
    }
    if (isOperatorInactive(operatorMatch)) {
      return NextResponse.json({ error: 'Operador inativo' }, { status: 403 });
    }

    const operatorId = body.operatorId
      ? String(body.operatorId)
      : String(operatorMatch.id ?? '');
    const operatorRegistration = String(
      operatorMatch.registration ?? operatorMatch.matricula ?? operatorMatch.code ?? operatorMatch.id ?? '',
    );
    const operatorName =
      typeof operatorMatch.name === 'string' ? operatorMatch.name : operatorRegistration;

    // -- 3. Start the shift ----------------------------------------------------
    const shiftId = `shift-${Date.now()}`;

    // Legacy equipments.json bookkeeping (no-op when equipment lives only in cadastro).
    ServerStorage.updateEquipment(
      equipment.id,
      {
        activeShiftId: shiftId,
        currentOperatorId: operatorRegistration,
        status: 'trabalhando',
      },
      tenantId,
    );

    ServerStorage.updateLiveState(tenantId, equipment.id, equipment.code, {
      status: 'OPERANDO',
      operatorRegistration,
      registration: operatorRegistration,
      operatorName,
      currentOperator: operatorName,
      ...(hourmeterStart !== undefined
        ? { hourmeterStart, hourmeterCurrent: hourmeterStart }
        : {}),
      updatedAt: new Date().toISOString(),
    });

    ServerStorage.saveEvent(
      {
        offlineId,
        equipmentId: equipment.id,
        type: 'SHIFT_START',
        timestamp: startedAt,
        payload: {
          equipmentId: equipment.id,
          equipmentCode: equipment.code,
          fleetCode: equipment.code,
          operatorId,
          operatorRegistration,
          operatorName,
          shiftId,
          hourmeterStart: hourmeterStart ?? null,
          startedAt,
          offlineId,
        },
      },
      tenantId,
    );

    auditFromRequest(req, tenantId, {
      action: 'SHIFT_START',
      entity: 'shift',
      entityId: shiftId,
      metadata: { equipmentId: equipment.id, fleetCode: equipment.code, operatorRegistration },
    });

    return NextResponse.json({
      success: true,
      status: 'OK',
      shiftId,
      equipmentId: equipment.id,
      equipmentCode: equipment.code,
      fleetCode: equipment.code,
      operatorId,
      operatorRegistration,
      operatorName,
      hourmeterStart: hourmeterStart ?? null,
      startedAt,
    });
  } catch (error) {
    console.error('[mobile/shift/start] unhandled error', error);
    return NextResponse.json({ error: 'Error' }, { status: 500 });
  }
}
