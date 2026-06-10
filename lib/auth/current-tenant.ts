import { SessionUser } from './session';

export function resolveCurrentTenantId(session: SessionUser): string {
  return session.activeTenantId || session.tenantId || session.defaultTenantId;
}

