/**
 * L'ordre des modules choisi à la main (demande de Jules, 13/10/2026) :
 * glissés dans la barre de gauche ou la grille des modules. Bibliothèque pure.
 *
 * L'ordre est une liste d'identifiants rangée dans les réglages du compte
 * (`Settings.moduleOrder`), pas une position sur chaque module : le registre
 * reste la seule liste des modules, l'ordre n'en est qu'une lecture.
 */

/**
 * Les modules dans l'ordre choisi. Un module absent de l'ordre (ajouté depuis)
 * vient à la fin, dans l'ordre du registre ; un identifiant qui ne correspond
 * plus à aucun module est ignoré. Sans ordre choisi, celui du registre.
 */
export function orderModules<T extends { id: string }>(modules: readonly T[], order: readonly string[]): T[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return modules
    .map((m, i) => ({ m, i }))
    .sort((a, b) => (rank.get(a.m.id) ?? order.length + a.i) - (rank.get(b.m.id) ?? order.length + b.i))
    .map(({ m }) => m);
}

/**
 * Un nouvel ordre pour une partie seulement des modules (le mode travail n'en
 * montre que quelques-uns) : ils prennent leurs nouvelles places parmi les
 * leurs, et les autres ne bougent pas.
 */
export function reorderSubset(all: readonly string[], subset: readonly string[]): string[] {
  const moved = new Set(subset);
  let next = 0;
  return all.map((id) => (moved.has(id) ? subset[next++] : id));
}

export interface Box {
  left: number;
  top: number;
  width: number;
  bottom: number;
}

/**
 * La place visée par le pointeur, en ordre de lecture, parmi les autres
 * éléments (celui qu'on tient exclu) : ceux d'une rangée au-dessus du pointeur,
 * plus ceux de sa rangée à sa gauche. Vaut pour une colonne comme pour une grille.
 */
export function dropIndex(others: readonly Box[], x: number, y: number): number {
  return others.filter((box) => box.bottom < y || (box.top <= y && box.left + box.width / 2 < x)).length;
}
