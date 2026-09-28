/**
 * Réordonner à la main — bibliothèque pure (étape 4). Le glisser-déposer
 * ne fait que déplacer un identifiant dans une liste ; ce fichier dit quelles
 * positions écrire, et seulement celles qui changent.
 */
import type { Task } from './types';

/** `ids` avec l'élément `from` déplacé à l'indice `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

/** Les positions à écrire pour que `orderedIds` soit l'ordre : 0, 1, 2… — seulement celles qui diffèrent. */
export function positionPatches(tasks: readonly Task[], orderedIds: readonly string[]): { id: string; position: number }[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  return orderedIds.flatMap((id, position) => (byId.get(id)?.position === position ? [] : [{ id, position }]));
}
