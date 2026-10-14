import { describe, expect, it } from 'vitest';
import * as server from '../../../../supabase/functions/atlas-mcp/recettes.ts';
import { recettesTools, type CookedRow, type PlanRow, type RecettesData, type RecipeRow } from '../../../../supabase/functions/atlas-mcp/recettes.ts';
import { cleanSteps, mergeStepTiming, schedule } from './schedule';
import * as types from './types';

/** Une base en mémoire, du seul compte du jeton, comme `recettesData` dans la fonction. */
function memory(): RecettesData & { recipes: RecipeRow[]; plan: PlanRow[]; cooked: CookedRow[]; pantry: string[] | null } {
  let n = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const db = { recipes: [] as RecipeRow[], plan: [] as PlanRow[], cooked: [] as CookedRow[], pantry: null as string[] | null };
  const patch = <T extends { id: string }>(list: T[], id: string, row: Record<string, unknown>) => {
    const item = list.find((x) => x.id === id);
    if (item) Object.assign(item, row);
    return item ?? null;
  };
  const drop = <T extends { id: string }>(list: T[], id: string) => {
    const i = list.findIndex((x) => x.id === id);
    if (i >= 0) list.splice(i, 1);
    return i >= 0;
  };
  return Object.assign(db, {
    listRecipes: async () => db.recipes,
    getRecipe: async (id: string) => db.recipes.find((r) => r.id === id) ?? null,
    insertRecipe: async (row: Record<string, unknown>) => {
      const recipe = {
        id: uuid(),
        description: '',
        servings: null,
        yield_label: 'personnes',
        prep_minutes: null,
        cook_minutes: null,
        rest_minutes: null,
        category: 'plat',
        tags: [],
        source_url: null,
        source_name: '',
        note: '',
        favorite: false,
        ingredients: [],
        steps: [],
        created_at: 'x',
        updated_at: 'x',
        ...row,
      } as unknown as RecipeRow;
      db.recipes.push(recipe);
      return recipe;
    },
    updateRecipe: async (id: string, row: Record<string, unknown>) => patch(db.recipes, id, row),
    deleteRecipe: async (id: string) => {
      db.plan = db.plan.filter((p) => p.recipe_id !== id);
      db.cooked = db.cooked.filter((c) => c.recipe_id !== id);
      return drop(db.recipes, id);
    },
    photoRecipeIds: async () => new Set<string>(),
    listCooked: async (recipeId: string) => db.cooked.filter((c) => c.recipe_id === recipeId),
    getCooked: async (id: string) => db.cooked.find((c) => c.id === id) ?? null,
    insertCooked: async (row: Record<string, unknown>) => {
      const c = { id: uuid(), ...row } as CookedRow;
      db.cooked.push(c);
      return c;
    },
    updateCooked: async (id: string, row: Record<string, unknown>) => patch(db.cooked, id, row),
    deleteCooked: async (id: string) => drop(db.cooked, id),
    listPlan: async (from: string, to: string) => db.plan.filter((p) => p.day >= from && p.day <= to),
    getPlan: async (id: string) => db.plan.find((p) => p.id === id) ?? null,
    insertPlan: async (row: Record<string, unknown>) => {
      const p = { id: uuid(), ...row } as PlanRow;
      db.plan.push(p);
      return p;
    },
    updatePlan: async (id: string, row: Record<string, unknown>) => patch(db.plan, id, row),
    deletePlan: async (id: string) => drop(db.plan, id),
    getPantry: async () => db.pantry,
    setPantry: async (items: string[]) => {
      db.pantry = items;
    },
  });
}

async function use(data: RecettesData, name: string, args: Record<string, unknown> = {}) {
  const tool = recettesTools.find((t) => t.name === name);
  if (!tool) throw new Error(`outil ${name}`);
  try {
    const result = await tool.run(args, { data, today: '2026-10-11' });
    return { error: false, text: result.text, value: (() => { try { return JSON.parse(result.text); } catch { return null; } })() };
  } catch (err) {
    return { error: true, text: (err as Error).message, value: null };
  }
}

describe('les outils de Recettes pour Claude', () => {
  it('ont les bornes du module', () => {
    expect(server.RECIPE_CATEGORIES).toEqual(types.RECIPE_CATEGORIES);
    expect(server.MEALS).toEqual(types.MEALS);
    expect([server.RECIPE_TITLE_MAX, server.SERVINGS_MAX, server.MINUTES_MAX, server.INGREDIENTS_MAX, server.STEPS_MAX, server.TAGS_MAX, server.PLAN_TITLE_MAX]).toEqual([
      types.RECIPE_TITLE_MAX,
      types.SERVINGS_MAX,
      types.MINUTES_MAX,
      types.INGREDIENTS_MAX,
      types.STEPS_MAX,
      types.TAGS_MAX,
      types.PLAN_TITLE_MAX,
    ]);
    expect(server.DEFAULT_PANTRY).toEqual(types.DEFAULT_PANTRY);
  });

  it('ont les mêmes postes, et gardent le temps des étapes comme l’app (§20)', () => {
    expect([...server.STATIONS]).toEqual([...types.STATIONS]);
    expect(server.STATION_MAX).toBe(types.STATION_MAX);
    const previous = [
      { text: 'Eau', id: 'e1', station: 'Casserole', minutes: 8, hands: false },
      { text: 'Oignon', id: 'o1', minutes: 3, hands: true, start: { after: 'start' as const, of: 'e1', offset: 0 } },
      { text: 'Pâtes', id: 'p1', minutes: 10, start: { after: 'end' as const, of: 'e1' } },
    ];
    for (const next of [
      [{ text: 'Oignon' }, { text: 'Eau' }],
      [{ text: 'Eau bouillante' }, { text: 'Oignon' }, { text: 'Pâtes' }],
      [{ text: 'Pâtes' }],
      [{ text: 'Eau' }, { text: 'Servir' }],
    ]) {
      expect(server.keepTiming(previous, next)).toEqual(mergeStepTiming(previous, next));
    }
  });

  it('règlent le temps d’une recette, et le gardent quand on réécrit ses étapes', async () => {
    const data = memory();
    const { recipe } = (
      await use(data, 'recettes_creer', { title: 'Pâtes aux lardons', steps: ['Faire bouillir l’eau.', 'Émincer l’oignon.', 'Cuire les pâtes 10 minutes.'] })
    ).value;
    expect(recipe.steps_timing).toBeNull();
    const timed = await use(data, 'recettes_minuter', {
      id: recipe.id,
      steps_timing: [
        { step: 1, station: 'Casserole', minutes: 8, hands: false, starts: 'launch' },
        { step: 2, station: 'Plan de travail', minutes: 3, hands: true, starts: { start_of: 1, offset_minutes: 0 } },
        { step: 3, station: 'Casserole', minutes: 10, hands: false, starts: { end_of: 1 } },
      ],
    });
    expect(timed.error).toBe(false);
    expect(timed.value.steps_timing).toEqual([
      { step: 1, station: 'Casserole', minutes: 8, hands: false, starts: 'launch' },
      { step: 2, station: 'Plan de travail', minutes: 3, hands: true, starts: { start_of: 1, offset_minutes: 0 } },
      { step: 3, station: 'Casserole', minutes: 10, hands: false, starts: { end_of: 1 } },
    ]);
    // Le JSON rangé est celui que l'app relit : rien n'est écarté par `cleanSteps`.
    expect(cleanSteps(data.recipes[0].steps)).toEqual(data.recipes[0].steps);
    expect(schedule(cleanSteps(data.recipes[0].steps)).total).toBe(18);

    const rewritten = await use(data, 'recettes_modifier', { id: recipe.id, steps: ['Faire bouillir l’eau.', 'Émincer l’oignon.', 'Cuire les pâtes 10 minutes.', 'Servir.'] });
    expect(rewritten.value.recipe.steps_timing.slice(0, 3)).toEqual(timed.value.steps_timing);

    const errors = [
      await use(data, 'recettes_minuter', { id: recipe.id, steps_timing: [{ step: 9 }] }),
      await use(data, 'recettes_minuter', { id: recipe.id, steps_timing: [{ step: 3, starts: { end_of: 3 } }] }),
      await use(data, 'recettes_minuter', { id: recipe.id, steps_timing: [{ step: 1, minutes: -2 }] }),
      await use(data, 'recettes_minuter', { id: recipe.id, steps_timing: [{ step: 1, starts: 'plus tard' }] }),
    ];
    expect(errors.map((e) => e.error)).toEqual([true, true, true, true]);
  });

  it('ajoutent, retrouvent, lisent, modifient et suppriment une recette', async () => {
    const data = memory();
    const created = await use(data, 'recettes_creer', {
      title: '  Curry de pois chiches ',
      servings: 4,
      cook_minutes: 25,
      tags: ['Végétarien', 'végétarien', 'rapide'],
      ingredients: ['400 g de pois chiches', { text: '20 cl de lait de coco', section: 'Pour la sauce' }, '  '],
      steps: ['Faire revenir l’oignon.', 'Ajouter le reste.'],
    });
    expect(created.error).toBe(false);
    const recipe = created.value.recipe;
    expect(recipe).toMatchObject({
      title: 'Curry de pois chiches',
      tags: ['végétarien', 'rapide'],
      ingredients: [
        { text: '400 g de pois chiches', section: null },
        { text: '20 cl de lait de coco', section: 'Pour la sauce' },
      ],
      steps: ['Faire revenir l’oignon.', 'Ajouter le reste.'],
    });
    // La recherche ignore accents et majuscules, et regarde aussi les ingrédients.
    expect((await use(data, 'recettes_lister', { query: 'COCO vegetarien' })).value).toMatchObject({ total: 1, recipes: [{ title: 'Curry de pois chiches', total_minutes: 25 }] });
    expect((await use(data, 'recettes_lister', { query: 'lasagnes' })).value.total).toBe(0);

    const updated = await use(data, 'recettes_modifier', { id: recipe.id, servings: 6, favorite: true });
    expect(updated.value.recipe).toMatchObject({ servings: 6, favorite: true, title: 'Curry de pois chiches' });
    expect((await use(data, 'recettes_lire', { id: recipe.id })).value).toMatchObject({ servings: 6, has_photo: false, cooked: [] });

    await use(data, 'recettes_menu_ajouter', { day: '2026-10-15', meal: 'soir', recipe_id: recipe.id });
    const gone = await use(data, 'recettes_supprimer', { id: recipe.id });
    expect(gone.text).toContain('supprimée');
    expect(data.recipes).toHaveLength(0);
    expect(data.plan).toHaveLength(0);
  });

  it('refusent ce que la base refuserait, avec une phrase que Claude comprend', async () => {
    const data = memory();
    expect((await use(data, 'recettes_creer', {})).text).toMatch(/titre manque/);
    expect((await use(data, 'recettes_creer', { title: 'A', servings: 0 })).text).toMatch(/1 à 100/);
    expect((await use(data, 'recettes_creer', { title: 'A', category: 'gouter' })).text).toMatch(/Catégorie inconnue/);
    expect((await use(data, 'recettes_creer', { title: 'A', source_url: 'ftp://x' })).text).toMatch(/http/);
    expect((await use(data, 'recettes_modifier', { id: 'pas-un-id' })).text).toMatch(/invalide/);
    expect((await use(data, 'recettes_lire', { id: '00000000-0000-4000-8000-999999999999' })).text).toMatch(/Aucune recette/);
    const { value } = await use(data, 'recettes_creer', { title: 'Tarte' });
    expect((await use(data, 'recettes_modifier', { id: value.recipe.id })).text).toMatch(/Rien à modifier/);
    expect(data.recipes).toHaveLength(1);
  });

  it('tiennent le menu : semaine en cours par défaut, à la suite dans un repas, recette ou simple titre', async () => {
    const data = memory();
    const tarte = (await use(data, 'recettes_creer', { title: 'Tarte aux pommes', category: 'dessert' })).value.recipe;
    const curry = (await use(data, 'recettes_creer', { title: 'Curry' })).value.recipe;
    await use(data, 'recettes_menu_ajouter', { day: '2026-10-13', meal: 'midi', recipe_id: curry.id, servings: 2 });
    const dessert = (await use(data, 'recettes_menu_ajouter', { day: '2026-10-13', meal: 'midi', recipe_id: tarte.id })).value.entry;
    expect(dessert.position).toBe(1);
    const restes = (await use(data, 'recettes_menu_ajouter', { day: '2026-10-14', meal: 'soir', title: 'Restes' })).value.entry;
    expect((await use(data, 'recettes_menu_ajouter', { day: '2026-10-14', meal: 'soir' })).text).toMatch(/recette .* ou un titre/);
    expect((await use(data, 'recettes_menu_ajouter', { day: '14/10', meal: 'soir', title: 'X' })).text).toMatch(/AAAA-MM-JJ/);
    expect((await use(data, 'recettes_menu_ajouter', { day: '2026-10-14', meal: 'gouter', title: 'X' })).text).toMatch(/midi ou soir/);

    // Le 11/10/2026 est un dimanche : la semaine en cours va du lundi 5 au dimanche 11 ; la suivante est demandée.
    expect((await use(data, 'recettes_menu_lister')).value).toMatchObject({ from: '2026-10-05', to: '2026-10-11', entries: [] });
    const week = (await use(data, 'recettes_menu_lister', { from: '2026-10-12' })).value;
    expect(week.entries.map((e: { title: string }) => e.title)).toEqual(['Curry', 'Tarte aux pommes', 'Restes']);

    await use(data, 'recettes_menu_modifier', { id: restes.id, day: '2026-10-16', recipe_id: curry.id });
    expect(data.plan.find((p) => p.id === restes.id)).toMatchObject({ day: '2026-10-16', recipe_id: curry.id });
    expect((await use(data, 'recettes_menu_modifier', { id: dessert.id, recipe_id: null })).text).toMatch(/besoin d’un titre/);
    expect((await use(data, 'recettes_menu_retirer', { id: dessert.id })).text).toMatch(/retirée/);
    expect(data.plan).toHaveLength(2);
  });

  it('notent les recettes faites, aujourd’hui par défaut', async () => {
    const data = memory();
    const curry = (await use(data, 'recettes_creer', { title: 'Curry' })).value.recipe;
    const done = (await use(data, 'recettes_faite_ajouter', { recipe_id: curry.id, rating: 5, comment: 'Parfait' })).value.cooked;
    expect(done).toMatchObject({ day: '2026-10-11', rating: 5, comment: 'Parfait', servings: null });
    expect((await use(data, 'recettes_faite_ajouter', { recipe_id: curry.id, rating: 6 })).text).toMatch(/1 à 5/);
    await use(data, 'recettes_faite_modifier', { id: done.id, rating: 4 });
    expect((await use(data, 'recettes_lire', { id: curry.id })).value.cooked).toMatchObject([{ rating: 4 }]);
    await use(data, 'recettes_faite_retirer', { id: done.id });
    expect(data.cooked).toHaveLength(0);
  });

  it('tiennent la liste des ingrédients « toujours là »', async () => {
    const data = memory();
    expect((await use(data, 'recettes_toujours_la')).value.pantry).toEqual(types.DEFAULT_PANTRY);
    const next = (await use(data, 'recettes_toujours_la', { add: ['Moutarde', 'SEL'], remove: ['eau', 'vinaigre'] })).value.pantry;
    expect(next).toEqual(['sel', 'poivre', 'huile', 'huile d’olive', 'sucre', 'farine', 'Moutarde']);
    expect((await use(data, 'recettes_toujours_la', { replace: ['sel'] })).value.pantry).toEqual(['sel']);
    expect(data.pantry).toEqual(['sel']);
  });

  it('disent à Claude ce qui est sans danger et ce qui détruit', () => {
    const hints = Object.fromEntries(recettesTools.map((t) => [t.name, t.annotations]));
    expect(hints.recettes_lister.readOnlyHint).toBe(true);
    expect(hints.recettes_supprimer.destructiveHint).toBe(true);
    expect(hints.recettes_menu_retirer.destructiveHint).toBe(true);
    expect(recettesTools.every((t) => t.name.startsWith('recettes_') && t.description.length > 20)).toBe(true);
  });
});
