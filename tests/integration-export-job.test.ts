import { describe, expect, test } from '@jest/globals';
import { buildFichaIntegrationPayload, normalizeIntegrationPayload } from '@/lib/integrations/payloads/operator-sheet-payload';

describe('integration payloads', () => {
  test('normalizes ficha payload without undefined or NaN', () => {
    const payload = normalizeIntegrationPayload({
      tenantId: 'tenant-1',
      sheetId: 'sheet-1',
      horimetroInicial: '0,5',
      horimetroFinal: '1.6',
      totalHoras: NaN,
      inconsistencias: [undefined, 'OK'],
    });

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('undefined');
    expect(serialized).not.toContain('NaN');
  });

  test('buildFichaIntegrationPayload exposes ficha core fields', () => {
    const payload = buildFichaIntegrationPayload({
      tenantId: 'tenant-1',
      sheetId: 'sheet-1',
      frota: '2026',
      operador: 'RAIMUNDO NONATO',
      matricula: '00125',
      os: '100',
      operacaoCodigo: '1002',
      operacaoDescricao: 'PLANTIO',
      centroCusto: '8080',
      horimetroInicial: 0.5,
      horimetroFinal: 1.6,
      totalHoras: 1.1,
      statusFicha: 'VALIDADO',
    });

    expect(payload).toMatchObject({
      tenantId: 'tenant-1',
      sheetId: 'sheet-1',
      frota: '2026',
      operador: 'RAIMUNDO NONATO',
      matricula: '00125',
      os: '100',
      operacaoCodigo: '1002',
      operacaoDescricao: 'PLANTIO',
      centroCusto: '8080',
      totalHoras: 1.1,
      statusFicha: 'VALIDADO',
    });
  });
});
