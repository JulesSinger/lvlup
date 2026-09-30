import { supabaseConfig } from '../../../core/data';
import type { HautsFaitsStore } from './hautsFaitsStore';
import { LocalHautsFaits } from './localHautsFaits';
import { SupabaseHautsFaits } from './supabaseHautsFaits';

/** Même bascule que le socle : le module ne relit pas les variables d'env. */
export const hautsFaitsStore: HautsFaitsStore = supabaseConfig
  ? new SupabaseHautsFaits(supabaseConfig.url, supabaseConfig.anonKey)
  : new LocalHautsFaits();

export type { HautsFaitsStore };
