import { DEMO_SNAPSHOT_KEY, demoModuleId } from '../lib/demo';

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
 *
 * En démo (`?demo=…`), le blob est un autre (`atlas.demo.v1`) : les exemples
 * ne touchent jamais les vraies données du mode local.
 */
const KEY = demoModuleId === null ? 'palier.v1' : DEMO_SNAPSHOT_KEY;

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
