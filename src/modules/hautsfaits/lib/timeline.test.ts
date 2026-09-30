import { describe, expect, it } from 'vitest';
import { onThisDay, onThisDayLabel } from './onThisDay';
import { remainingSuggestions, SUGGESTIONS } from './suggestions';
import { buildTimeline, gapLabel, type TimelineRow } from './timeline';
import type { DatePrecision, Feat, FeatCategory } from './types';

function feat(id: string, dateStart: string, datePrecision: DatePrecision, category: FeatCategory = 'etudes'): Feat {
  return {
    id,
    title: id,
    category,
    dateStart,
    datePrecision,
    dateEnd: null,
    dateEndPrecision: null,
    major: false,
    highlight: '',
    place: '',
    people: '',
    story: '',
    createdAt: '2026-09-30T10:00:00Z',
    updatedAt: '2026-09-30T10:00:00Z',
  };
}

/** Une frise lisible dans un test : « 2025 (26) », « … 2023 – 2024 », « semi ». */
const read = (rows: TimelineRow[]) =>
  rows.map((r) => (r.kind === 'year' ? `${r.year}${r.age === null ? '' : ` (${r.age})`}` : r.kind === 'gap' ? `… ${gapLabel(r)}` : r.feat.id));

const LIFE = [
  feat('brevet', '2014-01-01', 'year'),
  feat('bac', '2017-07-05', 'day'),
  feat('permis', '2018-06-01', 'month', 'autre'),
  feat('diplome', '2022-07-01', 'day'),
  feat('appart', '2022-09-29', 'day', 'chezsoi'),
  feat('semi', '2025-03-02', 'day', 'sport'),
];

describe('la frise', () => {
  it('années avec l’âge, hauts faits, années vides resserrées — le plus récent en haut', () => {
    expect(read(buildTimeline(LIFE, { birthDate: '1999-03-12' }))).toEqual([
      '2025 (26)',
      'semi',
      '… 2023 – 2024',
      '2022 (23)',
      'appart',
      'diplome',
      '… 2019 – 2021',
      '2018 (19)',
      'permis',
      '2017 (18)',
      'bac',
      '… 2015 – 2016',
      '2014 (15)',
      'brevet',
    ]);
  });

  it('dans l’ordre du livre, les mêmes resserrements', () => {
    expect(read(buildTimeline(LIFE, { order: 'asc' })).slice(0, 5)).toEqual(['2014', 'brevet', '… 2015 – 2016', '2017', 'bac']);
  });

  it('une seule année vide se dit seule ; deux années qui se suivent n’ont pas de resserrement', () => {
    const rows = buildTimeline([feat('a', '2020-01-01', 'year'), feat('b', '2018-01-01', 'year'), feat('c', '2017-01-01', 'year')]);
    expect(read(rows)).toEqual(['2020', 'a', '… 2019', '2018', 'b', '2017', 'c']);
  });

  it('filtrée par catégorie ; vide, elle ne rend rien', () => {
    expect(read(buildTimeline(LIFE, { category: 'sport' }))).toEqual(['2025', 'semi']);
    expect(buildTimeline([])).toEqual([]);
  });

  it('pas d’âge pour une année avant la naissance', () => {
    expect(read(buildTimeline([feat('x', '1998-01-01', 'year')], { birthDate: '1999-03-12' }))).toEqual(['1998', 'x']);
  });
});

describe('« Ce jour-là »', () => {
  it('à la date exacte, puis au mois ; jamais une date connue à l’année près ni l’année en cours', () => {
    const list = [
      feat('appart', '2022-09-30', 'day'),
      feat('rentree', '2019-09-01', 'month'),
      feat('brevet', '2014-01-01', 'year'),
      feat('semi', '2025-03-02', 'day'),
      feat('cetteannee', '2026-09-01', 'month'),
      feat('mariage', '2024-09-30', 'day'),
    ];
    const found = onThisDay(list, '2026-09-30');
    expect(found.map((f) => f.feat.id)).toEqual(['mariage', 'appart', 'rentree']);
    expect(found.map(onThisDayLabel)).toEqual(['Il y a 2 ans aujourd’hui', 'Il y a 4 ans aujourd’hui', 'Il y a 7 ans ce mois-ci']);
  });

  it('un 29 février revient le 28 les années qui n’en ont pas, et le 29 les autres', () => {
    const leap = [feat('bissextile', '2020-02-29', 'day')];
    expect(onThisDay(leap, '2026-02-28')).toHaveLength(1);
    expect(onThisDay(leap, '2028-02-28')).toHaveLength(0);
    expect(onThisDay(leap, '2028-02-29').map(onThisDayLabel)).toEqual(['Il y a 8 ans aujourd’hui']);
  });
});

describe('les idées pour démarrer', () => {
  it('une idée disparaît quand un haut fait porte déjà son titre, casse et accents ignorés', () => {
    const left = remainingSuggestions(['baccalaureat', '  Premier   appartement ']);
    expect(left.map((s) => s.title)).not.toContain('Baccalauréat');
    expect(left.map((s) => s.title)).not.toContain('Premier appartement');
    expect(left).toHaveLength(SUGGESTIONS.length - 2);
  });
});
