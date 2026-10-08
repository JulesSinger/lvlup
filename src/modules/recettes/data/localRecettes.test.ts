import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryBlobStore } from '../../../core/data/images/blobStore';
import { LocalRecettes } from './localRecettes';

/**
 * Le module s'appuie sur localStorage ; en environnement Node on en fournit
 * une version minimale — même motif que les autres modules.
 */
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

const lasagnes = {
  title: '  Lasagnes à la bolognaise ',
  servings: 8,
  prepMinutes: 30,
  cookMinutes: 95,
  sourceUrl: 'https://www.marmiton.org/recettes/recette_lasagnes-a-la-bolognaise_18215.aspx',
  sourceName: 'Marmiton',
  ingredients: [
    { text: '600 g de boeuf haché', section: null },
    { text: '1 l de lait', section: 'Pour la béchamel' },
  ],
  steps: [{ text: 'Faire revenir l’ail et les oignons.' }],
};
const photo = () => ({ full: new Blob(['grande']), thumb: new Blob(['mini']), width: 1600, height: 1200, takenAt: null });

describe('LocalRecettes', () => {
  let blobs: MemoryBlobStore;
  let store: LocalRecettes;

  beforeEach(() => {
    memory.clear();
    blobs = new MemoryBlobStore();
    store = new LocalRecettes(blobs);
  });

  it('crée une recette avec ses valeurs par défaut, rangées par titre', async () => {
    const r = await store.createRecipe(lasagnes, 'r1');
    expect(r).toMatchObject({ title: 'Lasagnes à la bolognaise', yieldLabel: 'personnes', category: 'plat', tags: [], favorite: false, restMinutes: null });
    expect(r.ingredients[1]).toEqual({ text: '1 l de lait', section: 'Pour la béchamel' });
    await store.createRecipe({ title: 'crêpes' }, 'r2');
    await store.createRecipe({ title: 'Aïoli' }, 'r3');
    expect((await store.listRecipes()).map((x) => x.title)).toEqual(['Aïoli', 'crêpes', 'Lasagnes à la bolognaise']);
  });

  it('une création rejouée n’écrit rien de plus', async () => {
    const a = await store.createRecipe(lasagnes, 'r1');
    const b = await store.createRecipe({ ...lasagnes, title: 'Autre' }, 'r1');
    expect(b).toEqual(a);
    expect(await store.listRecipes()).toHaveLength(1);
  });

  it('refuse ce que la base refuserait', async () => {
    await expect(store.createRecipe({ title: '   ' })).rejects.toThrow('titre');
    await expect(store.createRecipe({ title: 'x', servings: 0 })).rejects.toThrow('personnes');
    await expect(store.createRecipe({ title: 'x', cookMinutes: -5 })).rejects.toThrow('cuisson');
    await expect(store.createRecipe({ title: 'x', sourceUrl: 'javascript:alert(1)' })).rejects.toThrow('lien');
    const r = await store.createRecipe(lasagnes, 'r1');
    await expect(store.updateRecipe(r.id, { title: '' })).rejects.toThrow('titre');
  });

  it('modifie une recette et date la modification', async () => {
    const r = await store.createRecipe(lasagnes, 'r1');
    await store.updateRecipe(r.id, { favorite: true, tags: ['batch cooking'] });
    const [after] = await store.listRecipes();
    expect(after).toMatchObject({ favorite: true, tags: ['batch cooking'], title: r.title });
    expect(after.updatedAt >= r.updatedAt).toBe(true);
  });

  it('une seule photo par recette : la nouvelle remplace l’ancienne, fichiers compris', async () => {
    const r = await store.createRecipe(lasagnes, 'r1');
    const first = await store.setPhoto(r.id, photo(), 'p1');
    expect(await blobs.get(first.path)).not.toBeNull();
    const second = await store.setPhoto(r.id, photo(), 'p2');
    expect((await store.listPhotos()).map((p) => p.id)).toEqual(['p2']);
    expect(await blobs.get(first.path)).toBeNull();
    expect(await (await store.photoBlob(second, 'thumb')).text()).toBe('mini');
    await store.removePhoto(second);
    expect(await store.listPhotos()).toEqual([]);
    await expect(store.photoBlob(second, 'full')).rejects.toThrow('plus sur cet appareil');
  });

  it('supprimer une recette emporte sa photo, son historique et ses places au menu', async () => {
    const r = await store.createRecipe(lasagnes, 'r1');
    const keep = await store.createRecipe({ title: 'Crêpes' }, 'r2');
    const p = await store.setPhoto(r.id, photo(), 'p1');
    await store.addCooked({ recipeId: r.id, day: '2026-10-08', servings: 4, rating: 5, comment: 'parfait' });
    await store.addPlanEntry({ day: '2026-10-10', meal: 'soir', recipeId: r.id, title: '', servings: 4, position: 0 });
    await store.addPlanEntry({ day: '2026-10-10', meal: 'soir', recipeId: keep.id, title: '', servings: 4, position: 1 });
    await store.deleteRecipe(r.id);
    expect(await store.listPhotos()).toEqual([]);
    expect(await blobs.get(p.path)).toBeNull();
    expect(await store.listCooked()).toEqual([]);
    expect((await store.listPlan('2026-10-01', '2026-10-31')).map((e) => e.recipeId)).toEqual([keep.id]);
  });

  it('l’historique : note de 1 à 5, et rien pour une recette disparue', async () => {
    const r = await store.createRecipe(lasagnes, 'r1');
    const c = await store.addCooked({ recipeId: r.id, day: '2026-10-08', servings: null, rating: 4, comment: '' }, 'c1');
    await store.updateCooked(c.id, { rating: 5, comment: 'doubler l’ail' });
    expect((await store.listCooked())[0]).toMatchObject({ rating: 5, comment: 'doubler l’ail' });
    await expect(store.updateCooked(c.id, { rating: 6 })).rejects.toThrow('note');
    await expect(store.addCooked({ recipeId: 'inconnue', day: '2026-10-08', servings: null, rating: null, comment: '' })).rejects.toThrow();
  });

  it('le menu : par jour, midi avant soir, puis dans l’ordre de la case', async () => {
    const r = await store.createRecipe(lasagnes, 'r1');
    await store.addPlanEntry({ day: '2026-10-12', meal: 'soir', recipeId: r.id, title: '', servings: 2, position: 1 });
    await store.addPlanEntry({ day: '2026-10-12', meal: 'soir', recipeId: null, title: 'Salade', servings: null, position: 0 });
    await store.addPlanEntry({ day: '2026-10-12', meal: 'midi', recipeId: null, title: '  Restes ', servings: null, position: 0 });
    await store.addPlanEntry({ day: '2026-10-20', meal: 'midi', recipeId: null, title: 'Hors de la semaine', servings: null, position: 0 });
    const week = await store.listPlan('2026-10-12', '2026-10-18');
    expect(week.map((e) => `${e.meal} ${e.title || 'lasagnes'}`)).toEqual(['midi Restes', 'soir Salade', 'soir lasagnes']);
    await expect(store.addPlanEntry({ day: '2026-10-12', meal: 'soir', recipeId: null, title: ' ', servings: null, position: 0 })).rejects.toThrow('Restes');
  });

  it('les ingrédients « toujours là » ont une liste de départ, réglable', async () => {
    expect((await store.getSettings()).pantry).toContain('sel');
    await store.updateSettings({ pantry: ['sel', 'beurre'] });
    expect((await store.getSettings()).pantry).toEqual(['sel', 'beurre']);
  });

  it('la sauvegarde emporte tout, la liste des photos mais pas leur contenu', async () => {
    const r = await store.createRecipe(lasagnes, 'r1');
    await store.setPhoto(r.id, photo(), 'p1');
    await store.addCooked({ recipeId: r.id, day: '2026-10-08', servings: 4, rating: 5, comment: '' });
    const backup = await store.exportData();
    expect(JSON.stringify(backup)).not.toContain('grande');
    memory.clear();
    await store.importData(backup);
    expect(await store.exportData()).toEqual(backup);
  });
});
