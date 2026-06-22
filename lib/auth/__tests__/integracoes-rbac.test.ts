import { canAccessRoute, hasPermission, moduleFromPath } from '../rbac-shared';

describe('integracoes RBAC', () => {
  it('maps /integracoes routes to the integracoes module', () => {
    expect(moduleFromPath('/integracoes/pims')).toBe('integracoes');
    expect(moduleFromPath('/integracoes/totvs')).toBe('integracoes');
  });

  it('allows ADMIN, GESTOR and SUPORTE access to integrations', () => {
    expect(hasPermission('ADMIN_EMPRESA', 'integracoes', 'visualizar')).toBe(true);
    expect(hasPermission('GESTOR', 'integracoes', 'visualizar')).toBe(true);
    expect(hasPermission('SUPORTE', 'integracoes', 'visualizar')).toBe(true);
    expect(hasPermission('SUPER_ADMIN_SILO', 'integracoes', 'visualizar')).toBe(true);
    expect(canAccessRoute('ADMIN_EMPRESA', '/integracoes/pims')).toBe(true);
    expect(canAccessRoute('GESTOR', '/integracoes/totvs')).toBe(true);
    expect(canAccessRoute('SUPORTE', '/integracoes/exportacoes')).toBe(true);
    expect(canAccessRoute('SUPER_ADMIN_SILO', '/integracoes/jobs')).toBe(true);
  });

  it('blocks CONSULTA access to integrations', () => {
    expect(hasPermission('CONSULTA', 'integracoes', 'visualizar')).toBe(false);
    expect(canAccessRoute('CONSULTA', '/integracoes/logs')).toBe(false);
  });
});
