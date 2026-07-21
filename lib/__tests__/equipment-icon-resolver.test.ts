import {
  getFallbackEquipmentIconSrc,
  isKnownEquipmentIconSrc,
  resolveEquipmentIcon,
  resolveSafeEquipmentIconSrc,
} from '@/lib/equipment-icon-resolver';

describe('resolveEquipmentIcon', () => {
  it('colhedora online -> colhedora.png', () => {
    expect(resolveEquipmentIcon({ type: 'colhedora', status: 'OPERANDO' }).src).toBe('/icons/equipamentos/colhedora.png');
  });

  it('colhedora offline -> colhedora-off.png', () => {
    expect(resolveEquipmentIcon({ type: 'colhedora', status: 'OFFLINE' }).src).toBe('/icons/equipamentos/colhedora-off.png');
  });

  it('caminhao -> caminhao.png', () => {
    expect(resolveEquipmentIcon({ type: 'CAMINHAO' }).src).toBe('/icons/equipamentos/caminhao.png');
  });

  it('caminhao offline -> caminhao-off.png', () => {
    expect(resolveEquipmentIcon({ type: 'Caminhao', online: false }).src).toBe('/icons/equipamentos/caminhao-off.png');
  });

  it('trator com transbordo -> trator-transbordo.png', () => {
    expect(resolveEquipmentIcon({ equipmentType: 'Trator com transbordo' }).src).toBe('/icons/equipamentos/trator-transbordo.png');
  });

  it('pulverizador -> pulverizador.png', () => {
    expect(resolveEquipmentIcon({ category: 'Pulverizador' }).src).toBe('/icons/equipamentos/pulverizador.png');
  });

  it('vinhaca com acento -> vinhaca.png', () => {
    expect(resolveEquipmentIcon({ type: 'Vinhaça' }).src).toBe('/icons/equipamentos/vinhaca.png');
  });

  it('tipo desconhecido online -> generico.png', () => {
    expect(resolveEquipmentIcon({ type: 'Orbital' }).src).toBe('/icons/equipamentos/generico.png');
  });

  it('tipo desconhecido offline -> generico-off.png', () => {
    expect(resolveEquipmentIcon({ type: 'Orbital', isOffline: true }).src).toBe('/icons/equipamentos/generico-off.png');
  });

  it('status FINALIZADO usa versao offline/off', () => {
    expect(resolveEquipmentIcon({ type: 'Trator', status: 'FINALIZADO' }).src).toBe('/icons/equipamentos/trator-off.png');
  });

  it('fallback generico online/offline fica centralizado no resolver', () => {
    expect(getFallbackEquipmentIconSrc()).toBe('/icons/equipamentos/generico.png');
    expect(getFallbackEquipmentIconSrc({ status: 'INATIVO' })).toBe('/icons/equipamentos/generico-off.png');
  });

  it('aceita somente src operacional conhecido do pacote SILO', () => {
    expect(isKnownEquipmentIconSrc('/icons/equipamentos/trator.png')).toBe(true);
    expect(isKnownEquipmentIconSrc('/icons/equipamentos/inexistente.png')).toBe(false);
    expect(isKnownEquipmentIconSrc('https://cdn.exemplo.com/trator.png')).toBe(false);
  });

  it('src invalido cai para icone resolvido ou generico', () => {
    expect(resolveSafeEquipmentIconSrc('/icons/equipamentos/inexistente.png', { type: 'Colhedora' })).toBe('/icons/equipamentos/colhedora.png');
    expect(resolveSafeEquipmentIconSrc(null, { type: 'Tipo XPTO' })).toBe('/icons/equipamentos/generico.png');
  });
});
