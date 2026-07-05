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
  DIESEL_S10: 'Diesel S-10',
  DIESEL_S500: 'Diesel S-500',
  DIESEL: 'Diesel',
  GASOLINA: 'Gasolina',
  ETANOL: 'Etanol',
  FLEX: 'Flex',
  ELETRICO: 'Elétrico',
  NAO_APLICA: 'Não aplicável',
};

function normalizeProductCode(value?: string | null): string {
  return clean(value)
    .toUpperCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^A-Z0-9_]/g, '');
}

export function resolveFuelProduct(record: FuelProductSource): string {
  const description = clean(record.productDescription);
  if (description) return description;

  const fuelType = clean(record.fuelType);
  if (fuelType) return fuelType;

  const productCode = normalizeProductCode(record.productCode ?? record.product);
  if (!productCode) return 'Não informado';

  return PRODUCT_LABELS[productCode] ?? record.productCode?.trim() ?? record.product?.trim() ?? 'Não informado';
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
