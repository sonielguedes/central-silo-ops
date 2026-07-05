type ComboioBombaSource = {
  pumpCode?: string | null;
  comboioFleetCode?: string | null;
  truckFleetCode?: string | null;
  comboioDescription?: string | null;
  tankCode?: string | null;
  deviceAlias?: string | null;
};

type FuelProductSource = {
  productDescription?: string | null;
  fuelType?: string | null;
  productCode?: string | null;
  product?: string | null;
};

type OperatorSource = {
  operatorName?: string | null;
  driverName?: string | null;
  operatorRegistration?: string | null;
  driverRegistration?: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clean(value?: string | null): string {
  return String(value ?? '').trim();
}

export function resolveComboioBomba(record: ComboioBombaSource): string {
  const comboio = clean(record.comboioFleetCode) || clean(record.truckFleetCode);
  const pump = clean(record.pumpCode);

  const comboioValid = comboio && !UUID_PATTERN.test(comboio) ? comboio : '';
  const pumpValid = pump && !UUID_PATTERN.test(pump) ? pump : '';

  if (comboioValid && pumpValid) {
    if (comboioValid === pumpValid) return comboioValid;
    return `${comboioValid} / ${pumpValid}`;
  }
  if (comboioValid) {
    return comboioValid;
  }
  if (pumpValid) {
    return pumpValid;
  }

  return 'Não informado';
}

const PRODUCT_LABELS: Record<string, string> = {
  DIESELS10: 'Diesel S-10',
  DIESELS500: 'Diesel S-500',
  DIESEL: 'Diesel',
  GASOLINA: 'Gasolina',
  ETANOL: 'Etanol',
  FLEX: 'Flex',
  ELETRICO: 'Elétrico',
  NAOAPLICA: 'Não aplicável',
};

function normalizeProductKey(value?: string | null): string {
  return clean(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function translateProductCode(value?: string | null): string | null {
  const normalized = normalizeProductKey(value);
  return PRODUCT_LABELS[normalized] ?? null;
}

export function resolveFuelProduct(record: FuelProductSource): string {
  const description = clean(record.productDescription);
  if (description) return translateProductCode(description) ?? description;

  const fuelType = clean(record.fuelType);
  if (fuelType) {
    const translated = translateProductCode(fuelType);
    if (translated) return translated;
    if (!/^[A-Z0-9_\- ]+$/.test(fuelType)) return fuelType;
  }

  const productCode = normalizeProductKey(record.productCode ?? record.product);
  if (!productCode) return 'Não informado';

  return translateProductCode(productCode) ?? record.productCode?.trim() ?? record.product?.trim() ?? 'Não informado';
}

export function resolveOperatorDisplay(record: OperatorSource): string {
  return (
    clean(record.operatorName) ||
    clean(record.driverName) ||
    clean(record.operatorRegistration) ||
    clean(record.driverRegistration) ||
    '—'
  );
}

export function resolveFuelSyncStatus(status?: string | null): string {
  const value = clean(status).toUpperCase();
  if (value === 'SYNCED') return 'Sincronizado';
  if (value === 'PENDING' || value === 'PENDENTE_SYNC') return 'Pendente';
  if (value === 'ERROR' || value === 'ERRO_SYNC') return 'Erro';
  return status?.trim() || '—';
}
