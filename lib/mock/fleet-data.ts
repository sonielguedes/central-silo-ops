
export const EQUIPMENT_MOCK = [
  { id: '601076', name: 'CAM PLANTIO', type: 'CAMINHÃO', operation: 'SEM OPERAÇÃO', status: 'deslocando', model: 'Scania R540', operator: 'Ricardo Silva', farm: 'Faz. Santa Clara', field: 'Talhão 12', signal: 'Agora' },
  { id: '613020', name: 'CARREGADEIRA', type: 'CARREGADEIRA', operation: 'AGUARDANDO CAMINHÃO', status: 'parada', model: 'Volvo L120H', operator: 'Marcos Souza', farm: 'Faz. Santa Clara', field: 'Talhão 14', signal: '2 min' },
  { id: '614004', name: 'CARREG BELL', type: 'CARREGADEIRA', operation: 'RPM MÁXIMA MOTOR', status: 'alarme', model: 'Bell L2106E', operator: 'Luiz Castro', farm: 'Frente 03', field: 'Talhão 05', signal: 'Agora' },
  { id: '602073', name: 'TR TRANSBORDO', type: 'TRANSBORDO', operation: 'MANUTENÇÃO OFICINA', status: 'manutencao', model: 'Case IH Steiger', operator: 'Antônio M.', farm: 'Oficina Central', field: 'Setor A', signal: '12 min' },
  { id: '605112', name: 'COLHEDORA JD', type: 'COLHEDORA', operation: 'COLHEITA SOJA', status: 'trabalhando', model: 'John Deere S770', operator: 'João P.', farm: 'Faz. Santa Clara', field: 'Talhão 12', signal: 'Agora' },
  { id: '609001', name: 'TRATOR CASE', type: 'TRATOR', operation: 'OFFLINE', status: 'offline', model: 'Case Magnum 340', operator: 'Indisponível', farm: 'Faz. Santa Clara', field: 'Talhão 18', signal: '45 min' },
];

export const OPERATORS_MOCK = [
  { id: '1', name: 'Ricardo Silva', role: 'Motorista', status: 'ativo', equipment: '601076', shift: 'Turno A', lastActivity: 'Agora' },
  { id: '2', name: 'Marcos Souza', role: 'Operador Máquina', status: 'ativo', equipment: '613020', shift: 'Turno A', lastActivity: '5 min' },
  { id: '3', name: 'Luiz Castro', role: 'Operador Máquina', status: 'ativo', equipment: '614004', shift: 'Turno B', lastActivity: 'Agora' },
  { id: '4', name: 'João P.', role: 'Operador Máquina', status: 'ativo', equipment: '605112', shift: 'Turno C', lastActivity: 'Agora' },
];

export const FARMS_MOCK = [
  { id: '1', name: 'Fazenda Santa Clara', location: 'Sorriso/MT', area: '12.500 ha', status: 'em_operacao', field_count: 24 },
  { id: '2', name: 'Fazenda Rio Verde', location: 'Lucas do Rio Verde/MT', area: '8.200 ha', status: 'planejado', field_count: 15 },
];

export const STOPS_MOCK = [
  { id: '1', equipment: '613020', reason: 'Aguardando Caminhão', start: '14:30', duration: '25 min', type: 'operacional' },
  { id: '2', equipment: '602073', reason: 'Manutenção Preventiva', start: '08:00', duration: '6h 45min', type: 'tecnica' },
];
