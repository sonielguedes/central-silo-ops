import { calculateJourneyHourmeter } from '../journey-hourmeter-calculator';

describe('calculateJourneyHourmeter', () => {
  test('jornada ativa usa atual e oculta final', () => expect(calculateJourneyHourmeter({ status: 'EM_ANDAMENTO', hourmeterStart: 0.1, hourmeterCurrent: 5.1, hourmeterEnd: 5.1 })).toMatchObject({ end: null, total: 5, displayEnd: '—' }));
  test('atual absurdo é incompatível', () => expect(calculateJourneyHourmeter({ status: 'OPERANDO', hourmeterStart: 0.1, hourmeterCurrent: 34844.7 })).toMatchObject({ total: null, displayTotal: '—', isCurrentCompatible: false, warnings: ['HORIMETRO_ATUAL_INCOMPATIVEL'] }));
  test('finalizada calcula final menos inicial', () => expect(calculateJourneyHourmeter({ status: 'FINALIZADO', hourmeterStart: 10, hourmeterEnd: 18.5 }).total).toBe(8.5));
  test('final menor que inicial', () => expect(calculateJourneyHourmeter({ status: 'FINALIZADO', hourmeterStart: 18, hourmeterEnd: 10 })).toMatchObject({ total: null, isEndCompatible: false, warnings: ['HORIMETRO_FINAL_MENOR_QUE_INICIAL'] }));
  test('finalizada sem final', () => expect(calculateJourneyHourmeter({ status: 'FINALIZADO', hourmeterStart: 10 }).warnings).toContain('HORIMETRO_FINAL_AUSENTE'));
  test('sem inicial', () => expect(calculateJourneyHourmeter({ status: 'EM_ANDAMENTO', hourmeterCurrent: 10 }).warnings).toContain('HORIMETRO_INICIAL_AUSENTE'));
  test('aceita vírgula decimal', () => expect(calculateJourneyHourmeter({ status: 'FINALIZADO', hourmeterStart: '10,5', hourmeterEnd: '18,5' }).total).toBe(8));
  test('valores inválidos não quebram', () => expect(calculateJourneyHourmeter({ status: 'FINALIZADO', hourmeterStart: 'x', hourmeterEnd: -1 })).toMatchObject({ start: null, end: null, total: null }));
});
