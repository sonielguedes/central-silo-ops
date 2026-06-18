import { hasPermission } from '@/lib/auth/rbac-shared';

describe('RBAC integração jobs', () => {
  it('ADMIN_EMPRESA pode visualizar e editar sincronizacao', () => {
    expect(hasPermission('ADMIN_EMPRESA', 'sincronizacao', 'visualizar')).toBe(true);
    expect(hasPermission('ADMIN_EMPRESA', 'sincronizacao', 'editar')).toBe(true);
  });

  it('CONSULTA continua sem permissão de escrita em sincronizacao', () => {
    expect(hasPermission('CONSULTA', 'sincronizacao', 'visualizar')).toBe(false);
    expect(hasPermission('CONSULTA', 'sincronizacao', 'editar')).toBe(false);
  });
});

