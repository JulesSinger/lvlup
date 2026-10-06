/**
 * Réordonner à la main — bibliothèque pure. Le glisser-déposer ne fait que
 * déplacer un identifiant dans une liste ; ce fichier dit quelles positions
 * écrire, et seulement celles qui changent.
 *
 * Écrit pour les listes de Tâches, remonté au socle le 06/10/2026 quand
 * Objectifs a eu besoin de réordonner ses tuiles (CLAUDE.md §3 : une pièce
 * dont deux modules ont besoin appartient au socle).
 */

/** `ids` avec l'élément `from` déplacé à l'indice `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

/** Les positions à écrire pour que `orderedIds` soit l'ordre : 0, 1, 2… — seulement celles qui diffèrent. */
export function positionPatches(
  items: readonly { id: string; position: number }[],
  orderedIds: readonly string[],
): { id: string; position: number }[] {
  const byId = new Map(items.map((t) => [t.id, t]));
  return orderedIds.flatMap((id, position) => (byId.get(id)?.position === position ? [] : [{ id, position }]));
}
