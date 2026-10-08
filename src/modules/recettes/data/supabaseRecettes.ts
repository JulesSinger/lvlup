import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAll, getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import type { ImageSize, PreparedImage } from '../../../core/lib/images';
import {
  DEFAULT_RECETTES_SETTINGS,
  type Cooked,
  type CookedInput,
  type Ingredient,
  type Meal,
  type PlanEntry,
  type PlanEntryInput,
  type Recipe,
  type RecipeCategory,
  type RecipeInput,
  type RecipePatch,
  type RecipePhoto,
  type RecettesSettings,
  type Step,
} from '../lib/types';
import { validateCooked, validatePlanEntry, validateRecipe } from '../lib/validation';
import { photoCache } from './deviceImages';
import type { RecettesBackup, RecettesStore } from './recettesStore';

/** Le bucket privé des photos (migration du 2026-10-08). */
const BUCKET = 'recettes';
const BATCH = 500;

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function fail(problem: string | null) {
  if (problem) throw new Error(problem);
}

function* batches<T>(items: T[]): Generator<T[]> {
  for (let i = 0; i < items.length; i += BATCH) yield items.slice(i, i + BATCH);
}

interface RecipeRow {
  id: string;
  title: string;
  description: string;
  servings: number | null;
  yield_label: string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  rest_minutes: number | null;
  category: RecipeCategory;
  tags: string[] | null;
  source_url: string | null;
  source_name: string;
  note: string;
  favorite: boolean;
  ingredients: Ingredient[] | null;
  steps: Step[] | null;
  created_at: string;
  updated_at: string;
}

interface PhotoRow {
  id: string;
  recipe_id: string;
  path: string;
  thumb_path: string;
  width: number;
  height: number;
  bytes: number;
  created_at: string;
}

interface CookedRow {
  id: string;
  recipe_id: string;
  day: string;
  servings: number | null;
  rating: number | null;
  comment: string;
  created_at: string;
}

interface PlanRow {
  id: string;
  day: string;
  meal: Meal;
  recipe_id: string | null;
  title: string;
  servings: number | null;
  position: number;
  created_at: string;
}

const toRecipe = (r: RecipeRow): Recipe => ({
  id: r.id,
  title: r.title,
  description: r.description,
  servings: r.servings,
  yieldLabel: r.yield_label,
  prepMinutes: r.prep_minutes,
  cookMinutes: r.cook_minutes,
  restMinutes: r.rest_minutes,
  category: r.category,
  tags: r.tags ?? [],
  sourceUrl: r.source_url,
  sourceName: r.source_name,
  note: r.note,
  favorite: r.favorite,
  // Relu quoi que contienne la base : un tableau d'objets à texte, rien d'autre.
  ingredients: (r.ingredients ?? [])
    .filter((i) => i && typeof i.text === 'string')
    .map((i) => ({ text: i.text, section: typeof i.section === 'string' ? i.section : null })),
  steps: (r.steps ?? []).filter((s) => s && typeof s.text === 'string').map((s) => ({ text: s.text })),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toPhoto = (r: PhotoRow): RecipePhoto => ({
  id: r.id,
  recipeId: r.recipe_id,
  path: r.path,
  thumbPath: r.thumb_path,
  width: r.width,
  height: r.height,
  bytes: r.bytes,
  createdAt: r.created_at,
});

const toCooked = (r: CookedRow): Cooked => ({
  id: r.id,
  recipeId: r.recipe_id,
  day: r.day,
  servings: r.servings,
  rating: r.rating,
  comment: r.comment,
  createdAt: r.created_at,
});

const toPlan = (r: PlanRow): PlanEntry => ({
  id: r.id,
  day: r.day,
  meal: r.meal,
  recipeId: r.recipe_id,
  title: r.title,
  servings: r.servings,
  position: r.position,
  createdAt: r.created_at,
});

function recipeColumns(p: Partial<RecipeInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.title !== undefined) row.title = p.title.trim();
  if (p.description !== undefined) row.description = p.description;
  if (p.servings !== undefined) row.servings = p.servings;
  if (p.yieldLabel !== undefined) row.yield_label = p.yieldLabel;
  if (p.prepMinutes !== undefined) row.prep_minutes = p.prepMinutes;
  if (p.cookMinutes !== undefined) row.cook_minutes = p.cookMinutes;
  if (p.restMinutes !== undefined) row.rest_minutes = p.restMinutes;
  if (p.category !== undefined) row.category = p.category;
  if (p.tags !== undefined) row.tags = p.tags;
  if (p.sourceUrl !== undefined) row.source_url = p.sourceUrl;
  if (p.sourceName !== undefined) row.source_name = p.sourceName;
  if (p.note !== undefined) row.note = p.note;
  if (p.favorite !== undefined) row.favorite = p.favorite;
  if (p.ingredients !== undefined) row.ingredients = p.ingredients;
  if (p.steps !== undefined) row.steps = p.steps;
  return row;
}

function planColumns(p: Partial<PlanEntryInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.day !== undefined) row.day = p.day;
  if (p.meal !== undefined) row.meal = p.meal;
  if (p.recipeId !== undefined) row.recipe_id = p.recipeId;
  if (p.title !== undefined) row.title = p.title.trim();
  if (p.servings !== undefined) row.servings = p.servings;
  if (p.position !== undefined) row.position = p.position;
  return row;
}

function cookedColumns(p: Partial<CookedInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.recipeId !== undefined) row.recipe_id = p.recipeId;
  if (p.day !== undefined) row.day = p.day;
  if (p.servings !== undefined) row.servings = p.servings;
  if (p.rating !== undefined) row.rating = p.rating;
  if (p.comment !== undefined) row.comment = p.comment;
  return row;
}

/** Recettes stockées sur Supabase, protégées par le Row Level Security ; les photos dans le bucket `recettes`. */
export class SupabaseRecettes implements RecettesStore {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
  }

  private requireUserId(): Promise<string> {
    return requireUserId(this.client);
  }

  /** Création rejouable : `on conflict do nothing` sur l'id, puis relecture de la ligne. */
  private async upsertThenRead<R>(table: string, id: string, row: Record<string, unknown>): Promise<R> {
    const { error } = await this.client.from(table).upsert({ id, ...row }, { onConflict: 'id', ignoreDuplicates: true });
    check(error);
    return unwrap(await this.client.from(table).select('*').eq('id', id).single()) as R;
  }

  private async insert<R>(table: string, row: Record<string, unknown>, id?: string): Promise<R> {
    if (id) return this.upsertThenRead<R>(table, id, row);
    return unwrap(await this.client.from(table).insert(row).select().single()) as R;
  }

  /**
   * Un fichier qu'on n'arrive pas à supprimer n'est que de la place perdue :
   * la ligne est déjà partie, on ne bloque pas l'utilisateur pour ça.
   */
  private async removeFiles(paths: string[]) {
    if (paths.length === 0) return;
    await photoCache.forgetCached(paths);
    const { error } = await this.client.storage.from(BUCKET).remove(paths);
    if (error) console.warn('Recettes : fichiers restés dans le stockage', paths, error.message);
  }

  // Un carnet grossit avec les années : lu par paquets (le plafond de 1 000
  // lignes de Supabase tronque en silence).
  async listRecipes(): Promise<Recipe[]> {
    const rows = await fetchAll<RecipeRow>((from, to) =>
      this.client.from('recettes_recipes').select('*').order('title').order('id').range(from, to),
    );
    return rows.map(toRecipe);
  }

  async createRecipe(input: RecipeInput, id?: string): Promise<Recipe> {
    fail(validateRecipe(input));
    const userId = await this.requireUserId();
    return toRecipe(await this.insert<RecipeRow>('recettes_recipes', { user_id: userId, ...recipeColumns(input) }, id));
  }

  async updateRecipe(id: string, patch: RecipePatch) {
    // Le titre n'est vérifié que s'il change.
    fail(validateRecipe({ ...patch, title: patch.title ?? '·' }));
    const row = { ...recipeColumns(patch), updated_at: new Date().toISOString() };
    check((await this.client.from('recettes_recipes').update(row).eq('id', id)).error);
  }

  async deleteRecipe(id: string) {
    const photos = (unwrap(await this.client.from('recettes_photos').select('*').eq('recipe_id', id)) as PhotoRow[]).map(toPhoto);
    // Photo, historique et menu partent avec la recette (`on delete cascade`) ; les fichiers ensuite.
    check((await this.client.from('recettes_recipes').delete().eq('id', id)).error);
    await this.removeFiles(photos.flatMap((p) => [p.path, p.thumbPath]));
  }

  async listPhotos(): Promise<RecipePhoto[]> {
    return (unwrap(await this.client.from('recettes_photos').select('*')) as PhotoRow[]).map(toPhoto);
  }

  async setPhoto(recipeId: string, image: PreparedImage, id: string = crypto.randomUUID()): Promise<RecipePhoto> {
    const userId = await this.requireUserId();
    const old = (unwrap(await this.client.from('recettes_photos').select('*').eq('recipe_id', recipeId)) as PhotoRow[]).map(toPhoto);
    if (old.some((p) => p.id === id)) return old.find((p) => p.id === id)!;
    // Le premier segment du chemin est le compte : c'est ce que vérifient les politiques du bucket.
    const path = `${userId}/${recipeId}/${id}.jpg`;
    const thumbPath = `${userId}/${recipeId}/${id}-thumb.jpg`;
    const bucket = this.client.storage.from(BUCKET);
    for (const [target, blob] of [
      [path, image.full],
      [thumbPath, image.thumb],
    ] as const) {
      // `upsert` : un envoi rejoué après une coupure réécrit le même fichier plutôt que d'échouer.
      const { error } = await bucket.upload(target, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
      if (error) throw new Error(`La photo n’a pas pu être envoyée : ${error.message}`);
    }
    // Une seule photo par recette : la nouvelle ligne prend la place de l'ancienne d'un coup.
    const { error } = await this.client.from('recettes_photos').upsert(
      {
        id,
        user_id: userId,
        recipe_id: recipeId,
        path,
        thumb_path: thumbPath,
        width: image.width,
        height: image.height,
        bytes: image.full.size + image.thumb.size,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'recipe_id' },
    );
    check(error);
    await this.removeFiles(old.flatMap((p) => [p.path, p.thumbPath]));
    return toPhoto(unwrap(await this.client.from('recettes_photos').select('*').eq('id', id).single()) as PhotoRow);
  }

  async photoBlob(photo: RecipePhoto, size: ImageSize): Promise<Blob> {
    const path = size === 'full' ? photo.path : photo.thumbPath;
    return photoCache.cachedBlob(path, async () => {
      const { data, error } = await this.client.storage.from(BUCKET).download(path);
      if (error || !data) throw new Error('Cette photo n’a pas pu être chargée.');
      return data;
    });
  }

  async removePhoto(photo: RecipePhoto) {
    check((await this.client.from('recettes_photos').delete().eq('id', photo.id)).error);
    await this.removeFiles([photo.path, photo.thumbPath]);
  }

  async listCooked(): Promise<Cooked[]> {
    const rows = await fetchAll<CookedRow>((from, to) =>
      this.client.from('recettes_cooked').select('*').order('day').order('created_at').order('id').range(from, to),
    );
    return rows.map(toCooked);
  }

  async addCooked(input: CookedInput, id?: string): Promise<Cooked> {
    fail(validateCooked(input));
    const userId = await this.requireUserId();
    return toCooked(await this.insert<CookedRow>('recettes_cooked', { user_id: userId, ...cookedColumns(input) }, id));
  }

  async updateCooked(id: string, patch: Partial<Omit<CookedInput, 'recipeId'>>) {
    fail(validateCooked({ day: patch.day ?? '2000-01-01', servings: patch.servings ?? null, rating: patch.rating ?? null }));
    check((await this.client.from('recettes_cooked').update(cookedColumns(patch)).eq('id', id)).error);
  }

  async deleteCooked(id: string) {
    check((await this.client.from('recettes_cooked').delete().eq('id', id)).error);
  }

  async listPlan(from: string, to: string): Promise<PlanEntry[]> {
    const rows = unwrap(
      await this.client.from('recettes_plan').select('*').gte('day', from).lte('day', to).order('day').order('meal').order('position'),
    ) as PlanRow[];
    // « midi » avant « soir » : l'ordre alphabétique le donne déjà, on le dit quand même.
    return rows.map(toPlan).sort((a, b) => a.day.localeCompare(b.day) || (a.meal === b.meal ? a.position - b.position : a.meal === 'midi' ? -1 : 1));
  }

  async addPlanEntry(input: PlanEntryInput, id?: string): Promise<PlanEntry> {
    fail(validatePlanEntry(input));
    const userId = await this.requireUserId();
    return toPlan(await this.insert<PlanRow>('recettes_plan', { user_id: userId, ...planColumns(input) }, id));
  }

  async updatePlanEntry(id: string, patch: Partial<PlanEntryInput>) {
    check((await this.client.from('recettes_plan').update(planColumns(patch)).eq('id', id)).error);
  }

  async deletePlanEntry(id: string) {
    check((await this.client.from('recettes_plan').delete().eq('id', id)).error);
  }

  async getSettings(): Promise<RecettesSettings> {
    const row = unwrap(await this.client.from('recettes_settings').select('*').maybeSingle()) as { pantry: string[] } | null;
    if (!row) return { ...DEFAULT_RECETTES_SETTINGS };
    return { pantry: row.pantry ?? [] };
  }

  async updateSettings(patch: Partial<RecettesSettings>) {
    const userId = await this.requireUserId();
    const row: Record<string, unknown> = { user_id: userId, updated_at: new Date().toISOString() };
    if (patch.pantry !== undefined) row.pantry = patch.pantry;
    check((await this.client.from('recettes_settings').upsert(row, { onConflict: 'user_id' })).error);
  }

  async exportData(): Promise<RecettesBackup> {
    const [recipes, cooked, plan, settings] = await Promise.all([
      this.listRecipes(),
      this.listCooked(),
      this.listPlan('0001-01-01', '9999-12-31'),
      this.getSettings(),
    ]);
    // Les photos à part : une table ou un bucket manquant n'empêche pas la sauvegarde du reste.
    const photos = await this.listPhotos().catch(() => []);
    return { recipes, photos, cooked, plan, settings };
  }

  async importData(data: RecettesBackup) {
    const userId = await this.requireUserId();
    // Historique, menu et lignes des photos partent avec les recettes (`on delete cascade`).
    // Les fichiers des photos ne sont jamais effacés par une restauration.
    check((await this.client.from('recettes_recipes').delete().eq('user_id', userId)).error);

    for (const batch of batches(data.recipes ?? [])) {
      const rows = batch.map((r) => ({ id: r.id, user_id: userId, created_at: r.createdAt, updated_at: r.updatedAt, ...recipeColumns(r) }));
      check((await this.client.from('recettes_recipes').insert(rows)).error);
    }
    for (const batch of batches(data.cooked ?? [])) {
      const rows = batch.map((c) => ({ id: c.id, user_id: userId, created_at: c.createdAt, ...cookedColumns(c) }));
      check((await this.client.from('recettes_cooked').insert(rows)).error);
    }
    for (const batch of batches(data.plan ?? [])) {
      const rows = batch.map((p) => ({ id: p.id, user_id: userId, created_at: p.createdAt, ...planColumns(p) }));
      check((await this.client.from('recettes_plan').insert(rows)).error);
    }
    const photos = data.photos ?? [];
    if (photos.length > 0) {
      const rows = photos.map((p) => ({
        id: p.id,
        user_id: userId,
        recipe_id: p.recipeId,
        path: p.path,
        thumb_path: p.thumbPath,
        width: p.width,
        height: p.height,
        bytes: p.bytes,
        created_at: p.createdAt,
      }));
      // Une photo dont le fichier manque s'affichera comme absente ; mieux qu'une restauration refusée.
      const { error } = await this.client.from('recettes_photos').insert(rows);
      if (error) console.warn('Recettes : photos non restaurées', error.message);
    }
    if (data.settings) await this.updateSettings(data.settings);
  }
}
