import { supabaseConfig } from '../../../core/data';
import { LocalRecettes } from './localRecettes';
import type { RecettesStore } from './recettesStore';
import { SupabaseRecettes } from './supabaseRecettes';

/** Même bascule que le socle : le module ne relit pas les variables d'env. */
export const recettesStore: RecettesStore = supabaseConfig
  ? new SupabaseRecettes(supabaseConfig.url, supabaseConfig.anonKey)
  : new LocalRecettes();

export type { RecettesStore };
