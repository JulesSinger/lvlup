import { supabaseConfig } from '../../../core/data';
import { getClient } from '../../../core/data/supabaseClient';
import { base64ToFile, draftToInput } from '../lib/linkDraft';
import type { RecipeInput } from '../lib/types';

/**
 * Importer une recette depuis un lien, par la fonction `recettes-import`
 * (docs/etude-recettes.md §3.1, §16). Seulement avec un compte : sans
 * serveur, le navigateur ne peut pas lire la page d'un autre site.
 */
export const canImportFromLink = supabaseConfig !== null;

export async function importFromLink(url: string): Promise<{ draft: RecipeInput; photo: File | null }> {
  if (!supabaseConfig) throw new Error('Importer depuis un lien demande d’être connecté avec un compte.');
  const client = getClient(supabaseConfig.url, supabaseConfig.anonKey);
  const { data, error } = await client.functions.invoke('recettes-import', { body: { url: url.trim() } });
  if (error) {
    // La fonction répond une phrase toute prête ; on la montre telle quelle.
    const context = (error as { context?: Response }).context;
    const body = context && typeof context.json === 'function' ? await context.json().catch(() => null) : null;
    throw new Error(body?.error ?? 'L’import n’a pas abouti. La fonction est-elle déployée (supabase functions deploy recettes-import --no-verify-jwt) ?');
  }
  const draft = draftToInput((data as { draft?: unknown } | null)?.draft);
  if (!draft) throw new Error('Cette page ne décrit pas sa recette de façon lisible : copie le texte et colle-le.');
  const image = (data as { image?: { base64?: unknown; type?: unknown } | null }).image;
  const photo = image && typeof image.base64 === 'string' ? base64ToFile(image.base64, String(image.type ?? 'image/jpeg')) : null;
  return { draft, photo };
}
