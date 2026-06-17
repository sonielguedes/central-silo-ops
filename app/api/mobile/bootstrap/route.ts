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
 * "OS-100" → "100", "100" → "100", "z31nbt2kz" → null (sem dígitos suficientes não conta)
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
    const equipments = (CadastroStorage.getAll(tenantId, 'equipamentos') as StorageItem[])
      .filter(e => isEntityActive(e) && isMobileEnabled(e));

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

    // ── 7. Operador autenticado (se enviado no header) ───────────────────────
    let operator: StorageItem | undefined;
    if (operatorId) {
      const operators = CadastroStorage.getAll(tenantId, 'operadores') as StorageItem[];
      const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();
      operator = operators.find(op =>
        [op.id, op.registration, op.matricula].map(norm).includes(norm(operatorId))
      );
    }

    // ── 8. Montar pacote ──────────────────────────────────────────────────────
    const updatedAt = new Date().toISOString();
    const payload = {
      tenantId,
      operator: operator ? redactOperator(operator) : null,
      equipments,
      workOrders,
      costCenters,
      implements: implements_,
      operations,
      stopReasons,
      updatedAt,
    };

    const version = sha1(payload);

    console.info('[mobile/bootstrap] synced', {
      tenantId,
      operatorId: operatorId ?? '-',
      equipments:  equipments.length,
      workOrders:  workOrders.length,
      costCenters: costCenters.length,
      implements:  implements_.length,
      operations:  operations.length,
      stopReasons: stopReasons.length,
      hasOperator: !!operator,
      version,
    });

    return NextResponse.json({ ...payload, version });
  } catch (err) {
    console.error('[mobile/bootstrap] unhandled error', err);
    return NextResponse.json({ error: 'Erro interno ao gerar pacote de bootstrap' }, { status: 500 });
  }
}
