import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

export async function requireUserId(sb: SupabaseClient): Promise<string> {
  const { data } = await sb.auth.getUser();
  if (!data.user) throw new Error('Session expirée, reconnecte-toi.');
  return data.user.id;
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
