import { supabaseConfig } from '../../../core/data';
import { LocalTaches } from './localTaches';
import { SupabaseTaches } from './supabaseTaches';
import type { TachesStore } from './tachesStore';

/** Même bascule que le socle : le module ne relit pas les variables d'env. */
export const tachesStore: TachesStore = supabaseConfig
  ? new SupabaseTaches(supabaseConfig.url, supabaseConfig.anonKey)
  : new LocalTaches();

export type { TachesStore };
