import type { SupabaseClient } from '@supabase/supabase-js';
import { getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import type { Entry, EntryInput, Food, FoodInput, Meal, FoodSource, Target, TargetInput } from '../lib/types';
import type { NutritionBackup, NutritionStore } from './nutritionStore';

interface FoodRow {
  id: string;
  source: FoodSource;
  barcode: string | null;
  name: string;
  brand: string | null;
  kcal: number;
  protein_dg: number;
  carbs_dg: number;
  fat_dg: number;
  fiber_dg: number | null;
  serving_grams: number | null;
  favorite: boolean;
  created_at: string;
}

interface EntryRow {
  id: string;
  day: string;
  meal: Meal;
  food_id: string | null;
  ciqual_code: string | null;
  label: string;
  grams: number;
  kcal: number;
  protein_dg: number;
  carbs_dg: number;
  fat_dg: number;
  created_at: string;
}

interface TargetRow {
  id: string;
  effective_from: string;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  created_at: string;
}

function toFood(row: FoodRow): Food {
  return {
    id: row.id,
    source: row.source,
    barcode: row.barcode,
    name: row.name,
    brand: row.brand,
    kcal: row.kcal,
    proteinDg: row.protein_dg,
    carbsDg: row.carbs_dg,
    fatDg: row.fat_dg,
    fiberDg: row.fiber_dg,
    servingGrams: row.serving_grams,
    favorite: row.favorite,
    createdAt: row.created_at,
  };
}

function toEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    day: row.day,
    meal: row.meal,
    foodId: row.food_id,
    ciqualCode: row.ciqual_code,
    label: row.label,
    grams: row.grams,
    kcal: row.kcal,
    proteinDg: row.protein_dg,
    carbsDg: row.carbs_dg,
    fatDg: row.fat_dg,
    createdAt: row.created_at,
  };
}

function toTarget(row: TargetRow): Target {
  return {
    id: row.id,
    effectiveFrom: row.effective_from,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    createdAt: row.created_at,
  };
}

/** Colonnes d'un aliment, pour les seuls champs présents dans `patch`. */
function foodColumns(patch: Partial<FoodInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.source !== undefined) row.source = patch.source;
  if (patch.barcode !== undefined) row.barcode = patch.barcode;
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.brand !== undefined) row.brand = patch.brand;
  if (patch.kcal !== undefined) row.kcal = patch.kcal;
  if (patch.proteinDg !== undefined) row.protein_dg = patch.proteinDg;
  if (patch.carbsDg !== undefined) row.carbs_dg = patch.carbsDg;
  if (patch.fatDg !== undefined) row.fat_dg = patch.fatDg;
  if (patch.fiberDg !== undefined) row.fiber_dg = patch.fiberDg;
  if (patch.servingGrams !== undefined) row.serving_grams = patch.servingGrams;
  if (patch.favorite !== undefined) row.favorite = patch.favorite;
  return row;
}

/** Colonnes d'une entrée, pour les seuls champs présents dans `patch`. */
function entryColumns(patch: Partial<EntryInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.day !== undefined) row.day = patch.day;
  if (patch.meal !== undefined) row.meal = patch.meal;
  if (patch.foodId !== undefined) row.food_id = patch.foodId;
  if (patch.ciqualCode !== undefined) row.ciqual_code = patch.ciqualCode;
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.grams !== undefined) row.grams = patch.grams;
  if (patch.kcal !== undefined) row.kcal = patch.kcal;
  if (patch.proteinDg !== undefined) row.protein_dg = patch.proteinDg;
  if (patch.carbsDg !== undefined) row.carbs_dg = patch.carbsDg;
  if (patch.fatDg !== undefined) row.fat_dg = patch.fatDg;
  return row;
}

/** Nutrition (Cérès) stockée sur Supabase, protégée par le Row Level Security. */
export class SupabaseNutrition implements NutritionStore {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
  }

  private requireUserId(): Promise<string> {
    return requireUserId(this.client);
  }

  async listFoods(): Promise<Food[]> {
    const rows = unwrap(await this.client.from('nutrition_foods').select('*')) as FoodRow[];
    return rows.map(toFood);
  }

  async createFood(input: FoodInput): Promise<Food> {
    const userId = await this.requireUserId();
    const row = unwrap(
      await this.client
        .from('nutrition_foods')
        .insert({ user_id: userId, ...foodColumns(input) })
        .select()
        .single(),
    ) as FoodRow;
    return toFood(row);
  }

  async updateFood(id: string, patch: Partial<FoodInput>) {
    const { error } = await this.client.from('nutrition_foods').update(foodColumns(patch)).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteFood(id: string) {
    // `on delete set null` sur `food_id` : les entrées du journal restent.
    const { error } = await this.client.from('nutrition_foods').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async listEntries(from: string, to: string): Promise<Entry[]> {
    const rows = unwrap(
      await this.client
        .from('nutrition_entries')
        .select('*')
        .gte('day', from)
        .lte('day', to)
        .order('created_at', { ascending: true }),
    ) as EntryRow[];
    return rows.map(toEntry);
  }

  async createEntry(input: EntryInput, id?: string): Promise<Entry> {
    const userId = await this.requireUserId();
    if (id) {
      // Rejouable : `on conflict do nothing` sur l'id, puis relecture. Un
      // second envoi de la même entrée ne crée rien et rend la première.
      const { error } = await this.client
        .from('nutrition_entries')
        .upsert({ id, user_id: userId, ...entryColumns(input) }, { onConflict: 'id', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
      const saved = unwrap(
        await this.client.from('nutrition_entries').select('*').eq('id', id).single(),
      ) as EntryRow;
      return toEntry(saved);
    }
    const row = unwrap(
      await this.client
        .from('nutrition_entries')
        .insert({ user_id: userId, ...entryColumns(input) })
        .select()
        .single(),
    ) as EntryRow;
    return toEntry(row);
  }

  async updateEntry(id: string, patch: Partial<EntryInput>) {
    const { error } = await this.client.from('nutrition_entries').update(entryColumns(patch)).eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteEntry(id: string) {
    const { error } = await this.client.from('nutrition_entries').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async listTargets(): Promise<Target[]> {
    const rows = unwrap(
      await this.client
        .from('nutrition_targets')
        .select('*')
        .order('effective_from', { ascending: true }),
    ) as TargetRow[];
    return rows.map(toTarget);
  }

  async setTarget(input: TargetInput): Promise<Target> {
    const userId = await this.requireUserId();
    // La contrainte unique `(user_id, effective_from)` fait du remplacement
    // d'un objectif du même jour une simple mise à jour.
    const row = unwrap(
      await this.client
        .from('nutrition_targets')
        .upsert(
          {
            user_id: userId,
            effective_from: input.effectiveFrom,
            protein_g: input.proteinG,
            carbs_g: input.carbsG,
            fat_g: input.fatG,
          },
          { onConflict: 'user_id,effective_from' },
        )
        .select()
        .single(),
    ) as TargetRow;
    return toTarget(row);
  }

  async deleteTarget(id: string) {
    const { error } = await this.client.from('nutrition_targets').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  async exportData(): Promise<NutritionBackup> {
    const entries = unwrap(await this.client.from('nutrition_entries').select('*')) as EntryRow[];
    return {
      foods: await this.listFoods(),
      entries: entries.map(toEntry),
      targets: await this.listTargets(),
    };
  }

  /**
   * Remplace tout : plus simple et plus sûr qu'une fusion ligne à ligne,
   * cohérent avec le sens d'une restauration de sauvegarde. Les aliments
   * changent d'id à l'import (Supabase les régénère) : on reconstitue les
   * correspondances avant de réinsérer les entrées qui les référencent.
   */
  async importData(data: NutritionBackup) {
    const userId = await this.requireUserId();
    await this.client.from('nutrition_entries').delete().eq('user_id', userId);
    await this.client.from('nutrition_foods').delete().eq('user_id', userId);
    await this.client.from('nutrition_targets').delete().eq('user_id', userId);

    const foodIdMap = new Map<string, string>();
    for (const food of data.foods ?? []) {
      const row = unwrap(
        await this.client
          .from('nutrition_foods')
          .insert({ user_id: userId, ...foodColumns(food) })
          .select()
          .single(),
      ) as FoodRow;
      foodIdMap.set(food.id, row.id);
    }

    for (const entry of data.entries ?? []) {
      // Un aliment disparu n'emporte pas l'entrée : elle perd juste sa
      // référence, comme après une suppression ordinaire.
      const foodId = entry.foodId ? (foodIdMap.get(entry.foodId) ?? null) : null;
      const { error } = await this.client
        .from('nutrition_entries')
        .insert({ user_id: userId, ...entryColumns({ ...entry, foodId }) });
      if (error) throw new Error(error.message);
    }

    for (const target of data.targets ?? []) {
      const { error } = await this.client.from('nutrition_targets').insert({
        user_id: userId,
        effective_from: target.effectiveFrom,
        protein_g: target.proteinG,
        carbs_g: target.carbsG,
        fat_g: target.fatG,
      });
      if (error) throw new Error(error.message);
    }
  }
}
