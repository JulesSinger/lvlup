/**
 * Le catalogue pendant la saisie — bibliothèque pure (étape 3). Taper un
 * nom doit retrouver l'article qu'on a déjà, jamais en créer un double :
 * c'est lui qui porte la récurrence, le rayon et l'historique des prix.
 */
import { normalize } from './aisles';
import { isDue } from './trip';
import type { Item, ListEntry } from './types';

/** L'article du catalogue qui porte ce nom, à la casse et aux accents près. */
export function findItemByName(items: readonly Item[], name: string): Item | null {
  const key = normalize(name);
  if (!key) return null;
  return items.find((i) => normalize(i.name) === key) ?? null;
}

/**
 * Les articles connus à proposer pendant la frappe : ceux qui ne sont pas
 * déjà sur la liste, dont un mot commence par chaque mot tapé. Sans rien
 * taper : les habituels dus d'abord, puis les autres. Les habituels passent
 * toujours devant, puis l'ordre alphabétique.
 */
export function suggestItems(
  items: readonly Item[],
  entries: readonly ListEntry[],
  query: string,
  nextTrip: number,
  limit = 8,
): Item[] {
  const onList = new Set(entries.map((e) => e.itemId));
  const tokens = normalize(query).split(' ').filter(Boolean);
  const matches = items.filter((item) => {
    if (onList.has(item.id)) return false;
    const words = normalize(item.name).split(' ');
    return tokens.every((t) => words.some((w) => w.startsWith(t)));
  });
  const rank = (i: Item) => (isDue(i, nextTrip) ? 0 : i.recurrence !== null ? 1 : 2);
  return matches
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name, 'fr'))
    .slice(0, limit);
}
