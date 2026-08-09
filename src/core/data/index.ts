import type { CoreStore } from './coreStore';
import { LocalCore } from './localCore';
import { SupabaseCore } from './supabaseCore';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Point de bascule unique entre les deux modes, pour le socle **et** pour
 * les modules : `isRemote` leur dit quelle implémentation choisir, et il n'y
 * a ainsi qu'un seul endroit à lire les variables d'environnement.
 */
export const isRemote = Boolean(url && anonKey);
export const supabaseConfig = isRemote ? { url: url as string, anonKey: anonKey as string } : null;

export const coreStore: CoreStore = supabaseConfig
  ? new SupabaseCore(supabaseConfig.url, supabaseConfig.anonKey)
  : new LocalCore();

export type { CoreStore };
