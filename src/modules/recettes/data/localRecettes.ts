import { newId } from '../../../core/data/coreStore';
import type { BlobStore } from '../../../core/data/images/blobStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import type { ImageSize, PreparedImage } from '../../../core/lib/images';
import {
  DEFAULT_RECETTES_SETTINGS,
  type Cooked,
  type CookedInput,
  type PlanEntry,
  type PlanEntryInput,
  type Recipe,
  type RecipeInput,
  type RecipePatch,
  type RecipePhoto,
  type RecettesSettings,
} from '../lib/types';
import { validateCooked, validatePlanEntry, validateRecipe } from '../lib/validation';
import { deviceBlobs } from './deviceImages';
import type { RecettesBackup, RecettesStore } from './recettesStore';

const arrayOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

interface Snapshot {
  recipes: Recipe[];
  photos: RecipePhoto[];
  cooked: Cooked[];
  plan: PlanEntry[];
  settings: RecettesSettings;
}

/** Lecture des seules sections du module, sur le blob local partagé. */
function read(): Snapshot {
  const raw = readRaw();
  return {
    recipes: arrayOf<Recipe>(raw.recettesRecipes),
    photos: arrayOf<RecipePhoto>(raw.recettesPhotos),
    cooked: arrayOf<Cooked>(raw.recettesCooked),
    plan: arrayOf<PlanEntry>(raw.recettesPlan),
    settings: { ...DEFAULT_RECETTES_SETTINGS, ...(raw.recettesSettings as Partial<RecettesSettings> | undefined) },
  };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(s: Snapshot) {
  writeRaw({
    ...readRaw(),
    recettesRecipes: s.recipes,
    recettesPhotos: s.photos,
    recettesCooked: s.cooked,
    recettesPlan: s.plan,
    recettesSettings: s.settings,
  });
}

function fail(problem: string | null) {
  if (problem) throw new Error(problem);
}

const byTitle = (a: Recipe, b: Recipe) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }) || a.id.localeCompare(b.id);
const byPlan = (a: PlanEntry, b: PlanEntry) =>
  a.day.localeCompare(b.day) || (a.meal === b.meal ? 0 : a.meal === 'midi' ? -1 : 1) || a.position - b.position;

function toRecipe(input: RecipeInput, id: string, createdAt: string): Recipe {
  return {
    id,
    title: input.title.trim(),
    description: input.description ?? '',
    servings: input.servings ?? null,
    yieldLabel: input.yieldLabel ?? 'personnes',
    prepMinutes: input.prepMinutes ?? null,
    cookMinutes: input.cookMinutes ?? null,
    restMinutes: input.restMinutes ?? null,
    category: input.category ?? 'plat',
    tags: input.tags ?? [],
    sourceUrl: input.sourceUrl ?? null,
    sourceName: input.sourceName ?? '',
    note: input.note ?? '',
    favorite: input.favorite ?? false,
    ingredients: input.ingredients ?? [],
    steps: input.steps ?? [],
    createdAt,
    updatedAt: createdAt,
  };
}

/** Recettes stockées dans le navigateur, sans compte ni serveur ; les photos dans IndexedDB. */
export class LocalRecettes implements RecettesStore {
  private blobs: BlobStore;

  constructor(blobs?: BlobStore) {
    this.blobs = blobs ?? deviceBlobs();
  }

  async listRecipes(): Promise<Recipe[]> {
    return read().recipes.slice().sort(byTitle);
  }

  async createRecipe(input: RecipeInput, id: string = newId()): Promise<Recipe> {
    fail(validateRecipe(input));
    const s = read();
    const existing = s.recipes.find((r) => r.id === id);
    if (existing) return existing;
    const recipe = toRecipe(input, id, new Date().toISOString());
    s.recipes.push(recipe);
    write(s);
    return recipe;
  }

  async updateRecipe(id: string, patch: RecipePatch) {
    const s = read();
    const recipe = s.recipes.find((r) => r.id === id);
    if (!recipe) throw new Error('Cette recette n’existe plus.');
    const next = { ...recipe, ...patch, title: (patch.title ?? recipe.title).trim(), updatedAt: new Date().toISOString() };
    fail(validateRecipe(next));
    s.recipes = s.recipes.map((r) => (r.id === id ? next : r));
    write(s);
  }

  async deleteRecipe(id: string) {
    const s = read();
    const photos = s.photos.filter((p) => p.recipeId === id);
    s.recipes = s.recipes.filter((r) => r.id !== id);
    s.photos = s.photos.filter((p) => p.recipeId !== id);
    s.cooked = s.cooked.filter((c) => c.recipeId !== id);
    s.plan = s.plan.filter((p) => p.recipeId !== id);
    write(s);
    await this.blobs.delete(photos.flatMap((p) => [p.path, p.thumbPath]));
  }

  async listPhotos(): Promise<RecipePhoto[]> {
    return read().photos.slice();
  }

  async setPhoto(recipeId: string, image: PreparedImage, id: string = newId()): Promise<RecipePhoto> {
    const before = read();
    const same = before.photos.find((p) => p.id === id);
    if (same) return same;
    if (!before.recipes.some((r) => r.id === recipeId)) throw new Error('Cette recette n’existe plus.');
    const path = `local/${recipeId}/${id}.jpg`;
    const thumbPath = `local/${recipeId}/${id}-thumb.jpg`;
    await this.blobs.put(path, image.full);
    await this.blobs.put(thumbPath, image.thumb);
    const photo: RecipePhoto = {
      id,
      recipeId,
      path,
      thumbPath,
      width: image.width,
      height: image.height,
      bytes: image.full.size + image.thumb.size,
      createdAt: new Date().toISOString(),
    };
    const s = read();
    const old = s.photos.filter((p) => p.recipeId === recipeId);
    s.photos = [...s.photos.filter((p) => p.recipeId !== recipeId), photo];
    write(s);
    await this.blobs.delete(old.flatMap((p) => [p.path, p.thumbPath]));
    return photo;
  }

  async photoBlob(photo: RecipePhoto, size: ImageSize): Promise<Blob> {
    const blob = await this.blobs.get(size === 'full' ? photo.path : photo.thumbPath);
    if (!blob) throw new Error('Cette photo n’est plus sur cet appareil.');
    return blob;
  }

  async removePhoto(photo: RecipePhoto) {
    const s = read();
    s.photos = s.photos.filter((p) => p.id !== photo.id);
    write(s);
    await this.blobs.delete([photo.path, photo.thumbPath]);
  }

  async listCooked(): Promise<Cooked[]> {
    return read()
      .cooked.slice()
      .sort((a, b) => a.day.localeCompare(b.day) || a.createdAt.localeCompare(b.createdAt));
  }

  async addCooked(input: CookedInput, id: string = newId()): Promise<Cooked> {
    fail(validateCooked(input));
    const s = read();
    const existing = s.cooked.find((c) => c.id === id);
    if (existing) return existing;
    if (!s.recipes.some((r) => r.id === input.recipeId)) throw new Error('Cette recette n’existe plus.');
    const cooked: Cooked = { ...input, comment: input.comment ?? '', id, createdAt: new Date().toISOString() };
    s.cooked.push(cooked);
    write(s);
    return cooked;
  }

  async updateCooked(id: string, patch: Partial<Omit<CookedInput, 'recipeId'>>) {
    const s = read();
    const cooked = s.cooked.find((c) => c.id === id);
    if (!cooked) return;
    const next = { ...cooked, ...patch };
    fail(validateCooked(next));
    s.cooked = s.cooked.map((c) => (c.id === id ? next : c));
    write(s);
  }

  async deleteCooked(id: string) {
    const s = read();
    s.cooked = s.cooked.filter((c) => c.id !== id);
    write(s);
  }

  async listPlan(from: string, to: string): Promise<PlanEntry[]> {
    return read()
      .plan.filter((p) => p.day >= from && p.day <= to)
      .sort(byPlan);
  }

  async addPlanEntry(input: PlanEntryInput, id: string = newId()): Promise<PlanEntry> {
    fail(validatePlanEntry(input));
    const s = read();
    const existing = s.plan.find((p) => p.id === id);
    if (existing) return existing;
    if (input.recipeId && !s.recipes.some((r) => r.id === input.recipeId)) throw new Error('Cette recette n’existe plus.');
    const entry: PlanEntry = { ...input, title: input.title.trim(), id, createdAt: new Date().toISOString() };
    s.plan.push(entry);
    write(s);
    return entry;
  }

  async updatePlanEntry(id: string, patch: Partial<PlanEntryInput>) {
    const s = read();
    const entry = s.plan.find((p) => p.id === id);
    if (!entry) return;
    const next = { ...entry, ...patch };
    fail(validatePlanEntry(next));
    s.plan = s.plan.map((p) => (p.id === id ? next : p));
    write(s);
  }

  async deletePlanEntry(id: string) {
    const s = read();
    s.plan = s.plan.filter((p) => p.id !== id);
    write(s);
  }

  async getSettings(): Promise<RecettesSettings> {
    return read().settings;
  }

  async updateSettings(patch: Partial<RecettesSettings>) {
    const s = read();
    s.settings = { ...s.settings, ...patch };
    write(s);
  }

  async exportData(): Promise<RecettesBackup> {
    const s = read();
    return { recipes: s.recipes, photos: s.photos, cooked: s.cooked, plan: s.plan, settings: s.settings };
  }

  async importData(data: RecettesBackup) {
    write({
      recipes: data.recipes ?? [],
      photos: data.photos ?? [],
      cooked: data.cooked ?? [],
      plan: data.plan ?? [],
      settings: { ...DEFAULT_RECETTES_SETTINGS, ...data.settings },
    });
  }
}
