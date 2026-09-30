/**
 * Où l'on est dans Atlas : le module ouvert, dit par l'adresse (`#/budget`)
 * et retenu sur l'appareil.
 *
 * Demande de Jules (30/09/2026) : passer d'un module à l'autre sans repasser
 * par la liste, rouvrir Atlas là où on l'a laissé, et que le geste « retour »
 * ramène au module précédent. L'adresse porte le module pour que le retour
 * du navigateur et un rechargement le retrouvent ; l'appareil retient le
 * dernier, pour qu'une ouverture sans adresse (l'icône de l'écran d'accueil)
 * y revienne.
 *
 * Seuls les hashes qui commencent par `#/` sont à nous. Supabase se sert de
 * l'adresse pour ses liens (`#access_token=…&type=recovery`, le mot de passe
 * oublié) : ceux-là, on ne les lit pas et on ne les écrase jamais.
 */

/** Identifiant de stockage : ne jamais le renommer (CLAUDE.md §4). */
export const LAST_MODULE_KEY = 'atlas.module.v1';

/**
 * Le module que dit l'adresse : son identifiant, `null` pour la liste des
 * modules (`#/`), ou `undefined` quand l'adresse ne dit rien de la route
 * (pas de hash, un hash de Supabase…). Un module inconnu vaut la liste.
 */
export function routeFromHash(hash: string, ids: readonly string[]): string | null | undefined {
  if (!hash.startsWith('#/')) return undefined;
  const id = decodeURIComponent(hash.slice(2).split(/[/?#]/)[0] ?? '');
  if (!id) return null;
  return ids.includes(id) ? id : null;
}

export function hashFor(id: string | null): string {
  return id ? `#/${encodeURIComponent(id)}` : '#/';
}

/**
 * Le module à ouvrir au démarrage : celui de l'adresse s'il y en a un, sinon
 * le dernier retenu sur l'appareil, sinon la liste. Avec un seul module, on y
 * entre toujours (l'écran de choix n'a de sens qu'à partir de deux).
 */
export function initialModule(hash: string, stored: string | null, ids: readonly string[]): string | null {
  if (ids.length === 1) return ids[0];
  const fromHash = routeFromHash(hash, ids);
  if (fromHash !== undefined) return fromHash;
  return stored && ids.includes(stored) ? stored : null;
}

export function readLastModule(): string | null {
  try {
    return localStorage.getItem(LAST_MODULE_KEY);
  } catch {
    return null;
  }
}

export function saveLastModule(id: string | null) {
  try {
    if (id) localStorage.setItem(LAST_MODULE_KEY, id);
    else localStorage.removeItem(LAST_MODULE_KEY);
  } catch {
    // Stockage refusé (navigation privée…) : Atlas rouvrira simplement sur la liste.
  }
}
