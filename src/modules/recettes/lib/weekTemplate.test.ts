import { describe, expect, it } from 'vitest';
import type { Meal, TemplateEntry, Weekday } from './types';
import { consecutiveRepeats, cookingSummary, dayOfWeekday, dishKey, fromTemplate, swapSlots, weekdayOf } from './weekTemplate';

let n = 0;
function entry(weekday: Weekday, meal: Meal, what: string, leftovers = false, servings: number | null = null): TemplateEntry {
  const isRecipe = what.startsWith('#');
  return {
    id: `t${++n}`,
    weekday,
    meal,
    recipeId: isRecipe ? what.slice(1) : null,
    title: isRecipe ? '' : what,
    servings,
    leftovers,
    position: 0,
    createdAt: 'x',
  };
}

/** La semaine de Jules (22/11/2026) : quatre fois en cuisine, jamais deux repas de suite pareils. */
const JULES: TemplateEntry[] = [
  entry(1, 'midi', 'Plat 4', true),
  entry(1, 'soir', '#bolo', true),
  entry(2, 'midi', 'Plat 4', true),
  entry(2, 'soir', 'Plat 2', false, 4),
  entry(3, 'midi', '#bolo', true),
  entry(3, 'soir', 'Plat 2', true),
  entry(4, 'midi', '#bolo', true),
  entry(4, 'soir', 'Plat 3', false, 3),
  entry(5, 'midi', 'Plat 2', true),
  entry(5, 'soir', 'Plat 3', true),
  entry(6, 'midi', 'Plat 4', false, 3),
  entry(6, 'soir', 'Plat 2', true),
  entry(7, 'midi', 'Plat 3', true),
  entry(7, 'soir', '#bolo', false, 4),
];

describe('les jours de la semaine type', () => {
  it('1 = lundi … 7 = dimanche', () => {
    expect(weekdayOf('2026-11-23')).toBe(1);
    expect(weekdayOf('2026-11-28')).toBe(6);
    expect(weekdayOf('2026-11-29')).toBe(7);
    expect(dayOfWeekday('2026-11-23', 7)).toBe('2026-11-29');
  });
});

describe('recopier la semaine type', () => {
  it('chaque repas tombe à sa date, restes et parts compris', () => {
    const week = fromTemplate(JULES, '2026-11-25', []);
    expect(week).toHaveLength(14);
    expect(week[0]).toEqual({ day: '2026-11-23', meal: 'midi', recipeId: null, title: 'Plat 4', servings: null, leftovers: true, position: 0 });
    expect(week.at(-1)).toEqual({ day: '2026-11-29', meal: 'soir', recipeId: 'bolo', title: '', servings: 4, leftovers: false, position: 0 });
  });

  it('une case déjà remplie est gardée : recopier deux fois ne double rien', () => {
    const week = fromTemplate(JULES, '2026-11-23', [{ day: '2026-11-24', meal: 'soir' }]);
    expect(week).toHaveLength(13);
    expect(week.some((e) => e.day === '2026-11-24' && e.meal === 'soir')).toBe(false);
  });

  it('les jours passés sont sautés', () => {
    const week = fromTemplate(JULES, '2026-11-23', [], '2026-11-27');
    expect(week.map((e) => e.day)).toEqual(['2026-11-27', '2026-11-27', '2026-11-28', '2026-11-28', '2026-11-29', '2026-11-29']);
  });

  it('plusieurs choses dans une case gardent leur ordre', () => {
    const plat = { ...entry(3, 'soir', 'Gratin'), position: 0 };
    const dessert = { ...entry(3, 'soir', 'Yaourt'), position: 1 };
    const week = fromTemplate([dessert, plat], '2026-11-23', []);
    expect(week.map((e) => [e.title, e.position])).toEqual([
      ['Gratin', 0],
      ['Yaourt', 1],
    ]);
  });
});

describe('échanger deux repas', () => {
  it('chacun passe dans la case de l’autre', () => {
    const moves = swapSlots({ slot: 'mar-midi', entries: [{ id: 'a', position: 0 }] }, { slot: 'mer-midi', entries: [{ id: 'b', position: 0 }] });
    expect(moves).toEqual([
      { id: 'a', slot: 'mer-midi', position: 0 },
      { id: 'b', slot: 'mar-midi', position: 0 },
    ]);
  });

  it('vers une case vide, le repas se déplace', () => {
    expect(swapSlots({ slot: 1, entries: [{ id: 'a', position: 3 }, { id: 'b', position: 1 }] }, { slot: 2, entries: [] })).toEqual([
      { id: 'b', slot: 2, position: 0 },
      { id: 'a', slot: 2, position: 1 },
    ]);
  });
});

describe('ne pas manger deux repas de suite la même chose', () => {
  it('la semaine de Jules n’enchaîne rien, dimanche soir → lundi midi compris', () => {
    expect(consecutiveRepeats(JULES)).toEqual([]);
  });

  it('un plat qui suit le même est signalé, même d’une semaine à la suivante', () => {
    const repeats = consecutiveRepeats([entry(1, 'midi', '#bolo'), entry(1, 'soir', '#bolo'), entry(7, 'soir', 'À définir')]);
    expect(repeats.map((r) => [r.weekday, r.meal])).toEqual([[1, 'soir']]);
    const wrap = consecutiveRepeats([entry(7, 'soir', 'Chili'), entry(1, 'midi', 'chili ')]);
    expect(wrap.map((r) => [r.weekday, r.meal])).toEqual([[1, 'midi']]);
  });

  it('une case vide sépare, et un titre se compare sans majuscules ni accents', () => {
    expect(consecutiveRepeats([entry(1, 'midi', 'Chili'), entry(2, 'midi', 'Chili')])).toEqual([]);
    expect(dishKey({ recipeId: null, title: ' Purée ' })).toBe(dishKey({ recipeId: null, title: 'puree' }));
  });

  it('quatre fois en cuisine, dix repas de restes', () => {
    expect(cookingSummary(JULES)).toEqual({ cook: 4, leftovers: 10 });
  });
});
