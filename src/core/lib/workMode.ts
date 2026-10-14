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

/** Les modules visibles : tous, ou ceux du mode travail. Un mode travail sans aucun module garde tout (rien ne disparaît par erreur). */
export function visibleModules<T extends { id: string }>(modules: readonly T[], settings: { workMode: boolean; workModules: readonly string[] }): T[] {
  if (!settings.workMode) return [...modules];
  const shown = modules.filter((m) => settings.workModules.includes(m.id));
  return shown.length > 0 ? shown : [...modules];
}
