export type EquipmentIconResolverInput = {
  type?: string | null;
  category?: string | null;
  equipmentType?: string | null;
  fleetCode?: string | null;
  status?: string | null;
  online?: boolean | null;
  isOffline?: boolean | null;
};

export type EquipmentIconResolution = {
  src: string;
  label: string;
  kind: string;
  isOffline: boolean;
};

const ICON_BASE = '/icons/equipamentos';
const GENERIC_KIND = 'generico';
const KNOWN_ICON_KINDS = new Set([
  'caminhao',
  'caminhao-borracheiro',
  'caminhao-cavalo-vazio',
  'caminhao-prancha',
  'colhedora',
  'comboio',
  'distribuidor-solidos',
  'escavadeira-garra',
  'motobomba',
  'pulverizador',
  'trator',
  'trator-transbordo',
  'trator-esteira',
  'vinhaca',
  GENERIC_KIND,
]);

const ICON_LABELS: Record<string, string> = {
  caminhao: 'Caminhao',
  'caminhao-borracheiro': 'Caminhao borracheiro',
  'caminhao-cavalo-vazio': 'Caminhao cavalo vazio',
  'caminhao-prancha': 'Caminhao prancha',
  colhedora: 'Colhedora',
  comboio: 'Comboio',
  'distribuidor-solidos': 'Distribuidor de solidos',
  'escavadeira-garra': 'Escavadeira com garra',
  motobomba: 'Motobomba',
  pulverizador: 'Pulverizador',
  trator: 'Trator',
  'trator-transbordo': 'Trator + Transbordo',
  'trator-esteira': 'Trator de esteira',
  vinhaca: 'Vinhaca',
  generico: 'Generico',
};

const OFFLINE_STATUSES = new Set(['OFFLINE', 'FINALIZADO', 'DESCONECTADO', 'INATIVO']);

export function normalizeEquipmentIconKey(value?: string | null): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolveKind(text: string): string {
  if (!text) return GENERIC_KIND;
  if (text.includes('transbordo')) return 'trator-transbordo';
  if (text.includes('esteira') || text.includes('dozer')) return 'trator-esteira';
  if (text.includes('borracheiro')) return 'caminhao-borracheiro';
  if (text.includes('cavalo') && text.includes('vazio')) return 'caminhao-cavalo-vazio';
  if (text.includes('prancha') || text.includes('carreta prancha')) return 'caminhao-prancha';
  if (text.includes('distribuidor') && text.includes('solido')) return 'distribuidor-solidos';
  if (text.includes('escavadeira') || text.includes('excavator')) return 'escavadeira-garra';
  if (text.includes('vinhaca') || text.includes('vinhaca')) return 'vinhaca';
  if (text.includes('colhedora') || text.includes('harvester')) return 'colhedora';
  if (text.includes('pulverizador') || text.includes('sprayer')) return 'pulverizador';
  if (text.includes('comboio')) return 'comboio';
  if (text.includes('motobomba') || text.includes('bomba')) return 'motobomba';
  if (text.includes('caminhao') || text.includes('truck')) return 'caminhao';
  if (text.includes('trator') || text.includes('tractor')) return 'trator';
  return GENERIC_KIND;
}

function resolveOffline(input: EquipmentIconResolverInput): boolean {
  if (input.isOffline === true) return true;
  if (input.online === false) return true;
  const status = String(input.status ?? '').trim().toUpperCase();
  return OFFLINE_STATUSES.has(status);
}

export function resolveEquipmentIcon(input: EquipmentIconResolverInput): EquipmentIconResolution {
  const text = normalizeEquipmentIconKey([
    input.type,
    input.category,
    input.equipmentType,
    input.fleetCode,
  ].filter(Boolean).join(' '));
  const resolvedKind = resolveKind(text);
  const kind = KNOWN_ICON_KINDS.has(resolvedKind) ? resolvedKind : GENERIC_KIND;
  const isOffline = resolveOffline(input);
  const suffix = isOffline ? '-off' : '';

  return {
    src: `${ICON_BASE}/${kind}${suffix}.png`,
    label: ICON_LABELS[kind] ?? ICON_LABELS.generico,
    kind,
    isOffline,
  };
}

export function getFallbackEquipmentIconSrc(input?: Pick<EquipmentIconResolverInput, 'status' | 'online' | 'isOffline'>): string {
  const isOffline = resolveOffline(input ?? {});
  return `${ICON_BASE}/${GENERIC_KIND}${isOffline ? '-off' : ''}.png`;
}

export function isKnownEquipmentIconSrc(src?: string | null): boolean {
  const match = String(src ?? '').match(/^\/icons\/equipamentos\/([a-z0-9-]+?)(-off)?\.png$/);
  return Boolean(match && KNOWN_ICON_KINDS.has(match[1]));
}

export function resolveSafeEquipmentIconSrc(
  src: string | null | undefined,
  fallbackInput: EquipmentIconResolverInput = {},
): string {
  return isKnownEquipmentIconSrc(src) ? String(src) : resolveEquipmentIcon(fallbackInput).src;
}
