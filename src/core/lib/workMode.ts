/**
 * Le mode « au travail » (demande de Jules, 14/10/2026) — bibliothèque pure.
 *
 * Un interrupteur du compte (`Settings.workMode`) : seuls les modules choisis
 * (`Settings.workModules`) restent visibles, partout où le socle les liste
 * (barre, grille, « Tes modules », réglages), et leurs services avec eux — un
 * calque du calendrier d'un module caché disparaît aussi. Chaque module
 * visible lit `settings.workMode` et décide de ce qu'il montre.
 *
 * C'est un affichage, pas une protection : les données restent chargées.
 */

/**
 * Les modules visibles : sans ceux que le compte a cachés (15/10/2026), puis,
 * au travail, seulement ceux du mode travail. Ni l'un ni l'autre ne vide la
 * liste : un filtre qui ne laisserait rien garde tout, plutôt qu'un écran vide.
 */
export function visibleModules<T extends { id: string }>(
  modules: readonly T[],
  settings: { workMode: boolean; workModules: readonly string[]; hiddenModules?: readonly string[] | null },
): T[] {
  const hidden = settings.hiddenModules ?? [];
  const kept = modules.filter((m) => !hidden.includes(m.id));
  const base = kept.length > 0 ? kept : [...modules];
  if (!settings.workMode) return base;
  const shown = base.filter((m) => settings.workModules.includes(m.id));
  return shown.length > 0 ? shown : base;
}

/** Les modules proposés d'office à un compte tout neuf : les plus utiles au quotidien. */
export const STARTER_MODULES = ['taches', 'calendrier', 'courses'] as const;

/** Ce qu'il faut cacher pour ne garder que `chosen` (au moins un : sinon rien n'est caché). */
export function hiddenAfterChoice(allIds: readonly string[], chosen: readonly string[]): string[] {
  const kept = allIds.filter((id) => chosen.includes(id));
  return kept.length > 0 ? allIds.filter((id) => !chosen.includes(id)) : [];
}
