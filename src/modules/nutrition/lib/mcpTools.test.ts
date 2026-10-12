import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as server from '../../../../supabase/functions/atlas-mcp/nutrition.ts';
import { nutritionTools, type CiqualRow, type EntryRow, type FoodRow, type NutritionData } from '../../../../supabase/functions/atlas-mcp/nutrition.ts';
import table from '../data/ciqual.json';
import { buildIndex, searchFoods } from './foodSearch';
import { rescaleEntry, targetForDay } from './journal';
import { valuesForGrams } from './macros';
import { MEALS, MEAL_LABELS } from './types';

// Les outils de Nutrition du connecteur (docs/connecteur-claude.md §16) : la table CIQUAL est
// copiée à côté de la fonction, la recherche et les calculs recopiés — tout est comparé ici.

const ciqual = table.foods as CiqualRow[];

describe('connecteur — Nutrition : les copies suivent le module', () => {
  it('embarque la même table CIQUAL que l’app', () => {
    const app = readFileSync(new URL('../data/ciqual.json', import.meta.url), 'utf8');
    const copy = readFileSync(new URL('../../../../supabase/functions/atlas-mcp/ciqual.json', import.meta.url), 'utf8');
    expect(copy).toBe(app);
  });

  it('reprend les repas', () => {
    expect(server.MEALS).toEqual(MEALS);
    expect(server.MEAL_LABELS).toEqual(MEAL_LABELS);
  });

  it('cherche comme l’app', () => {
    const index = buildIndex(ciqual, (r) => r[1]);
    for (const q of ['riz blanc cuit', 'poulet filet', 'oeuf', 'pâtes', 'Œufs brouillés', 'yaourt nature']) {
      expect(server.searchFoods(ciqual, (r) => r[1], q).map((r) => r[0])).toEqual(searchFoods(index, q).map((r) => r[0]));
    }
  });

  it('calcule les valeurs, la remise à l’échelle et l’objectif du jour pareil', () => {
    const per100g = { kcal: 130, proteinDg: 27, carbsDg: 281, fatDg: 3 };
    for (const grams of [1, 37, 150, 333]) expect(server.valuesForGrams(per100g, grams)).toEqual(valuesForGrams(per100g, grams));
    const entry = { grams: 150, kcal: 195, protein_dg: 41, carbs_dg: 422, fat_dg: 5 };
    const app = rescaleEntry({ id: '', day: '', meal: 'lunch', foodId: null, ciqualCode: null, label: '', createdAt: '', grams: 150, kcal: 195, proteinDg: 41, carbsDg: 422, fatDg: 5 }, 220);
    expect(server.rescale(entry, 220)).toEqual({ grams: app.grams, kcal: app.kcal, protein_dg: app.proteinDg, carbs_dg: app.carbsDg, fat_dg: app.fatDg });
    const targets = [
      { effective_from: '2026-09-01', protein_g: 120, carbs_g: 250, fat_g: 70 },
      { effective_from: '2026-10-05', protein_g: 140, carbs_g: 220, fat_g: 65 },
    ];
    for (const d of ['2026-08-31', '2026-10-04', '2026-10-12'])
      expect(server.targetForDay(targets, d)?.effective_from).toBe(
        targetForDay(
          targets.map((t) => ({ id: '', createdAt: '', effectiveFrom: t.effective_from, proteinG: t.protein_g, carbsG: t.carbs_g, fatG: t.fat_g })),
          d,
        )?.effectiveFrom,
      );
  });

  it('lit les repas en français', () => {
    expect(['petit-déjeuner', 'Déjeuner', 'midi', 'dîner', 'goûter', 'snack'].map(server.readMeal)).toEqual(['breakfast', 'lunch', 'lunch', 'dinner', 'snack', 'snack']);
    expect(() => server.readMeal('brunch')).toThrow(/meal/);
  });
});

function memory() {
  let k = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++k).padStart(12, '0')}`;
  const foods: FoodRow[] = [{ id: uuid(), name: 'Granola maison', brand: null, kcal: 450, protein_dg: 100, carbs_dg: 600, fat_dg: 180, serving_grams: 50, favorite: true }];
  const entries: EntryRow[] = [];
  const data: NutritionData = {
    ciqual: () => ciqual,
    listEntries: async (from, to) => entries.filter((e) => e.day >= from && e.day <= to),
    getEntry: async (id) => entries.find((e) => e.id === id) ?? null,
    insertEntries: async (rows) => {
      const made = rows.map((r) => ({ id: uuid(), created_at: `2026-10-12T12:00:0${k}Z`, ...r }) as EntryRow);
      entries.push(...made);
      return made;
    },
    updateEntry: async (id, r) => Object.assign(entries.find((e) => e.id === id)!, r),
    deleteEntry: async (id) => {
      const i = entries.findIndex((e) => e.id === id);
      if (i < 0) return false;
      entries.splice(i, 1);
      return true;
    },
    listFoods: async () => foods,
    listTargets: async () => [{ effective_from: '2026-10-01', protein_g: 140, carbs_g: 220, fat_g: 65 }],
  };
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await nutritionTools.find((t) => t.name === name)!.run(args, { data, today: '2026-10-12' });
    try {
      return JSON.parse(result.text);
    } catch {
      return { text: result.text };
    }
  };
  return { foods, entries, call };
}

describe('connecteur — Nutrition : les outils', () => {
  it('cherche dans CIQUAL et dans les aliments de Jules, favoris en tête', async () => {
    const m = memory();
    const res = await m.call('nutrition_chercher', { query: 'granola' });
    expect(res.results[0]).toMatchObject({ ref: `food:${m.foods[0].id}`, name: 'Granola maison', mine: true, serving_grams: 50, per_100g: { kcal: 450, protein_g: 10 } });
    expect(res.results.slice(1).every((r: { ref: string }) => r.ref.startsWith('ciqual:'))).toBe(true);
  });

  it('note un repas d’après la table, et une estimation dite comme telle', async () => {
    const m = memory();
    const riz = (await m.call('nutrition_chercher', { query: 'riz blanc cuit' })).results[0];
    const res = await m.call('nutrition_ajouter', {
      meal: 'déjeuner',
      items: [
        { ref: riz.ref, grams: 150 },
        { label: 'Burger du food truck', grams: 350, kcal: 820, protein_g: 42, carbs_g: 60, fat_g: 45 },
      ],
    });
    const per100g = { kcal: riz.per_100g.kcal, proteinDg: riz.per_100g.protein_g * 10, carbsDg: riz.per_100g.carbs_g * 10, fatDg: riz.per_100g.fat_g * 10 };
    expect(m.entries[0]).toMatchObject({ day: '2026-10-12', meal: 'lunch', ciqual_code: riz.ref.slice(7), food_id: null, grams: 150, kcal: valuesForGrams(per100g, 150).kcal });
    expect(m.entries[1]).toMatchObject({ label: 'Burger du food truck (estimation)', ciqual_code: null, food_id: null, kcal: 820, protein_dg: 420 });
    expect(res.added[1].source).toBe('estimation');
    await expect(m.call('nutrition_ajouter', { meal: 'lunch', items: [{ ref: 'ciqual:000', grams: 10 }] })).rejects.toThrow(/inconnue/);
    // Le riz revient en tête de la recherche, avec son dernier poids.
    expect((await m.call('nutrition_chercher', { query: 'riz' })).results[0]).toMatchObject({ ref: riz.ref, last_grams: 150 });
  });

  it('dit le jour, l’objectif et ce qu’il reste ; corrige et retire', async () => {
    const m = memory();
    await m.call('nutrition_ajouter', { meal: 'breakfast', items: [{ ref: `food:${m.foods[0].id}`, grams: 60 }] });
    const day = await m.call('nutrition_journal', {});
    expect(day.total).toEqual({ kcal: 270, protein_g: 6, carbs_g: 36, fat_g: 10.8 });
    expect(day.target.kcal).toBe(140 * 4 + 220 * 4 + 65 * 9);
    expect(day.remaining.kcal).toBe(day.target.kcal - 270);
    const id = m.entries[0].id;
    await m.call('nutrition_modifier', { id, grams: 30, meal: 'snack' });
    expect(m.entries[0]).toMatchObject({ grams: 30, kcal: 135, meal: 'snack' });
    await m.call('nutrition_supprimer', { id });
    expect(m.entries).toEqual([]);
  });
});
