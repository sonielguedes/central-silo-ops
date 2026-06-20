/**
 * lib/operational-profiles.ts
 *
 * Perfil Operacional por Tipo de Equipamento — SILO OPS Central.
 *
 * Define quais operações, motivos de parada e modo de medição
 * cada perfil de equipamento pode usar.
 *
 * REGRA: fleetCode sempre String. Nunca Number.
 * REGRA: operatorRegistration sempre String. Nunca Number.
 */

// ── Tipos ────────────────────────────────────────────────────────────────────

export type OperationalProfileCode =
  | 'COLHEITA'
  | 'TRANSBORDO'
  | 'PREPARO_DE_SOLO'
  | 'PLANTIO'
  | 'APLICACAO'
  | 'TRANSPORTE'
  | 'ABASTECIMENTO'
  | 'MANUTENCAO'
  | 'APOIO'
  | 'GENERICO';

export type MeasurementMode = 'HORIMETRO' | 'KM' | 'AMBOS';

export interface OperationalProfile {
  code: OperationalProfileCode;
  name: string;
  description: string;
  measurementMode: MeasurementMode;
  /**
   * Códigos de operação permitidos (array de strings como "1001", "1003").
   * null = sem restrição (perfil GENERICO).
   * Se o código da operação NÃO estiver no catálogo mestre, ele sempre passa
   * (compatibilidade com operações customizadas dos clientes).
   */
  allowedOperationCodes: string[] | null;
  /**
   * Categorias de motivo de parada permitidas.
   * null = sem restrição.
   */
  allowedStopReasonCategories: string[] | null;
  requiresImplement: boolean;
  requiresWorkOrder: boolean;
  requiresCostCenter: boolean;
}

// ── Mapa de Perfis ────────────────────────────────────────────────────────────

/**
 * Códigos do catálogo mestre de operações (ensure-operations-catalog.ts):
 *  '1001' - Preparo de Solo
 *  '1002' - Plantio
 *  '1003' - Colheita
 *  '1004' - Transbordo
 *  '1005' - Aplicacao (Pulverização / Calcareo / Adubação)
 *  '1006' - Manutencao Operacional
 *  '3030' - Operacao Teste
 */
export const OPERATIONAL_PROFILES: Record<OperationalProfileCode, OperationalProfile> = {
  COLHEITA: {
    code:                       'COLHEITA',
    name:                       'Colheita',
    description:                'Colheita mecanizada — colhedoras e plataformas',
    measurementMode:            'HORIMETRO',
    allowedOperationCodes:      ['1003', '1006', '3030'],
    allowedStopReasonCategories: null,
    requiresImplement:          false,
    requiresWorkOrder:          false,
    requiresCostCenter:         true,
  },

  TRANSBORDO: {
    code:                       'TRANSBORDO',
    name:                       'Transbordo',
    description:                'Transbordo e transporte interno de grãos e fibras',
    measurementMode:            'HORIMETRO',
    allowedOperationCodes:      ['1004', '1006', '3030'],
    allowedStopReasonCategories: null,
    requiresImplement:          false,
    requiresWorkOrder:          false,
    requiresCostCenter:         true,
  },

  PREPARO_DE_SOLO: {
    code:                       'PREPARO_DE_SOLO',
    name:                       'Preparo de Solo',
    description:                'Aração, gradagem, subsolagem e nivelamento',
    measurementMode:            'HORIMETRO',
    allowedOperationCodes:      ['1001', '1006', '3030'],
    allowedStopReasonCategories: null,
    requiresImplement:          true,
    requiresWorkOrder:          false,
    requiresCostCenter:         true,
  },

  PLANTIO: {
    code:                       'PLANTIO',
    name:                       'Plantio',
    description:                'Plantio e semeadura de culturas',
    measurementMode:            'HORIMETRO',
    allowedOperationCodes:      ['1002', '1001', '1006', '3030'],
    allowedStopReasonCategories: null,
    requiresImplement:          true,
    requiresWorkOrder:          false,
    requiresCostCenter:         true,
  },

  APLICACAO: {
    code:                       'APLICACAO',
    name:                       'Aplicação',
    description:                'Pulverização, calcáreo, adubação e defensivos',
    measurementMode:            'HORIMETRO',
    allowedOperationCodes:      ['1005', '1006', '3030'],
    allowedStopReasonCategories: null,
    requiresImplement:          true,
    requiresWorkOrder:          false,
    requiresCostCenter:         true,
  },

  TRANSPORTE: {
    code:                       'TRANSPORTE',
    name:                       'Transporte',
    description:                'Transporte rodoviário — caminhões e carretas',
    measurementMode:            'KM',
    allowedOperationCodes:      ['1004', '1006', '3030'],
    allowedStopReasonCategories: null,
    requiresImplement:          false,
    requiresWorkOrder:          false,
    requiresCostCenter:         true,
  },

  ABASTECIMENTO: {
    code:                       'ABASTECIMENTO',
    name:                       'Abastecimento',
    description:                'Comboio e veículo de abastecimento de combustível',
    measurementMode:            'KM',
    allowedOperationCodes:      ['1005', '1006', '3030'],
    allowedStopReasonCategories: null,
    requiresImplement:          false,
    requiresWorkOrder:          false,
    requiresCostCenter:         false,
  },

  MANUTENCAO: {
    code:                       'MANUTENCAO',
    name:                       'Manutenção',
    description:                'Equipamentos em manutenção e apoio técnico',
    measurementMode:            'HORIMETRO',
    allowedOperationCodes:      ['1006', '3030'],
    allowedStopReasonCategories: null,
    requiresImplement:          false,
    requiresWorkOrder:          true,
    requiresCostCenter:         false,
  },

  APOIO: {
    code:                       'APOIO',
    name:                       'Apoio',
    description:                'Veículos de apoio, utilitários e monitoramento',
    measurementMode:            'KM',
    allowedOperationCodes:      ['1004', '1005', '1006', '3030'],
    allowedStopReasonCategories: null,
    requiresImplement:          false,
    requiresWorkOrder:          false,
    requiresCostCenter:         false,
  },

  GENERICO: {
    code:                       'GENERICO',
    name:                       'Genérico',
    description:                'Perfil padrão — sem restrição de operação',
    measurementMode:            'HORIMETRO',
    allowedOperationCodes:      null, // null = permite tudo
    allowedStopReasonCategories: null,
    requiresImplement:          false,
    requiresWorkOrder:          false,
    requiresCostCenter:         false,
  },
};

// ── Conjunto de códigos do catálogo mestre (para validação) ──────────────────

/**
 * Códigos conhecidos do catálogo mestre de operações.
 * Operações com código FORA deste set são consideradas customizadas
 * e sempre passam pelo guard (não bloqueamos o que não conhecemos).
 */
export const MASTER_OPERATION_CODES = new Set([
  '1001', '1002', '1003', '1004', '1005', '1006', '3030',
]);

// ── Funções utilitárias ───────────────────────────────────────────────────────

/**
 * Retorna o perfil operacional de um equipamento.
 * Se o equipamento não tiver perfil definido, retorna GENERICO.
 */
export function getProfileForEquipment(equipment: {
  operationalProfileCode?: string | null;
}): OperationalProfile {
  const code = equipment.operationalProfileCode as OperationalProfileCode | undefined | null;
  if (code && code in OPERATIONAL_PROFILES) {
    return OPERATIONAL_PROFILES[code as OperationalProfileCode];
  }
  return OPERATIONAL_PROFILES.GENERICO;
}

/**
 * Verifica se uma operação é permitida para o perfil do equipamento.
 *
 * Regras:
 * 1. Perfil GENERICO (ou sem perfil): tudo permitido.
 * 2. Código não está no catálogo mestre: permitido (não bloqueamos operações customizadas).
 * 3. Código no catálogo mestre e no allowedOperationCodes: permitido.
 * 4. Código no catálogo mestre e fora do allowedOperationCodes: BLOQUEADO.
 *
 * @param equipment  Equipamento com operationalProfileCode
 * @param operationCode  Código da operação (string, ex: "1003")
 * @returns { allowed: boolean; profile: OperationalProfile }
 */
export function checkOperationAllowed(
  equipment: { operationalProfileCode?: string | null; code?: string },
  operationCode: string | null | undefined,
): { allowed: boolean; profile: OperationalProfile; reason?: string } {
  const profile = getProfileForEquipment(equipment);

  // Perfil genérico ou sem restrições: tudo permitido
  if (profile.allowedOperationCodes === null) {
    return { allowed: true, profile };
  }

  // Sem código de operação informado: não há o que validar
  if (!operationCode || !operationCode.trim()) {
    return { allowed: true, profile };
  }

  const code = String(operationCode).trim();

  // Código fora do catálogo mestre: permitir (operação customizada)
  if (!MASTER_OPERATION_CODES.has(code)) {
    return { allowed: true, profile };
  }

  // Código no catálogo mestre: verificar perfil
  if (profile.allowedOperationCodes.includes(code)) {
    return { allowed: true, profile };
  }

  return {
    allowed: false,
    profile,
    reason: `Operação "${code}" não permitida para o perfil "${profile.code}" (${profile.name}).`,
  };
}

/**
 * Filtra uma lista de operações (do catálogo) para retornar apenas as
 * permitidas para o equipamento.
 *
 * @param equipment  Equipamento com operationalProfileCode
 * @param operations  Lista de operações do cadastro
 */
export function filterOperationsForEquipment(
  equipment: { operationalProfileCode?: string | null },
  operations: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const profile = getProfileForEquipment(equipment);

  // Sem restrição: retorna todas
  if (profile.allowedOperationCodes === null) {
    return operations;
  }

  const allowedSet = new Set(profile.allowedOperationCodes);

  return operations.filter(op => {
    const code = String(op.code ?? '').trim();
    // Se não tem código ou código fora do catálogo mestre: inclui (customizada)
    if (!code || !MASTER_OPERATION_CODES.has(code)) return true;
    return allowedSet.has(code);
  });
}
