import { resolveComboioBomba } from '../fueling-display';

describe('resolveComboioBomba', () => {
  it('uses the configured presentation priority and hides UUID values', () => {
    expect(resolveComboioBomba({ pumpCode: 'BOMBA-01' })).toBe('BOMBA-01');
    expect(resolveComboioBomba({ comboioFleetCode: 'COMBOIO-02' })).toBe('COMBOIO-02');
    expect(resolveComboioBomba({ comboioDescription: 'Comboio Norte' })).toBe('Comboio Norte');
    expect(resolveComboioBomba({ tankCode: 'TQ-07' })).toBe('TQ-07');
    expect(resolveComboioBomba({ deviceAlias: 'Ponto 9' })).toBe('Ponto 9');
    expect(resolveComboioBomba({ pumpCode: '88d1cd5b-e255-4407-aea9-b17f83cf7cd6' })).toBe('Não informado');
    expect(resolveComboioBomba({})).toBe('Não informado');
  });
});
