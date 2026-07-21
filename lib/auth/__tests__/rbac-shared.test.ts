import { canAccessRoute, hasPermission } from '@/lib/auth/rbac-shared';

describe('RBAC integracao jobs', () => {
  it('ADMIN_EMPRESA pode visualizar e editar sincronizacao', () => {
    expect(hasPermission('ADMIN_EMPRESA', 'sincronizacao', 'visualizar')).toBe(true);
    expect(hasPermission('ADMIN_EMPRESA', 'sincronizacao', 'editar')).toBe(true);
  });

  it('CONSULTA continua sem permissao de escrita em sincronizacao', () => {
    expect(hasPermission('CONSULTA', 'sincronizacao', 'visualizar')).toBe(false);
    expect(hasPermission('CONSULTA', 'sincronizacao', 'editar')).toBe(false);
  });

  it('SALA_OPERACIONAL acessa somente TV, mapa, conectividade e alertas em leitura', () => {
    expect(canAccessRoute('SALA_OPERACIONAL', '/tv')).toBe(true);
    expect(canAccessRoute('SALA_OPERACIONAL', '/mapa-operacional?modo=tv')).toBe(true);
    expect(canAccessRoute('SALA_OPERACIONAL', '/monitoramento/conectividade')).toBe(true);
    expect(canAccessRoute('SALA_OPERACIONAL', '/alertas')).toBe(true);
    expect(hasPermission('SALA_OPERACIONAL', 'mapa', 'visualizar')).toBe(true);
    expect(hasPermission('SALA_OPERACIONAL', 'dashboard', 'visualizar')).toBe(true);
    expect(hasPermission('SALA_OPERACIONAL', 'alertas', 'visualizar')).toBe(true);
  });

  it('SALA_OPERACIONAL bloqueia escrita operacional, cadastros, ficha e admin', () => {
    expect(hasPermission('SALA_OPERACIONAL', 'operadores', 'editar')).toBe(false);
    expect(hasPermission('SALA_OPERACIONAL', 'operacoes', 'editar')).toBe(false);
    expect(hasPermission('SALA_OPERACIONAL', 'cadastros', 'criar')).toBe(false);
    expect(hasPermission('SALA_OPERACIONAL', 'relatorios', 'exportar')).toBe(false);
    expect(canAccessRoute('SALA_OPERACIONAL', '/ferramentas/ficha-operador')).toBe(false);
    expect(canAccessRoute('SALA_OPERACIONAL', '/administracao/usuarios')).toBe(false);
    expect(canAccessRoute('SALA_OPERACIONAL', '/dashboard')).toBe(false);
  });
});
