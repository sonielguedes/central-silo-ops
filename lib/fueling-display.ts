type ComboioBombaSource = {
  pumpCode?: string | null;
  comboioFleetCode?: string | null;
  comboioDescription?: string | null;
  tankCode?: string | null;
  deviceAlias?: string | null;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clean(value?: string | null): string {
  return String(value ?? '').trim();
}

export function resolveComboioBomba(record: ComboioBombaSource): string {
  const candidate =
    clean(record.pumpCode) ||
    clean(record.comboioFleetCode) ||
    clean(record.comboioDescription) ||
    clean(record.tankCode) ||
    clean(record.deviceAlias);

  if (!candidate || UUID_PATTERN.test(candidate)) {
    return 'Não informado';
  }

  return candidate;
}
