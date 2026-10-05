import { supabaseConfig } from '../../../core/data';
import { LocalProjets } from './localProjets';
import type { ProjetsStore } from './projetsStore';
import { SupabaseProjets } from './supabaseProjets';

/** Même bascule que le socle : le module ne relit pas les variables d'env. */
export const projetsStore: ProjetsStore = supabaseConfig
  ? new SupabaseProjets(supabaseConfig.url, supabaseConfig.anonKey)
  : new LocalProjets();

export type { ProjetsStore };
