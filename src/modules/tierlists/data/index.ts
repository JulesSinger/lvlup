import { supabaseConfig } from '../../../core/data';
import { LocalTierlists } from './localTierlists';
import { SupabaseTierlists } from './supabaseTierlists';
import type { TierlistsStore } from './tierlistsStore';

/** Même bascule que le socle : le module ne relit pas les variables d'env. */
export const tierlistsStore: TierlistsStore = supabaseConfig
  ? new SupabaseTierlists(supabaseConfig.url, supabaseConfig.anonKey)
  : new LocalTierlists();

export type { TierlistsStore };
