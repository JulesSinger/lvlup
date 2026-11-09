import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { isNetworkError } from './outbox';

/**
 * Un seul client pour toute l'application.
 *
 * Chaque `createClient` ouvre sa propre écoute de session ; en instancier un
 * par module ferait diverger l'état d'authentification entre eux.
 */
let client: SupabaseClient | null = null;

export function getClient(url: string, anonKey: string): SupabaseClient {
  if (!client) client = createClient(url, anonKey);
  return client;
}

/**
 * Un client à part, en mémoire, pour redemander le mot de passe sans toucher à
 * la session ouverte (supprimer son compte, docs/securite.md §8) : se
 * reconnecter avec le client partagé ferait redescendre la session au premier
 * niveau de la double authentification, et l'app afficherait l'écran du code
 * au milieu de l'opération.
 */
export function isolatedClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'atlas-reauth' },
  });
}

export async function requireUserId(sb: SupabaseClient): Promise<string> {
  const { data, error } = await sb.auth.getUser();
  if (data.user) return data.user.id;
  // Sans réseau, `getUser` (qui interroge le serveur) échoue : ce n'est pas une
  // session expirée. Le compte de la session gardée sur l'appareil suffit — la
  // base vérifie de toute façon le jeton (RLS) — et surtout, l'erreur doit
  // rester une **panne de réseau** pour que l'écriture parte en file au lieu
  // d'être refusée (Courses à Auchan, 09/11/2026 ; vaut aussi pour Tâches et Nutrition).
  if (error && (error.name === 'AuthRetryableFetchError' || isNetworkError(error))) {
    const { data: local } = await sb.auth.getSession();
    if (local.session?.user) return local.session.user.id;
    throw new TypeError('Failed to fetch');
  }
  throw new Error('Session expirée, reconnecte-toi.');
}

export function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}


/** Ce que Supabase rend au plus par requête, dans sa configuration par défaut (« Max rows »). */
export const PAGE_SIZE = 1000;

/**
 * Lit TOUTES les lignes d'une requête, par paquets de `PAGE_SIZE`.
 *
 * Sans ça, une table qui dépasse 1 000 lignes est tronquée en silence : la
 * requête « réussit » et rend les 1 000 premières. Le budget l'atteint en
 * moins d'un an d'import bancaire (constat du 2026-10-07). `page` construit
 * la requête d'un paquet ; elle doit être triée de façon STABLE (un tri qui
 * finit par l'identifiant), sinon une ligne pourrait passer d'un paquet à
 * l'autre et être lue deux fois, ou jamais.
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const batch = unwrap(await page(from, from + PAGE_SIZE - 1)) ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}
