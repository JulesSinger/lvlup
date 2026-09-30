import { describe, expect, it } from 'vitest';
import { durationLabel } from './dates';
import { dateDraftFrom, dateFromDraft, draftFromFeat, emptyDraft, inputFromDraft, withPrecision } from './editorDraft';
import type { DatePrecision, Feat } from './types';

describe('la date dans la fenêtre', () => {
  it('se lit selon sa précision, rangée au début de sa période', () => {
    expect(dateFromDraft({ precision: 'day', day: '2025-03-02', month: 3, year: '2025' })).toBe('2025-03-02');
    expect(dateFromDraft({ precision: 'month', day: '2025-03-02', month: 6, year: '2018' })).toBe('2018-06-01');
    expect(dateFromDraft({ precision: 'year', day: '2025-03-02', month: 6, year: '2014' })).toBe('2014-01-01');
  });

  it('incomplète, elle ne rend rien', () => {
    expect(dateFromDraft({ precision: 'day', day: '', month: 1, year: '2025' })).toBeNull();
    expect(dateFromDraft({ precision: 'year', day: '', month: 1, year: '201' })).toBeNull();
  });

  it('changer de précision garde ce qu’on a dit, et revient au jour choisi', () => {
    const day = dateDraftFrom('2025-03-02', 'day');
    const month = withPrecision(day, 'month');
    expect(dateFromDraft(month)).toBe('2025-03-01');
    const year = withPrecision(month, 'year');
    expect(dateFromDraft(year)).toBe('2025-01-01');
    expect(dateFromDraft(withPrecision(month, 'day'))).toBe('2025-03-02');
    // Une autre année tapée entre-temps : le jour d'avant ne vaut plus, on part du 1er janvier.
    expect(dateFromDraft(withPrecision({ ...year, year: '2019' }, 'day'))).toBe('2019-01-01');
  });
});

describe('de la fenêtre au haut fait, et retour', () => {
  it('une idée pré-remplit le titre, la catégorie et la précision', () => {
    const draft = emptyDraft('2026-09-30', { title: 'Baccalauréat', category: 'etudes', precision: 'year' });
    expect(inputFromDraft({ ...draft, start: { ...draft.start, year: '2017' } })).toMatchObject({
      title: 'Baccalauréat',
      category: 'etudes',
      dateStart: '2017-01-01',
      datePrecision: 'year',
      dateEnd: null,
      dateEndPrecision: null,
    });
  });

  it('une période, les champs nettoyés de leurs espaces', () => {
    const draft = emptyDraft('2026-09-30', { precision: 'month' });
    const input = inputFromDraft({
      ...draft,
      title: '  Six mois à Madrid ',
      place: ' Madrid ',
      start: { ...draft.start, month: 1, year: '2021' },
      isPeriod: true,
      end: { ...draft.start, month: 6, year: '2021' },
    });
    expect(input).toMatchObject({ title: 'Six mois à Madrid', place: 'Madrid', dateStart: '2021-01-01', dateEnd: '2021-06-01', dateEndPrecision: 'month' });
  });

  it('une date incomplète dit ce qui manque', () => {
    const draft = emptyDraft('2026-09-30', { precision: 'year' });
    expect(inputFromDraft({ ...draft, start: { ...draft.start, year: '' } })).toBe('Écris l’année (quatre chiffres).');
  });

  it('un haut fait enregistré revient tel quel', () => {
    const feat: Feat = {
      id: 'f',
      title: 'École d’ingénieur',
      category: 'etudes',
      dateStart: '2019-09-01',
      datePrecision: 'month',
      dateEnd: '2022-07-01',
      dateEndPrecision: 'month',
      major: true,
      highlight: '3 ans',
      place: 'Lyon',
      people: '',
      story: 'Les partiels.',
      createdAt: '',
      updatedAt: '',
    };
    const { title, category, dateStart, datePrecision, dateEnd, dateEndPrecision, major, highlight, place, people, story } = feat;
    expect(inputFromDraft(draftFromFeat(feat))).toEqual({ title, category, dateStart, datePrecision, dateEnd, dateEndPrecision, major, highlight, place, people, story });
  });
});

describe('la durée d’une période', () => {
  const span = (dateStart: string, datePrecision: DatePrecision, dateEnd: string | null, dateEndPrecision: DatePrecision | null) =>
    durationLabel({ dateStart, datePrecision, dateEnd, dateEndPrecision });

  it('bouts compris, pas plus précise que ses dates', () => {
    expect(span('2023-08-03', 'day', '2023-08-10', 'day')).toBe('8 jours');
    expect(span('2021-01-01', 'month', '2021-06-01', 'month')).toBe('6 mois');
    expect(span('2019-09-01', 'month', '2022-07-01', 'month')).toBe('3 ans');
    expect(span('2023-06-15', 'day', '2023-09-20', 'day')).toBe('4 mois');
  });

  it('rien pour un haut fait ponctuel ou une période connue à l’année près', () => {
    expect(span('2025-03-02', 'day', null, null)).toBeNull();
    expect(span('2019-01-01', 'year', '2022-01-01', 'year')).toBeNull();
  });
});
