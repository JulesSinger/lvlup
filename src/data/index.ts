import { LocalStore } from './localStore';
import type { Store } from './store';
import { SupabaseStore } from './supabaseStore';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Point de bascule unique entre les deux modes.
 *
 * Sans variables d'environnement, l'app tourne en local dans le navigateur.
 * Dès que `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` sont renseignées,
 * elle passe en multi-utilisateur avec comptes, sans autre changement de code.
 */
export const store: Store = url && anonKey ? new SupabaseStore(url, anonKey) : new LocalStore();

export type { Store };
