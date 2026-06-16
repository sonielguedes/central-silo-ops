/**
 * POST /api/mobile/journeys/start
 *
 * Inicia uma jornada operacional a partir da tela "Seleção Operacional" do APK.
 *
 * Autenticação: X-Company-Token (requireMobileAuth).
 *
 * Validações server-side (em ordem):
 *  1. tenantId obrigatório (vem do token — não do body).
 *  2. Operador ativo e pertencente ao tenant.
 *  3. Equipamento ativo, mobileEnabled, pertencente ao tenant.
 *  4. Ordem de Serviço aberta e pertencente ao tenant.
 *  5. Centro de Custo ativo e pertencente ao tenant.
 *  6. Operação válida (não finalizada/cancelada) e pertencente ao tenant.
 *  7. Implemento: opcional, mas se enviado deve existir e estar disponível.
 *  8. Jornada duplicada: bloquear se mesmo equipamento JÁ tem jornada OPERANDO.
 */

import { NextRequest, NextResponse } from 'next/server';
import { CadastroStorage } from '@/lib/cadastro-storage';
import { ServerStorage } from '@/lib/server-storage';
import { requireMobileAuth } from '@/lib/auth/api-guard';
import { auditFromRequest } from '@/lib/audit/audit-log';

export const dynamic = 'force-dynamic';

// ── types ────────────────────────────────────────────────────────────────────

type Item = Record<string, unknown>;

interface JourneyStartBody {
  // Operador
  operatorId?: string;
  operatorRegistration?: string;
  registration?: string;
  matricula?: string;
  // Equipamento
  equipmentId?: string;
  equipmentCode?: string;
  fleetCode?: string;
  // Seleção Operacional (todos obrigatórios exceto implemento)
  workOrderId: string;
  costCenterId: string;
  operationId: string;
  implementId?: string;          // opcional
  // Horímetro
  hourmeterStart?: number;
  // Timestamps
  startedAt?: string;
  offlineId?: string;
}

// ── helpers ───────────────────────────────────────────────────────────────────

const norm = (v: unknown) => String(v ?? '').trim().toLowerCase();

const INACTIVE = new Set(['INATIVO', 'inativo', 'ARQUIVADO', 'arquivado']);

function isActive(item: Item): boolean {
  const es = String(item.entityStatus ?? 'ATIVO');
  return !INACTIVE.has(es) && item.deletedAt == null;
}

function isMobileEnabled(item: Item): boolean {
  return item.mobileEnabled !== false && item.mobileEnabled !== 'false';
}

function findByIds(items: Item[], ...ids: (string | undefined)[]): Item | undefined {
  const candidates = ids.map(norm).filter(Boolean);
  if (!candidates.length) return undefined;
  return items.find(item => {
    const keys = [item.id, item.code, item.registration, item.matricula].map(norm);
    return keys.some(k => k && candidates.includes(k));
  });
}

function err(msg: string, status: number) {
  return NextResponse.json({ error: msg }, { status });
}

const asHourmeter = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : undefined;

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = requireMobileAuth(req);
    if (!auth.ok) return auth.response;

    const { tenantId } = auth;
    const body = (await req.json()) as JourneyStartBody;

    // ── Campos obrigatórios mínimos ───────────────────────────────────────────
    if (!body.workOrderId)  return err('workOrderId é obrigatório', 400);
    if (!body.costCenterId) return err('costCenterId é obrigatório', 400);
    if (!body.operationId)  return err('operationId é obrigatório', 400);

    const operatorKey = body.operatorId ?? body.operatorRegistration ?? body.registration ?? body.matricula;
    if (!operatorKey) return err('Operador não identificado', 400);

    const equipKey = body.equipmentId ?? body.equipmentCode ?? body.fleetCode;
    if (!equipKey) return err('Equipamento não identificado', 400);

    // ── 1. Validar Operador ───────────────────────────────────────────────────
    const operators = CadastroStorage.getAll(tenantId, 'operadores') as Item[];
    const operator = findByIds(operators, operatorKey);
    if (!operator) return err('Operador não encontrado', 404);
    if (!isActive(operator)) return err('Operador inativo', 403);

    const operatorId    = String(operator.id ?? '');
    const operatorReg   = String(operator.registration ?? operator.matricula ?? operator.id ?? '');
    const operatorName  = typeof operator.name === 'string' ? operator.name : operatorReg;

    // ── 2. Validar Equipamento ────────────────────────────────────────────────
    const equipments = CadastroStorage.getAll(tenantId, 'equipamentos') as Item[];
    const equipment = findByIds(equipments, body.equipmentId, body.equipmentCode, body.fleetCode);
    if (!equipment) return err('Equipamento não encontrado', 404);
    if (!isActive(equipment)) return err('Equipamento inativo', 403);
    if (!isMobileEnabled(equipment)) return err('Equipamento desabilitado para mobile', 403);

    const equipmentId   = String(equipment.id ?? '');
    const equipmentCode = String(equipment.code ?? '');

    // ── 3. Verificar jornada duplicada ────────────────────────────────────────
    const fleet = ServerStorage.getLiveFleet(tenantId);
    const liveState = fleet.find(s => s.equipmentId === equipmentId);
    if (liveState?.status === 'OPERANDO') {
      return err(
        `Equipamento ${equipmentCode} já possui jornada ativa (ID: ${liveState.journeyId ?? 'desconhecido'})`,
        409,
      );
    }

    // ── 4. Validar Ordem de Serviço ───────────────────────────────────────────
    const orders = CadastroStorage.getAll(tenantId, 'ordens-servico') as Item[];
    const workOrder = orders.find(o => norm(o.id) === norm(body.workOrderId));
    if (!workOrder) return err('Ordem de Serviço não encontrada', 404);
    if (!isActive(workOrder)) return err('Ordem de Serviço arquivada', 403);
    if (workOrder.status !== 'ABERTA') {
      return err(`Ordem de Serviço não está aberta (status: ${workOrder.status})`, 409);
    }

    // ── 5. Validar Centro de Custo ────────────────────────────────────────────
    const costCenters = CadastroStorage.getAll(tenantId, 'centros-custo') as Item[];
    const costCenter = costCenters.find(c => norm(c.id) === norm(body.costCenterId));
    if (!costCenter) return err('Centro de Custo não encontrado', 404);
    if (!isActive(costCenter)) return err('Centro de Custo inativo', 403);
    if (costCenter.status !== 'ATIVO') return err('Centro de Custo inativo', 403);

    // ── 6. Validar Operação ───────────────────────────────────────────────────
    const TERMINAL_OPS = new Set(['FINALIZADA', 'CANCELADA']);
    const operations = CadastroStorage.getAll(tenantId, 'operacoes') as Item[];
    const operation = operations.find(o => norm(o.id) === norm(body.operationId));
    if (!operation) return err('Operação não encontrada', 404);
    if (!isActive(operation)) return err('Operação arquivada', 403);
    if (TERMINAL_OPS.has(String(operation.status ?? ''))) {
      return err(`Operação não disponível (status: ${operation.status})`, 409);
    }

    // ── 7. Validar Implemento (opcional) ──────────────────────────────────────
    let implementId: string | undefined;
    let implementCode: string | undefined;
    if (body.implementId) {
      const implements_ = CadastroStorage.getAll(tenantId, 'implementos') as Item[];
      const implement = implements_.find(i => norm(i.id) === norm(body.implementId!));
      if (!implement) return err('Implemento não encontrado', 404);
      if (!isActive(implement)) return err('Implemento inativo', 403);
      if (['INATIVO', 'MANUTENCAO'].includes(String(implement.status ?? ''))) {
        return err('Implemento não disponível', 409);
      }
      implementId   = String(implement.id ?? '');
      implementCode = String(implement.code ?? '');
    }

    // ── 8. Iniciar jornada ────────────────────────────────────────────────────
    const journeyId    = `journey-${Date.now()}`;
    const startedAt    = body.startedAt || new Date().toISOString();
    const offlineId    = body.offlineId || `start-${Date.now()}`;
    const hourmeterStart = asHourmeter(body.hourmeterStart);

    // Atualizar live state
    ServerStorage.updateLiveState(tenantId, equipmentId, equipmentCode, {
      status:              'OPERANDO',
      journeyId,
      operatorRegistration: operatorReg,
      registration:         operatorReg,
      operatorName,
      currentOperator:     operatorName,
      workOrder:           String(workOrder.code ?? body.workOrderId),
      costCenter:          String(costCenter.code ?? body.costCenterId),
      operationCode:       String(operation.type ?? body.operationId),
      implementCode:       implementCode,
      ...(hourmeterStart !== undefined
        ? { hourmeterStart, hourmeterCurrent: hourmeterStart }
        : {}),
      updatedAt: startedAt,
    });

    // Atualizar cadastro do equipamento
    ServerStorage.updateEquipment(
      equipmentId,
      { activeShiftId: journeyId, currentOperatorId: operatorReg, status: 'trabalhando' },
      tenantId,
    );

    // Salvar evento
    ServerStorage.saveEvent(
      {
        offlineId,
        equipmentId,
        type: 'JOURNEY_START',
        timestamp: startedAt,
        payload: {
          journeyId,
          equipmentId,
          equipmentCode,
          operatorId,
          operatorRegistration: operatorReg,
          operatorName,
          workOrderId:  body.workOrderId,
          workOrderCode: String(workOrder.code ?? ''),
          costCenterId: body.costCenterId,
          costCenterCode: String(costCenter.code ?? ''),
          operationId:  body.operationId,
          operationType: String(operation.type ?? ''),
          implementId,
          implementCode,
          hourmeterStart: hourmeterStart ?? null,
          startedAt,
          offlineId,
        },
      },
      tenantId,
    );

    // Auditoria
    auditFromRequest(req, tenantId, {
      action: 'JOURNEY_START',
      entity: 'journey',
      entityId: journeyId,
      metadata: {
        equipmentId, equipmentCode, operatorRegistration: operatorReg,
        workOrderId: body.workOrderId, costCenterId: body.costCenterId,
        operationId: body.operationId, implementId,
      },
    });

    return NextResponse.json({
      success: true,
      journeyId,
      equipmentId,
      equipmentCode,
      operatorId,
      operatorRegistration: operatorReg,
      operatorName,
      workOrderId:   body.workOrderId,
      workOrderCode: String(workOrder.code ?? ''),
      costCenterId:  body.costCenterId,
      costCenterCode: String(costCenter.code ?? ''),
      operationId:   body.operationId,
      operationType: String(operation.type ?? ''),
      implementId,
      implementCode,
      hourmeterStart: hourmeterStart ?? null,
      startedAt,
    });
  } catch (error) {
    console.error('[mobile/journeys/start] unhandled error', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
