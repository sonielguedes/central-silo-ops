import { resolveIconType, type EquipmentIconType } from '@/lib/equipment-icon-types';

type CatalogLike = {
  iconType?: string | null;
  type?: string | null;
  name?: string | null;
  model?: string | null;
  category?: string | null;
  brand?: string | null;
  manufacturer?: string | null;
};

type ResolutionInput = {
  type?: string | null;
  model?: string | null;
  category?: string | null;
  metadata?: { equipmentType?: string | null } | null;
  name?: string | null;
  brand?: string | null;
  code?: string | null;
  iconType?: string | null;
};

const KEYWORDS: Array<{ test: RegExp; iconType: EquipmentIconType }> = [
  { test: /\b(COLH|COLHEIT|HARVEST|HARVESTER|S680|S770|S790)\b/i, iconType: 'COLHEDORA' },
  { test: /\b(SULCADOR|SULCAD|RIDGER)\b/i, iconType: 'SULCADOR' },
  { test: /\b(TRATOR|TRACTOR|MAGNUM|ROWTRAC|M8|MX|MASSEY|FENDT|JOHN\s?DEERE|CASE\s?IH)\b/i, iconType: 'TRATOR' },
  { test: /\b(TRANSBORD|GRUNNER|CHASIS|RECOLH|TRB)\b/i, iconType: 'TRANSBORDO' },
  { test: /\b(PIPA|WATER|AQUA|HIDRO|TANK)\b/i, iconType: 'CAMINHAO_PIPA' },
  { test: /\b(COMBOIO|ABASTEC|FUEL|SUPPLY|SUPORTE\s?ABASTEC)\b/i, iconType: 'COMBOIO' },
  { test: /\b(CARREGADEIRA|LOADER|PA\s?CARREGA|WHEEL\s?LOADER)\b/i, iconType: 'PA_CARREGADEIRA' },
  { test: /\b(ESCAVA|EXCAV|DIGGER)\b/i, iconType: 'ESCAVADEIRA' },
  { test: /\b(MOTONIVEL|GRADER)\b/i, iconType: 'MOTONIVELADORA' },
  { test: /\b(TRATOR.*ESTEIRA|BULLDOZER|DOZER)\b/i, iconType: 'TRATOR_ESTEIRA' },
  { test: /\b(PLANT|SEED|SOWER|SEMEAD)\b/i, iconType: 'PLANTADEIRA' },
  { test: /\b(PULVER|SPRAY|SPRAYER)\b/i, iconType: 'PULVERIZADOR' },
  { test: /\b(CAMINHAO_BASCULANTE|BASCUL|DUMP|TIPPER)\b/i, iconType: 'CAMINHAO_BASCULANTE' },
  { test: /\b(CAMINHAO_PIPA|PIPA)\b/i, iconType: 'CAMINHAO_PIPA' },
  { test: /\b(CAMINHAO|CAMINH|TRUCK|CARGO|VEICUL|CAVALO)\b/i, iconType: 'CAMINHAO' },
  { test: /\b(GRADE\s?IMPLEMENTO|GRADE|IMPLEMENTO|ARADO|DISC|PLOW|PRANCHA)\b/i, iconType: 'GRADE_IMPLEMENTO' },
  { test: /\b(RFID|LEITOR|GATE|ANTENA)\b/i, iconType: 'LEITOR_RFID' },
  { test: /\b(MOBILE|TABLET|SMARTPHONE)\b/i, iconType: 'MOBILE' },
  { test: /\b(CARRO|PICK\s?UP|PICAPE|UTILITARIO|VEICULO)\b/i, iconType: 'VEICULO' },
];

export function normalizeEquipmentIconText(value: string | null | undefined): string {
  if (!value) return '';
  return String(value)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-\/.,;:(){}\[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toText(...values: Array<string | null | undefined>): string {
  return normalizeEquipmentIconText(values.filter(Boolean).map((v) => String(v)).join(' '));
}

function keywordResolve(text: string): EquipmentIconType | null {
  const normalized = normalizeEquipmentIconText(text);
  for (const rule of KEYWORDS) {
    if (rule.test.test(normalized)) return rule.iconType;
  }
  return null;
}

export function resolveEquipmentIconTypeFromContext(
  input: ResolutionInput,
  catalog?: CatalogLike | null,
): EquipmentIconType {
  const explicitIconType = resolveIconType(input.iconType ?? null);
  if (explicitIconType !== 'PADRAO_GENERICO') return explicitIconType;

  const typeCandidate = resolveIconType(input.type ?? null);
  if (typeCandidate !== 'PADRAO_GENERICO') return typeCandidate;

  const modelCandidate = resolveIconType(input.model ?? null);
  if (modelCandidate !== 'PADRAO_GENERICO') return modelCandidate;

  const categoryCandidate = resolveIconType(input.category ?? null);
  if (categoryCandidate !== 'PADRAO_GENERICO') return categoryCandidate;

  const metadataCandidate = resolveIconType(input.metadata?.equipmentType ?? null);
  if (metadataCandidate !== 'PADRAO_GENERICO') return metadataCandidate;

  const catalogCandidate =
    resolveIconType(catalog?.iconType ?? null) !== 'PADRAO_GENERICO'
      ? resolveIconType(catalog?.iconType ?? null)
      : resolveIconType(toText(catalog?.type, catalog?.model, catalog?.category, catalog?.brand, catalog?.manufacturer));
  if (catalogCandidate !== 'PADRAO_GENERICO') return catalogCandidate;

  const keywordCandidate = keywordResolve(
    toText(
      input.type,
      input.model,
      input.category,
      input.metadata?.equipmentType,
      input.name,
      input.brand,
      input.code,
      catalog?.type,
      catalog?.model,
      catalog?.category,
      catalog?.brand,
      catalog?.manufacturer,
    ),
  );
  if (keywordCandidate) return keywordCandidate;

  return 'PADRAO_GENERICO';
}
