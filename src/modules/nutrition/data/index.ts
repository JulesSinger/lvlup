import { supabaseConfig } from '../../../core/data';
import type { NutritionStore } from './nutritionStore';
import { LocalNutrition } from './localNutrition';
import { SupabaseNutrition } from './supabaseNutrition';

/** Même bascule que le socle : le module ne relit pas les variables d'env. */
export const nutritionStore: NutritionStore = supabaseConfig
  ? new SupabaseNutrition(supabaseConfig.url, supabaseConfig.anonKey)
  : new LocalNutrition();

export type { NutritionStore };
