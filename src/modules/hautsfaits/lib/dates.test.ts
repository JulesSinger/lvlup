import { describe, expect, it } from 'vitest';
import { CATEGORY_INFO } from './categories';
import { alignDate, formatFeatDate, formatFeatSpan, periodLastDay, sortFeats } from './dates';
import { FEAT_CATEGORIES, type DatePrecision } from './types';

describe('ranger une date au début de sa période', () => {
  it('une année au 1er janvier, un mois au 1er, un jour tel quel', () => {
    expect(alignDate('2014-06-17', 'year')).toBe('2014-01-01');
    expect(alignDate('2018-06-17', 'month')).toBe('2018-06-01');
    expect(alignDate('2025-03-02', 'day')).toBe('2025-03-02');
  });

  it('le dernier jour d’une période, février bissextile compris', () => {
    expect(periodLastDay('2014-01-01', 'year')).toBe('2014-12-31');
    expect(periodLastDay('2024-02-01', 'month')).toBe('2024-02-29');
    expect(periodLastDay('2023-02-01', 'month')).toBe('2023-02-28');
    expect(periodLastDay('2025-03-02', 'day')).toBe('2025-03-02');
  });
});

describe('dire une date, pas plus précisément qu’on ne la connaît', () => {
  it('année, mois, jour, et « 1er »', () => {
    expect(formatFeatDate('2014-01-01', 'year')).toBe('2014');
    expect(formatFeatDate('2018-06-01', 'month')).toBe('juin 2018');
    expect(formatFeatDate('2025-03-02', 'day')).toBe('2 mars 2025');
    expect(formatFeatDate('2022-07-01', 'day')).toBe('1er juillet 2022');
  });

  const span = (dateStart: string, datePrecision: DatePrecision, dateEnd: string | null, dateEndPrecision: DatePrecision | null) =>
    formatFeatSpan({ dateStart, datePrecision, dateEnd, dateEndPrecision });

  it('une période sans répéter ce qui est commun aux deux bouts', () => {
    expect(span('2021-01-01', 'month', '2021-06-01', 'month')).toBe('janvier – juin 2021');
    expect(span('2023-08-03', 'day', '2023-08-10', 'day')).toBe('3 – 10 août 2023');
    expect(span('2023-07-28', 'day', '2023-08-10', 'day')).toBe('28 juillet – 10 août 2023');
    expect(span('2019-09-01', 'month', '2022-07-01', 'month')).toBe('septembre 2019 – juillet 2022');
    expect(span('2019-01-01', 'year', '2022-01-01', 'year')).toBe('2019 – 2022');
  });

  it('des précisions différentes se disent en entier ; sans fin, la date seule', () => {
    expect(span('2019-01-01', 'year', '2022-07-01', 'month')).toBe('2019 – juillet 2022');
    expect(span('2025-03-02', 'day', null, null)).toBe('2 mars 2025');
  });
});

describe('l’ordre de la frise', () => {
  const feat = (id: string, dateStart: string, datePrecision: DatePrecision, createdAt = '2026-09-30T10:00:00Z') => ({
    id,
    dateStart,
    datePrecision,
    createdAt,
  });
  const ids = (list: { id: string }[]) => list.map((f) => f.id);

  it('le plus récent en haut par défaut, l’ordre du livre sur demande', () => {
    const list = [feat('bac', '2017-07-05', 'day'), feat('semi', '2025-03-02', 'day'), feat('brevet', '2014-01-01', 'year')];
    expect(ids(sortFeats(list))).toEqual(['semi', 'bac', 'brevet']);
    expect(ids(sortFeats(list, 'asc'))).toEqual(['brevet', 'bac', 'semi']);
  });

  it('une date imprécise se place au début de sa période', () => {
    const list = [feat('annee', '2022-01-01', 'year'), feat('juillet', '2022-07-01', 'day'), feat('1janv', '2022-01-01', 'day')];
    expect(ids(sortFeats(list))).toEqual(['juillet', '1janv', 'annee']);
    expect(ids(sortFeats(list, 'asc'))).toEqual(['annee', '1janv', 'juillet']);
  });

  it('à date égale, l’ordre d’enregistrement ; la liste d’origine n’est pas touchée', () => {
    const list = [feat('b', '2020-05-01', 'day', '2026-09-30T11:00:00Z'), feat('a', '2020-05-01', 'day', '2026-09-30T10:00:00Z')];
    expect(ids(sortFeats(list, 'asc'))).toEqual(['a', 'b']);
    expect(ids(sortFeats(list))).toEqual(['b', 'a']);
    expect(ids(list)).toEqual(['b', 'a']);
  });
});

describe('les catégories', () => {
  it('chacune a un nom, un emoji et une couleur, tous différents', () => {
    const infos = FEAT_CATEGORIES.map((c) => CATEGORY_INFO[c]);
    expect(infos.every((i) => i.label && i.emoji && i.color)).toBe(true);
    for (const key of ['label', 'emoji', 'color'] as const) {
      expect(new Set(infos.map((i) => i[key])).size).toBe(FEAT_CATEGORIES.length);
    }
  });
});
