/**
 * GET /api/mobile/bootstrap
 *
 * Retorna o pacote de dados mestres necessário para a tela "Seleção Operacional"
 * do APK SILO OPS Field.
 *
 * Autenticação: X-Company-Token (requireMobileAuth).
 * Escopo:       tenant extraído exclusivamente do token — zero cross-tenant.
 *
 * Payload retornado:
 *   tenantId, operator, equipments, workOrders, costCenters,
 *   implements, operations, stopReasons, updatedAt, version (SHA-1).
 *
 * Filtros:
 *   - equipamentos:      mobileEnabled !== false  AND  entityStatus === 'ATIVO'
 *   - ordens de serviço: status === 'ABERTA'  AND  entityStatus === 'ATIVO'
 *   - centros de custo:  status === 'ATIVO'   AND  entityStatus === 'ATIVO'
 *   - implementos:       entityStatus === 'ATIVO'  AND  status not in (INATIVO, MANUTENCAO)
 *   - operações:         entityStatus === 'ATIVO'  AND  status not in (FINALIZADA, CANCELADA)
 *   - motivos de parada: isActive === true
 *   - operador:          derivado do header X-Operator-Id (opcional)
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { requireMobileAuth } from '@/lib/auth/api-guard';
import { ensureOperationsCatalogForTenant } from '@/lib/catalog/ensure-operations-catalog';
import {
  getProfileForEquipment,
  filterOperationsForEquipment,
  OPERATIONAL_PROFILES,
} from '@/lib/operational-profiles';

export const dynamic = 'force-dynamic';

// ── helpers ──────────────────────────────────────────────────────────────────

type StorageItem = Record<string, unknown>;

const INACTIVE_ENTITY_STATUSES = new Set(['INATIVO', 'inativo', 'ARQUIVADO', 'arquivado']);

function isEntityActive(item: StorageItem): boolean {
  const es = String(item.entityStatus ?? 'ATIVO');
  return !INACTIVE_ENTITY_STATUSES.has(es) && item.deletedAt == null;
}

function isMobileEnabled(item: StorageItem): boolean {
  return item.mobileEnabled !== false && item.mobileEnabled !== 'false';
}

function sha1(payload: unknown): string {
  return crypto
    .createHash('sha1')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 12);
}

/**
 * Extrai apenas os dígitos de um valor.
 * "OS-100" -> "100", "100" -> "100", "z31nbt2kz" -> null
 * Retorna null se o resultado for vazio.
 */
function extractNumber(val: unknown): string | null {
  if (val == null) return null;
  const s = String(val).trim();
  const digits = s.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

// Remove campos sensíveis do objeto operador antes de enviar ao APK
function redactOperator(op: StorageItem): StorageItem {
  const { passwordHash: _ph, password: _pw, pin: _pin, pinHash: _pinh, ...safe } = op as Record<string, unknown>;
  return safe as StorageItem;
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const auth = requireMobileAuth(req);
    if (!auth.ok) return auth.response;

    const { tenantId } = auth;

    // Header opcional: identifica o operador logado no APK
    const operatorId = req.headers.get('x-operator-id')?.trim() || undefined;

    // ── 1. Equipamentos ──────────────────────────────────────────────────────
    // Garante mobileToken persistente para cada equipamento mobileEnabled.
    // Idempotente — só gera se ainda não existe.
    CadastroStorage.ensureEquipmentMobileTokens(tenantId);

    const equipments = (CadastroStorage.getAll(tenantId, 'equipamentos') as StorageItem[])
      .filter(e => isEntityActive(e) && isMobileEnabled(e))
      .map(e => {
        const profileCode = (e.operationalProfileCode as string | null | undefined) ?? 'GENERICO';
        const profile = getProfileForEquipment({ operationalProfileCode: profileCode });
        return {
          ...e,
          // Garantir que mobileToken seja sempre retornado (nunca undefined)
          mobileToken:            typeof e.mobileToken === 'string' ? e.mobileToken : null,
          fleetCode:              String(e.code ?? ''),
          // Perfil operacional — APK usa para filtrar opções de seleção
          operationalProfileCode: profileCode,
          measurementMode:        (e.measurementMode as string | null | undefined) ?? profile.measurementMode,
          operationalProfile: {
            code:                       profile.code,
            name:                       profile.name,
            description:                profile.description,
            measurementMode:            profile.measurementMode,
            allowedOperationCodes:      profile.allowedOperationCodes,
            requiresImplement:          profile.requiresImplement,
            requiresWorkOrder:          profile.requiresWorkOrder,
            requiresCostCenter:         profile.requiresCostCenter,
          },
        };
      });

    // ── 2. Ordens de Servico (abertas) ───────────────────────────────────────
    const rawWorkOrders = (CadastroStorage.getAll(tenantId, 'ordens-servico') as StorageItem[])
      .filter(o => isEntityActive(o) && o.status === 'ABERTA');

    const workOrders = rawWorkOrders.map(o => {
      // number: extrair digitos para garantir valor limpo no APK (evita WorkOrderEntity NPE)
      // fallback em cadeia: number -> code -> osNumber -> orderNumber -> id -> SEM_NUMERO
      const number =
        extractNumber(o.number) ??
        extractNumber(o.code) ??
        extractNumber(o.osNumber) ??
        extractNumber(o.orderNumber) ??
        (o.id ? String(o.id) : null) ??
        'SEM_NUMERO';

      const code = String(o.code || o.number || o.osNumber || o.orderNumber || o.id || 'SEM_CODIGO');
      const displayName = `OS ${number}`;

      return {
        ...o,
        id: o.id,
        number,
        code,
        displayName,
        status: o.status || 'ABERTA',
        type: o.type || null,
        priority: o.priority || null,
        description: o.description || null,
        equipmentId: o.equipmentId || '',
        operatorId: o.operatorId || '',
        costCenterId: o.costCenterId || '',
        operationId: o.operationId || '',
        openedAt: o.openedAt || null,
        createdAt: o.createdAt || null,
        updatedAt: o.updatedAt || null,
      };
    });

    // ── 3. Centros de Custo (ativos) ─────────────────────────────────────────
    const costCenters = (CadastroStorage.getAll(tenantId, 'centros-custo') as StorageItem[])
      .filter(c => isEntityActive(c) && c.status === 'ATIVO');

    // ── 4. Implementos (disponíveis) ──────────────────────────────────────────
    const BLOCKED_IMPL = new Set(['INATIVO', 'inativo', 'ARQUIVADO', 'arquivado', 'MANUTENCAO']);
    const implements_ = (CadastroStorage.getAll(tenantId, 'implementos') as StorageItem[])
      .filter(i => isEntityActive(i) && !BLOCKED_IMPL.has(String(i.status ?? '')));

    // ── 5. Operacoes (nao finalizadas) ────────────────────────────────────────
    // Garante que o catalogo mestre existe antes de ler — nao depende de login web
    ensureOperationsCatalogForTenant(tenantId);
    const TERMINAL_OPS = new Set(['FINALIZADA', 'CANCELADA']);
    const operations = (CadastroStorage.getAll(tenantId, 'operacoes') as StorageItem[])
      .filter(o => isEntityActive(o) && !TERMINAL_OPS.has(String(o.status ?? '')));

    // ── 6. Motivos de Parada (ativos) ────────────────────────────────────────
    const stopReasons = (CadastroStorage.getAll(tenantId, 'paradas') as StorageItem[])
      .filter(p => isEntityActive(p) && p.isActive !== false);

    // ── 7. Operadores ativos do tenant (array completo para o APK) ────────────
    // Permite que o APK identifique localmente a matrícula sem depender de sessão web.
    // registration é mantido como string para preservar zeros à esquerda (ex: "00125").
    const operators = (CadastroStorage.getAll(tenantId, 'operadores') as StorageItem[])
      .filter(o => isEntityActive(o) && (o.status === 'ATIVO' || o.entityStatus === 'ATIVO'))
      .map(o => ({
        id:           o.id,
        tenantId:     tenantId,
        registration: o.registration != null ? String(o.registration) : null,
        name:         o.name || null,
        phone:        o.phone || null,
        role:         o.role || o.cargo || 'Operador',
        shift:        o.shift || o.turno || null,
        status:       o.status || 'ATIVO',
        entityStatus: o.entityStatus || 'ATIVO',
      }));

    // ── 8. Operador autenticado (se enviado no header) ───────────────────────
    let operator: StorageItem | undefined;
    if (operatorId) {
      const allOperatorsRaw = CadastroStorage.getAll(tenantId, 'operadores') as StorageItem[];
      const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
      operator = allOperatorsRaw.find(op =>
        [op.id, op.registration, op.matricula].map(norm).includes(norm(operatorId))
      );
    }

    // ── 9. Regras por frota (allowedOperations filtradas por perfil) ─────────
    // O APK usa este mapa para filtrar a tela de seleção operacional offline-first.
    const allowedOperationsByFleet: Record<string, {
      profileCode: string;
      allowedOperationCodes: string[] | null;
      measurementMode: string;
      requiresImplement: boolean;
      requiresWorkOrder: boolean;
      requiresCostCenter: boolean;
      filteredOperationIds: string[];
    }> = {};

    for (const eq of equipments) {
      const fc = String(eq.fleetCode ?? '');
      if (!fc) continue;
      const profileCode = String((eq as Record<string,unknown>).operationalProfileCode ?? 'GENERICO');
      const profile = getProfileForEquipment({ operationalProfileCode: profileCode });
      const filteredOps = filterOperationsForEquipment(
        { operationalProfileCode: profileCode },
        operations as Array<Record<string, unknown>>,
      );
      allowedOperationsByFleet[fc] = {
        profileCode,
        allowedOperationCodes: profile.allowedOperationCodes,
        measurementMode:       profile.measurementMode,
        requiresImplement:     profile.requiresImplement,
        requiresWorkOrder:     profile.requiresWorkOrder,
        requiresCostCenter:    profile.requiresCostCenter,
        filteredOperationIds:  filteredOps.map(o => String((o as Record<string,unknown>).id ?? '')).filter(Boolean),
      };
    }

    // ── 10. Montar pacote ──────────────────────────────────────────────────────
    const updatedAt = new Date().toISOString();
    const payload = {
      tenantId,
      operator: operator ? redactOperator(operator) : null,
      equipments,
      workOrders,
      costCenters,
      implements: implements_,
      operations,
      operators,
      stopReasons,
      allowedOperationsByFleet,
      operationalProfiles: Object.values(OPERATIONAL_PROFILES).map(p => ({
        code:                  p.code,
        name:                  p.name,
        allowedOperationCodes: p.allowedOperationCodes,
        measurementMode:       p.measurementMode,
        requiresImplement:     p.requiresImplement,
        requiresWorkOrder:     p.requiresWorkOrder,
        requiresCostCenter:    p.requiresCostCenter,
      })),
      updatedAt,
    };

    const version = sha1(payload);

    console.info('[mobile/bootstrap] synced', {
      tenantId,
      operatorId:           operatorId ?? '-',
      equipments:           equipments.length,
      workOrders:           workOrders.length,
      costCenters:          costCenters.length,
      implements:           implements_.length,
      operations:           operations.length,
      operators:            operators.length,
      stopReasons:          stopReasons.length,
      hasOperator:          !!operator,
      profilesInPayload:    Object.keys(allowedOperationsByFleet).length,
      version,
    });

    return NextResponse.json({ ...payload, version });
  } catch (err) {
    console.error('[mobile/bootstrap] unhandled error', err);
    return NextResponse.json({ error: 'Erro interno ao gerar pacote de bootstrap' }, { status: 500 });
  }
}

export async function POST() { return handleMethodNotAllowed(); }
export async function PUT() { return handleMethodNotAllowed(); }
export async function DELETE() { return handleMethodNotAllowed(); }
export async function PATCH() { return handleMethodNotAllowed(); }
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Company-Token, X-Tenant-Id, X-Operator-Id',
    },
  });
}

function handleMethodNotAllowed() {
  return NextResponse.json({ error: 'Metodo nao permitido para este endpoint mobile.' }, { status: 405 });
}
