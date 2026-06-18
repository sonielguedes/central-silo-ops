import { PimsFileAdapter } from '@/lib/integrations/adapters/pims-file-adapter';
import { TotvsPlaceholderAdapter } from '@/lib/integrations/adapters/totvs-placeholder-adapter';
import type { IntegrationAdapter, IntegrationTargetSystem } from '@/lib/integrations/integration-types';

const PIMS = new PimsFileAdapter();
const TOTVS = new TotvsPlaceholderAdapter();

export function resolveIntegrationAdapter(
  targetSystem: IntegrationTargetSystem,
  targetAdapter?: string | null,
): IntegrationAdapter {
  if (targetAdapter === 'TOTVS_PLACEHOLDER' || targetSystem === 'TOTVS') return TOTVS;
  return PIMS;
}

