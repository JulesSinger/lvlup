/**
 * L'unique blob du mode local.
 *
 * La clé `palier.v1` porte le nom du tout premier prototype et ne doit pas
 * changer : la renommer effacerait les données de tous les usages existants.
 *
 * Le socle ne connaît que la section `settings` ; chaque module lit et écrit
 * les siennes. D'où la lecture-modification-écriture d'un enregistrement
 * libre plutôt qu'un type fermé : sans ça, le socle écraserait les sections
 * qu'il ne connaît pas.
 */
const KEY = 'palier.v1';

export type RawSnapshot = Record<string, unknown>;

export function readRaw(): RawSnapshot {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as RawSnapshot) : {};
  } catch {
    return {};
  }
}

export function writeRaw(snapshot: RawSnapshot) {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.error('Sauvegarde locale impossible', error);
  }
}
