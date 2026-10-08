import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryBlobStore } from '../../../core/data/images/blobStore';
import { createCalendarSource } from '../data/calendarSource';
import { LocalRecettes } from '../data/localRecettes';
import { mealAt, menuMarks } from './calendarMarks';
import type { PlanEntry, Recipe } from './types';

const memory = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
} as Storage;

const entry = (id: string, day: string, meal: 'midi' | 'soir', recipeId: string | null, title = ''): PlanEntry => ({ id, day, meal, recipeId, title, servings: 4, position: 0, createdAt: '' });

describe('le menu dans Calendar', () => {
  it('une marque par repas, sur la journée, qui ouvre la recette', () => {
    const recipes = [{ id: 'r1', title: 'Lasagnes' } as Recipe];
    const marks = menuMarks([entry('a', '2026-10-08', 'soir', 'r1'), entry('b', '2026-10-09', 'midi', null, 'Restes'), entry('c', '2026-11-01', 'midi', null, 'Hors')], recipes, '2026-10-05', '2026-10-11');
    expect(marks).toEqual([
      { id: 'plan:a', day: '2026-10-08', title: 'Soir · Lasagnes', detail: 'pour 4 · recette du carnet', movable: true, link: 'recipe:r1' },
      { id: 'plan:b', day: '2026-10-09', title: 'Midi · Restes', detail: 'pour 4', movable: true, link: 'menu' },
    ]);
  });

  it('posée sur une heure, la marque devient le midi ou le soir', () => {
    expect(mealAt(null, 'soir')).toBe('soir');
    expect(mealAt('12:30', 'soir')).toBe('midi');
    expect(mealAt('19:00', 'midi')).toBe('soir');
  });

  describe('la source du calendrier', () => {
    beforeEach(() => memory.clear());

    it('déplace un repas à un autre jour, à la fin de la case', async () => {
      const store = new LocalRecettes(new MemoryBlobStore());
      const source = createCalendarSource(store);
      const r = await store.createRecipe({ title: 'Lasagnes' }, 'r1');
      await store.addPlanEntry({ day: '2026-10-08', meal: 'soir', recipeId: r.id, title: '', servings: 4, position: 0 }, 'a');
      await store.addPlanEntry({ day: '2026-10-10', meal: 'midi', recipeId: null, title: 'Restes', servings: null, position: 0 }, 'b');
      expect((await source.marksBetween('2026-10-05', '2026-10-11')).map((m) => m.title)).toEqual(['Soir · Lasagnes', 'Midi · Restes']);
      await source.moveMark!('plan:a', { day: '2026-10-10', time: '12:00' });
      const moved = (await store.listPlan('2026-10-10', '2026-10-10')).map((e) => [e.id, e.meal, e.position]);
      expect(moved).toEqual([
        ['b', 'midi', 0],
        ['a', 'midi', 1],
      ]);
      await expect(source.moveMark!('plan:inconnu', { day: '2026-10-10', time: null })).rejects.toThrow('plus au menu');
    });
  });
});
