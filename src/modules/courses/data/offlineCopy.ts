import type { CourseData } from './courseOutbox';

/**
 * La dernière copie de Courses, gardée sur l'appareil pour ouvrir la liste
 * sans réseau (09/11/2026 — au fond d'un hypermarché). Seulement avec un
 * compte ; sans compte, tout est déjà sur l'appareil.
 *
 * `courses.offline.v1` est un identifiant de stockage (CLAUDE.md §4). La
 * perdre ne coûte rien de grave : la copie se refait au prochain chargement
 * réussi. Ce qui n'est pas encore parti vit dans la file (`courses.outbox.v1`),
 * jamais ici.
 */
export const COURSES_OFFLINE_KEY = 'courses.offline.v1';

export interface OfflineCopy extends CourseData {
  savedAt: string;
}

export function saveOfflineCopy(data: CourseData, storage: Storage | undefined = globalThis.localStorage, now = new Date()): void {
  try {
    storage?.setItem(COURSES_OFFLINE_KEY, JSON.stringify({ ...data, savedAt: now.toISOString() }));
  } catch {
    // Stockage plein ou refusé : pas de copie, Courses marche quand même avec du réseau.
  }
}

export function readOfflineCopy(storage: Storage | undefined = globalThis.localStorage): OfflineCopy | null {
  try {
    const raw = storage?.getItem(COURSES_OFFLINE_KEY);
    if (!raw) return null;
    const copy = JSON.parse(raw) as Partial<OfflineCopy>;
    if (!Array.isArray(copy.entries) || !Array.isArray(copy.items) || typeof copy.savedAt !== 'string') return null;
    return {
      savedAt: copy.savedAt,
      items: copy.items,
      entries: copy.entries,
      stores: copy.stores ?? [],
      trips: copy.trips ?? [],
      tripItems: copy.tripItems ?? [],
    };
  } catch {
    return null;
  }
}

/** À la déconnexion : la copie appartenait au compte qui part (docs/securite.md §3). */
export function forgetOfflineCopy(storage: Storage | undefined = globalThis.localStorage): void {
  try {
    storage?.removeItem(COURSES_OFFLINE_KEY);
  } catch {
    // Stockage refusé : il n'y avait pas de copie.
  }
}
