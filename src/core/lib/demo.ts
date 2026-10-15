/**
 * Le mode démo (demande de Jules, 15/10/2026) — bibliothèque pure, ou presque :
 * elle lit l'adresse au chargement, une fois.
 *
 * `?demo=taches` ouvre Atlas sur des données d'exemple du module, rangées à
 * part dans le navigateur (`atlas.demo.v1`, jamais `palier.v1` ni le compte) :
 * `core/data/index.ts` bascule alors tout en mode local. Les exemples sont
 * recréés à chaque ouverture ; quitter recharge l'app normale.
 */

const ID = /^[a-z]{2,20}$/;

/** Le module de la démo en cours, lu dans une adresse (`?demo=taches`), ou `null`. */
export function demoFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get('demo');
  return id && ID.test(id) ? id : null;
}

/** La démo en cours, lue une fois au chargement. */
export const demoModuleId: string | null = typeof window === 'undefined' ? null : demoFromSearch(window.location.search);

/** Où vivent les données de la démo, à part de celles du mode local. */
export const DEMO_SNAPSHOT_KEY = 'atlas.demo.v1';

/** L'adresse qui ouvre la démo d'un module. */
export function demoHref(moduleId: string, location: { pathname: string } = window.location): string {
  return `${location.pathname}?demo=${moduleId}#/${moduleId}`;
}

/** L'adresse pour quitter la démo, sur le même module, dans l'app normale. */
export function exitDemoHref(moduleId: string, location: { pathname: string } = window.location): string {
  return `${location.pathname}#/${moduleId}`;
}

/**
 * Les modules dont la démo a déjà été proposée sur cet appareil : elle ne
 * l'est qu'à la première ouverture. Rien de grave si la liste se perd : la
 * proposition revient une fois.
 */
export const DEMOS_SEEN_KEY = 'atlas.demos.seen.v1';

export function readSeenDemos(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DEMOS_SEEN_KEY) ?? '[]') as unknown;
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function markDemoSeen(moduleId: string) {
  try {
    const seen = readSeenDemos();
    if (!seen.includes(moduleId)) localStorage.setItem(DEMOS_SEEN_KEY, JSON.stringify([...seen, moduleId]));
  } catch {
    // Navigation privée : la proposition reviendra, rien de plus.
  }
}

/** Le jour d'aujourd'hui en AAAA-MM-JJ, heure locale : les exemples se datent par rapport à lui. */
export function todayString(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
