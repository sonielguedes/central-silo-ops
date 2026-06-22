const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  VALIDATING: 'Validando',
  BLOCKED: 'Bloqueado',
  SENDING: 'Enviando',
  SUCCESS: 'Sucesso',
  SYNCED: 'Sincronizado',
  FAILED: 'Falhou',
  RETRYING: 'Reprocessando',
  CANCELED: 'Cancelado',
  ACTIVE: 'Ativo',
  INACTIVE: 'Inativo',
  PENDING_REVIEW: 'Pendente de revisão',
  ATIVA: 'Ativa',
  FINALIZADA: 'Finalizada',
  INCONSISTENTE: 'Inconsistente',
  PENDENTE_SYNC: 'Pendente de sincronização',
  ERRO_SYNC: 'Erro de sincronização',
  HOMOLOGACAO: 'Homologação',
  PRODUCAO: 'Produção',
  WARNING: 'Alerta',
};

const PIMS_MAPPING_TYPE_LABELS: Record<string, string> = {
  OPERATION: 'Operação',
  STOP_REASON: 'Motivo de parada',
  COST_CENTER: 'Centro de Custo',
  EQUIPMENT: 'Equipamento',
  OPERATOR: 'Operador',
  IMPLEMENT: 'Implemento',
  WORK_ORDER: 'Ordem de Serviço',
  FICHA_FIELD: 'Campo da ficha',
};

const VALIDATION_TARGET_LABELS: Record<string, string> = {
  FICHA_OPERADOR: 'Ficha do Operador',
  JOURNEY: 'Jornada',
  STOP_EVENTS: 'Eventos de Parada',
  FULL_OPERATIONAL_PACKAGE: 'Pacote Operacional Completo',
};

export function translateStatusLabel(value: string): string {
  return STATUS_LABELS[value] ?? value;
}

export function translateMappingTypeLabel(value: string): string {
  return PIMS_MAPPING_TYPE_LABELS[value] ?? value;
}

export function translateValidationTargetLabel(value: string): string {
  return VALIDATION_TARGET_LABELS[value] ?? value;
}
