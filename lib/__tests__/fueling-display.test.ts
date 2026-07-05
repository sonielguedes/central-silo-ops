import { resolveComboioBomba, resolveFuelProduct, resolveFuelSyncStatus, resolveOperatorDisplay } from '../fueling-display';

describe('fueling display helpers', () => {
  it('resolves comboio/bomba without fallback misuse', () => {
    expect(resolveComboioBomba({ pumpCode: 'BOMBA-01' })).toBe('BOMBA-01');
    expect(resolveComboioBomba({ comboioFleetCode: 'COMBOIO-02' })).toBe('COMBOIO-02');
    expect(resolveComboioBomba({ comboioFleetCode: '770', pumpCode: 'BOMBA - 01' })).toBe('770 / BOMBA - 01');
    expect(resolveComboioBomba({ comboioFleetCode: 'BOMBA - 01', pumpCode: 'BOMBA - 01' })).toBe('BOMBA - 01');
    expect(resolveComboioBomba({ comboioDescription: 'Comboio Norte' })).toBe('Não informado');
    expect(resolveComboioBomba({ tankCode: 'TQ-07' })).toBe('Não informado');
    expect(resolveComboioBomba({ deviceAlias: 'Ponto 9' })).toBe('Não informado');
    expect(resolveComboioBomba({ pumpCode: '88d1cd5b-e255-4407-aea9-b17f83cf7cd6' })).toBe('Não informado');
    expect(resolveComboioBomba({})).toBe('Não informado');
  });

  it('resolves operator, product and sync labels', () => {
    expect(resolveOperatorDisplay({ driverName: 'sony' })).toBe('sony');
    expect(resolveOperatorDisplay({ operatorRegistration: '1234' })).toBe('1234');
    expect(resolveOperatorDisplay({})).toBe('—');

    expect(resolveFuelProduct({ productDescription: 'Diesel S-10' })).toBe('Diesel S-10');
    expect(resolveFuelProduct({ fuelType: 'Diesel S-10' })).toBe('Diesel S-10');
    expect(resolveFuelProduct({ fuelType: 'DIESEL_S10' })).toBe('Diesel S-10');
    expect(resolveFuelProduct({ productCode: 'DIESEL_S10' })).toBe('Diesel S-10');
    expect(resolveFuelProduct({ productCode: 'DIESEL_S500' })).toBe('Diesel S-500');
    expect(resolveFuelProduct({ productCode: 'UNKNOWN_CODE' })).toBe('UNKNOWN_CODE');
    expect(resolveFuelProduct({})).toBe('Não informado');

    expect(resolveFuelSyncStatus('SYNCED')).toBe('Sincronizado');
    expect(resolveFuelSyncStatus('ERRO_SYNC')).toBe('Erro');
  });
});
