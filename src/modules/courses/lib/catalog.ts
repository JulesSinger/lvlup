/**
 * Le catalogue pendant la saisie — bibliothèque pure (étape 3). Taper un
 * nom doit retrouver l'article qu'on a déjà, jamais en créer un double :
 * c'est lui qui porte la récurrence, le rayon et l'historique des prix.
 */
import { normalize } from './aisles';
import { isDue } from './trip';
import type { Item, ListEntry, Store, Trip } from './types';

/** L'article du catalogue qui porte ce nom, à la casse et aux accents près. */
export function findItemByName(items: readonly Item[], name: string): Item | null {
  const key = normalize(name);
  if (!key) return null;
  return items.find((i) => normalize(i.name) === key) ?? null;
}

/**
 * Le même article, au pluriel près : « oignons jaunes » retrouve « Oignon
 * jaune ». Pour les lignes qui viennent d'une recette (service `shopping`),
 * écrites autrement que dans le catalogue. Le nom exact passe d'abord.
 */
export function findItemLoosely(items: readonly Item[], name: string): Item | null {
  const exact = findItemByName(items, name);
  if (exact) return exact;
  const singular = (text: string) =>
    normalize(text)
      .split(' ')
      .map((w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w))
      .join(' ');
  const key = singular(name);
  if (!key) return null;
  return items.find((i) => singular(i.name) === key) ?? null;
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

/** Le magasin qui porte ce nom, à la casse et aux accents près. */
export function findStoreByName(stores: readonly Store[], name: string): Store | null {
  const key = normalize(name);
  if (!key) return null;
  return stores.find((s) => normalize(s.name) === key) ?? null;
}

/**
 * Les magasins, le plus fréquenté d'abord (nombre de courses), puis le plus
 * récemment visité, puis par nom — ceux qu'on propose en terminant une
 * course. Le premier est le choix par défaut.
 */
export function storesByUse(stores: readonly Store[], trips: readonly Trip[]): Store[] {
  const count = new Map<string, number>();
  const last = new Map<string, number>();
  for (const t of trips) {
    if (!t.storeId) continue;
    count.set(t.storeId, (count.get(t.storeId) ?? 0) + 1);
    last.set(t.storeId, Math.max(last.get(t.storeId) ?? 0, t.number));
  }
  return stores
    .slice()
    .sort(
      (a, b) =>
        (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0) ||
        (last.get(b.id) ?? 0) - (last.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name, 'fr'),
    );
}
