/**
 * Les modèles de liste — règles pures (docs/etude-courses.md §20).
 *
 * Remplir la liste avec un modèle suit la règle de toute la liste : **une
 * seule ligne par article**. Un article déjà sur la liste n'est pas ajouté une
 * seconde fois ; sa quantité est complétée (« 2 » + « 1 » → « 2 + 1 ») et il
 * repasse « à prendre » s'il était déjà dans le panier — il en faut encore.
 * Sans quantité dans le modèle, il n'y a rien à compléter : la ligne reste
 * telle quelle.
 */
import { joinNote, mergeQuantity, NOTE_MAX, QUANTITY_MAX } from './listMerge';
import type { Item, ListEntry, TemplateLine } from './types';

/** Les lignes d'un modèle, dans leur ordre. */
export function linesOf(lines: readonly TemplateLine[], templateId: string): TemplateLine[] {
  return lines.filter((l) => l.templateId === templateId).sort((a, b) => a.position - b.position);
}

export interface TemplatePlan {
  /** Articles à mettre sur la liste. */
  add: { itemId: string; quantity: string; note: string }[];
  /** Lignes déjà sur la liste, complétées. */
  merge: { entryId: string; quantity: string; note: string }[];
  /** Déjà sur la liste, rien à compléter. */
  already: number;
}

/**
 * Ce que remplir la liste avec ces lignes écrirait. `skip` : les lignes
 * décochées dans l'aperçu (« j'en ai encore »). Une ligne dont l'article a
 * disparu du catalogue est ignorée.
 */
export function templatePlan(
  lines: readonly TemplateLine[],
  entries: readonly ListEntry[],
  items: readonly Item[],
  skip: ReadonlySet<string> = new Set(),
): TemplatePlan {
  const known = new Map(items.map((i) => [i.id, i]));
  const onList = new Map(entries.map((e) => [e.itemId, e]));
  const plan: TemplatePlan = { add: [], merge: [], already: 0 };
  // Deux lignes du même article dans un modèle : la seconde complète la première.
  const added = new Map<string, { itemId: string; quantity: string; note: string }>();
  for (const line of lines) {
    if (skip.has(line.id)) continue;
    const item = known.get(line.itemId);
    if (!item) continue;
    const quantity = line.quantity.trim();
    const note = line.note.trim();
    const pending = added.get(item.id);
    if (pending) {
      const next = mergeQuantity(pending.quantity, quantity, pending.note);
      pending.quantity = next.quantity;
      pending.note = joinNote(next.note, note);
      continue;
    }
    const entry = onList.get(item.id);
    if (entry) {
      if (!quantity && !note) {
        plan.already += 1;
        continue;
      }
      const next = mergeQuantity(entry.quantity, quantity, entry.note);
      plan.merge.push({ entryId: entry.id, quantity: next.quantity, note: joinNote(next.note, note) });
      continue;
    }
    const row = { itemId: item.id, quantity: (quantity || item.defaultQuantity).slice(0, QUANTITY_MAX), note: note.slice(0, NOTE_MAX) };
    added.set(item.id, row);
    plan.add.push(row);
  }
  return plan;
}

/** Enregistrer la liste en cours comme modèle : ses articles, quantités et notes, dans l'ordre d'ajout. */
export function linesFromList(entries: readonly ListEntry[]): { itemId: string; quantity: string; note: string }[] {
  const seen = new Set<string>();
  return [...entries]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .filter((e) => (seen.has(e.itemId) ? false : (seen.add(e.itemId), true)))
    .map((e) => ({ itemId: e.itemId, quantity: e.quantity, note: e.note }));
}
