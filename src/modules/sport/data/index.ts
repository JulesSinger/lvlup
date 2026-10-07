import { supabaseConfig } from '../../../core/data';
import { LocalSport } from './localSport';
import type { SportStore } from './sportStore';
import { SupabaseSport } from './supabaseSport';

/** Même bascule que le socle : le module ne relit pas les variables d'env. */
export const sportStore: SportStore = supabaseConfig
  ? new SupabaseSport(supabaseConfig.url, supabaseConfig.anonKey)
  : new LocalSport();

export type { SportStore };
