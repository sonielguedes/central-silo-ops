/**
 * Smoke test: verifica que o helper de regras de negócio P0 foi exportado
 * corretamente. A execução completa do helper requer serviços reais e é feita
 * em ambiente de integração; aqui validamos apenas a contrato de exportação.
 */
import { runCriticalTests } from './business-rules.helper';

describe('business-rules helper — contrato de exportação', () => {
  it('runCriticalTests é uma função exportada', () => {
    expect(typeof runCriticalTests).toBe('function');
  });
});
