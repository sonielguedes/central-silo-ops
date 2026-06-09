import type { PrimaryMetric } from '@/lib/types';

export const FLEET_TYPE_CATEGORIES = [
  'Agrícola',
  'Implemento',
  'Rodoviário',
  'Apoio',
  'Infraestrutura',
  'Construção',
  'Tecnologia',
  'Outros',
] as const;

export type FleetTypeCategory = (typeof FLEET_TYPE_CATEGORIES)[number];

export const FLEET_OPERATIONAL_GROUPS = [
  'MAQUINA_AGRICOLA',
  'APOIO_AGRICOLA',
  'IMPLEMENTO',
  'RODOVIARIO',
  'APOIO',
  'INFRAESTRUTURA',
  'MAQUINA_PESADA',
  'TECNOLOGIA',
  'OUTROS',
] as const;

export type FleetOperationalGroup = (typeof FLEET_OPERATIONAL_GROUPS)[number];

export const PRIMARY_METRIC_OPTIONS = ['HORIMETRO', 'KM', 'HORAS', 'UNIDADE'] as const;

export const DEFAULT_PRIMARY_METRIC_BY_CATEGORY: Record<FleetTypeCategory, PrimaryMetric> = {
  'Agrícola': 'HORIMETRO',
  'Implemento': 'HORIMETRO',
  'Rodoviário': 'KM',
  'Apoio': 'KM',
  'Infraestrutura': 'UNIDADE',
  'Construção': 'HORIMETRO',
  'Tecnologia': 'UNIDADE',
  'Outros': 'UNIDADE',
};

export const DEFAULT_GROUP_BY_CATEGORY: Record<FleetTypeCategory, FleetOperationalGroup> = {
  'Agrícola': 'MAQUINA_AGRICOLA',
  'Implemento': 'IMPLEMENTO',
  'Rodoviário': 'RODOVIARIO',
  'Apoio': 'APOIO',
  'Infraestrutura': 'INFRAESTRUTURA',
  'Construção': 'MAQUINA_PESADA',
  'Tecnologia': 'TECNOLOGIA',
  'Outros': 'OUTROS',
};

export function resolveDefaultPrimaryMetric(category?: string): PrimaryMetric {
  if (!category) return 'HORIMETRO';
  return DEFAULT_PRIMARY_METRIC_BY_CATEGORY[category as FleetTypeCategory] ?? 'HORIMETRO';
}

export function resolveDefaultOperationalGroup(category?: string): FleetOperationalGroup {
  if (!category) return 'OUTROS';
  return DEFAULT_GROUP_BY_CATEGORY[category as FleetTypeCategory] ?? 'OUTROS';
}
