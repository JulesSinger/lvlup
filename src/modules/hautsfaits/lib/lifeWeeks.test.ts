import { describe, expect, it } from 'vitest';
import { buildLifeWeeks, livedLabel, weekIndex } from './lifeWeeks';
import { buildShowcase } from './showcase';
import type { DatePrecision, Feat, FeatCategory } from './types';

function feat(id: string, dateStart: string, datePrecision: DatePrecision = 'day', extra: Partial<Feat> = {}): Feat {
  return {
    id,
    title: id,
    category: 'etudes' as FeatCategory,
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
    ...extra,
  };
}

describe('une vie en semaines', () => {
  it('compte les semaines depuis chaque anniversaire', () => {
    expect(weekIndex('2000-03-15', '2000-03-15')).toBe(0);
    expect(weekIndex('2000-03-15', '2000-03-21')).toBe(0);
    expect(weekIndex('2000-03-15', '2000-03-22')).toBe(1);
    // La veille d'un anniversaire tombe dans la dernière case de la ligne.
    expect(weekIndex('2000-03-15', '2001-03-14')).toBe(51);
    expect(weekIndex('2000-03-15', '2001-03-15')).toBe(52);
    expect(weekIndex('2000-03-15', '2026-03-15')).toBe(26 * 52);
  });

  it('un 29 février se fête le 28 les autres années', () => {
    expect(weekIndex('2000-02-29', '2001-02-28')).toBe(52);
    expect(weekIndex('2000-02-29', '2001-02-27')).toBe(51);
  });

  it('dessine jusqu’à aujourd’hui, ou jusqu’à 90 ans', () => {
    const today = '2026-10-09';
    const now = buildLifeWeeks([], '2000-03-15', today, 'today')!;
    expect(now.rows).toBe(27);
    expect(now.current).toBe(weekIndex('2000-03-15', today));
    expect(buildLifeWeeks([], '2000-03-15', today, 'life')!.rows).toBe(90);
    expect(buildLifeWeeks([], null, today, 'today')).toBeNull();
    expect(livedLabel(now, 'today')).toMatch(/^1[\s ]?381 semaines vécues$/);
    expect(livedLabel(buildLifeWeeks([], '2000-03-15', today, 'life')!, 'life')).toMatch(/sur 4[\s ]?680$/);
  });

  it('pose les hauts faits et les périodes, rien avant la naissance', () => {
    const feats = [
      feat('bac', '2018-07-05'),
      feat('brevet', '2014-01-01', 'year'),
      feat('meme-semaine', '2018-07-06'),
      feat('avant', '1998-01-01', 'year'),
      feat('erasmus', '2021-01-01', 'month', { dateEnd: '2021-06-01', dateEndPrecision: 'month' }),
    ];
    const weeks = buildLifeWeeks(feats, '2000-03-15', '2026-10-09', 'today')!;
    expect(weeks.dots.map((d) => d.feats.map((f) => f.id))).toEqual([['brevet'], ['meme-semaine', 'bac'], ['erasmus']]);
    expect(weeks.dots[0].index).toBe(weekIndex('2000-03-15', '2014-01-01'));
    expect(weeks.bands).toEqual([{ from: weekIndex('2000-03-15', '2021-01-01'), to: weekIndex('2000-03-15', '2021-06-30'), feat: feats[4] }]);
  });
});

describe('la vitrine', () => {
  it('range par catégorie, dans l’ordre fixe, le plus récent d’abord', () => {
    const shelves = buildShowcase([
      feat('semi', '2023-04-02', 'day', { category: 'sport' }),
      feat('bac', '2018-07-05'),
      feat('master', '2024-09-01', 'month'),
    ]);
    expect(shelves.map((s) => [s.category, s.feats.map((f) => f.id)])).toEqual([
      ['etudes', ['master', 'bac']],
      ['sport', ['semi']],
    ]);
  });
});
