import { resolveEquipmentIcon } from '@/lib/equipment-icon-resolver';

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
});
