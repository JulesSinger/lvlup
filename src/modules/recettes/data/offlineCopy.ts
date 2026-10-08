import type { Cooked, PlanEntry, Recipe, RecipePhoto } from '../lib/types';

/**
 * La dernière copie du carnet, gardée sur l'appareil pour le lire sans réseau
 * (docs/etude-recettes.md §7, §19) — cuisine sans Wi-Fi, vacances. En lecture
 * seule : rien ne s'écrit hors ligne (on cuisine chez soi). Seulement avec un
 * compte ; sans compte, tout est déjà sur l'appareil.
 *
 * `recettes.offline.v1` est un identifiant de stockage (CLAUDE.md §4) ; le
 * perdre ne coûte rien de grave — la copie se refait au prochain chargement.
 */
export const OFFLINE_KEY = 'recettes.offline.v1';

export interface OfflineCopy {
  savedAt: string;
  recipes: Recipe[];
  photos: RecipePhoto[];
  cooked: Cooked[];
  plan: PlanEntry[];
}

export function saveOfflineCopy(copy: Omit<OfflineCopy, 'savedAt'>, storage: Storage | undefined = globalThis.localStorage, now = new Date()): void {
  try {
    storage?.setItem(OFFLINE_KEY, JSON.stringify({ ...copy, savedAt: now.toISOString() }));
  } catch {
    // Stockage plein ou refusé : pas de copie hors ligne, le carnet marche quand même.
  }
}

export function readOfflineCopy(storage: Storage | undefined = globalThis.localStorage): OfflineCopy | null {
  try {
    const raw = storage?.getItem(OFFLINE_KEY);
    if (!raw) return null;
    const copy = JSON.parse(raw) as Partial<OfflineCopy>;
    if (!Array.isArray(copy.recipes) || typeof copy.savedAt !== 'string') return null;
    return { savedAt: copy.savedAt, recipes: copy.recipes, photos: copy.photos ?? [], cooked: copy.cooked ?? [], plan: copy.plan ?? [] };
  } catch {
    return null;
  }
}
