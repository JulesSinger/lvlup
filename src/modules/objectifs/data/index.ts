import { supabaseConfig } from '../../../core/data';
import type { GoalsStore } from './goalsStore';
import { LocalGoals } from './localGoals';
import { SupabaseGoals } from './supabaseGoals';

/** Même bascule que le socle : le module ne relit pas les variables d'env. */
export const goalsStore: GoalsStore = supabaseConfig
  ? new SupabaseGoals(supabaseConfig.url, supabaseConfig.anonKey)
  : new LocalGoals();

export type { GoalsStore };
