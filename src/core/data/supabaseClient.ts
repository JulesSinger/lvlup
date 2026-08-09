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

